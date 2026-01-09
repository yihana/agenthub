import express from 'express';
import { db, DB_TYPE } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// 채팅 히스토리 조회 (관리자만) - 세션 단위로 그룹화
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      userid = '', 
      startDate = '', 
      endDate = '',
      searchKeyword = ''
    } = req.query;
    
    console.log('채팅 히스토리 조회 파라미터 (세션 단위):', { page, limit, userid, startDate, endDate, searchKeyword });
    
    const offset = (Number(page) - 1) * Number(limit);

    let query: string;
    let conditions: string[] = [];
    let params: any[] = [];
    let paramCount = 0;

    if (DB_TYPE === 'postgres') {
      // 세션별로 그룹화하여 조회
      query = `
        SELECT 
          ch.session_id,
          ch.user_id,
          MAX(ch.created_at) as last_activity,
          MIN(ch.created_at) as first_activity,
          COUNT(*) as message_count,
          (SELECT user_message FROM chat_history ch2 
           WHERE ch2.session_id = ch.session_id 
           ORDER BY ch2.created_at DESC LIMIT 1) as last_user_message,
          (SELECT assistant_response FROM chat_history ch3 
           WHERE ch3.session_id = ch.session_id 
           ORDER BY ch3.created_at DESC LIMIT 1) as last_assistant_response,
          (SELECT full_name FROM users u WHERE u.userid = ch.user_id LIMIT 1) as full_name,
          (SELECT department FROM users u WHERE u.userid = ch.user_id LIMIT 1) as department,
          (SELECT position FROM users u WHERE u.userid = ch.user_id LIMIT 1) as position
        FROM chat_history ch
      `;

      // 사용자ID 필터
      if (userid) {
        conditions.push(`ch.user_id ILIKE $${++paramCount}`);
        params.push(`%${userid}%`);
      }

      // 검색어 필터 (사용자 메시지 또는 어시스턴트 응답에서 검색)
      if (searchKeyword) {
        conditions.push(`(EXISTS (
          SELECT 1 FROM chat_history ch4 
          WHERE ch4.session_id = ch.session_id 
          AND (ch4.user_message ILIKE $${++paramCount} OR ch4.assistant_response ILIKE $${++paramCount})
        ))`);
        params.push(`%${searchKeyword}%`, `%${searchKeyword}%`);
      }

      // 날짜 범위 필터
      if (startDate) {
        conditions.push(`ch.created_at >= $${++paramCount}`);
        params.push(startDate);
      }

      if (endDate) {
        const endDateStr = String(endDate);
        const endDateTime = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59`;
        conditions.push(`ch.created_at <= $${++paramCount}`);
        params.push(endDateTime);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` GROUP BY ch.session_id, ch.user_id ORDER BY last_activity DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(Number(limit), offset);
    } else {
      // HANA 쿼리 - 세션별로 그룹화, UTC 시간을 한국 시간(UTC+9)으로 변환
      query = `
        SELECT 
          ch.SESSION_ID,
          ch.USER_ID,
          ADD_SECONDS(MAX(ch.CREATED_AT), 32400) as LAST_ACTIVITY,
          ADD_SECONDS(MIN(ch.CREATED_AT), 32400) as FIRST_ACTIVITY,
          COUNT(*) as MESSAGE_COUNT
        FROM EAR.chat_history ch
      `;

      // 사용자ID 필터
      if (userid) {
        conditions.push(`ch.USER_ID LIKE ?`);
        params.push(`%${userid}%`);
      }

      // 검색어 필터
      if (searchKeyword) {
        conditions.push(`(EXISTS (
          SELECT 1 FROM EAR.chat_history ch4 
          WHERE ch4.SESSION_ID = ch.SESSION_ID 
          AND (ch4.USER_MESSAGE LIKE ? OR ch4.ASSISTANT_RESPONSE LIKE ?)
        ))`);
        params.push(`%${searchKeyword}%`, `%${searchKeyword}%`);
      }

      // 날짜 범위 필터
      if (startDate) {
        conditions.push(`ch.CREATED_AT >= ?`);
        params.push(startDate);
      }

      if (endDate) {
        const endDateStr = String(endDate);
        const endDateTime = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59`;
        conditions.push(`ch.CREATED_AT <= ?`);
        params.push(endDateTime);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` GROUP BY ch.SESSION_ID, ch.USER_ID ORDER BY MAX(ch.CREATED_AT) DESC LIMIT ? OFFSET ?`;
      params.push(Number(limit), offset);
    }

    console.log('실행할 쿼리:', query);
    console.log('쿼리 파라미터:', params);

    const result = await db.query(query, params);
    
    console.log('쿼리 결과 개수:', result.rows?.length || 0);
    if (result.rows && result.rows.length > 0) {
      console.log('첫 번째 결과 샘플 (원본):', JSON.stringify(result.rows[0], null, 2));
      console.log('첫 번째 결과 키들:', Object.keys(result.rows[0] || {}));
    }

    // 결과 포맷팅 - 세션 단위
    let formattedRows: any[] = [];
    
    if (DB_TYPE === 'hana') {
      // HANA의 경우 최신 메시지를 별도로 조회
      for (const row of result.rows) {
        const sessionId = row.session_id || row.SESSION_ID || '';
        const userId = row.user_id || row.USER_ID || '';
        
        try {
          // 최신 메시지 조회
          const messageResult = await db.query(
            `SELECT TOP 1 USER_MESSAGE, ASSISTANT_RESPONSE 
             FROM EAR.chat_history 
             WHERE SESSION_ID = ? AND USER_ID = ?
             ORDER BY CREATED_AT DESC`,
            [sessionId, userId]
          );
          
          const lastMsg = messageResult.rows[0] || {};
          
          // 사용자 정보 조회
          const userResult = await db.query(
            `SELECT FULL_NAME, DEPARTMENT, POSITION 
             FROM EAR.users 
             WHERE USERID = ?`,
            [userId]
          );
          
          const userInfo = userResult.rows[0] || {};
          
          formattedRows.push({
            session_id: sessionId,
            user_id: userId,
            last_activity: row.last_activity || row.LAST_ACTIVITY || null,
            first_activity: row.first_activity || row.FIRST_ACTIVITY || null,
            message_count: row.message_count || row.MESSAGE_COUNT || 0,
            last_user_message: lastMsg.user_message || lastMsg.USER_MESSAGE || '',
            last_assistant_response: lastMsg.assistant_response || lastMsg.ASSISTANT_RESPONSE || '',
            full_name: userInfo.full_name || userInfo.FULL_NAME || null,
            department: userInfo.department || userInfo.DEPARTMENT || null,
            position: userInfo.position || userInfo.POSITION || null
          });
        } catch (error) {
          console.error('세션 정보 조회 오류:', error);
          formattedRows.push({
            session_id: sessionId,
            user_id: userId,
            last_activity: row.last_activity || row.LAST_ACTIVITY || null,
            first_activity: row.first_activity || row.FIRST_ACTIVITY || null,
            message_count: row.message_count || row.MESSAGE_COUNT || 0,
            last_user_message: '',
            last_assistant_response: '',
            full_name: null,
            department: null,
            position: null
          });
        }
      }
    } else {
      // PostgreSQL
      formattedRows = result.rows.map((row: any) => ({
        session_id: row.session_id || '',
        user_id: row.user_id || '',
        last_activity: row.last_activity || null,
        first_activity: row.first_activity || null,
        message_count: row.message_count || 0,
        last_user_message: row.last_user_message || '',
        last_assistant_response: row.last_assistant_response || '',
        full_name: row.full_name || null,
        department: row.department || null,
        position: row.position || null
      }));
    }
    
    // 디버깅: 포맷팅된 첫 번째 행 확인
    if (formattedRows.length > 0) {
      console.log('포맷팅된 첫 번째 세션:', JSON.stringify(formattedRows[0], null, 2));
    }

    // 전체 개수 조회
    let countQuery: string;
    let countParams: any[] = [];
    let countParamCount = 0;

    // 세션 개수 조회 (DISTINCT session_id)
    if (DB_TYPE === 'postgres') {
      countQuery = `
        SELECT COUNT(DISTINCT session_id) as count
        FROM chat_history ch
      `;
      
      if (conditions.length > 0) {
        // 조건에서 $1, $2 등을 다시 매핑
        const countConditions = conditions.map(condition => {
          return condition.replace(/\$\d+/g, () => `$${++countParamCount}`);
        });
        countQuery += ' WHERE ' + countConditions.join(' AND ');
        countParams = params.slice(0, -2); // 마지막 2개 파라미터(limit, offset) 제외
      }
    } else {
      // HANA 쿼리 - 세션 개수
      countQuery = `
        SELECT COUNT(DISTINCT SESSION_ID) as count
        FROM EAR.chat_history ch
      `;
      
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // 마지막 2개 파라미터(limit, offset) 제외
      }
    }

    const countResult = await db.query(countQuery, countParams);
    console.log('COUNT 쿼리 결과:', JSON.stringify(countResult.rows[0], null, 2));
    console.log('COUNT 쿼리 결과 키들:', Object.keys(countResult.rows[0] || {}));
    
    let total = 0;
    if (DB_TYPE === 'postgres') {
      total = parseInt(countResult.rows[0].count || countResult.rows[0].COUNT || '0');
    } else {
      // HANA - db-hana.ts에서 키를 소문자로 정규화하므로 'count' 사용
      const countRow = countResult.rows[0];
      // HANA는 COUNT(*) as count로 별칭을 사용하므로 'count' 키 사용
      total = parseInt(
        countRow.count || 
        countRow['count(*)'] || 
        countRow['COUNT(*)'] || 
        countRow.COUNT || 
        (countRow[Object.keys(countRow)[0]]) || // 첫 번째 키의 값 사용 (폴백)
        '0'
      );
      console.log('파싱된 total 값:', total, 'countRow:', countRow);
    }

    console.log('응답 데이터:', {
      chatHistoryCount: formattedRows.length,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

    // 캐시 방지 헤더 설정
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      sessions: formattedRows, // 세션 목록으로 반환
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('채팅 히스토리 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 세션별 채팅 히스토리 조회 (관리자만) - 모든 메시지 조회
router.get('/session/:sessionId', requireAdmin, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 1000 } = req.query;
    
    console.log('세션 히스토리 조회 (관리자):', sessionId);
    
    let query: string;
    let params: any[] = [];
    
    if (DB_TYPE === 'postgres') {
      query = `
        SELECT id, session_id, user_id, user_message, assistant_response, 
               sources, intent_options, created_at
        FROM chat_history
        WHERE session_id = $1
        ORDER BY created_at ASC
        LIMIT $2
      `;
      params = [sessionId, parseInt(limit as string)];
    } else {
      // HANA - UTC 시간을 한국 시간(UTC+9)으로 변환
      query = `
        SELECT TOP ${parseInt(limit as string)}
         ID as id, 
         SESSION_ID as session_id, 
         USER_ID as user_id, 
         USER_MESSAGE as user_message, 
         ASSISTANT_RESPONSE as assistant_response, 
         SOURCES as sources, 
         INTENT_OPTIONS as intent_options, 
         ADD_SECONDS(CREATED_AT, 32400) as created_at
        FROM EAR.chat_history 
        WHERE SESSION_ID = ?
        ORDER BY CREATED_AT ASC
      `;
      params = [sessionId];
    }
    
    const result = await db.query(query, params);
    
    // 결과 포맷팅
    const history = result.rows.map((row: any) => {
      if (DB_TYPE === 'hana') {
        return {
          id: row.id || null,
          session_id: row.session_id || sessionId,
          user_id: row.user_id || '',
          user_message: row.user_message || '',
          assistant_response: row.assistant_response || '',
          sources: row.sources ? (typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources) : null,
          intent_options: row.intent_options ? (typeof row.intent_options === 'string' ? JSON.parse(row.intent_options) : row.intent_options) : null,
          created_at: row.created_at || null
        };
      } else {
        return {
          id: row.id || null,
          session_id: row.session_id || sessionId,
          user_id: row.user_id || '',
          user_message: row.user_message || '',
          assistant_response: row.assistant_response || '',
          sources: row.sources ? (typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources) : null,
          intent_options: row.intent_options ? (typeof row.intent_options === 'string' ? JSON.parse(row.intent_options) : row.intent_options) : null,
          created_at: row.created_at || null
        };
      }
    });
    
    res.json({ history });
  } catch (error) {
    console.error('세션 히스토리 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;

