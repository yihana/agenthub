import express from 'express';
import { db, DB_TYPE } from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

const logAudit = async (userId: string | null, eventType: string, targetId: string | number, details: any) => {
  const payload = details ? JSON.stringify(details) : null;
  if (DB_TYPE === 'postgres') {
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type, target_id, details) VALUES ($1, $2, $3, $4)',
      [userId, eventType, String(targetId), payload]
    );
  } else {
    await db.query(
      'INSERT INTO EAR.audit_logs (USER_ID, EVENT_TYPE, TARGET_ID, DETAILS) VALUES (?, ?, ?, ?)',
      [userId, eventType, String(targetId), payload]
    );
  }
};

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    if (DB_TYPE === 'postgres') {
      const params: any[] = [];
      const clauses: string[] = [];
      let paramIndex = 0;

      if (status) {
        clauses.push(`status = $${++paramIndex}`);
        params.push(status);
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const result = await db.query(
        `SELECT * FROM job_queue
         ${whereSql}
         ORDER BY created_at DESC
         LIMIT $${++paramIndex} OFFSET $${++paramIndex}`,
        [...params, Number(limit), offset]
      );

      res.json({ jobs: result.rows });
    } else {
      const params: any[] = [];
      const clauses: string[] = [];

      if (status) {
        clauses.push('STATUS = ?');
        params.push(status);
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const result = await db.query(
        `SELECT * FROM EAR.job_queue
         ${whereSql}
         ORDER BY CREATED_AT DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );

      res.json({ jobs: result.rows || result });
    }
  } catch (error: any) {
    console.error('작업 큐 조회 오류:', error);
    res.status(500).json({ error: '작업 큐 조회 중 오류가 발생했습니다.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { payload, priority = 0, scheduledAt, assignedAgentId } = req.body;

    const jobId = `job_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const payloadValue = payload ? JSON.stringify(payload) : null;

    if (DB_TYPE === 'postgres') {
      await db.query(
        `INSERT INTO job_queue (job_id, payload, priority, status, assigned_agent_id, scheduled_at)
         VALUES ($1, $2, $3, 'queued', $4, $5)`,
        [jobId, payloadValue, priority, assignedAgentId || null, scheduledAt || null]
      );
    } else {
      await db.query(
        `INSERT INTO EAR.job_queue (JOB_ID, PAYLOAD, PRIORITY, STATUS, ASSIGNED_AGENT_ID, SCHEDULED_AT)
         VALUES (?, ?, ?, 'queued', ?, ?)`,
        [jobId, payloadValue, priority, assignedAgentId || null, scheduledAt || null]
      );
    }

    const authReq = req as any;
    await logAudit(authReq.user?.userid || authReq.user?.id || null, 'job_created', jobId, {
      priority
    });

    res.status(201).json({ jobId });
  } catch (error: any) {
    console.error('작업 생성 오류:', error);
    res.status(500).json({ error: '작업 생성 중 오류가 발생했습니다.' });
  }
});

router.get('/:jobId', authenticateToken, async (req, res) => {
  try {
    const { jobId } = req.params;

    if (DB_TYPE === 'postgres') {
      const result = await db.query('SELECT * FROM job_queue WHERE job_id = $1', [jobId]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
      }
      res.json({ job: result.rows[0] });
    } else {
      const result = await db.query('SELECT * FROM EAR.job_queue WHERE JOB_ID = ?', [jobId]);
      const rows = result.rows || result;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '작업을 찾을 수 없습니다.' });
      }
      res.json({ job: rows[0] });
    }
  } catch (error: any) {
    console.error('작업 조회 오류:', error);
    res.status(500).json({ error: '작업 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
