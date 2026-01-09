import express from 'express';
import { db, DB_TYPE } from '../db';
import { authenticateToken } from '../middleware/auth';
import { OpenAI } from 'openai';
const jwt = require('jsonwebtoken');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const router = express.Router();

// 디버그 모드 (환경 변수로 제어)
const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

// Bearer Token 검증 미들웨어 (CALL_OF_SILENCE_TOKEN 환경변수와 비교)
const validateCallOfSilenceToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Bearer Token이 필요합니다.' });
  }
  
  const token = authHeader.replace('Bearer ', '').trim();
  const expectedToken = process.env.CALL_OF_SILENCE_TOKEN;
  
  if (!expectedToken) {
    console.error('CALL_OF_SILENCE_TOKEN 환경변수가 설정되지 않았습니다.');
    return res.status(500).json({ error: '서버 설정 오류' });
  }
  
  if (token !== expectedToken) {
    return res.status(401).json({ error: '유효하지 않은 토큰입니다.' });
  }
  
  next();
};

// POST /api/agent/intent/f3a9c1e7b2d84f09a6c5e1b37d92a477
router.post('/intent/f3a9c1e7b2d84f09a6c5e1b37d92a477', validateCallOfSilenceToken, async (req, res) => {
  try {
    const { id, tcode, contents, hash } = req.body;
    
    // 입력 검증
    if (!id || !tcode || !contents || !hash) {
      return res.status(400).json({ 
        error: '필수 필드가 누락되었습니다.',
        required: ['id', 'tcode', 'contents', 'hash']
      });
    }
    
    // 데이터 길이 검증
    if (tcode.length > 50) {
      return res.status(400).json({ error: 'tcode는 50자를 초과할 수 없습니다.' });
    }
    
    if (hash.length > 200) {
      return res.status(400).json({ error: 'hash는 200자를 초과할 수 없습니다.' });
    }
    
    // DB에 저장
    let savedData;
    if (DB_TYPE === 'postgres') {
      const result = await db.query(
        'INSERT INTO agent_intents (user_id, tcode, contents, hash) VALUES ($1, $2, $3, $4) RETURNING id, user_id, tcode, hash, created_at',
        [id, tcode, contents, hash]
      );
      savedData = result.rows[0];
    } else {
      // HANA
      await db.query(
        'INSERT INTO EAR.agent_intents (USER_ID, TCODE, CONTENTS, HASH) VALUES (?, ?, ?, ?)',
        [id, tcode, contents, hash]
      );
      
      // HANA는 RETURNING을 지원하지 않으므로 마지막 삽입된 레코드 조회
      const selectResult = await db.query(
        'SELECT TOP 1 ID, USER_ID, TCODE, HASH, CREATED_AT FROM EAR.agent_intents ORDER BY ID DESC',
        []
      );
      savedData = selectResult.rows?.[0] || selectResult[0];
    }
    
    res.status(201).json({
      success: true,
      message: '데이터가 성공적으로 저장되었습니다.',
      data: {
        id: savedData.id || savedData.ID,
        user_id: savedData.user_id || savedData.USER_ID,
        tcode: savedData.tcode || savedData.TCODE,
        hash: savedData.hash || savedData.HASH,
        created_at: savedData.created_at || savedData.CREATED_AT
      }
    });
    
  } catch (error: any) {
    console.error('Agent Intent 저장 오류:', error);
    res.status(500).json({ 
      error: '데이터 저장 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// GET /api/agent/recent-intent - userName으로 24시간 이내 최근 AGENT_INTENTS 조회
router.get('/recent-intent', authenticateToken, async (req, res) => {
  try {
    if (DEBUG_AUTH) {
      console.log('=== [AGENT_INTENTS] 최근 Intent 조회 시작 ===');
    }
    
    const authReq = req as any;
    const user = authReq.user;
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 사용자 정보 (초기):', {
        user: user ? {
          userid: user.userid,
          id: user.id,
          fullName: user.fullName,
          email: user.email
        } : null,
        hasUser: !!user
      });
    }
    
    // 1. 먼저 IAS SCIM API 호출하여 userName 추출
    let userName = null;
    try {
      // 요청 헤더에서 토큰 추출
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] 토큰 추출:', {
          hasAuthHeader: !!authHeader,
          hasToken: !!token
        });
      }
      
      if (token) {
        // 토큰에서 user_uuid 추출
        const decoded = jwt.decode(token, { complete: true }) as any;
        const payload = decoded?.payload;
        
        if (DEBUG_AUTH) {
          console.log('[AGENT_INTENTS] 토큰 디코딩:', {
            hasPayload: !!payload,
            user_uuid_locations: {
              'ext_attr.user_uuid': payload?.ext_attr?.user_uuid,
              'payload.user_uuid': payload?.user_uuid
            }
          });
        }
        
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
          console.log('[AGENT_INTENTS] user_uuid 추출:', {
            userUuid: userUuid || '(없음)',
            foundIn: userUuid ? (
              xsUserAttributes.user_uuid ? 'xs.user.attributes' :
              extAttr.user_uuid ? 'ext_attr' :
              customAttributes.user_uuid ? 'custom_attributes' :
              userAttributes.user_uuid ? 'user_attributes' :
              'payload.user_uuid'
            ) : 'not found'
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
            console.warn('[AGENT_INTENTS] IAS SCIM API 호출 실패: IAS_API_USERNAME 또는 IAS_API_PASSWORD 환경변수가 설정되지 않았습니다.');
          } else {
            // Basic 인증 헤더 생성
            const basicAuth = Buffer.from(`${iasApiUsername}:${iasApiPassword}`).toString('base64');
            
            if (DEBUG_AUTH) {
              console.log('[AGENT_INTENTS] IAS SCIM API 호출 시작:', { 
                scimUrl, 
                userUuid
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
              userName = scimData.userName;
              if (DEBUG_AUTH) {
                console.log('[AGENT_INTENTS] ✅ IAS SCIM API에서 userName 추출:', userName);
                console.log('[AGENT_INTENTS] SCIM 응답 정보:', {
                  userName: scimData.userName,
                  displayName: scimData.displayName,
                  employeeNumber: scimData['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User']?.employeeNumber
                });
              }
            } else {
              const errorText = await scimResponse.text();
              console.warn('[AGENT_INTENTS] IAS SCIM Users API 호출 실패:', {
                status: scimResponse.status,
                statusText: scimResponse.statusText,
                error: errorText?.substring(0, 200)
              });
            }
          }
        } else {
          console.warn('[AGENT_INTENTS] user_uuid를 찾을 수 없어 IAS SCIM API 호출을 건너뜁니다.');
        }
      }
    } catch (scimError: any) {
      console.error('[AGENT_INTENTS] IAS SCIM API 호출 오류:', scimError?.message || scimError);
      // SCIM API 실패해도 계속 진행 (fallback으로 userid 사용)
    }
    
    // 2. userName이 없으면 user.userid를 fallback으로 사용
    if (!userName) {
      userName = user?.userid || null;
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] IAS SCIM API에서 userName을 가져오지 못해 user.userid를 사용:', userName);
      }
    }
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 최종 사용할 userName:', userName);
      console.log('[AGENT_INTENTS] DB_TYPE:', DB_TYPE);
    }
    
    if (!userName) {
      console.log('[AGENT_INTENTS] ❌ userName이 없습니다. user 객체:', user);
      return res.status(400).json({ error: '사용자 정보를 찾을 수 없습니다.' });
    }
    
    // 먼저 전체 테이블에서 해당 userName의 모든 데이터 확인 (디버깅용)
    let debugQueryText;
    let debugParams: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      debugQueryText = `SELECT id, user_id, tcode, contents, hash, is_greeted, created_at FROM agent_intents WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`;
      debugParams = [userName];
    } else {
      debugQueryText = `SELECT TOP 10 ID, USER_ID, TCODE, CONTENTS, HASH, IS_GREETED, CREATED_AT FROM EAR.agent_intents WHERE USER_ID = ? ORDER BY CREATED_AT DESC`;
      debugParams = [userName];
    }
    
    try {
      const debugResult = await db.query(debugQueryText, debugParams);
      const debugRows = debugResult.rows || debugResult;
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] 해당 userName의 전체 데이터 (최대 10개):', {
          count: debugRows.length,
          rows: debugRows.map((row: any) => ({
            id: row.id || row.ID,
            user_id: row.user_id || row.USER_ID,
            tcode: row.tcode || row.TCODE,
            contents: (row.contents || row.CONTENTS || '').substring(0, 100) + '...',
            is_greeted: row.is_greeted !== undefined ? row.is_greeted : (row.IS_GREETED !== undefined ? row.IS_GREETED : false),
            created_at: row.created_at || row.CREATED_AT,
            created_at_type: typeof (row.created_at || row.CREATED_AT)
          }))
        });
        
        // 각 row의 user_id와 userName 비교
        debugRows.forEach((row: any, index: number) => {
          const rowUserId = row.user_id || row.USER_ID;
          const matches = rowUserId === userName;
          console.log(`[AGENT_INTENTS] Row ${index + 1}: user_id="${rowUserId}", userName="${userName}", 일치=${matches}`);
        });
      }
    } catch (debugError) {
      console.error('[AGENT_INTENTS] 디버깅 쿼리 오류:', debugError);
    }
    
    // 24시간 이내의 가장 최근 row 조회
    let queryText;
    let params: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT id, user_id, tcode, contents, hash, is_greeted, created_at
        FROM agent_intents
        WHERE user_id = $1 
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      params = [userName];
    } else {
      // HANA
      queryText = `
        SELECT TOP 1 ID, USER_ID, TCODE, CONTENTS, HASH, IS_GREETED, CREATED_AT
        FROM EAR.agent_intents
        WHERE USER_ID = ? 
          AND CREATED_AT >= ADD_SECONDS(CURRENT_TIMESTAMP, -86400)
        ORDER BY CREATED_AT DESC
      `;
      params = [userName];
    }
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 실행할 쿼리:', queryText);
      console.log('[AGENT_INTENTS] 쿼리 파라미터:', params);
    }
    
    const result = await db.query(queryText, params);
    const rows = result.rows || result;
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 쿼리 결과:', {
        rowsCount: rows.length,
        rows: rows.map((row: any) => ({
          id: row.id || row.ID,
          user_id: row.user_id || row.USER_ID,
          tcode: row.tcode || row.TCODE,
          contents: (row.contents || row.CONTENTS || '').substring(0, 100) + '...',
          created_at: row.created_at || row.CREATED_AT,
          created_at_iso: row.created_at ? new Date(row.created_at).toISOString() : (row.CREATED_AT ? new Date(row.CREATED_AT).toISOString() : null)
        }))
      });
    }
    
    if (rows.length === 0) {
      console.log('[AGENT_INTENTS] ❌ 24시간 이내 데이터를 찾을 수 없습니다.');
      return res.json({ 
        found: false,
        data: null 
      });
    }
    
    const intentData = rows[0];
    const isGreeted = intentData.is_greeted !== undefined ? intentData.is_greeted : (intentData.IS_GREETED !== undefined ? intentData.IS_GREETED : false);
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 조회된 데이터의 인사 완료 여부:', {
        id: intentData.id || intentData.ID,
        is_greeted: isGreeted,
        is_greeted_raw: intentData.is_greeted,
        IS_GREETED_raw: intentData.IS_GREETED
      });
    }
    
    // 인사가 이미 완료된 경우 인사하지 않음
    if (isGreeted === true || isGreeted === 'true' || isGreeted === 1) {
      console.log('[AGENT_INTENTS] ✅ 최신 데이터가 이미 인사 완료됨 - 인사하지 않음');
      return res.json({ 
        found: false,
        data: null,
        reason: 'already_greeted'
      });
    }
    
    const responseData = {
      id: intentData.id || intentData.ID,
      user_id: intentData.user_id || intentData.USER_ID,
      tcode: intentData.tcode || intentData.TCODE,
      contents: intentData.contents || intentData.CONTENTS,
      hash: intentData.hash || intentData.HASH,
      is_greeted: isGreeted,
      created_at: intentData.created_at || intentData.CREATED_AT
    };
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] ✅ 데이터 찾음 (인사 미완료):', {
        ...responseData,
        contents_preview: (responseData.contents || '').substring(0, 100) + '...'
      });
      console.log('[AGENT_INTENTS] userName 비교:', {
        db_user_id: responseData.user_id,
        request_userName: userName,
        matches: responseData.user_id === userName
      });
      console.log('=== [AGENT_INTENTS] 최근 Intent 조회 완료 ===');
    }
    
    res.json({
      found: true,
      data: responseData
    });
    
  } catch (error: any) {
    console.error('[AGENT_INTENTS] ❌ Recent Intent 조회 오류:', error?.message || 'Unknown error');
    if (DEBUG_AUTH) {
      console.error('[AGENT_INTENTS] 오류 스택:', error?.stack);
    }
    res.status(500).json({ 
      error: '데이터 조회 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// POST /api/agent/mark-greeted - 인사 완료 표시
router.post('/mark-greeted', authenticateToken, async (req, res) => {
  try {
    console.log('=== [AGENT_INTENTS] 인사 완료 표시 시작 ===');
    
    const authReq = req as any;
    const user = authReq.user;
    
    // IAS SCIM API 호출하여 userName 추출
    let userName = null;
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      
      if (token) {
        const decoded = jwt.decode(token, { complete: true }) as any;
        const payload = decoded?.payload;
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
          const iasBaseUrl = process.env.IAS_BASE_URL || 'https://avbayppic.accounts.ondemand.com';
          const scimUrl = `${iasBaseUrl}/scim/Users/${userUuid}`;
          const iasApiUsername = process.env.IAS_API_USERNAME;
          const iasApiPassword = process.env.IAS_API_PASSWORD;
          
          if (iasApiUsername && iasApiPassword) {
            const basicAuth = Buffer.from(`${iasApiUsername}:${iasApiPassword}`).toString('base64');
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
              userName = scimData.userName;
              if (DEBUG_AUTH) {
                console.log('[AGENT_INTENTS] IAS SCIM API에서 userName 추출:', userName);
              }
            }
          }
        }
      }
    } catch (scimError: any) {
      console.error('[AGENT_INTENTS] IAS SCIM API 호출 오류:', scimError?.message || 'Unknown error');
    }
    
    if (!userName) {
      userName = user?.userid || null;
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] IAS SCIM API 실패, user.userid 사용:', userName);
      }
    }
    
    const { intentId } = req.body;
    
    if (!intentId) {
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] ❌ intentId가 없음');
      }
      return res.status(400).json({ error: 'intentId가 필요합니다.' });
    }
    
    if (!userName) {
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] ❌ userName이 없음');
      }
      return res.status(400).json({ error: '사용자 정보를 찾을 수 없습니다.' });
    }
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 인사 완료 표시 요청:', {
        intentId: intentId,
        userName: userName
      });
    }
    
    // 해당 intent가 해당 사용자의 최신 데이터인지 확인
    let checkQuery;
    let checkParams: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      checkQuery = `
        SELECT id, is_greeted, created_at
        FROM agent_intents
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      checkParams = [userName];
    } else {
      // HANA
      checkQuery = `
        SELECT TOP 1 ID, IS_GREETED, CREATED_AT
        FROM EAR.agent_intents
        WHERE USER_ID = ?
          AND CREATED_AT >= ADD_SECONDS(CURRENT_TIMESTAMP, -86400)
        ORDER BY CREATED_AT DESC
      `;
      checkParams = [userName];
    }
    
    const checkResult = await db.query(checkQuery, checkParams);
    const latestRow = checkResult.rows?.[0] || checkResult[0];
    const latestId = latestRow?.id || latestRow?.ID;
    
    if (DEBUG_AUTH) {
      console.log('[AGENT_INTENTS] 최신 데이터 확인:', {
        requestedIntentId: intentId,
        latestIntentId: latestId,
        isLatest: latestId === intentId,
        latestCreatedAt: latestRow?.created_at || latestRow?.CREATED_AT
      });
    }
    
    if (!latestRow || latestId !== intentId) {
      if (DEBUG_AUTH) {
        console.log('[AGENT_INTENTS] ⚠️ 요청한 intent가 최신 데이터가 아님');
      }
      return res.status(400).json({ 
        error: '최신 데이터가 아닙니다. 최신 데이터만 인사 완료로 표시할 수 있습니다.',
        latestIntentId: latestId
      });
    }
    
    // 해당 intent의 is_greeted를 true로 업데이트
    let updateQuery;
    let updateParams: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      updateQuery = `
        UPDATE agent_intents
        SET is_greeted = true
        WHERE id = $1 AND user_id = $2
      `;
      updateParams = [intentId, userName];
    } else {
      // HANA
      updateQuery = `
        UPDATE EAR.agent_intents
        SET IS_GREETED = true
        WHERE ID = ? AND USER_ID = ?
      `;
      updateParams = [intentId, userName];
    }
    
    console.log('[AGENT_INTENTS] 인사 완료 업데이트 쿼리:', updateQuery);
    console.log('[AGENT_INTENTS] 업데이트 파라미터:', updateParams);
    
    const updateResult = await db.query(updateQuery, updateParams);
    const affectedRows = updateResult.rowCount || updateResult.rowsAffected || 0;
    
    console.log('[AGENT_INTENTS] ✅ 인사 완료 표시 성공:', {
      intentId: intentId,
      userName: userName,
      affectedRows: affectedRows
    });
    console.log('=== [AGENT_INTENTS] 인사 완료 표시 완료 ===');
    
    res.json({
      success: true,
      message: '인사 완료로 표시되었습니다.',
      intentId: intentId
    });
    
  } catch (error: any) {
    console.error('[AGENT_INTENTS] ❌ 인사 완료 표시 오류:', error);
    console.error('[AGENT_INTENTS] 오류 스택:', error.stack);
    res.status(500).json({ 
      error: '인사 완료 표시 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// POST /api/agent/generate-request - AGENT_INTENTS CONTENTS를 바탕으로 요청제목/내용 생성
router.post('/generate-request', authenticateToken, async (req, res) => {
  try {
    console.log('=== [AGENT] 요청 제목/내용 생성 시작 ===');
    
    const { intentId, contents } = req.body;
    const userId = (req as any).user?.userid;

    if (!intentId && !contents) {
      return res.status(400).json({ 
        error: 'intentId 또는 contents가 필요합니다.' 
      });
    }

    let requestContents = contents;

    // intentId가 제공된 경우 DB에서 CONTENTS 조회
    if (intentId && !contents) {
      let queryText;
      let params: any[] = [];

      if (DB_TYPE === 'postgres') {
        queryText = `
          SELECT contents
          FROM agent_intents
          WHERE id = $1 AND user_id = $2
        `;
        params = [intentId, userId];
      } else {
        queryText = `
          SELECT CONTENTS
          FROM EAR.agent_intents
          WHERE ID = ? AND USER_ID = ?
        `;
        params = [intentId, userId];
      }

      const result = await db.query(queryText, params);
      const rows = result.rows || result;

      if (rows.length === 0) {
        return res.status(404).json({ 
          error: 'Intent를 찾을 수 없습니다.' 
        });
      }

      requestContents = rows[0].contents || rows[0].CONTENTS;
    }

    if (!requestContents || requestContents.trim() === '') {
      return res.status(400).json({ 
        error: 'CONTENTS가 비어있습니다.' 
      });
    }

    console.log('[AGENT] 요청 제목/내용 생성 - CONTENTS:', requestContents.substring(0, 100) + '...');

    // LLM을 호출하여 요청제목과 요청내용 생성
    const prompt = `다음은 사용자가 ESM 시스템에 등록하고자 하는 요청 내용입니다:

${requestContents}

위 내용을 바탕으로 ESM 요청등록을 위한 제목과 내용을 작성해주세요.

요구사항:
1. 제목: 간결하고 명확하게 요청 사항을 나타내는 제목 (최대 50자)
2. 내용: 요청 사항을 상세히 설명하는 내용 (구체적이고 명확하게)

다음 JSON 형식으로만 응답해주세요:
{
  "title": "요청 제목",
  "content": "요청 내용"
}

주의사항:
- 제목은 짧고 명확하게 작성하세요
- 내용은 구체적인 상황, 요청 사항, 필요한 정보를 포함하세요
- JSON 형식만 응답하고 다른 설명은 하지 마세요`;

    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 ESM 요청등록 전문가입니다. 사용자의 요청 내용을 바탕으로 명확하고 구체적인 요청 제목과 내용을 작성합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const response = completion.choices[0].message.content?.trim() || '';
    console.log('[AGENT] LLM 응답:', response.substring(0, 200) + '...');

    // JSON 파싱
    let parsedResponse;
    try {
      // JSON 코드 블록이 있는 경우 제거
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(response);
      }
    } catch (parseError) {
      console.error('[AGENT] JSON 파싱 실패:', parseError);
      // 파싱 실패 시 기본값 사용
      parsedResponse = {
        title: '요청 등록',
        content: requestContents
      };
    }

    // 값 검증
    const title = parsedResponse.title || '요청 등록';
    const content = parsedResponse.content || requestContents;

    console.log('[AGENT] ✅ 요청 제목/내용 생성 완료:', {
      title: title.substring(0, 50),
      contentLength: content.length
    });
    console.log('=== [AGENT] 요청 제목/내용 생성 완료 ===');

    res.json({
      success: true,
      title: title,
      content: content
    });

  } catch (error: any) {
    console.error('[AGENT] ❌ 요청 제목/내용 생성 오류:', error);
    console.error('[AGENT] 오류 스택:', error.stack);
    res.status(500).json({ 
      error: '요청 제목/내용 생성 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

// POST /api/agent/generate-request-from-chat - 채팅 히스토리를 바탕으로 요청제목/내용 생성
router.post('/generate-request-from-chat', authenticateToken, async (req, res) => {
  try {
    console.log('=== [AGENT] 채팅 히스토리 기반 요청 제목/내용 생성 시작 ===');
    
    const { sessionId, lastUserMessage } = req.body;
    const userId = (req as any).user?.userid;

    if (!sessionId) {
      return res.status(400).json({ 
        error: 'sessionId가 필요합니다.' 
      });
    }

    // 최근 메시지만 조회 (최근 20개 메시지만 사용하여 컨텍스트 제한)
    // 20개 메시지 = 약 10개 대화(사용자+어시스턴트), 토큰 수 약 3000~5000개 추정
    const MAX_HISTORY_ITEMS = 20;
    const { getChatHistory } = await import('../db');
    const chatHistory = await getChatHistory(sessionId, userId, MAX_HISTORY_ITEMS);
    
    if (!chatHistory || chatHistory.length === 0) {
      return res.status(404).json({ 
        error: '채팅 히스토리를 찾을 수 없습니다.' 
      });
    }

    console.log('[AGENT] 채팅 히스토리 조회 완료:', chatHistory.length, '개 메시지 (최대', MAX_HISTORY_ITEMS, '개로 제한)');

    // 채팅 히스토리를 대화 형식으로 변환
    const conversationHistory = chatHistory.map((item: any) => {
      const userMsg = item.user_message || item.USER_MESSAGE || '';
      const assistantMsg = item.assistant_response || item.ASSISTANT_RESPONSE || '';
      return {
        user: userMsg,
        assistant: assistantMsg
      };
    });

    // 직전 사용자 메시지 찾기 (lastUserMessage가 제공된 경우 사용, 아니면 히스토리의 마지막 사용자 메시지)
    const lastUserMsg = lastUserMessage || (chatHistory.length > 0 ? (chatHistory[chatHistory.length - 1].user_message || chatHistory[chatHistory.length - 1].USER_MESSAGE) : '');

    if (!lastUserMsg || lastUserMsg.trim() === '') {
      return res.status(400).json({ 
        error: '사용자 메시지를 찾을 수 없습니다.' 
      });
    }

    console.log('[AGENT] 직전 사용자 메시지:', lastUserMsg.substring(0, 100) + '...');
    console.log('[AGENT] 대화 히스토리 길이:', conversationHistory.length, '개 대화');

    // 대화 히스토리를 맥락으로 구성 (최근 메시지 우선)
    // 메시지 길이도 제한하여 토큰 수 제어 (각 메시지 최대 500자)
    const MAX_MESSAGE_LENGTH = 500;
    const MAX_CONVERSATIONS = 10; // 최근 10개 대화만 사용
    const filteredHistory = conversationHistory
      .filter((conv: any) => conv.user && conv.user.trim() !== '' && conv.assistant && conv.assistant.trim() !== '');
    
    // 최근 N개 대화만 사용
    const recentHistory = filteredHistory.slice(-MAX_CONVERSATIONS);
    
    const contextHistory = recentHistory
      .map((conv: any, index: number) => {
        const userMsg = conv.user.length > MAX_MESSAGE_LENGTH 
          ? conv.user.substring(0, MAX_MESSAGE_LENGTH) + '...' 
          : conv.user;
        const assistantMsg = conv.assistant.length > MAX_MESSAGE_LENGTH 
          ? conv.assistant.substring(0, MAX_MESSAGE_LENGTH) + '...' 
          : conv.assistant;
        return `[대화 ${index + 1}]
사용자: ${userMsg}
어시스턴트: ${assistantMsg}`;
      })
      .join('\n\n');

    console.log('[AGENT] 맥락으로 사용할 대화 수:', recentHistory.length, '개 (전체', filteredHistory.length, '개 중 최근', MAX_CONVERSATIONS, '개)');

    // LLM 프롬프트 구성
    let prompt = `다음은 사용자가 ESM 시스템에 서비스 요청을 등록하기 위한 대화 히스토리입니다.

[대화 히스토리 - 맥락 참고용]
${contextHistory}

[최근 사용자 요청 - 중심 내용]
${lastUserMsg}

위 대화 히스토리와 최근 사용자 요청을 바탕으로 ESM 요청등록을 위한 제목과 내용을 작성해주세요.

요구사항:
1. 제목: 간결하고 명확하게 요청 사항을 나타내는 제목 (최대 50자)
   - 최근 사용자 요청을 중심으로 작성하되, 대화 히스토리의 맥락을 반영
   
2. 내용: 요청 사항을 상세히 설명하는 내용
   - 최근 사용자 요청을 중심으로 작성
   - 대화 히스토리의 맥락을 참고하여 필요한 배경 정보 포함
   - 구체적인 상황, 요청 사항, 필요한 정보를 포함

다음 JSON 형식으로만 응답해주세요:
{
  "title": "요청 제목",
  "content": "요청 내용"
}

주의사항:
- 제목은 짧고 명확하게 작성하세요
- 내용은 최근 요청을 중심으로 하되, 전체 대화 맥락을 고려하여 작성하세요
- 구체적이고 실용적인 내용으로 작성하세요
- JSON 형식만 응답하고 다른 설명은 하지 마세요`;

    // 프롬프트 길이 체크 (대략적인 토큰 추정: 한글 1자 ≈ 1 토큰)
    const estimatedTokens = Math.ceil(prompt.length / 2); // 보수적으로 2자당 1토큰 추정
    console.log('[AGENT] 예상 프롬프트 토큰 수:', estimatedTokens, '토큰');
    
    if (estimatedTokens > 50000) { // 50K 토큰 제한 (128K 중 여유있게)
      console.warn('[AGENT] ⚠️ 프롬프트 토큰 수가 큽니다:', estimatedTokens, '토큰. 최근 5개 대화만 사용합니다.');
      // 최근 5개 대화만 사용하도록 재구성
      const limitedHistory = filteredHistory.slice(-5);
      const limitedContextHistory = limitedHistory
        .map((conv: any, index: number) => {
          const userMsg = conv.user.length > MAX_MESSAGE_LENGTH 
            ? conv.user.substring(0, MAX_MESSAGE_LENGTH) + '...' 
            : conv.user;
          const assistantMsg = conv.assistant.length > MAX_MESSAGE_LENGTH 
            ? conv.assistant.substring(0, MAX_MESSAGE_LENGTH) + '...' 
            : conv.assistant;
          return `[대화 ${index + 1}]
사용자: ${userMsg}
어시스턴트: ${assistantMsg}`;
        })
        .join('\n\n');
      
      // 프롬프트 재구성
      prompt = `다음은 사용자가 ESM 시스템에 서비스 요청을 등록하기 위한 대화 히스토리입니다.

[대화 히스토리 - 맥락 참고용]
${limitedContextHistory}

[최근 사용자 요청 - 중심 내용]
${lastUserMsg}

위 대화 히스토리와 최근 사용자 요청을 바탕으로 ESM 요청등록을 위한 제목과 내용을 작성해주세요.

요구사항:
1. 제목: 간결하고 명확하게 요청 사항을 나타내는 제목 (최대 50자)
   - 최근 사용자 요청을 중심으로 작성하되, 대화 히스토리의 맥락을 반영
   
2. 내용: 요청 사항을 상세히 설명하는 내용
   - 최근 사용자 요청을 중심으로 작성
   - 대화 히스토리의 맥락을 참고하여 필요한 배경 정보 포함
   - 구체적인 상황, 요청 사항, 필요한 정보를 포함

다음 JSON 형식으로만 응답해주세요:
{
  "title": "요청 제목",
  "content": "요청 내용"
}

주의사항:
- 제목은 짧고 명확하게 작성하세요
- 내용은 최근 요청을 중심으로 하되, 전체 대화 맥락을 고려하여 작성하세요
- 구체적이고 실용적인 내용으로 작성하세요
- JSON 형식만 응답하고 다른 설명은 하지 마세요`;
    }

    const completion = await openai.chat.completions.create({
      model: process.env.CHAT_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 ESM 요청등록 전문가입니다. 사용자의 대화 히스토리와 최근 요청을 바탕으로 명확하고 구체적인 요청 제목과 내용을 작성합니다.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    });

    const response = completion.choices[0].message.content?.trim() || '';
    console.log('[AGENT] LLM 응답:', response.substring(0, 200) + '...');

    // JSON 파싱
    let parsedResponse;
    try {
      // JSON 코드 블록이 있는 경우 제거
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        parsedResponse = JSON.parse(response);
      }
    } catch (parseError) {
      console.error('[AGENT] JSON 파싱 실패:', parseError);
      // 파싱 실패 시 기본값 사용
      parsedResponse = {
        title: '요청 등록',
        content: lastUserMsg
      };
    }

    // 값 검증
    const title = parsedResponse.title || '요청 등록';
    const content = parsedResponse.content || lastUserMsg;

    console.log('[AGENT] ✅ 채팅 히스토리 기반 요청 제목/내용 생성 완료:', {
      title: title.substring(0, 50),
      contentLength: content.length,
      historyItems: conversationHistory.length
    });
    console.log('=== [AGENT] 채팅 히스토리 기반 요청 제목/내용 생성 완료 ===');

    res.json({
      success: true,
      title: title,
      content: content
    });

  } catch (error: any) {
    console.error('[AGENT] ❌ 채팅 히스토리 기반 요청 제목/내용 생성 오류:', error);
    console.error('[AGENT] 오류 스택:', error.stack);
    res.status(500).json({ 
      error: '요청 제목/내용 생성 중 오류가 발생했습니다.',
      details: error.message 
    });
  }
});

export default router;

