import express from 'express';
import { query, DB_TYPE } from '../db';
import { requireAdmin, requireAllowedGroup } from '../middleware/auth';

const router = express.Router();

// 사용자 그룹별 메뉴 매핑 목록 조회 (허용된 그룹만 접근 가능)
router.get('/', requireAllowedGroup, async (req, res) => {
  try {
    const { group_name } = req.query;
    
    let result;
    if (DB_TYPE === 'postgres') {
      let sql = `
        SELECT 
          gmm.id,
          gmm.group_name,
          gmm.menu_id,
          gmm.is_active,
          gmm.created_by,
          gmm.created_at,
          gmm.updated_at,
          m.menu_code,
          m.label as menu_label,
          m.path as menu_path
        FROM group_menu_mappings gmm
        JOIN menus m ON gmm.menu_id = m.id
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (group_name) {
        sql += ' AND gmm.group_name = $1';
        params.push(group_name);
      }
      
      sql += ' ORDER BY gmm.group_name, m.display_order, m.label';
      
      result = await query(sql, params);
    } else {
      let sql = `
        SELECT 
          gmm.ID as id,
          gmm.GROUP_NAME as group_name,
          gmm.MENU_ID as menu_id,
          gmm.IS_ACTIVE as is_active,
          gmm.CREATED_BY as created_by,
          gmm.CREATED_AT as created_at,
          gmm.UPDATED_AT as updated_at,
          m.MENU_CODE as menu_code,
          m.LABEL as menu_label,
          m.PATH as menu_path
        FROM EAR.group_menu_mappings gmm
        JOIN EAR.menus m ON gmm.MENU_ID = m.ID
        WHERE 1=1
      `;
      const params: any[] = [];
      
      if (group_name) {
        sql += ' AND gmm.GROUP_NAME = ?';
        params.push(group_name);
      }
      
      sql += ' ORDER BY gmm.GROUP_NAME, m.DISPLAY_ORDER, m.LABEL';
      
      result = await query(sql, params);
    }
    
    res.json({
      success: true,
      mappings: result.rows || []
    });
  } catch (error: any) {
    console.error('그룹별 메뉴 매핑 조회 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 특정 그룹의 접근 가능한 메뉴 목록 조회 (사용자용)
router.get('/accessible', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }
    
    // 사용자의 samlGroups 가져오기 (XSUAA 토큰에서)
    const samlGroups: string[] = user.samlGroups || [];
    
    // 허용된 그룹만 필터링 (EAR-ADMIN, EAR-USER, EAR-5TIER)
    const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
    const userGroups = samlGroups.filter(g => allowedGroups.includes(g));
    
    if (userGroups.length === 0) {
      return res.json({
        success: true,
        menuIds: []
      });
    }
    
    let result;
    if (DB_TYPE === 'postgres') {
      result = await query(
        `SELECT DISTINCT menu_id 
         FROM group_menu_mappings 
         WHERE group_name = ANY($1) AND is_active = true`,
        [userGroups]
      );
    } else {
      // HANA는 ANY 대신 IN 사용
      const placeholders = userGroups.map(() => '?').join(',');
      result = await query(
        `SELECT DISTINCT MENU_ID as menu_id 
         FROM EAR.group_menu_mappings 
         WHERE GROUP_NAME IN (${placeholders}) AND IS_ACTIVE = true`,
        userGroups
      );
    }
    
    const menuIds = (result.rows || []).map((row: any) => row.menu_id);
    
    res.json({
      success: true,
      menuIds
    });
  } catch (error: any) {
    console.error('접근 가능한 메뉴 조회 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 사용자 그룹별 메뉴 매핑 생성
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { group_name, menu_id, is_active } = req.body;
    const createdBy = (req as any).user?.userid || 'admin';
    
    if (!group_name || !menu_id) {
      return res.status(400).json({ error: '그룹명과 메뉴 ID는 필수입니다.' });
    }
    
    // 허용된 그룹만 체크
    const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
    if (!allowedGroups.includes(group_name)) {
      return res.status(400).json({ error: '허용되지 않은 그룹명입니다. (EAR-ADMIN, EAR-USER, EAR-5TIER만 가능)' });
    }
    
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'INSERT INTO group_menu_mappings (group_name, menu_id, is_active, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [group_name, menu_id, is_active !== false, createdBy]
      );
      
      res.json({
        success: true,
        message: '매핑이 생성되었습니다.',
        mapping: result.rows[0]
      });
    } else {
      await query(
        'INSERT INTO EAR.group_menu_mappings (GROUP_NAME, MENU_ID, IS_ACTIVE, CREATED_BY) VALUES (?, ?, ?, ?)',
        [group_name, menu_id, is_active !== false, createdBy]
      );
      
      const result = await query(
        'SELECT ID as id, GROUP_NAME as group_name, MENU_ID as menu_id, IS_ACTIVE as is_active, CREATED_BY as created_by, CREATED_AT as created_at, UPDATED_AT as updated_at FROM EAR.group_menu_mappings WHERE GROUP_NAME = ? AND MENU_ID = ?',
        [group_name, menu_id]
      );
      
      res.json({
        success: true,
        message: '매핑이 생성되었습니다.',
        mapping: result.rows[0]
      });
    }
  } catch (error: any) {
    console.error('매핑 생성 오류:', error);
    if (error.message && error.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '이미 존재하는 매핑입니다.' });
    }
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 사용자 그룹별 메뉴 매핑 수정
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'UPDATE group_menu_mappings SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [is_active !== false, id]
      );
      
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '매핑을 찾을 수 없습니다.' });
      }
      
      res.json({
        success: true,
        message: '매핑이 수정되었습니다.',
        mapping: result.rows[0]
      });
    } else {
      await query(
        'UPDATE EAR.group_menu_mappings SET IS_ACTIVE = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?',
        [is_active !== false, id]
      );
      
      const result = await query(
        'SELECT ID as id, GROUP_NAME as group_name, MENU_ID as menu_id, IS_ACTIVE as is_active, CREATED_BY as created_by, CREATED_AT as created_at, UPDATED_AT as updated_at FROM EAR.group_menu_mappings WHERE ID = ?',
        [id]
      );
      
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json({ error: '매핑을 찾을 수 없습니다.' });
      }
      
      res.json({
        success: true,
        message: '매핑이 수정되었습니다.',
        mapping: result.rows[0]
      });
    }
  } catch (error: any) {
    console.error('매핑 수정 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 사용자 그룹별 메뉴 매핑 삭제
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    if (DB_TYPE === 'postgres') {
      const result = await query('DELETE FROM group_menu_mappings WHERE id = $1', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: '매핑을 찾을 수 없습니다.' });
      }
    } else {
      const result = await query('DELETE FROM EAR.group_menu_mappings WHERE ID = ?', [id]);
      if (result.rowCount === 0) {
        return res.status(404).json({ error: '매핑을 찾을 수 없습니다.' });
      }
    }
    
    res.json({
      success: true,
      message: '매핑이 삭제되었습니다.'
    });
  } catch (error: any) {
    console.error('매핑 삭제 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

// 그룹별 일괄 매핑 설정
router.post('/batch', requireAdmin, async (req, res) => {
  try {
    const { group_name, menu_ids } = req.body;
    const createdBy = (req as any).user?.userid || 'admin';
    
    if (!group_name || !Array.isArray(menu_ids)) {
      return res.status(400).json({ error: '그룹명과 메뉴 ID 배열은 필수입니다.' });
    }
    
    // 허용된 그룹만 체크
    const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
    if (!allowedGroups.includes(group_name)) {
      return res.status(400).json({ error: '허용되지 않은 그룹명입니다. (EAR-ADMIN, EAR-USER, EAR-5TIER만 가능)' });
    }
    
    if (DB_TYPE === 'postgres') {
      // 기존 매핑 삭제
      await query('DELETE FROM group_menu_mappings WHERE group_name = $1', [group_name]);
      
      // 새 매핑 추가
      if (menu_ids.length > 0) {
        const values = menu_ids.map((menuId: number, index: number) => 
          `($${index * 2 + 1}, $${index * 2 + 2}, true, $${menu_ids.length * 2 + 1})`
        ).join(', ');
        
        const params = menu_ids.flatMap((menuId: number) => [group_name, menuId]);
        params.push(createdBy);
        
        await query(
          `INSERT INTO group_menu_mappings (group_name, menu_id, is_active, created_by) VALUES ${values}`,
          params
        );
      }
    } else {
      // 기존 매핑 삭제
      await query('DELETE FROM EAR.group_menu_mappings WHERE GROUP_NAME = ?', [group_name]);
      
      // 새 매핑 추가
      for (const menuId of menu_ids) {
        await query(
          'INSERT INTO EAR.group_menu_mappings (GROUP_NAME, MENU_ID, IS_ACTIVE, CREATED_BY) VALUES (?, ?, ?, ?)',
          [group_name, menuId, true, createdBy]
        );
      }
    }
    
    res.json({
      success: true,
      message: '일괄 매핑이 설정되었습니다.'
    });
  } catch (error: any) {
    console.error('일괄 매핑 설정 오류:', error);
    res.status(500).json({ error: error.message || '서버 오류가 발생했습니다.' });
  }
});

export default router;

