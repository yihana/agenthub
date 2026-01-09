import express from 'express';
import * as xsenv from '@sap/xsenv';
import * as xssec from '@sap/xssec';
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// 디버그 모드 (환경 변수로 제어)
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

// XSUAA 사용 여부 확인
const USE_XSUAA = process.env.USE_XSUAA === 'true' || process.env.VCAP_SERVICES !== undefined;

// XSUAA 설정 로드 (CF 환경에서만)
let xsuaaConfig: any = null;

if (USE_XSUAA) {
  try {
    // 1) 정석: getServices를 사용해 credentials만 추출
    try {
      const services: any = (xsenv as any).getServices ? (xsenv as any).getServices({ xsuaa: { label: 'xsuaa' } }) : null;
      if (services?.xsuaa) xsuaaConfig = services.xsuaa;
    } catch {}

    // 2) 태그 기반 검색
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

    // 4) 필수 필드 확인
    if (!xsuaaConfig || !xsuaaConfig.clientid || !xsuaaConfig.url) {
      console.warn('XSUAA 자격증명(clientid/url)을 찾지 못했습니다. XSUAA 서비스 바인딩 상태를 확인하세요.');
      xsuaaConfig = null;
    }
  } catch (error) {
    console.warn('XSUAA 설정을 로드할 수 없습니다. JWT 인증을 사용합니다.', error);
  }
}

export interface AuthenticatedRequest extends Omit<express.Request, 'user'> {
  user?: {
    userId?: number;
    userid: string;
    email?: string;
    isAdmin: boolean;
    companyCode?: string;
    givenName?: string;
    familyName?: string;
    scopes?: string[];
    samlGroups?: string[];
  };
}

/**
 * XSUAA 토큰 검증 및 사용자 정보 추출
 */
async function validateXSUAAToken(token: string): Promise<any> {
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
        console.log('=== 토큰 Payload 전체 (middleware/auth.ts) ===');
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
        
        console.log('=== Self-defined Attributes 확인 (middleware) ===');
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
      
      // 사용자 정보 추출
      // 권한 확인 로직: xs.saml.groups에서 "EAR-ADMIN" 또는 "EAR-USER" 확인
      const xsSystemAttributes = payload['xs.system.attributes'] || {};
      const samlGroups = xsSystemAttributes['xs.saml.groups'] || [];
      
      const userInfo = {
        userid: payload.user_name || payload.email || payload.sub,
        email: payload.email,
        givenName: payload.given_name,
        familyName: payload.family_name,
        isAdmin: false,
        companyCode: 'SKN', // 일단 모든 사용자를 SKN으로 설정
        scopes: Array.isArray(payload.scope) ? payload.scope : (payload.scope ? [payload.scope] : []),
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
          console.log('✅ 관리자 권한 확인됨 (middleware) - samlGroups:', samlGroups);
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
        
        if (Array.isArray(userInfo.scopes)) {
          userInfo.isAdmin = userInfo.scopes.some((s: string) => 
            adminScopePattern.test(s) || s.toLowerCase().includes('administrator')
          );
        }
      }
      
      resolve({
        securityContext: null,
        userInfo,
        tokenInfo: payload
      });
    } catch (parseError: any) {
      // JWT 파싱 실패 시 xssec로 폴백 시도
      if (DEBUG_AUTH) {
        console.warn('JWT 직접 파싱 실패, xssec로 폴백 시도:', parseError?.message || parseError);
      }
      
      try {
        xssec.createSecurityContext(token, xsuaaConfig, (error: any, ctx: any, tokenInfo: any) => {
          if (error) {
            return reject(new Error(`토큰 검증 실패: ${error?.message || error}`));
          }

          if (DEBUG_AUTH) {
            // 🔍 디버그 모드에서만 상세 로그 출력
            console.log('=== xssec 토큰 정보 전체 (middleware/auth.ts) ===');
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
            companyCode: 'SKN', // 일단 모든 사용자를 SKN으로 설정
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
              console.log('✅ 관리자 권한 확인됨 (middleware xssec) - samlGroups:', samlGroups);
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

/**
 * 통합 인증 미들웨어 - XSUAA 또는 JWT 토큰 지원
 * 요청 헤더의 Authorization 토큰을 검증하고 사용자 정보를 req.user에 추가
 */
export const authenticateToken: express.RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    
    // 토큰이 없거나 빈 문자열인 경우
    if (!token || token.length === 0) {
      res.status(401).json({ error: '인증 토큰이 필요합니다.' });
      return;
    }

    // XSUAA 사용 시
    if (USE_XSUAA && xsuaaConfig) {
      try {
        const { userInfo } = await validateXSUAAToken(token);
        authReq.user = userInfo;
        next();
        return;
      } catch (xsuaaError: any) {
        // XSUAA 검증 실패 시 JWT 폴백 (하이브리드 모드)
        if (DEBUG_AUTH) {
          console.warn('XSUAA 토큰 검증 실패, JWT 폴백 시도:', xsuaaError?.message || xsuaaError);
        }
        // JWT 검증으로 계속 진행
      }
    }

    // JWT 토큰 검증 (XSUAA 미사용 또는 폴백)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      authReq.user = {
        userId: decoded.userId,
        userid: decoded.userid,
        isAdmin: decoded.isAdmin || false,
        companyCode: decoded.companyCode || 'SKN'
      };
      
      next();
      return;
    } catch (jwtError) {
      res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
      return;
    }
  } catch (error) {
    console.error('인증 오류:', error);
    res.status(401).json({ error: '인증 처리 중 오류가 발생했습니다.' });
    return;
  }
}

/**
 * 허용된 그룹 권한 확인 미들웨어 (EAR-ADMIN, EAR-USER, EAR-5TIER)
 */
export const requireAllowedGroup: express.RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    
    if (!token || token.length === 0) {
      res.status(401).json({ error: '인증 토큰이 필요합니다.' });
      return;
    }

    // 먼저 authenticateToken을 통해 사용자 정보를 설정
    // XSUAA 사용 시
    if (USE_XSUAA && xsuaaConfig) {
      try {
        const { userInfo } = await validateXSUAAToken(token);
        const samlGroups: string[] = userInfo.samlGroups || [];
        const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
        const hasAllowedGroup = samlGroups.some((g: string) => allowedGroups.includes(g));
        
        console.log('🔍 requireAllowedGroup 체크:', {
          samlGroups: samlGroups,
          allowedGroups: allowedGroups,
          hasAllowedGroup: hasAllowedGroup,
          isAdmin: userInfo.isAdmin
        });
        
        if (!hasAllowedGroup) {
          res.status(403).json({ error: '허용된 그룹 권한이 필요합니다. (EAR-ADMIN, EAR-USER, EAR-5TIER)' });
          return;
        }
        
        authReq.user = userInfo;
        next();
        return;
      } catch (xsuaaError: any) {
        console.warn('XSUAA 토큰 검증 실패, JWT 폴백 시도:', xsuaaError?.message || xsuaaError);
      }
    }

    // JWT 토큰 검증 (폴백)
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      const samlGroups: string[] = decoded.samlGroups || [];
      const allowedGroups = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];
      const hasAllowedGroup = samlGroups.some((g: string) => allowedGroups.includes(g)) || decoded.isAdmin;
      
      console.log('🔍 requireAllowedGroup JWT 체크:', {
        samlGroups: samlGroups,
        allowedGroups: allowedGroups,
        hasAllowedGroup: hasAllowedGroup,
        isAdmin: decoded.isAdmin
      });
      
      if (!hasAllowedGroup) {
        res.status(403).json({ error: '허용된 그룹 권한이 필요합니다. (EAR-ADMIN, EAR-USER, EAR-5TIER)' });
        return;
      }
      
      authReq.user = {
        userId: decoded.userId,
        userid: decoded.userid,
        isAdmin: decoded.isAdmin || false,
        companyCode: decoded.companyCode || 'SKN',
        samlGroups: samlGroups
      };
      
      next();
      return;
    } catch (jwtError) {
      res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
      return;
    }
  } catch (error) {
    console.error('그룹 권한 확인 오류:', error);
    res.status(401).json({ error: '권한 확인 중 오류가 발생했습니다.' });
    return;
  }
};

/**
 * 관리자 권한 확인 미들웨어
 */
export const requireAdmin: express.RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
    
    // 토큰이 없거나 빈 문자열인 경우
    if (!token || token.length === 0) {
      res.status(401).json({ error: '인증 토큰이 필요합니다.' });
      return;
    }

    // XSUAA 사용 시
    if (USE_XSUAA && xsuaaConfig) {
      try {
        const { userInfo } = await validateXSUAAToken(token);
        
        if (!userInfo.isAdmin) {
          res.status(403).json({ error: '관리자 권한(EAR-ADMIN)이 필요합니다.' });
          return;
        }
        
        authReq.user = userInfo;
        next();
        return;
      } catch (xsuaaError: any) {
        // XSUAA 검증 실패 시 JWT 폴백
        console.warn('XSUAA 토큰 검증 실패, JWT 폴백 시도:', xsuaaError?.message || xsuaaError);
      }
    }

    // JWT 토큰 검증
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (!decoded.isAdmin) {
        res.status(403).json({ error: '관리자 권한이 필요합니다.' });
        return;
      }
      
      authReq.user = {
        userId: decoded.userId,
        userid: decoded.userid,
        isAdmin: decoded.isAdmin
      };
      
      next();
      return;
    } catch (jwtError) {
      res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
      return;
    }
  } catch (error) {
    console.error('관리자 권한 확인 오류:', error);
    res.status(401).json({ error: '권한 확인 중 오류가 발생했습니다.' });
    return;
  }
}

/**
 * 특정 스코프 확인 미들웨어
 */
export async function requireScope(scope: string): Promise<express.RequestHandler> {
  return async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      
      if (!token || token.length === 0) {
        res.status(401).json({ error: '인증 토큰이 필요합니다.' });
        return;
      }

      // XSUAA 사용 시
      if (USE_XSUAA && xsuaaConfig) {
        try {
          const { userInfo } = await validateXSUAAToken(token);
          const scopes = userInfo.scopes || [];
          const hasScope = scopes.some((s: string) => 
            s.toLowerCase() === scope.toLowerCase() || 
            s.toLowerCase().includes(scope.toLowerCase())
          );
          
          if (!hasScope) {
            res.status(403).json({ error: `권한(${scope})이 필요합니다.` });
            return;
          }
          
          authReq.user = userInfo;
          next();
          return;
        } catch (xsuaaError: any) {
          res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
          return;
        }
      }

      // JWT의 경우 스코프 검증 없이 통과 (하위 호환성)
      next();
      return;
    } catch (error) {
      console.error('스코프 확인 오류:', error);
      res.status(401).json({ error: '권한 확인 중 오류가 발생했습니다.' });
      return;
    }
  };
}



