import express from 'express';
import { db, DB_TYPE } from '../db';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = express.Router();

const parseJsonField = (value: any) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const normalizeAgentRow = (row: any) => {
  const envConfig = parseJsonField(row.env_config || row.ENV_CONFIG);
  const tags = parseJsonField(row.tags || row.TAGS) || [];
  return {
    id: row.id || row.ID,
    name: row.name || row.NAME,
    description: row.description || row.DESCRIPTION,
    type: row.type || row.TYPE,
    status: row.status || row.STATUS,
    envConfig,
    maxConcurrency: row.max_concurrency || row.MAX_CONCURRENCY,
    tags,
    lastHeartbeat: row.last_heartbeat || row.LAST_HEARTBEAT,
    isActive: row.is_active ?? row.IS_ACTIVE,
    createdAt: row.created_at || row.CREATED_AT,
    updatedAt: row.updated_at || row.UPDATED_AT
  };
};

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

router.get('/summary', authenticateToken, async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const statusResult = await db.query(
        `SELECT status, COUNT(*)::int as count
         FROM agents
         WHERE is_active = true
         GROUP BY status`
      );

      const totalsResult = await db.query(
        `SELECT COUNT(*)::int as total,
                COUNT(*) FILTER (WHERE status = 'active')::int as active,
                COUNT(*) FILTER (WHERE status = 'inactive')::int as inactive,
                COUNT(*) FILTER (WHERE status = 'error')::int as error
         FROM agents
         WHERE is_active = true`
      );

      const metricsResult = await db.query(
        `SELECT
            COALESCE(SUM(requests_processed), 0)::int as total_requests,
            COALESCE(AVG(avg_latency), 0)::float as avg_latency,
            COALESCE(AVG(error_rate), 0)::float as avg_error_rate
         FROM agent_metrics
         WHERE timestamp >= NOW() - INTERVAL '1 hour'`
      );

      res.json({
        statusBreakdown: statusResult.rows,
        totals: totalsResult.rows[0],
        metrics: metricsResult.rows[0]
      });
    } else {
      const statusResult = await db.query(
        `SELECT STATUS as status, COUNT(*) as count
         FROM EAR.agents
         WHERE IS_ACTIVE = true
         GROUP BY STATUS`
      );

      const totalsResult = await db.query(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN STATUS = 'active' THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN STATUS = 'inactive' THEN 1 ELSE 0 END) as inactive,
                SUM(CASE WHEN STATUS = 'error' THEN 1 ELSE 0 END) as error
         FROM EAR.agents
         WHERE IS_ACTIVE = true`
      );

      const metricsResult = await db.query(
        `SELECT
            COALESCE(SUM(REQUESTS_PROCESSED), 0) as total_requests,
            COALESCE(AVG(AVG_LATENCY), 0) as avg_latency,
            COALESCE(AVG(ERROR_RATE), 0) as avg_error_rate
         FROM EAR.agent_metrics
         WHERE TIMESTAMP >= ADD_SECONDS(CURRENT_TIMESTAMP, -3600)`
      );

      const totalsRow = statusResult.rows?.[0] || totalsResult.rows?.[0] || totalsResult[0] || {};

      res.json({
        statusBreakdown: statusResult.rows || statusResult,
        totals: totalsResult.rows?.[0] || totalsResult[0] || totalsRow,
        metrics: metricsResult.rows?.[0] || metricsResult[0] || {}
      });
    }
  } catch (error: any) {
    console.error('에이전트 요약 조회 오류:', error);
    res.status(500).json({ error: '에이전트 요약 조회 중 오류가 발생했습니다.' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { search = '', status, type, role, page = 1, limit = 20 } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    if (DB_TYPE === 'postgres') {
      const whereClauses: string[] = [];
      const params: any[] = [];
      let paramIndex = 0;

      if (search) {
        whereClauses.push(`(a.name ILIKE $${++paramIndex} OR a.description ILIKE $${paramIndex})`);
        params.push(`%${search}%`);
      }
      if (status) {
        whereClauses.push(`a.status = $${++paramIndex}`);
        params.push(status);
      }
      if (type) {
        whereClauses.push(`a.type = $${++paramIndex}`);
        params.push(type);
      }
      if (role) {
        whereClauses.push(`ar.role_name = $${++paramIndex}`);
        params.push(role);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const joinSql = role ? 'LEFT JOIN agent_roles ar ON a.id = ar.agent_id' : '';

      const dataResult = await db.query(
        `SELECT DISTINCT a.*
         FROM agents a
         ${joinSql}
         ${whereSql}
         ORDER BY a.created_at DESC
         LIMIT $${++paramIndex} OFFSET $${++paramIndex}`,
        [...params, Number(limit), offset]
      );

      const countResult = await db.query(
        `SELECT COUNT(DISTINCT a.id)::int as total
         FROM agents a
         ${joinSql}
         ${whereSql}`,
        params
      );

      const agents = dataResult.rows.map(normalizeAgentRow);
      const agentIds = agents.map((agent) => agent.id);

      let rolesMap: Record<string, string[]> = {};
      if (agentIds.length > 0) {
        const rolesResult = await db.query(
          'SELECT agent_id, role_name FROM agent_roles WHERE agent_id = ANY($1::int[])',
          [agentIds]
        );
        rolesMap = rolesResult.rows.reduce((acc: Record<string, string[]>, row: any) => {
          const key = String(row.agent_id);
          acc[key] = acc[key] || [];
          acc[key].push(row.role_name);
          return acc;
        }, {});
      }

      res.json({
        agents: agents.map((agent) => ({
          ...agent,
          roles: rolesMap[String(agent.id)] || []
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: countResult.rows[0]?.total || 0,
          totalPages: Math.ceil((countResult.rows[0]?.total || 0) / Number(limit))
        }
      });
    } else {
      const whereClauses: string[] = [];
      const params: any[] = [];

      if (search) {
        whereClauses.push('(UPPER(a.NAME) LIKE ? OR UPPER(a.DESCRIPTION) LIKE ?)');
        params.push(`%${search.toUpperCase()}%`, `%${search.toUpperCase()}%`);
      }
      if (status) {
        whereClauses.push('a.STATUS = ?');
        params.push(status);
      }
      if (type) {
        whereClauses.push('a.TYPE = ?');
        params.push(type);
      }
      if (role) {
        whereClauses.push('ar.ROLE_NAME = ?');
        params.push(role);
      }

      const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
      const joinSql = role ? 'LEFT JOIN EAR.agent_roles ar ON a.ID = ar.AGENT_ID' : '';

      const dataResult = await db.query(
        `SELECT DISTINCT a.*
         FROM EAR.agents a
         ${joinSql}
         ${whereSql}
         ORDER BY a.CREATED_AT DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );

      const countResult = await db.query(
        `SELECT COUNT(DISTINCT a.ID) as total
         FROM EAR.agents a
         ${joinSql}
         ${whereSql}`,
        params
      );

      const agents = (dataResult.rows || dataResult).map(normalizeAgentRow);
      const agentIds = agents.map((agent) => agent.id);

      let rolesMap: Record<string, string[]> = {};
      if (agentIds.length > 0) {
        const placeholders = agentIds.map(() => '?').join(',');
        const rolesResult = await db.query(
          `SELECT AGENT_ID, ROLE_NAME FROM EAR.agent_roles WHERE AGENT_ID IN (${placeholders})`,
          agentIds
        );
        const rows = rolesResult.rows || rolesResult;
        rolesMap = rows.reduce((acc: Record<string, string[]>, row: any) => {
          const key = String(row.AGENT_ID || row.agent_id);
          acc[key] = acc[key] || [];
          acc[key].push(row.ROLE_NAME || row.role_name);
          return acc;
        }, {});
      }

      const total = countResult.rows?.[0]?.TOTAL || countResult.rows?.[0]?.total || countResult[0]?.TOTAL || 0;

      res.json({
        agents: agents.map((agent) => ({
          ...agent,
          roles: rolesMap[String(agent.id)] || []
        })),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: Number(total),
          totalPages: Math.ceil(Number(total) / Number(limit))
        }
      });
    }
  } catch (error: any) {
    console.error('에이전트 목록 조회 오류:', error);
    res.status(500).json({ error: '에이전트 목록 조회 중 오류가 발생했습니다.' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, type, envConfig, maxConcurrency, tags, roles = [], status = 'inactive' } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: '에이전트 이름과 유형은 필수입니다.' });
    }

    const envPayload = envConfig ? JSON.stringify(envConfig) : null;
    const tagsPayload = tags ? JSON.stringify(tags) : JSON.stringify([]);

    let agentId: number | string;

    if (DB_TYPE === 'postgres') {
      const result = await db.query(
        `INSERT INTO agents (name, description, type, status, env_config, max_concurrency, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [name, description, type, status, envPayload, maxConcurrency || 1, tagsPayload]
      );

      agentId = result.rows[0].id;
    } else {
      await db.query(
        `INSERT INTO EAR.agents (NAME, DESCRIPTION, TYPE, STATUS, ENV_CONFIG, MAX_CONCURRENCY, TAGS)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, description, type, status, envPayload, maxConcurrency || 1, tagsPayload]
      );

      const idResult = await db.query('SELECT TOP 1 ID FROM EAR.agents ORDER BY ID DESC', []);
      const idRow = idResult.rows?.[0] || idResult[0];
      agentId = idRow.ID || idRow.id;
    }

    if (roles.length > 0) {
      for (const roleName of roles) {
        if (DB_TYPE === 'postgres') {
          await db.query(
            'INSERT INTO agent_roles (agent_id, role_name) VALUES ($1, $2)',
            [agentId, roleName]
          );
        } else {
          await db.query(
            'INSERT INTO EAR.agent_roles (AGENT_ID, ROLE_NAME) VALUES (?, ?)',
            [agentId, roleName]
          );
        }
      }
    }

    const authReq = req as any;
    await logAudit(authReq.user?.userid || authReq.user?.id || null, 'agent_created', agentId, {
      name,
      type
    });

    res.status(201).json({ success: true, id: agentId });
  } catch (error: any) {
    console.error('에이전트 생성 오류:', error);
    res.status(500).json({ error: '에이전트 생성 중 오류가 발생했습니다.' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, envConfig, maxConcurrency, tags, roles, status, type } = req.body;

    if (type) {
      return res.status(400).json({ error: '에이전트 유형은 수정할 수 없습니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const existing = await db.query('SELECT id FROM agents WHERE id = $1', [id]);
      if (existing.rows.length === 0) {
        return res.status(404).json({ error: '에이전트를 찾을 수 없습니다.' });
      }

      await db.query(
        `UPDATE agents
         SET name = COALESCE($1, name),
             description = COALESCE($2, description),
             env_config = COALESCE($3, env_config),
             max_concurrency = COALESCE($4, max_concurrency),
             tags = COALESCE($5, tags),
             status = COALESCE($6, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [
          name,
          description,
          envConfig ? JSON.stringify(envConfig) : null,
          maxConcurrency,
          tags ? JSON.stringify(tags) : null,
          status,
          id
        ]
      );

      if (Array.isArray(roles)) {
        await db.query('DELETE FROM agent_roles WHERE agent_id = $1', [id]);
        for (const roleName of roles) {
          await db.query(
            'INSERT INTO agent_roles (agent_id, role_name) VALUES ($1, $2)',
            [id, roleName]
          );
        }
      }
    } else {
      const existing = await db.query('SELECT ID FROM EAR.agents WHERE ID = ?', [id]);
      const rows = existing.rows || existing;
      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '에이전트를 찾을 수 없습니다.' });
      }

      await db.query(
        `UPDATE EAR.agents
         SET NAME = COALESCE(?, NAME),
             DESCRIPTION = COALESCE(?, DESCRIPTION),
             ENV_CONFIG = COALESCE(?, ENV_CONFIG),
             MAX_CONCURRENCY = COALESCE(?, MAX_CONCURRENCY),
             TAGS = COALESCE(?, TAGS),
             STATUS = COALESCE(?, STATUS),
             UPDATED_AT = CURRENT_TIMESTAMP
         WHERE ID = ?`,
        [
          name,
          description,
          envConfig ? JSON.stringify(envConfig) : null,
          maxConcurrency,
          tags ? JSON.stringify(tags) : null,
          status,
          id
        ]
      );

      if (Array.isArray(roles)) {
        await db.query('DELETE FROM EAR.agent_roles WHERE AGENT_ID = ?', [id]);
        for (const roleName of roles) {
          await db.query(
            'INSERT INTO EAR.agent_roles (AGENT_ID, ROLE_NAME) VALUES (?, ?)',
            [id, roleName]
          );
        }
      }
    }

    const authReq = req as any;
    await logAudit(authReq.user?.userid || authReq.user?.id || null, 'agent_updated', id, {
      name,
      status
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('에이전트 수정 오류:', error);
    res.status(500).json({ error: '에이전트 수정 중 오류가 발생했습니다.' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (DB_TYPE === 'postgres') {
      await db.query(
        `UPDATE agents
         SET is_active = false,
             status = 'inactive',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [id]
      );
    } else {
      await db.query(
        `UPDATE EAR.agents
         SET IS_ACTIVE = false,
             STATUS = 'inactive',
             UPDATED_AT = CURRENT_TIMESTAMP
         WHERE ID = ?`,
        [id]
      );
    }

    const authReq = req as any;
    await logAudit(authReq.user?.userid || authReq.user?.id || null, 'agent_deactivated', id, {});

    res.json({ success: true });
  } catch (error: any) {
    console.error('에이전트 비활성화 오류:', error);
    res.status(500).json({ error: '에이전트 비활성화 중 오류가 발생했습니다.' });
  }
});

router.get('/:id/metrics', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { start_time, end_time } = req.query as any;

    const startTime = start_time ? new Date(start_time) : new Date(Date.now() - 3600 * 1000 * 24);
    const endTime = end_time ? new Date(end_time) : new Date();

    if (DB_TYPE === 'postgres') {
      const result = await db.query(
        `SELECT * FROM agent_metrics
         WHERE agent_id = $1 AND timestamp BETWEEN $2 AND $3
         ORDER BY timestamp DESC`,
        [id, startTime, endTime]
      );
      res.json({ metrics: result.rows });
    } else {
      const result = await db.query(
        `SELECT * FROM EAR.agent_metrics
         WHERE AGENT_ID = ? AND TIMESTAMP BETWEEN ? AND ?
         ORDER BY TIMESTAMP DESC`,
        [id, startTime, endTime]
      );
      res.json({ metrics: result.rows || result });
    }
  } catch (error: any) {
    console.error('에이전트 메트릭 조회 오류:', error);
    res.status(500).json({ error: '에이전트 메트릭 조회 중 오류가 발생했습니다.' });
  }
});

router.get('/:id/tasks', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, page = 1, limit = 20 } = req.query as any;
    const offset = (Number(page) - 1) * Number(limit);

    if (DB_TYPE === 'postgres') {
      const params: any[] = [id];
      const clauses: string[] = ['agent_id = $1'];
      let paramIndex = 1;

      if (status) {
        clauses.push(`status = $${++paramIndex}`);
        params.push(status);
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const result = await db.query(
        `SELECT * FROM agent_tasks
         ${whereSql}
         ORDER BY received_at DESC NULLS LAST
         LIMIT $${++paramIndex} OFFSET $${++paramIndex}`,
        [...params, Number(limit), offset]
      );

      res.json({ tasks: result.rows });
    } else {
      const params: any[] = [id];
      const clauses: string[] = ['AGENT_ID = ?'];

      if (status) {
        clauses.push('STATUS = ?');
        params.push(status);
      }

      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

      const result = await db.query(
        `SELECT * FROM EAR.agent_tasks
         ${whereSql}
         ORDER BY RECEIVED_AT DESC
         LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
      );

      res.json({ tasks: result.rows || result });
    }
  } catch (error: any) {
    console.error('에이전트 작업 조회 오류:', error);
    res.status(500).json({ error: '에이전트 작업 조회 중 오류가 발생했습니다.' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (DB_TYPE === 'postgres') {
      const result = await db.query('SELECT * FROM agents WHERE id = $1', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '에이전트를 찾을 수 없습니다.' });
      }

      const rolesResult = await db.query('SELECT role_name FROM agent_roles WHERE agent_id = $1', [id]);
      const agent = normalizeAgentRow(result.rows[0]);

      res.json({
        agent: {
          ...agent,
          roles: rolesResult.rows.map((row: any) => row.role_name)
        }
      });
    } else {
      const result = await db.query('SELECT * FROM EAR.agents WHERE ID = ?', [id]);
      const rows = result.rows || result;

      if (!rows || rows.length === 0) {
        return res.status(404).json({ error: '에이전트를 찾을 수 없습니다.' });
      }

      const rolesResult = await db.query('SELECT ROLE_NAME FROM EAR.agent_roles WHERE AGENT_ID = ?', [id]);
      const rolesRows = rolesResult.rows || rolesResult;

      const agent = normalizeAgentRow(rows[0]);
      res.json({
        agent: {
          ...agent,
          roles: rolesRows.map((row: any) => row.ROLE_NAME || row.role_name)
        }
      });
    }
  } catch (error: any) {
    console.error('에이전트 상세 조회 오류:', error);
    res.status(500).json({ error: '에이전트 상세 조회 중 오류가 발생했습니다.' });
  }
});

export default router;
