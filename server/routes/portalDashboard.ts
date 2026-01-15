import express from 'express';
import { DB_TYPE, query } from '../db';

const router = express.Router();

const DEFAULT_BASELINES = [
  {
    metric_key: 'baseline_minutes_per_request',
    value: 12,
    unit: 'minute',
    description: '요청 1건당 기준 처리 시간 (분)'
  },
  {
    metric_key: 'cost_per_hour',
    value: 45000,
    unit: 'KRW',
    description: '시간당 인건비 단가'
  }
];

const normalizeErrorRate = (raw: number | null) => {
  if (!raw && raw !== 0) {
    return null;
  }
  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.max(0, normalized);
};

const buildFilter = (agentType?: string, businessType?: string) => {
  const filters: string[] = [];
  if (agentType) {
    filters.push('a.type = $3');
  }
  if (businessType) {
    filters.push('a.business_type = $4');
  }
  return filters.length ? `AND ${filters.join(' AND ')}` : '';
};

router.get('/metrics', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'week';
    const agentType = (req.query.agentType as string) || '';
    const businessType = (req.query.businessType as string) || '';

    const days = period === 'month' ? 30 : 7;

    if (DB_TYPE === 'postgres') {
      const params = [days, period, agentType || null, businessType || null];
      const filterClause = buildFilter(agentType, businessType);
      const metricsSql = `
        WITH bounds AS (
          SELECT CURRENT_DATE - ($1 || ' days')::interval AS date_from,
                 CURRENT_DATE AS date_to
        ),
        req AS (
          SELECT
            COUNT(*) AS total_requests,
            COUNT(*) FILTER (WHERE status = 'completed') AS completed_requests,
            COUNT(*) FILTER (WHERE status IN ('pending', 'in_progress')) AS pending_requests
          FROM ear_requests r, bounds b
          WHERE r.created_at >= b.date_from AND r.created_at < b.date_to
        ),
        agent_base AS (
          SELECT
            AVG(am.avg_latency) AS avg_latency,
            AVG(am.error_rate) AS avg_error_rate,
            SUM(am.requests_processed) AS requests_processed
          FROM agent_metrics am
          JOIN agents a ON a.id = am.agent_id
          JOIN bounds b ON am.timestamp >= b.date_from AND am.timestamp < b.date_to
          WHERE 1=1
          ${filterClause}
        ),
        agent_breakdown AS (
          SELECT
            a.type AS agent_type,
            a.business_type,
            SUM(am.requests_processed) AS requests_processed,
            AVG(am.avg_latency) AS avg_latency,
            AVG(am.error_rate) AS avg_error_rate
          FROM agent_metrics am
          JOIN agents a ON a.id = am.agent_id
          JOIN bounds b ON am.timestamp >= b.date_from AND am.timestamp < b.date_to
          WHERE 1=1
          ${filterClause}
          GROUP BY a.type, a.business_type
        )
        SELECT
          (SELECT date_from FROM bounds) AS date_from,
          (SELECT date_to FROM bounds) AS date_to,
          req.total_requests,
          req.completed_requests,
          req.pending_requests,
          agent_base.avg_latency,
          agent_base.avg_error_rate,
          agent_base.requests_processed,
          COALESCE((SELECT JSONB_AGG(agent_breakdown) FROM agent_breakdown), '[]'::jsonb) AS breakdown
        FROM req, agent_base;
      `;

      const result = await query(metricsSql, params);
      const row = result.rows[0] || {};

      const baselines = await query(
        `SELECT metric_key, value, unit, description
         FROM portal_metric_inputs
         WHERE (business_type = $1 OR business_type IS NULL)
           AND (agent_type = $2 OR agent_type IS NULL)`,
        [businessType || null, agentType || null]
      );

      const baselineMap = new Map<string, { value: number }>();
      baselines.rows.forEach((item: any) => {
        baselineMap.set(item.metric_key, item);
      });
      DEFAULT_BASELINES.forEach((item) => {
        if (!baselineMap.has(item.metric_key)) {
          baselineMap.set(item.metric_key, item as any);
        }
      });

      const avgLatency = Number(row.avg_latency || 0);
      const errorRateRaw = Number(row.avg_error_rate || 0);
      const normalizedErrorRate = normalizeErrorRate(errorRateRaw) ?? 0;
      const errorRatePct = normalizedErrorRate * 100;
      const qualityScore = Math.max(0, (1 - normalizedErrorRate) * 5);
      const stabilityScore = Math.max(0, 100 - errorRatePct);

      const baselineMinutes = baselineMap.get('baseline_minutes_per_request')?.value ?? 12;
      const costPerHour = baselineMap.get('cost_per_hour')?.value ?? 45000;
      const avgResponseMinutes = avgLatency / 1000 / 60;
      const completedRequests = Number(row.completed_requests || 0);
      const timeSavingsMinutes = Math.max(0, (baselineMinutes - avgResponseMinutes) * completedRequests);
      const costSavings = (timeSavingsMinutes / 60) * costPerHour;

      return res.json({
        period,
        date_from: row.date_from,
        date_to: row.date_to,
        total_requests: Number(row.total_requests || 0),
        completed_requests: completedRequests,
        pending_requests: Number(row.pending_requests || 0),
        avg_latency_ms: avgLatency,
        error_rate_pct: errorRatePct,
        quality_score: Number(qualityScore.toFixed(2)),
        stability_score: Number(stabilityScore.toFixed(2)),
        requests_processed: Number(row.requests_processed || 0),
        breakdown: row.breakdown || [],
        baselines: Array.from(baselineMap.entries()).map(([key, value]) => ({
          metric_key: key,
          value: value.value,
          unit: value.unit || null,
          description: value.description || null
        })),
        savings: {
          baseline_minutes_per_request: baselineMinutes,
          avg_response_minutes: Number(avgResponseMinutes.toFixed(4)),
          time_savings_minutes: Number(timeSavingsMinutes.toFixed(2)),
          cost_savings: Number(costSavings.toFixed(2))
        }
      });
    }

    const hanaMetricsSql = `
      SELECT
        (SELECT COUNT(*) FROM EAR.EAR_REQUESTS WHERE CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})) AS TOTAL_REQUESTS,
        (SELECT COUNT(*) FROM EAR.EAR_REQUESTS WHERE STATUS = 'completed' AND CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})) AS COMPLETED_REQUESTS,
        (SELECT COUNT(*) FROM EAR.EAR_REQUESTS WHERE STATUS IN ('pending','in_progress') AND CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})) AS PENDING_REQUESTS,
        (SELECT AVG(AVG_LATENCY) FROM EAR.AGENT_METRICS WHERE TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})) AS AVG_LATENCY,
        (SELECT AVG(ERROR_RATE) FROM EAR.AGENT_METRICS WHERE TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})) AS AVG_ERROR_RATE,
        (SELECT SUM(REQUESTS_PROCESSED) FROM EAR.AGENT_METRICS WHERE TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})) AS REQUESTS_PROCESSED
      FROM DUMMY;
    `;

    const hanaResult = await query(hanaMetricsSql);
    const row = hanaResult.rows?.[0] || hanaResult[0] || {};
    const avgLatency = Number(row.AVG_LATENCY || 0);
    const errorRateRaw = Number(row.AVG_ERROR_RATE || 0);
    const normalizedErrorRate = normalizeErrorRate(errorRateRaw) ?? 0;
    const errorRatePct = normalizedErrorRate * 100;
    const qualityScore = Math.max(0, (1 - normalizedErrorRate) * 5);
    const stabilityScore = Math.max(0, 100 - errorRatePct);

    return res.json({
      period,
      total_requests: Number(row.TOTAL_REQUESTS || 0),
      completed_requests: Number(row.COMPLETED_REQUESTS || 0),
      pending_requests: Number(row.PENDING_REQUESTS || 0),
      avg_latency_ms: avgLatency,
      error_rate_pct: errorRatePct,
      quality_score: Number(qualityScore.toFixed(2)),
      stability_score: Number(stabilityScore.toFixed(2)),
      requests_processed: Number(row.REQUESTS_PROCESSED || 0),
      breakdown: [],
      baselines: DEFAULT_BASELINES,
      savings: {
        baseline_minutes_per_request: DEFAULT_BASELINES[0].value,
        avg_response_minutes: Number((avgLatency / 1000 / 60).toFixed(4)),
        time_savings_minutes: 0,
        cost_savings: 0
      }
    });
  } catch (error) {
    console.error('Portal dashboard metrics error:', error);
    res.status(500).json({ error: '포털 지표 집계 중 오류가 발생했습니다.' });
  }
});

router.get('/baselines', async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'SELECT id, metric_key, value, unit, description, business_type, agent_type FROM portal_metric_inputs ORDER BY metric_key'
      );
      return res.json({ baselines: result.rows });
    }

    const hanaResult = await query(
      'SELECT ID, METRIC_KEY, VALUE, UNIT, DESCRIPTION, BUSINESS_TYPE, AGENT_TYPE FROM EAR.PORTAL_METRIC_INPUTS ORDER BY METRIC_KEY'
    );
    return res.json({ baselines: hanaResult.rows || hanaResult });
  } catch (error) {
    console.error('Portal baseline fetch error:', error);
    res.status(500).json({ error: 'Baseline 정보를 불러오지 못했습니다.' });
  }
});

router.post('/baselines', async (req, res) => {
  try {
    const { metric_key, value, unit, description, business_type, agent_type } = req.body || {};

    if (!metric_key || value === undefined) {
      return res.status(400).json({ error: 'metric_key와 value는 필수입니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `INSERT INTO portal_metric_inputs (metric_key, value, unit, description, business_type, agent_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (metric_key, business_type, agent_type)
         DO UPDATE SET value = EXCLUDED.value, unit = EXCLUDED.unit, description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [metric_key, value, unit || null, description || null, business_type || null, agent_type || null]
      );
      return res.json({ baseline: result.rows[0] });
    }

    await query(
      `MERGE INTO EAR.PORTAL_METRIC_INPUTS AS target
       USING (SELECT ? AS METRIC_KEY, ? AS VALUE, ? AS UNIT, ? AS DESCRIPTION, ? AS BUSINESS_TYPE, ? AS AGENT_TYPE FROM DUMMY) AS source
       ON (target.METRIC_KEY = source.METRIC_KEY
           AND ((target.BUSINESS_TYPE = source.BUSINESS_TYPE) OR (target.BUSINESS_TYPE IS NULL AND source.BUSINESS_TYPE IS NULL))
           AND ((target.AGENT_TYPE = source.AGENT_TYPE) OR (target.AGENT_TYPE IS NULL AND source.AGENT_TYPE IS NULL)))
       WHEN MATCHED THEN
         UPDATE SET VALUE = source.VALUE, UNIT = source.UNIT, DESCRIPTION = source.DESCRIPTION, UPDATED_AT = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (METRIC_KEY, VALUE, UNIT, DESCRIPTION, BUSINESS_TYPE, AGENT_TYPE, CREATED_AT, UPDATED_AT)
         VALUES (source.METRIC_KEY, source.VALUE, source.UNIT, source.DESCRIPTION, source.BUSINESS_TYPE, source.AGENT_TYPE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [metric_key, value, unit || null, description || null, business_type || null, agent_type || null]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Portal baseline update error:', error);
    res.status(500).json({ error: 'Baseline 정보를 저장하지 못했습니다.' });
  }
});

export default router;
