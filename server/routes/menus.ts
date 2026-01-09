import express from 'express';
import { query, DB_TYPE } from '../db';
import { requireAdmin, authenticateToken } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import * as xsenv from '@sap/xsenv';
import * as xssec from '@sap/xssec';

const router = express.Router();

// 디버그 모드 (환경 변수로 제어)
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

// XSUAA 설정 로드
const USE_XSUAA = process.env.USE_XSUAA === 'true' || process.env.VCAP_SERVICES !== undefined;
let xsuaaConfig: any = null;

if (USE_XSUAA) {
  try {
    const services: any = (xsenv as any).getServices ? (xsenv as any).getServices({ xsuaa: { label: 'xsuaa' } }) : null;
    if (services?.xsuaa) xsuaaConfig = services.xsuaa;
    
    if (!xsuaaConfig && process.env.VCAP_SERVICES) {
      const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      const xsuaaServices = vcapServices['xsuaa'] || [];
      if (xsuaaServices.length > 0) {
        xsuaaConfig = xsuaaServices[0].credentials;
      }
    }
  } catch (error) {
    console.warn('XSUAA 설정 로드 실패:', error);
  }
}

// XSUAA 토큰에서 사용자 정보 추출
async function extractUserInfoFromXSUAAToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!xsuaaConfig) {
      return reject(new Error('XSUAA 설정이 없습니다.'));
    }

    try {
      // JWT를 직접 파싱하여 토큰 정보 추출
      const decoded = jwt.decode(token, { complete: true }) as any;
      
      if (!decoded || !decoded.payload) {
        return reject(new Error('JWT 토큰 디코딩 실패'));
      }
      
      const payload = decoded.payload;
      const xsSystemAttributes = payload['xs.system.attributes'] || {};
      const samlGroups = xsSystemAttributes['xs.saml.groups'] || [];
      
      const userInfo = {
        userid: payload.user_name || payload.email || payload.sub,
        email: payload.email,
        givenName: payload.given_name,
        familyName: payload.family_name,
        isAdmin: false,
        scopes: Array.isArray(payload.scope) ? payload.scope : (payload.scope ? [payload.scope] : []),
        samlGroups: samlGroups
      };
      
      // xs.saml.groups에서 EAR-ADMIN 확인
      const hasAdminGroup = Array.isArray(samlGroups) && samlGroups.some((group: string) => 
        group.toUpperCase() === 'EAR-ADMIN' || group.toUpperCase() === 'EAR_ADMIN'
      );
      
      if (hasAdminGroup) {
        userInfo.isAdmin = true;
      }
      
      resolve(userInfo);
    } catch (error: any) {
      // xssec 폴백 시도
      try {
        xssec.createSecurityContext(token, xsuaaConfig, (error: any, ctx: any, tokenInfo: any) => {
          if (error) {
            return reject(error);
          }
          
          const xsSystemAttributes = tokenInfo['xs.system.attributes'] || {};
          const samlGroups = xsSystemAttributes['xs.saml.groups'] || [];
          
          const userInfo = {
            userid: tokenInfo.user_name || tokenInfo.email || tokenInfo.sub,
            email: tokenInfo.email,
            givenName: tokenInfo.given_name,
            familyName: tokenInfo.family_name,
            isAdmin: false,
            scopes: tokenInfo.scope || [],
            samlGroups: samlGroups
          };
          
          const hasAdminGroup = Array.isArray(samlGroups) && samlGroups.some((group: string) => 
            group.toUpperCase() === 'EAR-ADMIN' || group.toUpperCase() === 'EAR_ADMIN'
          );
          
          if (hasAdminGroup) {
            userInfo.isAdmin = true;
          }
          
          resolve(userInfo);
        });
      } catch (xssecError: any) {
        reject(xssecError);
      }
    }
  });
}

// 선택적 인증 - 토큰이 있으면 사용자 정보를 가져오고, 없으면 기본값 사용
const optionalAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    
    if (token) {
      // XSUAA 토큰 우선 시도
      if (USE_XSUAA && xsuaaConfig) {
        try {
          const userInfo = await extractUserInfoFromXSUAAToken(token);
          (req as any).user = userInfo;
          next();
          return;
        } catch (xsuaaError) {
          // XSUAA 파싱 실패 시 JWT 폴백
          console.warn('XSUAA 토큰 파싱 실패, JWT 폴백 시도:', (xsuaaError as any)?.message);
        }
      }
      
      // JWT 토큰 검증 (폴백)
      try {
        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        (req as any).user = {
          userId: decoded.userId,
          userid: decoded.userid,
          isAdmin: decoded.isAdmin || false,
          samlGroups: decoded.samlGroups || []
        };
      } catch (jwtError) {
        // 토큰이 유효하지 않으면 무시하고 계속 진행
        (req as any).user = null;
      }
    } else {
      (req as any).user = null;
    }
    next();
  } catch (error) {
    (req as any).user = null;
    next();
  }
};

// 메뉴 목록 조회 (계층 구조)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { includeInactive } = req.query;
    const user = (req as any).user;
    const isAdmin = user?.isAdmin || false;
    
    // 디버깅: 사용자 정보 로그 (디버그 모드에서만)
    if (DEBUG_AUTH) {
      console.log('🔍 /api/menus - 사용자 정보:', {
        hasUser: !!user,
        isAdmin: isAdmin,
        samlGroups: user?.samlGroups || 'N/A',
        userid: user?.userid || 'N/A'
      });
    }
    
    // 사용자의 samlGroups 기반 접근 가능한 메뉴 ID 목록 가져오기
    let accessibleMenuIds: number[] = [];
    if (user && user.samlGroups && Array.isArray(user.samlGroups)) {
      const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
      const userGroups = user.samlGroups.filter((g: string) => allowedGroups.includes(g));
      
      if (userGroups.length > 0) {
        try {
          if (DB_TYPE === 'postgres') {
            const mappingResult = await query(
              `SELECT DISTINCT menu_id 
               FROM group_menu_mappings 
               WHERE group_name = ANY($1) AND is_active = true`,
              [userGroups]
            );
            accessibleMenuIds = (mappingResult.rows || []).map((row: any) => row.menu_id);
          } else {
            const placeholders = userGroups.map(() => '?').join(',');
            const mappingResult = await query(
              `SELECT DISTINCT MENU_ID as menu_id 
               FROM EAR.group_menu_mappings 
               WHERE GROUP_NAME IN (${placeholders}) AND IS_ACTIVE = true`,
              userGroups
            );
            accessibleMenuIds = (mappingResult.rows || []).map((row: any) => parseInt(row.menu_id));
          }
        } catch (mappingError: any) {
          console.warn('그룹별 메뉴 매핑 조회 실패 (기본 메뉴 표시):', mappingError.message);
          // 매핑 조회 실패 시 모든 메뉴 표시 (하위 호환성)
        }
      }
    }
    
    let result;
    if (DB_TYPE === 'postgres') {
      const whereClause = includeInactive === 'true' ? '' : 'WHERE is_active = true';
      result = await query(
        `SELECT id, parent_id, menu_code, label, path, icon_name, description, display_order, is_active, admin_only, created_by, created_at, updated_at 
         FROM menus ${whereClause} 
         ORDER BY display_order ASC, id ASC`,
        []
      );
    } else {
      const whereClause = includeInactive === 'true' ? '' : 'WHERE IS_ACTIVE = true';
      result = await query(
        `SELECT ID as id, PARENT_ID as parent_id, MENU_CODE as menu_code, LABEL as label, PATH as path, 
                ICON_NAME as icon_name, DESCRIPTION as description, DISPLAY_ORDER as display_order, 
                IS_ACTIVE as is_active, ADMIN_ONLY as admin_only, CREATED_BY as created_by, 
                CREATED_AT as created_at, UPDATED_AT as updated_at 
         FROM EAR.menus ${whereClause} 
         ORDER BY DISPLAY_ORDER ASC, ID ASC`,
        []
      );
    }
    
    const menus = result.rows || [];
    
    // 메뉴 필터링: 관리자이거나 그룹별 매핑이 설정된 경우
    let filteredMenus: any[];
    console.log('🔍 메뉴 필터링 정보:', {
      isAdmin: isAdmin,
      accessibleMenuIdsCount: accessibleMenuIds.length,
      totalMenusCount: menus.length
    });
    
    if (isAdmin) {
      // 관리자는 모든 메뉴 접근 가능
      filteredMenus = menus;
      console.log('✅ 관리자 권한으로 모든 메뉴 표시:', menus.length);
    } else if (accessibleMenuIds.length > 0) {
      // 그룹별 매핑이 설정된 경우, 매핑된 메뉴만 표시
      filteredMenus = menus.filter((menu: any) => {
        const menuId = typeof menu.id === 'string' ? parseInt(menu.id) : menu.id;
        return accessibleMenuIds.includes(menuId);
      });
    } else {
      // 매핑이 없는 경우 모든 메뉴 표시 (그룹별 매핑이 설정되어야 접근 가능)
      filteredMenus = [];
    }
    
    // 계층 구조로 변환
    const menuMap = new Map<number, any>();
    const rootMenus: any[] = [];
    
    // 모든 메뉴을 맵에 추가 (ID를 숫자로 변환)
    filteredMenus.forEach((menu: any) => {
      menu.items = [];
      const menuId = typeof menu.id === 'string' ? parseInt(menu.id) : menu.id;
      menuMap.set(menuId, menu);
      // id도 숫자로 변환
      menu.id = menuId;
    });
    
    // 계층 구조 구성
    filteredMenus.forEach((menu: any) => {
      // parent_id를 숫자로 변환
      const parentId = menu.parent_id 
        ? (typeof menu.parent_id === 'string' ? parseInt(menu.parent_id) : menu.parent_id)
        : null;
      
      if (parentId) {
        const parent = menuMap.get(parentId);
        if (parent) {
          parent.items.push(menu);
        } else {
          // 부모를 찾지 못한 경우 로그 출력 (디버깅용)
          console.warn(`부모 메뉴를 찾을 수 없습니다. parent_id: ${parentId}, menu_code: ${menu.menu_code}`);
        }
      } else {
        rootMenus.push(menu);
      }
    });
    
    // 정렬
    const sortMenus = (menus: any[]) => {
      menus.sort((a, b) => a.display_order - b.display_order);
      menus.forEach(menu => {
        if (menu.items && menu.items.length > 0) {
          sortMenus(menu.items);
        }
      });
    };
    sortMenus(rootMenus);
    
    res.json({
      success: true,
      menus: rootMenus,
      flatMenus: filteredMenus
    });
  } catch (error: any) {
    console.error('메뉴 조회 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 경로별 메뉴 활성화 상태 확인 (라우트 가드용)
router.get('/check-path/:path', optionalAuth, async (req, res) => {
  try {
    const { path } = req.params;
    const decodedPath = decodeURIComponent(path);
    const user = (req as any).user;
    const isAdmin = user?.isAdmin || false;
    
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        'SELECT id, path, is_active, admin_only FROM menus WHERE path = $1',
        [decodedPath]
      );
    } else {
      result = await query(
        'SELECT ID as id, PATH as path, IS_ACTIVE as is_active, ADMIN_ONLY as admin_only FROM EAR.menus WHERE PATH = ?',
        [decodedPath]
      );
    }
    
    // 경로에 해당하는 메뉴가 없는 경우 (메뉴로 등록되지 않은 경로는 접근 허용)
    if (!result.rows || result.rows.length === 0) {
      return res.json({
        success: true,
        isActive: true,
        message: '메뉴로 등록되지 않은 경로입니다.'
      });
    }
    
    const menu = result.rows[0];
    const menuId = typeof menu.id === 'string' ? parseInt(menu.id) : menu.id;
    
    // 메뉴가 비활성화된 경우 (관리자 포함 모든 사용자 접근 불가)
    if (!menu.is_active) {
      return res.json({
        success: true,
        isActive: false,
        message: '비활성화된 메뉴입니다.'
      });
    }
    
    // 관리자는 그룹별 매핑 체크 없이 모든 활성화된 메뉴 접근 가능
    if (isAdmin) {
      return res.json({
        success: true,
        isActive: true,
        message: '활성화된 메뉴입니다.'
      });
    }
    
    // 사용자가 없는 경우 접근 불가
    if (!user) {
      return res.json({
        success: true,
        isActive: false,
        message: '인증이 필요합니다.'
      });
    }
    
    // 그룹별 메뉴 매핑 확인
    const samlGroups = user.samlGroups || [];
    const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
    const userGroups = samlGroups.filter((g: string) => allowedGroups.includes(g));
    
    // 허용된 그룹이 없는 경우 접근 불가
    if (userGroups.length === 0) {
      return res.json({
        success: true,
        isActive: false,
        message: '접근 권한이 없습니다.'
      });
    }
    
    // 사용자의 그룹이 해당 메뉴에 접근 권한이 있는지 확인
    let hasAccess = false;
    try {
      if (DB_TYPE === 'postgres') {
        const mappingResult = await query(
          `SELECT COUNT(*) as count
           FROM group_menu_mappings 
           WHERE menu_id = $1 AND group_name = ANY($2) AND is_active = true`,
          [menuId, userGroups]
        );
        const count = parseInt((mappingResult.rows || [])[0]?.count || '0');
        hasAccess = count > 0;
      } else {
        const placeholders = userGroups.map(() => '?').join(',');
        const mappingResult = await query(
          `SELECT COUNT(*) as count
           FROM EAR.group_menu_mappings 
           WHERE MENU_ID = ? AND GROUP_NAME IN (${placeholders}) AND IS_ACTIVE = true`,
          [menuId, ...userGroups]
        );
        const count = parseInt(((mappingResult.rows || [])[0] || (mappingResult as any)[0])?.count || '0');
        hasAccess = count > 0;
      }
    } catch (mappingError: any) {
      console.error('그룹별 메뉴 매핑 확인 오류:', mappingError);
      // 매핑 확인 실패 시 접근 불가 (보안상 안전하게)
      return res.json({
        success: true,
        isActive: false,
        message: '접근 권한 확인 중 오류가 발생했습니다.'
      });
    }
    
    if (!hasAccess) {
      return res.json({
        success: true,
        isActive: false,
        message: '접근 권한이 없습니다.'
      });
    }
    
    // 활성화된 메뉴이고 접근 권한이 있는 경우
    res.json({
      success: true,
      isActive: true,
      message: '활성화된 메뉴입니다.'
    });
  } catch (error: any) {
    console.error('경로별 메뉴 상태 확인 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 메뉴 상세 조회
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        'SELECT * FROM menus WHERE id = $1',
        [id]
      );
    } else {
      result = await query(
        'SELECT ID as id, PARENT_ID as parent_id, MENU_CODE as menu_code, LABEL as label, PATH as path, ICON_NAME as icon_name, DESCRIPTION as description, DISPLAY_ORDER as display_order, IS_ACTIVE as is_active, ADMIN_ONLY as admin_only, CREATED_BY as created_by, CREATED_AT as created_at, UPDATED_AT as updated_at FROM EAR.menus WHERE ID = ?',
        [id]
      );
    }
    
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });
    }
    
    res.json({
      success: true,
      menu: result.rows[0]
    });
  } catch (error: any) {
    console.error('메뉴 상세 조회 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 메뉴 생성 (관리자만)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { parent_id, menu_code, label, path, icon_name, description, display_order, is_active } = req.body;
    const createdBy = (req as any).user?.userid || 'admin';
    
    if (!menu_code || !label) {
      return res.status(400).json({ error: '메뉴 코드와 라벨은 필수입니다.' });
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'INSERT INTO menus (parent_id, menu_code, label, path, icon_name, description, display_order, is_active, admin_only, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, $9) RETURNING *',
        [parent_id || null, menu_code, label, path || null, icon_name || null, description || null, display_order || 0, is_active !== false, createdBy]
      );
      
      res.json({
        success: true,
        message: '메뉴가 생성되었습니다.',
        menu: result.rows[0]
      });
    } else {
      await query(
        'INSERT INTO EAR.menus (PARENT_ID, MENU_CODE, LABEL, PATH, ICON_NAME, DESCRIPTION, DISPLAY_ORDER, IS_ACTIVE, ADMIN_ONLY, CREATED_BY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, false, ?)',
        [parent_id || null, menu_code, label, path || null, icon_name || null, description || null, display_order || 0, is_active !== false, createdBy]
      );
      
      // HANA는 ID를 직접 가져올 수 없으므로 조회
      const result = await query(
        'SELECT ID as id, PARENT_ID as parent_id, MENU_CODE as menu_code, LABEL as label, PATH as path, ICON_NAME as icon_name, DESCRIPTION as description, DISPLAY_ORDER as display_order, IS_ACTIVE as is_active, ADMIN_ONLY as admin_only, CREATED_BY as created_by, CREATED_AT as created_at, UPDATED_AT as updated_at FROM EAR.menus WHERE MENU_CODE = ?',
        [menu_code]
      );
      
      res.json({
        success: true,
        message: '메뉴가 생성되었습니다.',
        menu: result.rows[0]
      });
    }
  } catch (error: any) {
    console.error('메뉴 생성 오류:', error);
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '이미 존재하는 메뉴 코드입니다.' });
    }
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 메뉴 수정 (관리자만)
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { parent_id, menu_code, label, path, icon_name, description, display_order, is_active } = req.body;
    
    if (!menu_code || !label) {
      return res.status(400).json({ error: '메뉴 코드와 라벨은 필수입니다.' });
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'UPDATE menus SET parent_id = $1, menu_code = $2, label = $3, path = $4, icon_name = $5, description = $6, display_order = $7, is_active = $8, admin_only = false, updated_at = CURRENT_TIMESTAMP WHERE id = $9 RETURNING *',
        [parent_id || null, menu_code, label, path || null, icon_name || null, description || null, display_order || 0, is_active !== false, id]
      );
      
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });
      }
      
      res.json({
        success: true,
        message: '메뉴가 수정되었습니다.',
        menu: result.rows[0]
      });
    } else {
      await query(
        'UPDATE EAR.menus SET PARENT_ID = ?, MENU_CODE = ?, LABEL = ?, PATH = ?, ICON_NAME = ?, DESCRIPTION = ?, DISPLAY_ORDER = ?, IS_ACTIVE = ?, ADMIN_ONLY = false, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?',
        [parent_id || null, menu_code, label, path || null, icon_name || null, description || null, display_order || 0, is_active !== false, id]
      );
      
      const result = await query(
        'SELECT ID as id, PARENT_ID as parent_id, MENU_CODE as menu_code, LABEL as label, PATH as path, ICON_NAME as icon_name, DESCRIPTION as description, DISPLAY_ORDER as display_order, IS_ACTIVE as is_active, ADMIN_ONLY as admin_only, CREATED_BY as created_by, CREATED_AT as created_at, UPDATED_AT as updated_at FROM EAR.menus WHERE ID = ?',
        [id]
      );
      
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });
      }
      
      res.json({
        success: true,
        message: '메뉴가 수정되었습니다.',
        menu: result.rows[0]
      });
    }
  } catch (error: any) {
    console.error('메뉴 수정 오류:', error);
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '이미 존재하는 메뉴 코드입니다.' });
    }
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 메뉴 삭제 (관리자만)
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (DB_TYPE === 'postgres') {
      const result = await query('DELETE FROM menus WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });
      }
    } else {
      const result = await query('DELETE FROM EAR.menus WHERE ID = ?', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: '메뉴를 찾을 수 없습니다.' });
      }
    }
    
    res.json({
      success: true,
      message: '메뉴가 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('메뉴 삭제 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

export default router;

