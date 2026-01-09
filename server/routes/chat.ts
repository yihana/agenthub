import express from 'express';
import { generateRAGResponse, generateRAGResponseStream, detectFirewallIntent, getFirewallTemplates, detectChatIntent } from '../rag';
import { insertChatHistory, getChatHistory, deleteChatSession, query, DB_TYPE } from '../db';
import { authenticateToken } from '../middleware/auth';
import { validateInput } from '../utils/inputValidation';
import { filterOutputSecurity } from '../utils/outputSecurity';
import axios from 'axios';
import https from 'https';
import { URL } from 'url';

const router = express.Router();

// SK Networks RAG API 호출 함수
async function callSKNetworksRAG(userMessage: string): Promise<string> {
  // DB에서 회사코드 "SKN"인 활성 RAG Agent 조회
  let ragUrl: string;
  let ragToken: string;

  try {
    let queryText: string;
    let params: any[] = [];

    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT agent_url, agent_token
        FROM rag_agents_info
        WHERE company_code = $1 AND is_active = 'Y'
        LIMIT 1
      `;
      params = ['SKN'];
    } else {
      queryText = `
        SELECT AGENT_URL, AGENT_TOKEN
        FROM EAR.RAG_AGENTS_INFO
        WHERE COMPANY_CODE = ? AND IS_ACTIVE = 'Y'
        LIMIT 1
      `;
      params = ['SKN'];
    }

    const result = await query(queryText, params);

    if (result.rows.length === 0) {
      // DB에 없으면 환경변수로 fallback (하위 호환성)
      ragUrl = process.env.SKN_RAG_URL || '';
      ragToken = process.env.SKN_RAG_TOKEN || '';
      
      if (!ragUrl || !ragToken) {
        throw new Error('SKN 회사코드에 대한 활성 RAG Agent가 설정되지 않았습니다. 시스템 관리자 메뉴에서 RAG Agent를 설정해주세요.');
      }
    } else {
      const row = result.rows[0];
      ragUrl = row.agent_url || row.AGENT_URL;
      ragToken = row.agent_token || row.AGENT_TOKEN;
    }
  } catch (error: any) {
    console.error('RAG Agent 조회 오류:', error);
    // 에러 발생 시 환경변수로 fallback
    ragUrl = process.env.SKN_RAG_URL || '';
    ragToken = process.env.SKN_RAG_TOKEN || '';
    
    if (!ragUrl || !ragToken) {
      throw new Error('RAG Agent 정보를 조회할 수 없습니다. 시스템 관리자에게 문의하세요.');
    }
  }

  // URL 파싱
  const url = new URL(ragUrl);
  const originalHostname = url.hostname; // 원래 호스트명 (Host 헤더용)
  // ipAddress 값은 환경변수 ADOTBIZ_PRIVATE_LINK_IP 값을 읽어서 세팅, 없으면 개발서버이면 Default IP 10.220.4.141, 운영서버이면 10.220.5.115 
  const ipAddress = process.env.ADOTBIZ_PRIVATE_LINK_IP || (process.env.NODE_ENV === 'development' ? '10.220.4.141' : '10.220.5.115'); // Private Link IP 주소
  const port = parseInt(url.port || '443', 10);
  const path = url.pathname + url.search; // 경로와 쿼리 문자열
  
  // 요청 본문 데이터
  const requestData = JSON.stringify({
    input: {
      messages: [
        {
          content: userMessage,
          type: 'human'
        }
      ],
      additional_kwargs: {
        '<input-key>': '<input-value>'
      }
    }
  });

  return new Promise<string>((resolve, reject) => {
    // SSL 인증서 검증 무시 및 SNI 설정을 위한 옵션
    const options = {
      hostname: ipAddress, // IP 주소로 연결
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'aip-user': 'wisdomguy',
        'Authorization': `Bearer ${ragToken}`,
        'Host': originalHostname, // 원래 호스트명을 Host 헤더에 명시적으로 설정
        'Content-Length': Buffer.byteLength(requestData)
      },
      rejectUnauthorized: false, // SSL 인증서 검증 무시
      servername: originalHostname // SNI용 원래 호스트명 (curl --resolve와 동일한 동작)
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const parsedResponse = JSON.parse(responseData);
          
          // 응답에서 실제 답변 추출 (응답 구조에 따라 조정 필요)
          if (parsedResponse.output) {
            // output이 문자열인 경우
            if (typeof parsedResponse.output === 'string') {
              resolve(parsedResponse.output);
              return;
            }
            // output이 객체이고 messages가 있는 경우
            if (parsedResponse.output.messages && Array.isArray(parsedResponse.output.messages)) {
              const lastMessage = parsedResponse.output.messages[parsedResponse.output.messages.length - 1];
              if (lastMessage && lastMessage.content) {
                resolve(lastMessage.content);
                return;
              }
            }
            // output이 객체이고 content가 있는 경우
            if (parsedResponse.output.content) {
              resolve(parsedResponse.output.content);
              return;
            }
            // 그 외의 경우 JSON 문자열로 반환
            resolve(JSON.stringify(parsedResponse.output));
            return;
          }
          
          // output이 없는 경우 전체 응답 반환
          resolve(JSON.stringify(parsedResponse));
        } catch (parseError) {
          // JSON 파싱 실패 시 원본 응답 반환
          resolve(responseData);
        }
      });
    });

    req.on('error', (error: any) => {
      console.error('SK Networks RAG API 호출 오류:', error);
      if (error.code === 'ECONNRESET' || error.code === 'ECONNREFUSED') {
        reject(new Error('SK Networks RAG API에 연결할 수 없습니다.'));
      } else {
        reject(new Error(`SK Networks RAG API 호출 중 오류: ${error.message}`));
      }
    });

    // 타임아웃 설정 (30초)
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('SK Networks RAG API 호출 타임아웃'));
    });

    // 요청 본문 전송
    req.write(requestData);
    req.end();
  });
}

// 채팅 API
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { message, sessionId = 'default' } = req.body;
  const userId = (req as any).user?.userid || 'anonymous';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 입력보안 검증
    const validation = await validateInput(message);
    if (validation.blocked) {
      return res.status(400).json({
        error: '입력이 차단되었습니다.',
        blocked: true,
        violations: validation.violations
      });
    }

    // 방화벽 키워드 감지 (임시 주석 처리)
    /*
    if (detectFirewallIntent(message)) {
      const templates = getFirewallTemplates();
      return res.json({
        response: `방화벽 관련 문의를 감지했습니다. 다음 ITSM 사례 템플릿 중에서 선택해주세요:`,
        sources: [],
        firewallTemplates: templates,
        isFirewallIntent: true
      });
    }
    */

    // RAG 응답 생성
    const { response, sources } = await generateRAGResponse(message, sessionId);

    // 채팅 히스토리 저장 (user_id 포함)
    await insertChatHistory(sessionId, userId, message, response, sources);

    res.json({
      response,
      sources,
      isFirewallIntent: false
    });

  } catch (error) {
    console.error('Chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 모든 채팅 히스토리 조회 (개선요청용) - 사용자별 필터링
router.get('/all-histories', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userid;
    
    if (!userId) {
      return res.status(401).json({ error: '인증된 사용자 정보를 찾을 수 없습니다.' });
    }

    let queryText;
    let params: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      queryText = `SELECT id, session_id, user_message, assistant_response, sources, created_at
                   FROM chat_history 
                   WHERE user_id = $1
                   ORDER BY created_at DESC 
                   LIMIT 100`;
      params = [userId];
    } else {
      // HANA
      queryText = `SELECT ID, SESSION_ID, USER_MESSAGE, ASSISTANT_RESPONSE, SOURCES, CREATED_AT
                   FROM EAR.chat_history 
                   WHERE USER_ID = ?
                   ORDER BY CREATED_AT DESC 
                   LIMIT 100`;
      params = [userId];
    }
    
    const result = await query(queryText, params);
    
    res.json({ histories: result.rows });
  } catch (error) {
    console.error('All histories API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 세션 목록 조회
router.get('/sessions', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user?.userid;
    let sessions = [];
    
    if (DB_TYPE === 'postgres') {
      const result = await query(
        `SELECT 
           session_id,
           MAX(created_at) as last_activity,
           (SELECT user_message FROM chat_history ch2 WHERE ch2.session_id = ch1.session_id AND ch2.user_id = $1 ORDER BY created_at DESC LIMIT 1) as last_user_message,
           (SELECT assistant_response FROM chat_history ch3 WHERE ch3.session_id = ch1.session_id AND ch3.user_id = $1 ORDER BY created_at DESC LIMIT 1) as last_assistant_response
         FROM chat_history ch1 
         WHERE ch1.user_id = $1
         GROUP BY session_id 
         ORDER BY last_activity DESC 
         LIMIT 50`,
        [userId]
      );
      
      sessions = result.rows.map((row: any) => ({
        id: row.session_id,
        title: row.last_user_message ? 
          (row.last_user_message.length > 30 ? row.last_user_message.substring(0, 30) + '...' : row.last_user_message) :
          '새로운 채팅',
        preview: row.last_assistant_response ? 
          (row.last_assistant_response.length > 50 ? row.last_assistant_response.substring(0, 50) + '...' : row.last_assistant_response) :
          '새로운 대화를 시작하세요...',
        lastMessage: row.last_assistant_response || '새로운 대화를 시작하세요...',
        createdAt: row.last_activity
      }));
    } else {
      // HANA - 먼저 세션 목록 가져오기, UTC 시간을 한국 시간(UTC+9)으로 변환 (9시간 = 32400초)
      // GROUP BY를 사용하므로 DISTINCT 불필요
      const sessionList = await query(
        `SELECT SESSION_ID,
                ADD_SECONDS(MAX(CREATED_AT), 32400) as LAST_ACTIVITY
         FROM EAR.chat_history
         WHERE USER_ID = ?
         GROUP BY SESSION_ID
         ORDER BY MAX(CREATED_AT) DESC
         LIMIT 50`,
        [userId]
      );
      
      // 각 세션의 최신 메시지 개별 조회
      for (const sessionRow of sessionList.rows) {
        try {
          const messageResult = await query(
            `SELECT TOP 1 USER_MESSAGE, ASSISTANT_RESPONSE 
             FROM EAR.chat_history 
             WHERE SESSION_ID = ? AND USER_ID = ?
             ORDER BY CREATED_AT DESC`,
            [sessionRow.session_id, userId]
          );
          
          const lastMsg = messageResult.rows[0];
          sessions.push({
            id: sessionRow.session_id,
            title: lastMsg?.user_message ? 
              (lastMsg.user_message.length > 30 ? lastMsg.user_message.substring(0, 30) + '...' : lastMsg.user_message) :
              `세션 ${sessionRow.session_id.substring(0, 8)}`,
            preview: lastMsg?.assistant_response ? 
              (lastMsg.assistant_response.length > 50 ? lastMsg.assistant_response.substring(0, 50) + '...' : lastMsg.assistant_response) :
              '새로운 대화를 시작하세요...',
            lastMessage: lastMsg?.assistant_response || '새로운 대화를 시작하세요...',
            createdAt: sessionRow.last_activity
          });
        } catch (msgError) {
          // 메시지 조회 실패 시 기본값
          sessions.push({
            id: sessionRow.session_id,
            title: `세션 ${sessionRow.session_id.substring(0, 8)}`,
            preview: '대화 로드 실패',
            lastMessage: '',
            createdAt: sessionRow.last_activity
          });
        }
      }
    }
    
    res.json({ sessions });
  } catch (error) {
    console.error('Sessions API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 채팅 히스토리 조회
router.get('/history/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 20 } = req.query;
    const userId = (req as any).user?.userid;

    console.log('채팅 히스토리 조회 요청:', sessionId, 'userId:', userId, 'limit:', limit);
    const history = await getChatHistory(sessionId, userId, parseInt(limit as string));
    
    console.log('히스토리 조회 결과:', history.length, '개');
    if (history.length > 0) {
      const firstItem = history[0];
      console.log('첫 번째 메시지 샘플:', {
        id: firstItem.id || firstItem.ID,
        session_id: firstItem.session_id || firstItem.SESSION_ID,
        user_id: firstItem.user_id || firstItem.USER_ID,
        user_message: (firstItem.user_message || firstItem.USER_MESSAGE)?.substring(0, 50),
        intent_options: firstItem.intent_options || firstItem.INTENT_OPTIONS,
        created_at: firstItem.created_at || firstItem.CREATED_AT
      });
      // 모든 필드명 확인
      console.log('첫 번째 메시지 모든 필드:', Object.keys(firstItem));
    }
    
    res.json({ history });
  } catch (error) {
    console.error('Chat history API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 스트리밍 채팅 API
router.post('/stream', authenticateToken, async (req, res) => {
  try {
    const { message, sessionId = 'default', moduleType = 'SKAX Chat Modul' } = req.body;
    const userId: string = (req as any).user?.userid || 'anonymous';

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // SK Networks RAG Module 선택 시 별도 처리
    if (moduleType === 'SK Networks RAG Module') {
      try {
        const ragResponse = await callSKNetworksRAG(message);
        
        // 채팅 히스토리 저장
        await insertChatHistory(sessionId, userId, message, ragResponse, []);
        
        // SSE 형식으로 응답 전송
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });
        
        // 스트리밍처럼 보이도록 응답을 청크로 나누어 전송
        const chunkSize = 50;
        for (let i = 0; i < ragResponse.length; i += chunkSize) {
          const chunk = ragResponse.substring(i, i + chunkSize);
          res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
          // 작은 지연을 추가하여 스트리밍 효과
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        
        res.write(`data: ${JSON.stringify({ type: 'done', response: ragResponse, sources: [] })}\n\n`);
        res.end();
        return;
      } catch (ragError: any) {
        console.error('SK Networks RAG 호출 오류:', ragError);
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Cache-Control'
        });
        res.write(`data: ${JSON.stringify({ 
          type: 'error', 
          error: ragError.message || 'SK Networks RAG API 호출 중 오류가 발생했습니다.' 
        })}\n\n`);
        res.end();
        return;
      }
    }

    // 입력보안 검증
    const validation = await validateInput(message);
    if (validation.blocked) {
      // SSE로 에러 전송
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });
      res.write(`data: ${JSON.stringify({ 
        type: 'error', 
        error: '입력이 차단되었습니다.',
        blocked: true,
        violations: validation.violations
      })}\n\n`);
      res.end();
      return;
    }

    // 채팅 의도 감지 (DB 기반, 방화벽 감지보다 먼저)
    const companyCode = (req as any).user?.companyCode || 'SKN';
    const intentResult = await detectChatIntent(message, companyCode);
    if (intentResult?.matched) {
      // DB의 display_type 값을 사용하여 표시 방식 결정
      const displayType = intentResult.displayType || 'inline';
      
      // 인라인 표시인지 모달 표시인지에 따라 처리
      let responseMessage = intentResult.responseMessage || '';
      
      if (displayType === 'modal') {
        // 모달 표시인 경우 응답 메시지에 팝업 표시 여부 추가
        responseMessage = `${intentResult.responseMessage}\n\n[요청선택 팝업표시됨]`;
      }
      
      // 채팅 히스토리 저장 (의도 감지된 경우도 저장)
      await insertChatHistory(sessionId, userId, message, responseMessage, [], intentResult.options || []);
      
      return res.json({
        response: responseMessage,
        sources: [],
        isIntentDetected: true,
        intentOptions: intentResult.options || [],
        displayType: displayType,
        intentCategory: intentResult.intentCategory
      });
    }

    // 방화벽 키워드 감지 (임시 주석 처리)
    // if (detectFirewallIntent(message)) {
    //   const templates = getFirewallTemplates();
    //   const responseMessage = `방화벽 관련 문의를 감지했습니다. 다음 ITSM 사례 템플릿 중에서 선택해주세요:\n\n[요청선택 팝업표시됨]`;
      
    //   // 채팅 히스토리 저장
    //   await insertChatHistory(sessionId, userId || 'anonymous', message, responseMessage, [], []);
      
    //   return res.json({
    //     response: responseMessage,
    //     sources: [],
    //     firewallTemplates: templates,
    //     isFirewallIntent: true
    //   });
    // }

    // SSE 헤더 설정
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    let fullResponse = '';
    let filteredResponse = ''; // 필터링된 응답 버퍼
    let sources: any[] = [];
    let lastCheckedLength = 0; // 마지막으로 체크한 위치
    let lastSentLength = 0; // 마지막으로 전송한 위치
    const CHECK_INTERVAL = 500; // 500자 단위로 체크

    try {
      // 스트리밍 응답 생성
      for await (const chunk of generateRAGResponseStream(message, sessionId)) {
        switch (chunk.type) {
          case 'chunk':
            fullResponse += chunk.data;
            
            // 500자 단위로 출력보안 체크
            if (fullResponse.length - lastCheckedLength >= CHECK_INTERVAL) {
              // 전체 응답을 다시 필터링 (누적된 내용 포함)
              filteredResponse = await filterOutputSecurity(fullResponse);
              
              // 필터링된 부분 중 아직 전송하지 않은 부분 전송
              const newContent = filteredResponse.substring(lastSentLength);
              if (newContent) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: newContent })}\n\n`);
                lastSentLength = filteredResponse.length;
              }
              
              lastCheckedLength = fullResponse.length;
            } else {
              // 500자 미만이지만, 매번 필터링하여 전송 (누적 버퍼 사용)
              filteredResponse = await filterOutputSecurity(fullResponse);
              const newContent = filteredResponse.substring(lastSentLength);
              if (newContent) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: newContent })}\n\n`);
                lastSentLength = filteredResponse.length;
              }
            }
            break;
          
          case 'sources':
            sources = chunk.data;
            res.write(`data: ${JSON.stringify({ type: 'sources', sources: chunk.data })}\n\n`);
            break;
          
          case 'done':
            // 최종 전체 응답 필터링
            filteredResponse = await filterOutputSecurity(fullResponse);
            
            // 아직 전송하지 않은 부분 전송
            if (lastSentLength < filteredResponse.length) {
              const remainingContent = filteredResponse.substring(lastSentLength);
              if (remainingContent) {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: remainingContent })}\n\n`);
              }
            }
            
            // 채팅 히스토리 저장 (필터링된 응답 저장)
            await insertChatHistory(sessionId, userId, message, filteredResponse, sources);
            res.write(`data: ${JSON.stringify({ type: 'done', response: filteredResponse, sources })}\n\n`);
            break;
        }
      }
    } catch (streamError) {
      console.error('Streaming error:', streamError);
      res.write(`data: ${JSON.stringify({ type: 'error', error: '스트리밍 중 오류가 발생했습니다.' })}\n\n`);
    }

    res.end();

  } catch (error) {
    console.error('Stream chat API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 인사 메시지 저장 API
router.post('/greeting', authenticateToken, async (req, res) => {
  try {
    const { sessionId, greetingMessage, intentOptions } = req.body;
    const userId = (req as any).user?.userid || 'anonymous';

    if (!sessionId || !greetingMessage) {
      return res.status(400).json({ error: 'sessionId and greetingMessage are required' });
    }

    // 인사 메시지를 데이터베이스에 저장 (user_message는 시스템 메시지로 표시)
    await insertChatHistory(
      sessionId, 
      userId, 
      '[시스템 인사]', 
      greetingMessage, 
      undefined, 
      intentOptions
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Greeting message save error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 세션 목록 조회 (두 번째 구현 - 사용자별 필터링 적용)
router.get('/sessions-list', authenticateToken, async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const userId = (req as any).user?.userid;
    
    let queryText;
    let params: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      queryText = `
        SELECT DISTINCT session_id, 
               MIN(created_at) as first_message_at,
               MAX(created_at) as last_message_at,
               COUNT(*) as message_count,
               (SELECT user_message FROM chat_history 
                WHERE session_id = ch.session_id AND user_id = $1
                ORDER BY created_at ASC LIMIT 1) as first_message
        FROM chat_history ch
        WHERE user_id = $1
        GROUP BY session_id
        ORDER BY last_message_at DESC
        LIMIT $2
      `;
      params = [userId, parseInt(limit as string)];
    } else {
      // HANA - 간단한 집계 사용, UTC 시간을 한국 시간(UTC+9)으로 변환 (9시간 = 32400초)
      queryText = `
        SELECT SESSION_ID, 
               ADD_SECONDS(MIN(CREATED_AT), 32400) as FIRST_MESSAGE_AT,
               ADD_SECONDS(MAX(CREATED_AT), 32400) as LAST_MESSAGE_AT,
               COUNT(*) as MESSAGE_COUNT,
               MIN(USER_MESSAGE) as FIRST_MESSAGE
        FROM EAR.chat_history
        WHERE USER_ID = ?
        GROUP BY SESSION_ID
        ORDER BY MAX(CREATED_AT) DESC
        LIMIT ?
      `;
      params = [userId, parseInt(limit as string)];
    }
    
    const result = await query(queryText, params);
    
    const sessions = result.rows.map((row: any) => ({
      id: row.session_id,
      title: row.first_message ? 
        (row.first_message.length > 30 ? 
          row.first_message.substring(0, 30) + '...' : 
          row.first_message) : 
        `세션 ${row.session_id.slice(-8)}`,
      preview: `${row.message_count}개 메시지`,
      lastMessage: row.last_message_at,
      createdAt: row.first_message_at
    }));
    
    res.json({ sessions });
  } catch (error) {
    console.error('Sessions API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 개별 세션 삭제
router.delete('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = (req as any).user?.userid;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    const deletedCount = await deleteChatSession(sessionId, userId);
    
    if (deletedCount === 0) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ 
      message: 'Session deleted successfully',
      deletedCount 
    });
  } catch (error) {
    console.error('Delete session API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 방화벽 템플릿 조회
router.get('/firewall-templates', (req, res) => {
  try {
    const templates = getFirewallTemplates();
    res.json({ templates });
  } catch (error) {
    console.error('Firewall templates API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

