import express from 'express';
import * as xsenv from '@sap/xsenv';
import * as xssec from '@sap/xssec';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
import { db, DB_TYPE } from '../db';
import { getClientIp, logClientIpInfo, getBaseUrl, getClientHost, getClientProtocol } from '../utils/ipUtils';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';

const router = express.Router();

// JWT 시크릿 키
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

const LOCAL_ONLY = process.env.LOCAL_ONLY === 'true';

// 디버그 모드 (환경 변수로 제어)
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

// XSUAA 사용 여부 확인
const USE_XSUAA = process.env.USE_XSUAA === 'true' || process.env.VCAP_SERVICES !== undefined;

// XSUAA 설정 로드 (신뢰성 높임)
let xsuaaConfig: any = null;
if (USE_XSUAA) {
  try {
    // 1) 정석: getServices를 사용해 credentials만 추출
    try {
      const services: any = (xsenv as any).getServices ? (xsenv as any).getServices({ xsuaa: { label: 'xsuaa' } }) : null;
      if (services?.xsuaa) xsuaaConfig = services.xsuaa;
    } catch {}

    // 2) 태그 기반 검색 (환경에 따라 label 대신 tag가 쓰일 수 있음)
    if (!xsuaaConfig) {
      try {
        const services: any = (xsenv as any).getServices ? (xsenv as any).getServices({ xsuaa: { tag: 'xsuaa' } }) : null;
        if (services?.xsuaa) xsuaaConfig = services.xsuaa;
      } catch {}
    }

    // 3) VCAP_SERVICES 직접 파싱
    if (!xsuaaConfig && process.env.VCAP_SERVICES) {
      const vcapServices = JSON.parse(process.env.VCAP_SERVICES);
      const xsuaaServices = vcapServices['xsuaa'] || [];
      if (xsuaaServices.length > 0) {
        xsuaaConfig = xsuaaServices[0].credentials;
      }
    }

    // 4) 최종 검증: 필수 필드 확인
    if (!xsuaaConfig || !xsuaaConfig.clientid || !xsuaaConfig.url) {
      console.warn('XSUAA 자격증명(clientid/url)을 찾지 못했습니다. 서비스 바인딩을 확인하세요.');
      xsuaaConfig = null;
    }
  } catch (error) {
    console.warn('XSUAA 설정 로드 실패:', error);
  }
}

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { userid, password } = req.body;
    
    const clientIp = getClientIp(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    
    logClientIpInfo(req, '로그인 시도');

    if (!userid || (!password && !LOCAL_ONLY)) {
      return res.status(400).json({ error: '사용자ID와 비밀번호를 입력해주세요.' });
    }

    // 사용자 조회
    console.log('로그인 시도 - 사용자ID:', userid);
    
    let userResult;
    try {
      if (DB_TYPE === 'postgres') {
        userResult = await db.query(
          'SELECT * FROM users WHERE userid = $1 AND is_active = true',
          [userid]
        );
      } else {
        // HANA
        userResult = await db.query(
          'SELECT * FROM EAR.users WHERE USERID = ? AND IS_ACTIVE = true',
          [userid]
        );
      }

      if (userResult.rows.length === 0 && !LOCAL_ONLY) {
        // 로그인 실패 기록
        if (DB_TYPE === 'postgres') {
          await db.query(
            'INSERT INTO login_history (userid, ip_address, user_agent, login_status, failure_reason) VALUES ($1, $2, $3, $4, $5)',
            [userid, clientIp, userAgent, 'failed', '사용자를 찾을 수 없습니다']
          );
        } else {
          await db.query(
            'INSERT INTO EAR.login_history (USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS, FAILURE_REASON) VALUES (?, ?, ?, ?, ?)',
          [userid, clientIp, userAgent, 'failed', '사용자를 찾을 수 없습니다']
          );
        }
        return res.status(401).json({ error: '사용자ID 또는 비밀번호가 올바르지 않습니다.' });
      }
      if (userResult.rows.length === 0 && LOCAL_ONLY) {
        const existingLocal = await db.query(
          'SELECT * FROM users WHERE is_active = true ORDER BY id ASC LIMIT 1',
          []
        );
        if (existingLocal.rows.length > 0) {
          userResult = existingLocal;
        }
      }
    } catch (dbError) {
      console.error('DB 쿼리 오류:', dbError);
      return res.status(500).json({ error: '데이터베이스 오류가 발생했습니다.' });
    }

    const user = userResult.rows[0];

    // 계정 잠금 확인 및 해제
    if (user.locked_until && new Date() < new Date(user.locked_until)) {
      if (DB_TYPE === 'postgres') {
        await db.query(
          'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
          [user.id]
        );
      } else {
        await db.query(
          'UPDATE EAR.users SET FAILED_LOGIN_ATTEMPTS = 0, LOCKED_UNTIL = NULL WHERE ID = ?',
          [user.id]
        );
      }
    }
    
    if (user.failed_login_attempts >= 5) {
      if (DB_TYPE === 'postgres') {
        await db.query(
          'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
          [user.id]
        );
      } else {
        await db.query(
          'UPDATE EAR.users SET FAILED_LOGIN_ATTEMPTS = 0, LOCKED_UNTIL = NULL WHERE ID = ?',
          [user.id]
        );
      }
    }

    // 비밀번호 확인
    const isValidPassword = LOCAL_ONLY ? true : await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      // 실패 횟수 증가
      const newFailedAttempts = user.failed_login_attempts + 1;
      const lockUntil = newFailedAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000) : null;

      if (DB_TYPE === 'postgres') {
        if (lockUntil) {
          await db.query(
            'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
            [newFailedAttempts, lockUntil, user.id]
          );
        } else {
          await db.query(
            'UPDATE users SET failed_login_attempts = $1 WHERE id = $2',
            [newFailedAttempts, user.id]
          );
        }
        
        await db.query(
          'INSERT INTO login_history (user_id, userid, ip_address, user_agent, login_status, failure_reason) VALUES ($1, $2, $3, $4, $5, $6)',
          [user.id, userid, clientIp, userAgent, 'failed', '잘못된 비밀번호']
        );
      } else {
        // HANA
        if (lockUntil) {
          await db.query(
            'UPDATE EAR.users SET FAILED_LOGIN_ATTEMPTS = ?, LOCKED_UNTIL = ? WHERE ID = ?',
            [newFailedAttempts, lockUntil, user.id]
          );
        } else {
          await db.query(
            'UPDATE EAR.users SET FAILED_LOGIN_ATTEMPTS = ? WHERE ID = ?',
            [newFailedAttempts, user.id]
          );
        }
        
        await db.query(
          'INSERT INTO EAR.login_history (USER_ID, USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS, FAILURE_REASON) VALUES (?, ?, ?, ?, ?, ?)',
          [user.id, userid, clientIp, userAgent, 'failed', '잘못된 비밀번호']
        );
      }

      return res.status(401).json({ error: '사용자ID 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 로그인 성공
    if (DB_TYPE === 'postgres') {
      await db.query(
        'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      
      await db.query(
        'INSERT INTO login_history (user_id, userid, ip_address, user_agent, login_status) VALUES ($1, $2, $3, $4, $5)',
        [user.id, userid, clientIp, userAgent, 'success']
      );
    } else {
      // HANA
      await db.query(
        'UPDATE EAR.users SET FAILED_LOGIN_ATTEMPTS = 0, LOCKED_UNTIL = NULL, LAST_LOGIN = CURRENT_TIMESTAMP WHERE ID = ?',
        [user.id]
      );
      
      await db.query(
        'INSERT INTO EAR.login_history (USER_ID, USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS) VALUES (?, ?, ?, ?, ?)',
        [user.id, userid, clientIp, userAgent, 'success']
      );
    }

    // 사용자 company_code 가져오기 (없으면 SKN으로 설정)
    const companyCode = user.company_code || 'SKN';
    
    // 사용자가 DB에 없거나 company_code가 없으면 SKN으로 업데이트
    if (!user.company_code && !LOCAL_ONLY) {
      if (DB_TYPE === 'postgres') {
        await db.query(
          'UPDATE users SET company_code = $1 WHERE id = $2',
          ['SKN', user.id]
        );
      } else {
        await db.query(
          'UPDATE EAR.users SET COMPANY_CODE = ? WHERE ID = ?',
          ['SKN', user.id]
        );
      }
    }

    // JWT 토큰 생성
    const token = jwt.sign(
      { 
        userId: user.id, 
        userid: user.userid, 
        isAdmin: user.is_admin,
        companyCode: companyCode
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        userid: user.userid,
        fullName: user.full_name,
        email: user.email,
        isAdmin: user.is_admin,
        companyCode: companyCode
      }
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// XSUAA 토큰 검증 헬퍼
async function validateXSUAATokenHelper(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // 토큰 유효성 검사
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return reject(new Error('토큰이 제공되지 않았거나 유효하지 않습니다.'));
    }
    
    if (!xsuaaConfig) {
      return reject(new Error('XSUAA 설정이 없습니다.'));
    }

    // xssec.createSecurityContext는 Express 요청 객체를 기대할 수 있으므로
    // 먼저 JWT를 직접 파싱하여 토큰 정보 추출 (더 안전한 방법)
    try {
      // JWT를 서명 검증 없이 디코딩하여 토큰 정보 추출
      const decoded = jwt.decode(token, { complete: true }) as any;
      
      if (!decoded || !decoded.payload) {
        return reject(new Error('JWT 토큰 디코딩 실패'));
      }
      
      const payload = decoded.payload;
      
      // Self-defined Attributes 읽기 (로그는 디버그 모드에서만)
      const xsUserAttributes = payload['xs.user.attributes'] || {};
      const extAttr = payload.ext_attr || {};
      const customAttributes = payload.custom_attributes || {};
      const userAttributes = payload.user_attributes || {};
      
      const employeeNumber = 
        xsUserAttributes.employee_number || 
        extAttr.employee_number || 
        customAttributes.employee_number ||
        userAttributes.employee_number ||
        payload.employee_number;
      
      if (DEBUG_AUTH) {
        // 🔍 디버그 모드에서만 상세 로그 출력
        console.log('=== 토큰 Payload 전체 (routes/auth.ts) ===');
        console.log(JSON.stringify(payload, null, 2));
        console.log('=== 토큰 Payload 끝 ===');
        
        console.log('=== C4C ID 확인 가능한 속성들 ===');
        console.log({
          ext_attr: payload.ext_attr,
          attributes: payload.attributes,
          xs_user_attributes: payload['xs.user.attributes'],
          c4cUserId: payload.c4cUserId,
          c4c_user_id: payload.c4c_user_id,
          user_attributes: payload.user_attributes,
          custom_attributes: payload.custom_attributes,
          'xs.system.attributes': payload['xs.system.attributes'],
          'user.attributes': payload['user.attributes']
        });
        console.log('=== C4C ID 확인 끝 ===');
        
        const selfDefinedAttributes = {
          employee_number: employeeNumber,
          first_name: xsUserAttributes.first_name || extAttr.first_name || customAttributes.first_name || payload.first_name,
          last_name: xsUserAttributes.last_name || extAttr.last_name || customAttributes.last_name || payload.last_name,
          locale: xsUserAttributes.locale || extAttr.locale || customAttributes.locale || payload.locale,
          mail: xsUserAttributes.mail || extAttr.mail || customAttributes.mail || payload.mail || payload.email,
          user_uuid: xsUserAttributes.user_uuid || extAttr.user_uuid || customAttributes.user_uuid || payload.user_uuid
        };
        
        console.log('=== Self-defined Attributes 확인 (토큰 검증) ===');
        console.log('xs.user.attributes:', xsUserAttributes);
        console.log('ext_attr:', extAttr);
        console.log('custom_attributes:', customAttributes);
        console.log('user_attributes:', userAttributes);
        console.log('추출된 Self-defined Attributes:', selfDefinedAttributes);
        console.log('employee_number 값:', employeeNumber || '(없음)');
        console.log('=== Self-defined Attributes 확인 끝 ===');
      }
      
      // 토큰 만료 확인
      if (payload.exp && payload.exp < Date.now() / 1000) {
        return reject(new Error('토큰이 만료되었습니다.'));
      }
      
      // 권한 확인 로직: xs.saml.groups에서 "EAR-ADMIN" 또는 "EAR-USER" 확인
      const xsSystemAttributes = payload['xs.system.attributes'] || {};
      const samlGroups = xsSystemAttributes['xs.saml.groups'] || [];
      
      // 사용자 정보 추출
      const userInfo = {
        userid: payload.user_name || payload.email || payload.sub,
        email: payload.email,
        givenName: payload.given_name,
        familyName: payload.family_name,
        isAdmin: false,
        scopes: Array.isArray(payload.scope) ? payload.scope : (payload.scope ? [payload.scope] : []),
        samlGroups: samlGroups
      };
      
      let hasAdminScope = false;
      let hasUserScope = false;
      
      // xs.saml.groups에서 EAR-ADMIN 또는 EAR_ADMIN 확인 (하이픈/언더스코어 모두 지원)
      const hasAdminGroup = Array.isArray(samlGroups) && (
        samlGroups.includes('EAR-ADMIN') || 
        samlGroups.includes('EAR_ADMIN') ||
        samlGroups.some((g: string) => g.toUpperCase() === 'EAR-ADMIN' || g.toUpperCase() === 'EAR_ADMIN')
      );
      
      if (hasAdminGroup) {
        userInfo.isAdmin = true;
        hasAdminScope = true;
        if (DEBUG_AUTH) {
          console.log('✅ 관리자 권한 확인됨 - samlGroups:', samlGroups);
        }
      } else if (Array.isArray(samlGroups) && (
        samlGroups.includes('EAR-USER') || 
        samlGroups.includes('EAR_USER') ||
        samlGroups.some((g: string) => g.toUpperCase() === 'EAR-USER' || g.toUpperCase() === 'EAR_USER')
      )) {
        // EAR-USER가 있으면 일반 사용자 (기본값 false 유지)
        userInfo.isAdmin = false;
        hasUserScope = true;
      } else {
        // 폴백: 기존 scope 기반 권한 확인 (하위 호환성)
        const xsappname = xsuaaConfig.xsappname || 'ear-xsuaa';
        const adminScopePattern = new RegExp(`${xsappname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[!.]Administrator`, 'i');
        const userScopePattern = new RegExp(`${xsappname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[!.]User`, 'i');
        const tier5ScopePattern = new RegExp(`${xsappname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[!.]5TIER`, 'i');
        const tier5EtcScopePattern = new RegExp(`${xsappname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[!.]5TIER-ETC`, 'i');
        
        if (Array.isArray(userInfo.scopes)) {
          hasAdminScope = userInfo.scopes.some((s: string) => 
            adminScopePattern.test(s) || s.toLowerCase().includes('administrator')
          );
          hasUserScope = userInfo.scopes.some((s: string) => 
            userScopePattern.test(s) || 
            tier5ScopePattern.test(s) || 
            tier5EtcScopePattern.test(s) ||
            s.toLowerCase().includes('user') ||
            s.toLowerCase().includes('5tier')
          );
          userInfo.isAdmin = hasAdminScope;
        }
      }
      
      if (DEBUG_AUTH) {
        console.log('XSUAA 토큰 정보 (JWT 직접 파싱):', {
          userid: userInfo.userid,
          email: userInfo.email,
          scopes: userInfo.scopes,
          samlGroups: samlGroups,
          hasAdminScope,
          hasUserScope,
          isAdmin: userInfo.isAdmin
        });
      }
      
      resolve({
        securityContext: null,
        userInfo,
        tokenInfo: payload
      });
    } catch (parseError: any) {
      // JWT 파싱 실패 시 xssec로 폴백 시도
      console.warn('JWT 직접 파싱 실패, xssec로 폴백 시도:', parseError?.message || parseError);
      
      try {
        xssec.createSecurityContext(token, xsuaaConfig, (error: any, ctx: any, tokenInfo: any) => {
          if (error) {
            return reject(new Error(`토큰 검증 실패: ${error?.message || error}`));
          }

          if (DEBUG_AUTH) {
            // 🔍 디버그 모드에서만 상세 로그 출력
            console.log('=== xssec 토큰 정보 전체 (routes/auth.ts) ===');
            console.log(JSON.stringify(tokenInfo, null, 2));
            console.log('=== xssec 토큰 정보 끝 ===');
            
            console.log('=== C4C ID 확인 가능한 속성들 (xssec) ===');
            console.log({
              ext_attr: tokenInfo.ext_attr,
              attributes: tokenInfo.attributes,
              xs_user_attributes: tokenInfo['xs.user.attributes'],
              c4cUserId: tokenInfo.c4cUserId,
              c4c_user_id: tokenInfo.c4c_user_id,
              user_attributes: tokenInfo.user_attributes,
              custom_attributes: tokenInfo.custom_attributes,
              'xs.system.attributes': tokenInfo['xs.system.attributes'],
              'user.attributes': tokenInfo['user.attributes']
            });
            console.log('=== C4C ID 확인 끝 (xssec) ===');
          }

          // 권한 확인 로직: xs.saml.groups에서 "EAR-ADMIN" 또는 "EAR-USER" 확인
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
          
          // xs.saml.groups에서 EAR-ADMIN 또는 EAR_ADMIN 확인 (하이픈/언더스코어 모두 지원)
          const hasAdminGroup = Array.isArray(samlGroups) && (
            samlGroups.includes('EAR-ADMIN') || 
            samlGroups.includes('EAR_ADMIN') ||
            samlGroups.some((g: string) => g.toUpperCase() === 'EAR-ADMIN' || g.toUpperCase() === 'EAR_ADMIN')
          );
          
          if (hasAdminGroup) {
            userInfo.isAdmin = true;
            if (DEBUG_AUTH) {
              console.log('✅ 관리자 권한 확인됨 (xssec) - samlGroups:', samlGroups);
            }
          } else if (Array.isArray(samlGroups) && (
            samlGroups.includes('EAR-USER') || 
            samlGroups.includes('EAR_USER') ||
            samlGroups.some((g: string) => g.toUpperCase() === 'EAR-USER' || g.toUpperCase() === 'EAR_USER')
          )) {
            // EAR-USER가 있으면 일반 사용자 (기본값 false 유지)
            userInfo.isAdmin = false;
          } else {
            // 폴백: 기존 scope 기반 권한 확인 (하위 호환성)
            const xsappname = xsuaaConfig.xsappname || 'ear-xsuaa';
            const adminScopePattern = new RegExp(`${xsappname.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[!.]Administrator`, 'i');
            
            if (Array.isArray(tokenInfo.scope)) {
              userInfo.isAdmin = tokenInfo.scope.some((s: string) => 
                adminScopePattern.test(s) || s.toLowerCase().includes('administrator')
              );
            } else if (typeof tokenInfo.scope === 'string') {
              userInfo.isAdmin = adminScopePattern.test(tokenInfo.scope) || tokenInfo.scope.toLowerCase().includes('administrator');
            }
          }

          resolve({
            securityContext: ctx,
            userInfo,
            tokenInfo
          });
        });
      } catch (xssecError: any) {
        reject(new Error(`토큰 검증 실패: ${xssecError?.message || xssecError}`));
      }
    }
  });
}

// 토큰 검증 (XSUAA 또는 JWT)
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    
    // 토큰이 없거나 빈 문자열인 경우
    if (!token || token.length === 0) {
      return res.status(401).json({ error: '토큰이 제공되지 않았습니다.' });
    }
    
    if (DEBUG_AUTH) {
      console.log('토큰 검증 요청:', {
        hasToken: !!token,
        tokenLength: token.length,
        tokenPrefix: token.substring(0, 20) + '...'
      });
    }

    // XSUAA 토큰 검증 시도
    if (USE_XSUAA && xsuaaConfig) {
      try {
        const { userInfo } = await validateXSUAATokenHelper(token);
        
        // DB에서 사용자 정보 조회 (있는 경우)
        let dbUser = null;
        try {
          let userResult;
          if (DB_TYPE === 'postgres') {
            userResult = await db.query(
              'SELECT id, userid, full_name, email, is_admin, is_active, company_code FROM users WHERE userid = $1 AND is_active = true',
              [userInfo.userid]
            );
          } else {
            userResult = await db.query(
              'SELECT ID, USERID, FULL_NAME, EMAIL, IS_ADMIN, IS_ACTIVE, COMPANY_CODE FROM EAR.users WHERE USERID = ? AND IS_ACTIVE = true',
              [userInfo.userid]
            );
          }
          
          if (userResult.rows.length > 0) {
            dbUser = userResult.rows[0];
          }
        } catch (dbError) {
          console.warn('DB 사용자 조회 실패 (계속 진행):', dbError);
        }

        // XSUAA 사용자 정보 반환 (DB 정보와 병합)
        // isAdmin 우선순위: userInfo.isAdmin (토큰 기반) > DB is_admin
        // 토큰에서 추출한 isAdmin이 true면 무조건 true (DB 값 무시)
        const finalIsAdmin = userInfo.isAdmin === true ? true : (dbUser?.is_admin || dbUser?.IS_ADMIN || false);
        
        if (DEBUG_AUTH) {
          console.log('✅ /api/auth/verify 응답:', {
            userid: userInfo.userid,
            userInfoIsAdmin: userInfo.isAdmin,
            dbIsAdmin: dbUser?.is_admin || dbUser?.IS_ADMIN,
            dbUserExists: !!dbUser,
            finalIsAdmin: finalIsAdmin,
            samlGroups: userInfo.samlGroups || 'N/A'
          });
        }
        
        return res.json({
          valid: true,
          user: {
            id: dbUser?.id || dbUser?.ID,
            userid: userInfo.userid,
            fullName: dbUser?.full_name || dbUser?.FULL_NAME || `${userInfo.givenName || ''} ${userInfo.familyName || ''}`.trim(),
            givenName: userInfo.givenName || dbUser?.full_name?.split(' ')[0] || dbUser?.FULL_NAME?.split(' ')[0] || '',
            email: userInfo.email || dbUser?.email || dbUser?.EMAIL,
            isAdmin: finalIsAdmin,
            samlGroups: userInfo.samlGroups || []
          },
          scopes: userInfo.scopes,
          source: 'XSUAA'
        });
      } catch (xsuaaError: any) {
        console.error('XSUAA 토큰 검증 실패:', xsuaaError?.message || 'Unknown error');
        if (DEBUG_AUTH) {
          console.error('XSUAA 토큰 검증 상세 오류:', xsuaaError?.name || 'Unknown', xsuaaError?.stack || JSON.stringify(xsuaaError, null, 2));
        }
        
        // MissingJwtError인 경우 명확한 에러 메시지 반환
        if (xsuaaError?.name === 'MissingJwtError' || xsuaaError?.message?.includes('no jwt bearer token')) {
          return res.status(401).json({ 
            error: '토큰이 제공되지 않았거나 유효하지 않습니다.',
            details: 'XSUAA 토큰 검증 실패: 토큰이 없거나 잘못된 형식입니다.'
          });
        }
        
        // JWT 검증으로 폴백 시도 (IAS 토큰은 JWT가 아니므로 실패할 것임)
        if (DEBUG_AUTH) {
          console.log('XSUAA 검증 실패, JWT 폴백 시도');
        }
      }
    }

    // JWT 토큰 검증
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // 사용자 정보 조회
      let userResult;
      if (DB_TYPE === 'postgres') {
        userResult = await db.query(
          'SELECT id, userid, full_name, email, is_admin, is_active, company_code FROM users WHERE id = $1 AND is_active = true',
          [decoded.userId]
        );
      } else {
        // HANA
        userResult = await db.query(
          'SELECT ID, USERID, FULL_NAME, EMAIL, IS_ADMIN, IS_ACTIVE, COMPANY_CODE FROM EAR.users WHERE ID = ? AND IS_ACTIVE = true',
          [decoded.userId]
        );
      }

      if (userResult.rows.length === 0) {
        return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
      }

      const user = userResult.rows[0];
      const companyCode = user.company_code || user.COMPANY_CODE || 'SKN';
      
      return res.json({
        valid: true,
        user: {
          id: user.id || user.ID,
          userid: user.userid || user.USERID,
          fullName: user.full_name || user.FULL_NAME,
          email: user.email || user.EMAIL,
          isAdmin: user.is_admin || user.IS_ADMIN || false,
          companyCode: companyCode,
          samlGroups: decoded.samlGroups || []
        },
        source: 'JWT'
      });
    } catch (jwtError: any) {
      console.error('JWT 토큰 검증 오류:', jwtError?.message || 'Unknown error');
      return res.status(401).json({ 
        error: '유효하지 않은 토큰입니다.',
        details: USE_XSUAA && xsuaaConfig ? 'XSUAA 토큰 검증 실패 후 JWT 검증도 실패' : 'JWT 토큰 검증 실패'
      });
    }

  } catch (error: any) {
    console.error('토큰 검증 오류:', error?.message || error);
    res.status(401).json({ 
      error: '유효하지 않은 토큰입니다.',
      details: error?.message || '알 수 없는 오류'
    });
  }
});

// XSUAA/IAS 설정 정보 조회
router.get('/config', (req, res) => {
  const useXSUAA = USE_XSUAA && xsuaaConfig !== null;
  
  // 최소한의 공개 정보만 반환 (보안: 민감한 설정 정보는 제거)
  const config: any = {
    useXSUAA,
    iasEnabled: useXSUAA,
    localOnly: LOCAL_ONLY
  };
  
  if (useXSUAA && xsuaaConfig?.url) {
    // Cloud Foundry Custom Domain 환경을 고려한 Base URL 생성
    const baseUrl = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/auth/callback`;
    // 로그인 URL만 반환 (필요한 정보는 모두 포함되어 있음)
    // 민감한 정보(xsappname, clientid, url)는 직접 노출하지 않음
    config.loginUrl = `${xsuaaConfig.url}/oauth/authorize?client_id=${xsuaaConfig.clientid}&response_type=code&redirect_uri=${encodeURIComponent(callbackUrl)}`;
  }
  
  res.json(config);
});

// IAS 로그인 리다이렉트 URL 생성
router.get('/ias-login-url', (req, res) => {
  if (!USE_XSUAA || !xsuaaConfig) {
    return res.status(400).json({ error: 'XSUAA가 설정되지 않았습니다.' });
  }

  // OAuth2 Authorization Code Flow: 백엔드 콜백 URL로 리다이렉트
  // Cloud Foundry Custom Domain 환경을 고려한 Base URL 생성
  const baseUrl = getBaseUrl(req);
  const callbackUri = `${baseUrl}/api/auth/callback`;
  const state = req.query.state as string || '';
  
  // 스코프 설정
  // 주의: scope를 요청하지 않으면 사용자가 가지고 있는 모든 scope가 토큰에 포함됩니다.
  // 특정 scope를 요청하면 해당 scope에 대한 권한이 없을 경우 invalid_scope 에러가 발생할 수 있습니다.
  // 따라서 scope를 요청하지 않거나, 명시적으로 요청된 경우에만 포함합니다.
  const requestedScope = req.query.scope as string;
  const xsappname = xsuaaConfig.xsappname || 'ear-xsuaa';
  
  // SCIM API 접근을 위한 추가 scope (환경 변수에서 가져오기)
  // 주의: XSUAA 토큰으로 IAS SCIM API를 직접 호출하는 것은 일반적으로 지원되지 않을 수 있습니다.
  // 이는 XSUAA와 IAS 간의 Trust Configuration에 따라 달라질 수 있습니다.
  const scimScope = process.env.SCIM_SCOPE || '';
  
  // Identity Provider 설정 (환경 변수 또는 쿼리 파라미터에서 가져오기)
  // 주의: idp 파라미터는 Trust Configuration에서 설정한 IDP 이름을 사용해야 함
  // 전체 IAS 테넌트 URL이 아닌, Trust Configuration의 이름 (예: "ias-trust", "default" 등)
  // 환경변수가 없으면 기본값으로 "default" 사용 (Identity Provider 선택 화면을 건너뛰기 위해)
  let defaultIdp = process.env.DEFAULT_IDP || req.query.idp as string;
  
  // DEFAULT_IDP가 설정되지 않았을 경우, IAS_BASE_URL을 기준으로 기본값 설정
  if (!defaultIdp || defaultIdp.trim() === '') {
    const iasBaseUrl = process.env.IAS_BASE_URL || '';
    // 운영 환경 (abppvbjd5)이거나 개발 환경 (avbayppic) 모두 "default" IDP 사용
    // 또는 "sap.custom" 사용 가능 (개발 환경 설정 참고)
    defaultIdp = 'sap.custom';
    console.log('DEFAULT_IDP 환경변수가 설정되지 않아 기본값 "sap.custom" 사용');
  }
  
  // IAS 인증 URL 생성 (Authorization Code Flow)
  // scope를 요청하지 않으면 사용자가 가지고 있는 모든 scope가 토큰에 포함됩니다.
  let loginUrl = `${xsuaaConfig.url}/oauth/authorize?` +
    `client_id=${encodeURIComponent(xsuaaConfig.clientid)}` +
    `&response_type=code` +
    `&redirect_uri=${encodeURIComponent(callbackUri)}`;
  
  // scope가 명시적으로 요청된 경우에만 추가
  // scope를 요청하지 않으면 사용자가 가지고 있는 모든 scope가 자동으로 포함됩니다.
  let finalScope = requestedScope || '';
  
  // SCIM scope가 환경 변수에 설정되어 있고, requestedScope가 없는 경우 추가
  if (scimScope && scimScope.trim() !== '' && !requestedScope) {
    finalScope = scimScope.trim();
  } else if (scimScope && scimScope.trim() !== '' && requestedScope) {
    // requestedScope와 scimScope를 결합
    finalScope = `${requestedScope.trim()} ${scimScope.trim()}`;
  }
  
  if (finalScope && finalScope.trim() !== '') {
    loginUrl += `&scope=${encodeURIComponent(finalScope.trim())}`;
    if (DEBUG_AUTH) {
      console.log('요청된 scope:', finalScope);
    }
  } else {
    if (DEBUG_AUTH) {
      console.log('scope를 요청하지 않음 - 모든 사용 가능한 scope가 포함됩니다.');
    }
  }
  
  // idp 파라미터 추가 (IDP를 고정하기 위해)
  // 주의: defaultIdp가 유효한 형식인지 확인 (빈 문자열이 아닌 경우에만 추가)
  if (defaultIdp && defaultIdp.trim() !== '') {
    // IAS 테넌트 URL 형식이 아닌 IDP 이름만 사용
    // 예: "ias-trust", "default" 등
    loginUrl += `&idp=${encodeURIComponent(defaultIdp.trim())}`;
  }
  
  if (state) {
    loginUrl += `&state=${encodeURIComponent(state)}`;
  }
  
  if (DEBUG_AUTH) {
    console.log('IAS 로그인 URL 생성 (Authorization Code Flow):', {
      xsappname,
      scope: finalScope || 'not specified (will include all available scopes)',
      requestedScope: requestedScope || null,
      scimScope: scimScope || null,
      baseUrl,
      callbackUri,
      state,
      idp: defaultIdp || 'not specified (will show provider selection)',
      'X-Forwarded-Host': req.get('X-Forwarded-Host'),
      'req.get(host)': req.get('host'),
      'req.headers.host': req.headers.host
    });
  }

  res.json({ loginUrl, redirectUri: callbackUri, scope: requestedScope || null });
});

// IAS 콜백 엔드포인트 (Authorization Code Flow)
router.get('/callback', async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    
    if (DEBUG_AUTH) {
      console.log('=== /api/auth/callback 엔드포인트 실행 시작 ===');
      console.log('요청 정보:', {
        method: req.method,
        path: req.path,
        url: req.url,
        query: req.query,
        headers: {
          host: req.headers.host,
          'x-forwarded-host': req.headers['x-forwarded-host'],
          'x-forwarded-proto': req.headers['x-forwarded-proto']
        }
      });
      console.log('IAS 콜백 요청 받음:', {
        code: req.query.code ? '있음' : '없음',
        state: req.query.state,
        error: req.query.error,
        error_description: req.query.error_description,
        baseUrl,
        'X-Forwarded-Host': req.get('X-Forwarded-Host'),
        'req.get(host)': req.get('host'),
        'req.headers.host': req.headers.host,
        'X-Forwarded-Proto': req.get('X-Forwarded-Proto'),
        'req.protocol': req.protocol,
        'VCAP_SERVICES': !!process.env.VCAP_SERVICES
      });
    }
    
    const code = req.query.code as string;
    const state = req.query.state as string || '';
    const error = req.query.error as string;
    const errorDescription = req.query.error_description as string;
    
    if (error) {
      const currentCallbackUri = `${baseUrl}/api/auth/callback`;
      
      console.error('IAS 콜백 오류:', error, errorDescription || '');
      if (DEBUG_AUTH) {
        console.error('IAS 콜백 오류 상세:', {
          error,
          error_description: errorDescription,
          baseUrl,
          currentCallbackUri,
          'X-Forwarded-Host': req.get('X-Forwarded-Host'),
          'req.get(host)': req.get('host'),
          'req.headers.host': req.headers.host,
          'X-Forwarded-Proto': req.get('X-Forwarded-Proto'),
          'VCAP_SERVICES': !!process.env.VCAP_SERVICES,
          '주의': 'redirect_uri가 XSUAA 설정과 일치하지 않을 수 있습니다. 현재 redirect_uri와 xs-security.json의 redirect-uris를 비교하세요.'
        });
      }
      
      // invalid_scope 에러의 경우, scope를 요청하지 않고 다시 시도
      // 또는 에러를 무시하고 로그인 페이지로 리다이렉트 (무한 루프 방지)
      if (error === 'invalid_scope') {
        console.warn('invalid_scope 에러 발생 - scope 없이 로그인 URL 재생성');
        // scope 없이 로그인 URL 재생성
        const callbackUri = `${baseUrl}/api/auth/callback`;
        let defaultIdp = process.env.DEFAULT_IDP || '';
        
        // DEFAULT_IDP가 설정되지 않았을 경우 기본값 사용
        if (!defaultIdp || defaultIdp.trim() === '') {
          defaultIdp = 'default';
        }
        
        let retryLoginUrl = `${xsuaaConfig.url}/oauth/authorize?` +
          `client_id=${encodeURIComponent(xsuaaConfig.clientid)}` +
          `&response_type=code` +
          `&redirect_uri=${encodeURIComponent(callbackUri)}`;
        
        if (defaultIdp && defaultIdp.trim() !== '') {
          retryLoginUrl += `&idp=${encodeURIComponent(defaultIdp.trim())}`;
        }
        
        return res.redirect(retryLoginUrl);
      }
      
      // 다른 에러의 경우 에러를 프론트엔드로 전달 (쿼리 파라미터로)
      const errorParams = new URLSearchParams({
        error: error,
        ...(errorDescription ? { error_description: errorDescription } : {})
      });
      return res.redirect(`/?${errorParams.toString()}`);
    }
    
    if (!code) {
      console.error('Authorization code가 없습니다.');
      return res.redirect('/?error=no_code');
    }
    
    if (!USE_XSUAA || !xsuaaConfig) {
      console.error('XSUAA 설정이 없습니다.');
      return res.redirect('/?error=no_xsuaa_config');
    }
    
    // Authorization code를 access token으로 교환
    // baseUrl은 이미 위에서 선언됨
    const redirectUri = `${baseUrl}/api/auth/callback`;
    
    if (DEBUG_AUTH) {
      console.log('Callback 처리 - Base URL 정보:', {
        baseUrl,
        redirectUri,
        'X-Forwarded-Host': req.get('X-Forwarded-Host'),
        'req.get(host)': req.get('host'),
        'req.headers.host': req.headers.host
      });
    }
    
    const tokenRequestData = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      client_id: xsuaaConfig.clientid,
      redirect_uri: redirectUri
    });
    
    // client_secret이 있으면 추가 (XSUAA의 경우 필요할 수 있음)
    if (xsuaaConfig.clientsecret) {
      tokenRequestData.append('client_secret', xsuaaConfig.clientsecret);
    }
    
    if (DEBUG_AUTH) {
      console.log('토큰 교환 요청:', {
        url: `${xsuaaConfig.url}/oauth/token`,
        client_id: xsuaaConfig.clientid,
        redirect_uri: redirectUri,
        has_client_secret: !!xsuaaConfig.clientsecret
      });
    }
    
    try {
      const tokenResponse = await fetch(`${xsuaaConfig.url}/oauth/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenRequestData.toString()
      });
      
      const responseText = await tokenResponse.text();
      
      if (!tokenResponse.ok) {
        console.error('토큰 교환 실패:', tokenResponse.status);
        if (DEBUG_AUTH) {
          console.error('토큰 교환 실패 상세:', responseText);
        }
        return res.redirect(`/?error=token_exchange_failed&error_description=${encodeURIComponent(responseText.substring(0, 200))}`);
      }
      
      if (DEBUG_AUTH) {
        console.log('토큰 교환 응답:', {
          status: tokenResponse.status,
          statusText: tokenResponse.statusText,
          hasBody: !!responseText
        });
      }
      
      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('토큰 응답 파싱 실패:', parseError, responseText);
        return res.redirect('/?error=token_parse_error');
      }
      
      const accessToken = tokenData.access_token;
      
      if (!accessToken) {
        console.error('Access token을 받지 못했습니다. 응답:', tokenData);
        return res.redirect('/?error=no_access_token');
      }
      
      // SCIM Users API 호출하여 userName 가져오기
      let userName = null;
      try {
        // 토큰에서 user_uuid 추출
        const decoded = jwt.decode(accessToken, { complete: true }) as any;
        const payload = decoded?.payload;
        
        // user_uuid는 여러 위치에서 찾을 수 있음
        const xsUserAttributes = payload?.['xs.user.attributes'] || {};
        const extAttr = payload?.ext_attr || {};
        const customAttributes = payload?.custom_attributes || {};
        const userAttributes = payload?.user_attributes || {};
        
        const userUuid = 
          xsUserAttributes.user_uuid || 
          extAttr.user_uuid || 
          customAttributes.user_uuid || 
          userAttributes.user_uuid ||
          payload?.user_uuid;
        
        if (DEBUG_AUTH) {
          console.log('=== 토큰 Payload 전체 (IAS SCIM API 호출 전) ===');
          console.log(JSON.stringify(payload, null, 2));
          console.log('=== 토큰 Payload 끝 ===');
          console.log('토큰에서 user_uuid 추출 (SCIM API 호출 전):', {
            userUuid: userUuid || '(없음)',
            foundIn: userUuid ? (
              xsUserAttributes.user_uuid ? 'xs.user.attributes' :
              extAttr.user_uuid ? 'ext_attr' :
              customAttributes.user_uuid ? 'custom_attributes' :
              userAttributes.user_uuid ? 'user_attributes' :
              'payload.user_uuid'
            ) : 'not found',
            checkedLocations: {
              'xs.user.attributes': xsUserAttributes.user_uuid || '(없음)',
              'ext_attr': extAttr.user_uuid || '(없음)',
              'custom_attributes': customAttributes.user_uuid || '(없음)',
              'user_attributes': userAttributes.user_uuid || '(없음)',
              'payload.user_uuid': payload?.user_uuid || '(없음)'
            }
          });
        }
        
        if (userUuid) {
          // IAS SCIM API URL (환경변수에서 가져오거나 기본값 사용)
          const iasBaseUrl = process.env.IAS_BASE_URL || 'https://avbayppic.accounts.ondemand.com';
          const scimUrl = `${iasBaseUrl}/scim/Users/${userUuid}`;
          
          // Basic 인증을 위한 환경변수 확인
          const iasApiUsername = process.env.IAS_API_USERNAME;
          const iasApiPassword = process.env.IAS_API_PASSWORD;
          
          if (!iasApiUsername || !iasApiPassword) {
            console.warn('IAS SCIM API 호출 실패: IAS_API_USERNAME 또는 IAS_API_PASSWORD 환경변수가 설정되지 않았습니다.');
          } else {
            // Basic 인증 헤더 생성
            const basicAuth = Buffer.from(`${iasApiUsername}:${iasApiPassword}`).toString('base64');
            
            if (DEBUG_AUTH) {
              console.log('IAS SCIM API 호출:', { 
                scimUrl, 
                userUuid,
                username: iasApiUsername
              });
            }
            
            const scimResponse = await fetch(scimUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            });
            
            if (scimResponse.ok) {
              const scimData = await scimResponse.json() as any;
              userName = scimData.userName;
              if (DEBUG_AUTH) {
                console.log('IAS SCIM API 응답에서 userName 추출:', userName);
              }
            } else {
              const errorText = await scimResponse.text();
              const errorData = errorText ? (() => {
                try {
                  return JSON.parse(errorText);
                } catch {
                  return errorText;
                }
              })() : null;
              
              console.warn('IAS SCIM Users API 호출 실패:', scimResponse.status, scimResponse.statusText);
              if (DEBUG_AUTH) {
                console.warn('IAS SCIM API 오류 상세:', errorData);
              }
            }
          }
        } else {
          if (DEBUG_AUTH) {
            console.warn('user_uuid를 찾을 수 없어 IAS SCIM API 호출을 건너뜁니다');
          }
        }
      } catch (scimError: any) {
        console.error('IAS SCIM Users API 호출 오류:', scimError?.message || 'Unknown error');
        if (DEBUG_AUTH) {
          console.error('IAS SCIM API 호출 스택:', scimError?.stack);
        }
        // SCIM API 실패해도 로그인은 계속 진행
      }
      
      if (DEBUG_AUTH) {
        console.log('토큰 교환 성공, 프론트엔드로 리다이렉트');
      }
      
      // Self-defined Attributes 읽기 (로그는 디버그 모드에서만)
      if (DEBUG_AUTH) {
        try {
          const decoded = jwt.decode(accessToken, { complete: true }) as any;
          const payload = decoded?.payload || {};
          
          // Self-defined Attributes가 포함될 수 있는 여러 위치에서 읽기
          const xsUserAttributes = payload['xs.user.attributes'] || {};
          const extAttr = payload.ext_attr || {};
          const customAttributes = payload.custom_attributes || {};
          const userAttributes = payload.user_attributes || {};
          
          // employee_number 읽기 (여러 위치에서 시도)
          const employeeNumber = 
            xsUserAttributes.employee_number || 
            extAttr.employee_number || 
            customAttributes.employee_number ||
            userAttributes.employee_number ||
            payload.employee_number;
          
          // 기타 Self-defined Attributes 읽기
          const selfDefinedAttributes = {
            employee_number: employeeNumber,
            first_name: xsUserAttributes.first_name || extAttr.first_name || customAttributes.first_name || payload.first_name,
            last_name: xsUserAttributes.last_name || extAttr.last_name || customAttributes.last_name || payload.last_name,
            locale: xsUserAttributes.locale || extAttr.locale || customAttributes.locale || payload.locale,
            mail: xsUserAttributes.mail || extAttr.mail || customAttributes.mail || payload.mail || payload.email,
            user_uuid: xsUserAttributes.user_uuid || extAttr.user_uuid || customAttributes.user_uuid || payload.user_uuid
          };
          
          console.log('=== Self-defined Attributes 확인 (로그인 직후) ===');
          console.log('xs.user.attributes:', xsUserAttributes);
          console.log('ext_attr:', extAttr);
          console.log('custom_attributes:', customAttributes);
          console.log('user_attributes:', userAttributes);
          console.log('직접 속성 (payload):', {
            employee_number: payload.employee_number,
            first_name: payload.first_name,
            last_name: payload.last_name,
            locale: payload.locale,
            mail: payload.mail,
            user_uuid: payload.user_uuid
          });
          console.log('추출된 Self-defined Attributes:', selfDefinedAttributes);
          console.log('employee_number 값:', employeeNumber || '(없음)');
          console.log('=== Self-defined Attributes 확인 끝 ===');
        } catch (attrError: any) {
          console.error('Self-defined Attributes 읽기 오류:', attrError?.message || attrError);
        }
      }
      
      // 토큰에서 사용자 정보 추출하여 로그인 이력 저장
      try {
        const { userInfo } = await validateXSUAATokenHelper(accessToken);
        const clientIp = getClientIp(req);
        const userAgent = req.get('User-Agent') || 'unknown';
        
        // DB에서 사용자 정보 조회 (user_id 필요)
        let dbUser = null;
        try {
          if (DB_TYPE === 'postgres') {
            const userResult = await db.query(
              'SELECT id, userid FROM users WHERE userid = $1 AND is_active = true',
              [userInfo.userid]
            );
            if (userResult.rows.length > 0) {
              dbUser = userResult.rows[0];
            }
          } else {
            const userResult = await db.query(
              'SELECT ID, USERID FROM EAR.users WHERE USERID = ? AND IS_ACTIVE = true',
              [userInfo.userid]
            );
            if (userResult.rows.length > 0) {
              dbUser = userResult.rows[0];
            }
          }
        } catch (dbError) {
          console.warn('DB 사용자 조회 실패 (로그인 이력 저장 스킵):', dbError);
        }
        
        // 로그인 이력 저장 (DB에 사용자가 있는 경우)
        if (dbUser) {
          try {
            if (DB_TYPE === 'postgres') {
              await db.query(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
                [dbUser.id]
              );
              
              await db.query(
                'INSERT INTO login_history (user_id, userid, ip_address, user_agent, login_status) VALUES ($1, $2, $3, $4, $5)',
                [dbUser.id, userInfo.userid, clientIp, userAgent, 'success']
              );
            } else {
              await db.query(
                'UPDATE EAR.users SET LAST_LOGIN = CURRENT_TIMESTAMP WHERE ID = ?',
                [dbUser.ID]
              );
              
              await db.query(
                'INSERT INTO EAR.login_history (USER_ID, USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS) VALUES (?, ?, ?, ?, ?)',
                [dbUser.ID, userInfo.userid, clientIp, userAgent, 'success']
              );
            }
            console.log('IAS 로그인 이력 저장 완료:', { userid: userInfo.userid, clientIp });
          } catch (historyError) {
            console.error('로그인 이력 저장 오류:', historyError);
            // 로그인 이력 저장 실패해도 로그인은 계속 진행
          }
        } else {
          // DB에 사용자가 없어도 로그인 이력 저장 (user_id 없이)
          try {
            if (DB_TYPE === 'postgres') {
              await db.query(
                'INSERT INTO login_history (userid, ip_address, user_agent, login_status) VALUES ($1, $2, $3, $4)',
                [userInfo.userid, clientIp, userAgent, 'success']
              );
            } else {
              await db.query(
                'INSERT INTO EAR.login_history (USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS) VALUES (?, ?, ?, ?)',
                [userInfo.userid, clientIp, userAgent, 'success']
              );
            }
            console.log('IAS 로그인 이력 저장 완료 (DB 사용자 없음):', { userid: userInfo.userid, clientIp });
          } catch (historyError) {
            console.error('로그인 이력 저장 오류:', historyError);
          }
        }
      } catch (tokenError) {
        console.error('토큰에서 사용자 정보 추출 실패 (로그인 이력 저장 스킵):', tokenError);
        // 토큰 파싱 실패해도 로그인은 계속 진행
      }
      
      // 토큰을 프론트엔드로 전달 (쿼리 파라미터로, 보안상 좋지 않지만 임시로)
      // 실제 운영 환경에서는 세션이나 httpOnly 쿠키 사용 권장
      const tokenParams = new URLSearchParams({
        access_token: accessToken
      });
      
      if (userName) {
        tokenParams.append('userName', userName);
      }
      
      if (state) {
        tokenParams.append('state', state);
      }
      
      // 프론트엔드로 리다이렉트 (토큰과 함께)
      res.redirect(`/?${tokenParams.toString()}`);
    } catch (fetchError: any) {
      console.error('토큰 교환 요청 중 오류:', fetchError?.message || 'Unknown error');
      return res.redirect(`/?error=fetch_error&error_description=${encodeURIComponent(fetchError?.message || '토큰 교환 요청 실패')}`);
    }
  } catch (error: any) {
    console.error('IAS 콜백 오류:', error?.message || 'Unknown error');
    if (DEBUG_AUTH) {
      console.error('IAS 콜백 오류 스택:', error?.stack);
    }
    res.redirect(`/?error=callback_error&error_description=${encodeURIComponent(error?.message || '알 수 없는 오류')}`);
  }
});

// 로그아웃
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = authReq.user;
    
    // 로그아웃 이력 저장
    if (user?.userid) {
      try {
        const clientIp = getClientIp(req);
        const userAgent = req.get('User-Agent') || 'unknown';
        
        // DB에서 사용자 정보 조회 (user_id 필요)
        let dbUser = null;
        try {
          if (DB_TYPE === 'postgres') {
            const userResult = await db.query(
              'SELECT id FROM users WHERE userid = $1 AND is_active = true',
              [user.userid]
            );
            if (userResult.rows.length > 0) {
              dbUser = userResult.rows[0];
            }
          } else {
            const userResult = await db.query(
              'SELECT ID FROM EAR.users WHERE USERID = ? AND IS_ACTIVE = true',
              [user.userid]
            );
            if (userResult.rows.length > 0) {
              dbUser = userResult.rows[0];
            }
          }
        } catch (dbError) {
          console.warn('DB 사용자 조회 실패 (로그아웃 이력 저장 스킵):', dbError);
        }
        
        // 로그아웃 이력 저장
        if (dbUser) {
          try {
            if (DB_TYPE === 'postgres') {
              await db.query(
                'INSERT INTO login_history (user_id, userid, ip_address, user_agent, login_status) VALUES ($1, $2, $3, $4, $5)',
                [dbUser.id, user.userid, clientIp, userAgent, 'logout']
              );
            } else {
              await db.query(
                'INSERT INTO EAR.login_history (USER_ID, USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS) VALUES (?, ?, ?, ?, ?)',
                [dbUser.ID, user.userid, clientIp, userAgent, 'logout']
              );
            }
            console.log('로그아웃 이력 저장 완료:', { userid: user.userid, clientIp });
          } catch (historyError) {
            console.error('로그아웃 이력 저장 오류:', historyError);
            // 로그아웃 이력 저장 실패해도 로그아웃은 계속 진행
          }
        } else {
          // DB에 사용자가 없어도 로그아웃 이력 저장 (user_id 없이)
          try {
            if (DB_TYPE === 'postgres') {
              await db.query(
                'INSERT INTO login_history (userid, ip_address, user_agent, login_status) VALUES ($1, $2, $3, $4)',
                [user.userid, clientIp, userAgent, 'logout']
              );
            } else {
              await db.query(
                'INSERT INTO EAR.login_history (USERID, IP_ADDRESS, USER_AGENT, LOGIN_STATUS) VALUES (?, ?, ?, ?)',
                [user.userid, clientIp, userAgent, 'logout']
              );
            }
            console.log('로그아웃 이력 저장 완료 (DB 사용자 없음):', { userid: user.userid, clientIp });
          } catch (historyError) {
            console.error('로그아웃 이력 저장 오류:', historyError);
          }
        }
      } catch (error) {
        console.error('로그아웃 이력 저장 중 오류:', error);
        // 로그아웃 이력 저장 실패해도 로그아웃은 계속 진행
      }
    }
    
    // IAS 로그아웃 URL 생성 (IAS가 활성화된 경우)
    let logoutUrl = null;
    let iasLoginUrl = null;
    if (USE_XSUAA && xsuaaConfig) {
      try {
        // Cloud Foundry Custom Domain 환경을 고려한 Base URL 생성
        const baseUrl = getBaseUrl(req);
        
        // IAS 로그인 URL 생성 (로그아웃 후 리다이렉트용)
        // scope를 요청하지 않으면 사용자가 가지고 있는 모든 scope가 토큰에 포함됩니다.
        const callbackUri = `${baseUrl}/api/auth/callback`;
        let defaultIdp = process.env.DEFAULT_IDP || '';
        
        // DEFAULT_IDP가 설정되지 않았을 경우 기본값 사용
        if (!defaultIdp || defaultIdp.trim() === '') {
          defaultIdp = 'default';
        }
        
        let loginUrl = `${xsuaaConfig.url}/oauth/authorize?` +
          `client_id=${encodeURIComponent(xsuaaConfig.clientid)}` +
          `&response_type=code` +
          `&redirect_uri=${encodeURIComponent(callbackUri)}`;
        
        if (defaultIdp && defaultIdp.trim() !== '') {
          loginUrl += `&idp=${encodeURIComponent(defaultIdp.trim())}`;
        }
        
        iasLoginUrl = loginUrl;
        
        // XSUAA 로그아웃 URL 생성 (로그인과 일관성 유지)
        // XSUAA가 Trust Configuration을 통해 IAS 세션도 함께 종료
        // 로그인을 XSUAA로 시작했으므로 로그아웃도 XSUAA로 처리하는 것이 표준 패턴
        logoutUrl = `${xsuaaConfig.url}/logout?client_id=${encodeURIComponent(xsuaaConfig.clientid)}`;
        
        console.log('XSUAA 로그아웃 URL 생성:', {
          logoutUrl,
          iasLoginUrl,
          xsuaaUrl: xsuaaConfig.url,
          clientId: xsuaaConfig.clientid,
          baseUrl
        });
      } catch (urlError) {
        console.error('XSUAA 로그아웃 URL 생성 오류:', urlError);
      }
    }
    
    res.json({ 
      success: true, 
      message: '로그아웃되었습니다.',
      logoutUrl: logoutUrl,
      iasLoginUrl: iasLoginUrl
    });
  } catch (error) {
    console.error('로그아웃 오류:', error);
    res.json({ 
      success: true, 
      message: '로그아웃되었습니다.',
      logoutUrl: null,
      iasLoginUrl: null
    });
  }
});

// 비밀번호 변경
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: '인증이 필요합니다.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 현재 비밀번호 확인
    let userResult;
    if (DB_TYPE === 'postgres') {
      userResult = await db.query(
        'SELECT password_hash FROM users WHERE id = $1',
        [decoded.userId]
      );
    } else {
      // HANA
      userResult = await db.query(
        'SELECT PASSWORD_HASH FROM EAR.users WHERE ID = ?',
        [decoded.userId]
      );
    }

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
    
    if (!isValidPassword) {
      return res.status(400).json({ error: '현재 비밀번호가 올바르지 않습니다.' });
    }

    // 새 비밀번호 해시화
    const saltRounds = 10;
    const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    if (DB_TYPE === 'postgres') {
      await db.query(
        'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPasswordHash, decoded.userId]
      );
    } else {
      // HANA
      await db.query(
        'UPDATE EAR.users SET PASSWORD_HASH = ?, UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = ?',
        [newPasswordHash, decoded.userId]
      );
    }

    res.json({ success: true, message: '비밀번호가 변경되었습니다.' });

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;
