import express from 'express';
import { db, DB_TYPE } from '../db';
import { requireAdmin } from '../middleware/auth';

const router = express.Router();

// 관리자 권한 확인 미들웨어는 공통 미들웨어 사용

// 로그인 이력 조회 (관리자만)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      userid = '', 
      status = '', 
      startDate = '', 
      endDate = '' 
    } = req.query;
    
    console.log('로그인 이력 조회 파라미터:', { page, limit, userid, status, startDate, endDate });
    
    const offset = (Number(page) - 1) * Number(limit);

    let query: string;
    let conditions: string[] = [];
    let params: any[] = [];
    let paramCount = 0;

    if (DB_TYPE === 'postgres') {
      query = `
        SELECT lh.id, lh.user_id, lh.userid, lh.login_time, lh.ip_address, 
               lh.user_agent, lh.login_status, lh.failure_reason,
               u.full_name, u.department, u.position
        FROM login_history lh
        LEFT JOIN users u ON lh.user_id = u.id
      `;

      // 사용자ID 필터
      if (userid) {
        conditions.push(`lh.userid ILIKE $${++paramCount}`);
        params.push(`%${userid}%`);
      }

      // 로그인 상태 필터
      if (status) {
        conditions.push(`lh.login_status = $${++paramCount}`);
        params.push(status);
      }

      // 날짜 범위 필터
      if (startDate) {
        conditions.push(`lh.login_time >= $${++paramCount}`);
        params.push(startDate);
      }

      if (endDate) {
        // endDate에 시간이 없으면 23:59:59까지 포함하도록 설정
        const endDateStr = String(endDate);
        const endDateTime = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59`;
        conditions.push(`lh.login_time <= $${++paramCount}`);
        params.push(endDateTime);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY lh.login_time DESC LIMIT $${++paramCount} OFFSET $${++paramCount}`;
      params.push(Number(limit), offset);
    } else {
      // HANA 쿼리 - UTC 시간을 한국 시간(UTC+9)으로 변환 (9시간 = 32400초)
      query = `
        SELECT lh.ID, lh.USER_ID, lh.USERID, ADD_SECONDS(lh.LOGIN_TIME, 32400) AS LOGIN_TIME, lh.IP_ADDRESS, 
               lh.USER_AGENT, lh.LOGIN_STATUS, lh.FAILURE_REASON,
               u.FULL_NAME, u.DEPARTMENT, u.POSITION
        FROM EAR.login_history lh
        LEFT JOIN EAR.users u ON lh.USER_ID = u.ID
      `;

      // 사용자ID 필터
      if (userid) {
        conditions.push(`lh.USERID LIKE ?`);
        params.push(`%${userid}%`);
      }

      // 로그인 상태 필터
      if (status) {
        conditions.push(`lh.LOGIN_STATUS = ?`);
        params.push(status);
      }

      // 날짜 범위 필터
      if (startDate) {
        conditions.push(`lh.LOGIN_TIME >= ?`);
        params.push(startDate);
      }

      if (endDate) {
        // endDate에 시간이 없으면 23:59:59까지 포함하도록 설정
        const endDateStr = String(endDate);
        const endDateTime = endDateStr.includes('T') ? endDateStr : `${endDateStr}T23:59:59`;
        conditions.push(`lh.LOGIN_TIME <= ?`);
        params.push(endDateTime);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY lh.LOGIN_TIME DESC LIMIT ? OFFSET ?`;
      params.push(Number(limit), offset);
    }

    console.log('실행할 쿼리:', query);
    console.log('쿼리 파라미터:', params);

    const result = await db.query(query, params);

    // 전체 개수 조회
    let countQuery: string;
    let countParams: any[] = [];
    let countParamCount = 0;

    if (DB_TYPE === 'postgres') {
      countQuery = `
        SELECT COUNT(*) 
        FROM login_history lh
        LEFT JOIN users u ON lh.user_id = u.id
      `;
      
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.map(condition => 
          condition.replace(/\$\d+/g, () => `$${++countParamCount}`)
        ).join(' AND ');
        countParams = params.slice(0, -2); // 마지막 2개 파라미터(limit, offset) 제외
      }
    } else {
      // HANA 쿼리
      countQuery = `
        SELECT COUNT(*) 
        FROM EAR.login_history lh
        LEFT JOIN EAR.users u ON lh.USER_ID = u.ID
      `;
      
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
        countParams = params.slice(0, -2); // 마지막 2개 파라미터(limit, offset) 제외
      }
    }

    const countResult = await db.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      loginHistory: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('로그인 이력 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 이력 통계 (관리자만)
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { period = '7' } = req.query; // 기본 7일
    const days = parseInt(period as string);

    let statsQuery: string;
    let totalStatsQuery: string;
    let recentFailuresQuery: string;

    if (DB_TYPE === 'postgres') {
      // PostgreSQL 쿼리
      statsQuery = `
        SELECT 
          DATE(login_time) as date,
          COUNT(*) as total_logins,
          COUNT(CASE WHEN login_status = 'success' THEN 1 END) as successful_logins,
          COUNT(CASE WHEN login_status = 'failed' THEN 1 END) as failed_logins,
          COUNT(CASE WHEN login_status = 'locked' THEN 1 END) as locked_logins
        FROM login_history 
        WHERE login_time >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(login_time)
        ORDER BY date DESC
      `;

      totalStatsQuery = `
        SELECT 
          COUNT(*) as total_logins,
          COUNT(CASE WHEN login_status = 'success' THEN 1 END) as successful_logins,
          COUNT(CASE WHEN login_status = 'failed' THEN 1 END) as failed_logins,
          COUNT(CASE WHEN login_status = 'locked' THEN 1 END) as locked_logins,
          COUNT(DISTINCT user_id) as unique_users
        FROM login_history 
        WHERE login_time >= CURRENT_DATE - INTERVAL '${days} days'
      `;

      recentFailuresQuery = `
        SELECT userid, login_time, ip_address, failure_reason
        FROM login_history 
        WHERE login_status = 'failed' 
        ORDER BY login_time DESC 
        LIMIT 10
      `;
    } else {
      // HANA 쿼리 - INTERVAL 대신 ADD_DAYS 사용
      statsQuery = `
        SELECT 
          TO_DATE(LOGIN_TIME) as date,
          COUNT(*) as total_logins,
          COUNT(CASE WHEN LOGIN_STATUS = 'success' THEN 1 END) as successful_logins,
          COUNT(CASE WHEN LOGIN_STATUS = 'failed' THEN 1 END) as failed_logins,
          COUNT(CASE WHEN LOGIN_STATUS = 'locked' THEN 1 END) as locked_logins
        FROM EAR.login_history 
        WHERE LOGIN_TIME >= ADD_DAYS(CURRENT_DATE, -${days})
        GROUP BY TO_DATE(LOGIN_TIME)
        ORDER BY date DESC
      `;

      totalStatsQuery = `
        SELECT 
          COUNT(*) as total_logins,
          COUNT(CASE WHEN LOGIN_STATUS = 'success' THEN 1 END) as successful_logins,
          COUNT(CASE WHEN LOGIN_STATUS = 'failed' THEN 1 END) as failed_logins,
          COUNT(CASE WHEN LOGIN_STATUS = 'locked' THEN 1 END) as locked_logins,
          COUNT(DISTINCT USER_ID) as unique_users
        FROM EAR.login_history 
        WHERE LOGIN_TIME >= ADD_DAYS(CURRENT_DATE, -${days})
      `;

      recentFailuresQuery = `
        SELECT USERID, ADD_SECONDS(LOGIN_TIME, 32400) AS LOGIN_TIME, IP_ADDRESS, FAILURE_REASON
        FROM EAR.login_history 
        WHERE LOGIN_STATUS = 'failed' 
        ORDER BY LOGIN_TIME DESC 
        LIMIT 10
      `;
    }

    const statsResult = await db.query(statsQuery);
    const totalStatsResult = await db.query(totalStatsQuery);
    const recentFailuresResult = await db.query(recentFailuresQuery);

    res.json({
      period: days,
      dailyStats: statsResult.rows,
      totalStats: totalStatsResult.rows[0],
      recentFailures: recentFailuresResult.rows
    });

  } catch (error) {
    console.error('로그인 이력 통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 특정 사용자의 로그인 이력 조회 (관리자만)
router.get('/user/:userId', requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query: string;
    let countQuery: string;

    if (DB_TYPE === 'postgres') {
      query = `
        SELECT id, login_time, ip_address, user_agent, login_status, failure_reason
        FROM login_history 
        WHERE user_id = $1 
        ORDER BY login_time DESC 
        LIMIT $2 OFFSET $3
      `;
      countQuery = 'SELECT COUNT(*) FROM login_history WHERE user_id = $1';
    } else {
      query = `
        SELECT ID, ADD_SECONDS(LOGIN_TIME, 32400) AS LOGIN_TIME, IP_ADDRESS, USER_AGENT, LOGIN_STATUS, FAILURE_REASON
        FROM EAR.login_history 
        WHERE USER_ID = ? 
        ORDER BY LOGIN_TIME DESC 
        LIMIT ? OFFSET ?
      `;
      countQuery = 'SELECT COUNT(*) FROM EAR.login_history WHERE USER_ID = ?';
    }

    const result = await db.query(query, [userId, Number(limit), offset]);
    const countResult = await db.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      loginHistory: result.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit))
      }
    });

  } catch (error) {
    console.error('사용자 로그인 이력 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// 로그인 이력 삭제 (관리자만) - 오래된 기록 정리용
router.delete('/cleanup', requireAdmin, async (req, res) => {
  try {
    const { days = 90 } = req.body; // 기본 90일 이전 기록 삭제

    let query: string;

    if (DB_TYPE === 'postgres') {
      query = 'DELETE FROM login_history WHERE login_time < CURRENT_DATE - INTERVAL $1 days';
    } else {
      query = 'DELETE FROM EAR.login_history WHERE LOGIN_TIME < ADD_DAYS(CURRENT_DATE, -?)';
    }

    const result = await db.query(query, [days]);

    res.json({ 
      success: true, 
      message: `${result.rowCount}개의 오래된 로그인 이력이 삭제되었습니다.`,
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('로그인 이력 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

export default router;
