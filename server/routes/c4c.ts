import express from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
const jwt = require('jsonwebtoken');

const router = express.Router();

// 디버그 모드 (환경 변수로 제어)
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

// displayId가 "0"으로 시작하면 "X"로 변경하는 헬퍼 함수
function normalizeDisplayId(displayId: string | null | undefined): string {
  if (!displayId) {
    return '';
  }
  
  // "0"으로 시작하는 경우 "X"로 변경
  if (displayId.startsWith('0')) {
    return 'X' + displayId.substring(1);
  }
  
  return displayId;
}

// C4C 케이스 목록 조회
router.get('/cases', authenticateToken, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const currentUserEmail = authReq.user?.email || authReq.user?.userid;
    
    if (!currentUserEmail) {
      return res.status(400).json({ 
        error: '사용자 정보를 찾을 수 없습니다.' 
      });
    }
    
    // 서버 사이드 환경변수에서 인증 정보 읽기
    const username = process.env.C4C_USERNAME || process.env.VITE_C4C_USERNAME;
    const password = process.env.C4C_PASSWORD || process.env.VITE_C4C_PASSWORD;
    
    if (!username || !password) {
      console.error('C4C API 인증 정보가 설정되지 않았습니다.');
      return res.status(500).json({ 
        error: 'C4C API 인증 정보가 설정되지 않았습니다.' 
      });
    }
    
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    // 1. 현재 사용자의 C4C 내부 ID 조회 (여러 방법 시도)
    let c4cUserId = null;
    
    // 방법1 관련 아래주석은 백업용으로 지우지 말것!!!
    /*
    // 방법 1: User Service API (다양한 엔드포인트와 필터 형식 시도)
    const userServiceEndpoints = [
      `https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/user-service/users?$filter=emailAddress eq '${currentUserEmail}'`,
      `https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/user-service/users?$filter=email eq '${currentUserEmail}'`,
      `https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/user-service/users?$filter=userName eq '${currentUserEmail}'`,
      `https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/user-service/users?$filter=logonName eq '${currentUserEmail}'`
    ];
    
    for (const userServiceUrl of userServiceEndpoints) {
      try {
        console.log('C4C User Service API 호출 시도:', { url: userServiceUrl, email: currentUserEmail });
        
        const userResponse = await fetch(userServiceUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
          }
        });
        
        if (userResponse.ok) {
          const userData = await userResponse.json() as any;
          console.log('C4C User Service 응답:', JSON.stringify(userData, null, 2));
          
          // 응답 구조에 따라 ID 추출
          if (userData.value) {
            if (Array.isArray(userData.value) && userData.value.length > 0) {
              c4cUserId = userData.value[0].id;
            } else if (userData.value.id) {
              c4cUserId = userData.value.id;
            }
          } else if (userData.id) {
            c4cUserId = userData.id;
          }
          
          if (c4cUserId) {
            console.log('추출된 C4C User ID:', c4cUserId);
            break; // 성공하면 루프 종료
          }
        } else {
          const errorText = await userResponse.text();
          console.warn('C4C User Service API 호출 실패:', userResponse.status, errorText.substring(0, 200));
          // 다음 엔드포인트 시도
        }
      } catch (userError) {
        console.error('C4C User Service API 호출 오류:', userError);
        // 다음 엔드포인트 시도
      }
    }
    */
    
    // 아래 방법2 주속은 지우지 말것 
    // 방법 2: Case 목록에서 최근 생성된 Case의 createdBy를 사용 (User Service 실패 시)
    /*
    if (!c4cUserId) {
      try {
        console.log('Case 목록에서 사용자 ID 추출 시도');
        const tempCaseUrl = 'https://my1002010.au1.test.crm.cloud.sap/sap/c4c/api/v1/case-service/cases?$top=1&$orderby=adminData/createdOn desc';
        
        const tempResponse = await fetch(tempCaseUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
          }
        });
        
        if (tempResponse.ok) {
          const tempData = await tempResponse.json() as any;
          const tempCases = Array.isArray(tempData.value) ? tempData.value : (tempData.value ? [tempData.value] : []);
          
          // createdByName이 현재 사용자와 일치하는 Case 찾기
          const matchingCase = tempCases.find((caseItem: any) => {
            const createdByName = caseItem.adminData?.createdByName?.toLowerCase();
            return createdByName === currentUserEmail.toLowerCase() || 
                   (createdByName && createdByName.includes(currentUserEmail.toLowerCase().split('@')[0]));
          });
          
          if (matchingCase?.adminData?.createdBy) {
            c4cUserId = matchingCase.adminData.createdBy;
            console.log('Case 목록에서 추출된 C4C User ID:', c4cUserId);
          }
        }
      } catch (tempError) {
        console.error('Case 목록에서 사용자 ID 추출 실패:', tempError);
      }
    }
    */
   
    // 2. IAS SCIM API 호출하여 userName 추출
    let userName = null;
    try {
      // 요청 헤더에서 토큰 추출
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      
      if (token) {
        // 토큰에서 user_uuid 추출
        const decoded = jwt.decode(token, { complete: true }) as any;
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
        
        if (userUuid) {
          // IAS SCIM API URL (환경변수에서 가져오거나 기본값 사용)
          const iasBaseUrl = process.env.IAS_BASE_URL || 'https://avbayppic.accounts.ondemand.com';
          const scimUrl = `${iasBaseUrl}/scim/Users/${userUuid}`;
          console.log('IAS SCIM API URL:', scimUrl);
          console.log('IAS Base URL (환경변수):', process.env.IAS_BASE_URL || '기본값(개발서버)');
          
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
                'Accept': '*/*',
                'User-Agent': 'Node.js',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
              }
            });
            
            if (scimResponse.ok) {
              const scimData = await scimResponse.json() as any;
              
              // userName 필드 직접 추출 (최상위 레벨)
              userName = scimData?.userName || null;
              
              if (DEBUG_AUTH) {
                // 디버깅: 전체 SCIM 응답 로그 출력
                console.log('=== IAS SCIM API 전체 응답 ===');
                console.log(JSON.stringify(scimData, null, 2));
                console.log('=== IAS SCIM API 응답 끝 ===');
                console.log('=== IAS SCIM API 응답에서 userName 추출 ===');
                console.log('추출된 userName:', userName);
                console.log('scimData.userName:', scimData?.userName);
                console.log('scimData.displayName:', scimData?.displayName);
                console.log('=== userName 로그 출력 완료 ===');
              }
              
              if (!userName) {
                console.warn('IAS SCIM API 응답에서 userName을 찾을 수 없습니다.');
                if (DEBUG_AUTH) {
                  console.warn('사용 가능한 필드:', Object.keys(scimData || {}));
                }
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
              
              console.warn('IAS SCIM Users API 호출 실패:', {
                status: scimResponse.status,
                statusText: scimResponse.statusText,
                error: errorData
              });
            }
          }
        } else {
          if (DEBUG_AUTH) {
            console.warn('=== user_uuid를 찾을 수 없어 IAS SCIM API 호출을 건너뜁니다 ===');
            console.warn('토큰 payload에서 확인한 위치들:', {
              'xs.user.attributes': xsUserAttributes,
              'ext_attr': extAttr,
              'custom_attributes': customAttributes,
              'user_attributes': userAttributes,
              'payload.user_uuid': payload?.user_uuid
            });
            console.warn('=== user_uuid 없음 로그 끝 ===');
          }
        }
      }
    } catch (scimError: any) {
      console.error('IAS SCIM Users API 호출 오류:', scimError?.message || 'Unknown error');
      if (DEBUG_AUTH) {
        console.error('IAS SCIM API 호출 스택:', scimError?.stack);
      }
      // SCIM API 실패해도 Case 조회는 계속 진행
    }
    
    // 3. Case 목록 조회 (사용자 필터링)
    // C4C Base URL (환경변수에서 가져오거나 기본값 사용)
    const c4cBaseUrl = process.env.C4C_BASE_URL || 'https://my1002010.au1.test.crm.cloud.sap';
    let caseUrl = `${c4cBaseUrl}/sap/c4c/api/v1/case-service/cases`;
    if (userName) {
      // userName을 사용하여 contact/displayId로 필터링 (변환된 값 사용)
      const normalizedDisplayId = normalizeDisplayId(userName);
      const encodedDisplayId = encodeURIComponent(normalizedDisplayId);
      caseUrl += `?$filter=contact/displayId eq '${encodedDisplayId}'`;
      if (DEBUG_AUTH) {
        console.log('=== 완성된 Case 목록 조회 URL ===');
        console.log('원본 userName:', userName);
        console.log('변환된 displayId:', normalizedDisplayId);
        console.log('URL:', caseUrl);
        console.log('=== URL 로그 출력 완료 ===');
      }
    } else if (c4cUserId) {
      // 사용자 ID로 필터링
      const encodedUserId = encodeURIComponent(c4cUserId);
      // 아래 주석은 백업용으로 지우지 말것!!!
      // caseUrl += `?$filter=adminData/createdBy eq '${encodedUserId}'`;
      console.log('Case 목록 조회 (필터링):', { c4cUserId, caseUrl });
    } else {
      console.warn('Case 목록 조회 (필터 없음 - User ID를 찾을 수 없음, 전체 케이스 조회)');
      // User ID를 찾을 수 없으면 전체 케이스 조회
    }
    
    const response = await fetch(caseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      const errorText = await response.text();
      console.error('C4C Case API 응답 오류:', response.status, errorText);
      res.status(response.status).json({ 
        error: 'C4C API 호출 실패',
        status: response.status,
        details: errorText 
      });
    }
  } catch (error) {
    console.error('C4C API 호출 오류:', error);
    res.status(500).json({ error: 'C4C API 호출 중 오류가 발생했습니다.' });
  }
});

// C4C 케이스 상세 조회
router.get('/cases/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 서버 사이드 환경변수에서 인증 정보 읽기
    const username = process.env.C4C_USERNAME || process.env.VITE_C4C_USERNAME;
    const password = process.env.C4C_PASSWORD || process.env.VITE_C4C_PASSWORD;
    
    if (!username || !password) {
      console.error('C4C API 인증 정보가 설정되지 않았습니다.');
      return res.status(500).json({ 
        error: 'C4C API 인증 정보가 설정되지 않았습니다.' 
      });
    }
    
    const credentials = Buffer.from(`${username}:${password}`).toString('base64');
    
    // C4C Base URL (환경변수에서 가져오거나 기본값 사용)
    const c4cBaseUrl = process.env.C4C_BASE_URL || 'https://my1002010.au1.test.crm.cloud.sap';
    const caseUrl = `${c4cBaseUrl}/sap/c4c/api/v1/case-service/cases/${id}`;
    
    const response = await fetch(caseUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'APIKey': 'ZhQTrUa9MULNGxozr2ksCT1RYRZbby11'
      }
    });

    if (response.ok) {
      const data = await response.json();
      res.json(data);
    } else {
      const errorText = await response.text();
      console.error('C4C Case 상세 API 응답 오류:', response.status, errorText);
      res.status(response.status).json({ 
        error: 'C4C API 호출 실패',
        status: response.status,
        details: errorText 
      });
    }
  } catch (error) {
    console.error('C4C Case 상세 API 호출 오류:', error);
    res.status(500).json({ error: 'C4C API 호출 중 오류가 발생했습니다.' });
  }
});

export default router;


