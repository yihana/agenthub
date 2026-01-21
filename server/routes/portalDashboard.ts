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
  },
  {
    metric_key: 'sla_latency_ms',
    value: 2000,
    unit: 'ms',
    description: 'SLA 기준 응답 시간 (ms)'
  },
  {
    metric_key: 'investment_cost',
    value: 0,
    unit: 'KRW',
    description: '에이전트 개발/운영 투자 비용'
  },
  {
    metric_key: 'total_roles',
    value: 0,
    unit: 'count',
    description: '전체 역할 수'
  },
  {
    metric_key: 'roles_redefined',
    value: 0,
    unit: 'count',
    description: 'AI 협업으로 재설계된 역할 수'
  },
  {
    metric_key: 'customer_nps_delta',
    value: 0,
    unit: 'point',
    description: 'AI 도입 이후 고객 만족도/NPS 변화'
  },
  {
    metric_key: 'error_reduction_pct',
    value: 0,
    unit: 'pct',
    description: '오류율 감소율'
  },
  {
    metric_key: 'decision_speed_improvement_pct',
    value: 0,
    unit: 'pct',
    description: '의사결정 속도 개선율'
  }
];

const normalizeErrorRate = (raw: number | null) => {
  if (!raw && raw !== 0) {
    return null;
  }
  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.max(0, normalized);
};

const buildFilter = (agentIndex: number, businessIndex: number) =>
  `AND ($${agentIndex}::text IS NULL OR a.type = $${agentIndex}) AND ($${businessIndex}::text IS NULL OR a.business_type = $${businessIndex})`;

const buildRequestFilter = (agentIndex: number, businessIndex: number) =>
  `AND ($${agentIndex}::text IS NULL OR a.type = $${agentIndex}) AND ($${businessIndex}::text IS NULL OR COALESCE(r.business_type, a.business_type) = $${businessIndex})`;

router.get('/metrics', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'week';
    const agentType = (req.query.agentType as string) || '';
    const businessType = (req.query.businessType as string) || '';

    const days = period === 'month' ? 30 : 7;

    if (DB_TYPE === 'postgres') {
      const params = [days, agentType || null, businessType || null, agentType || null, businessType || null];
      const requestFilterClause = buildRequestFilter(2, 3);
      const filterClause = buildFilter(4, 5);
      const metricsSql = `
        WITH bounds AS (
          SELECT CURRENT_DATE - ($1 || ' days')::interval AS date_from,
                 CURRENT_DATE AS date_to
        ),
        prev_bounds AS (
          SELECT CURRENT_DATE - ($1 || ' days')::interval * 2 AS date_from,
                 CURRENT_DATE - ($1 || ' days')::interval AS date_to
        ),
        req AS (
          SELECT
            COUNT(*) AS total_requests,
            COUNT(*) FILTER (WHERE r.status = 'completed') AS completed_requests,
            COUNT(*) FILTER (WHERE r.status IN ('pending', 'in_progress')) AS pending_requests
          FROM ear_requests r
          LEFT JOIN agents a ON a.id = r.agent_id
          JOIN bounds b ON r.created_at >= b.date_from AND r.created_at < b.date_to
          WHERE 1=1
          ${requestFilterClause}
        ),
        req_prev AS (
          SELECT
            COUNT(*) AS total_requests
          FROM ear_requests r
          LEFT JOIN agents a ON a.id = r.agent_id
          JOIN prev_bounds b ON r.created_at >= b.date_from AND r.created_at < b.date_to
          WHERE 1=1
          ${requestFilterClause}
        ),
        agent_base AS (
          SELECT
            AVG(am.avg_latency) AS avg_latency,
            AVG(am.error_rate) AS avg_error_rate,
            AVG(am.queue_time) AS avg_queue_time,
            SUM(am.requests_processed) AS requests_processed,
            SUM(am.ai_assisted_decisions) AS ai_assisted_decisions,
            SUM(am.ai_assisted_decisions_validated) AS ai_validated_decisions,
            SUM(am.ai_recommendations) AS ai_recommendations,
            SUM(am.decisions_overridden) AS decisions_overridden,
            AVG(am.cognitive_load_before_score) AS avg_cognitive_load_before,
            AVG(am.cognitive_load_after_score) AS avg_cognitive_load_after,
            AVG(am.handoff_time_seconds) AS avg_handoff_time_seconds,
            AVG(am.team_satisfaction_score) AS avg_team_satisfaction_score,
            SUM(am.innovation_count) AS innovation_count
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
        ),
        task_stats AS (
          SELECT
            COUNT(*) AS total_tasks,
            COUNT(*) FILTER (WHERE t.status IN ('completed', 'success')) AS success_tasks,
            COUNT(*) FILTER (WHERE t.status IN ('failed', 'error')) AS error_tasks
          FROM agent_tasks t
          JOIN agents a ON a.id = t.agent_id
          JOIN bounds b ON t.received_at >= b.date_from AND t.received_at < b.date_to
          WHERE 1=1
          ${filterClause}
        ),
        user_stats AS (
          SELECT COUNT(*) AS total_users FROM users
        ),
        mapped_users AS (
          SELECT COUNT(DISTINCT user_id) AS mapped_users FROM user_business_domain
        ),
        domain_stats AS (
          SELECT
            COALESCE(r.business_type, a.business_type) AS business_type,
            COUNT(*) AS request_count
          FROM ear_requests r
          LEFT JOIN agents a ON a.id = r.agent_id
          JOIN bounds b ON r.created_at >= b.date_from AND r.created_at < b.date_to
          WHERE COALESCE(r.business_type, a.business_type) IS NOT NULL
          GROUP BY COALESCE(r.business_type, a.business_type)
        ),
        funnel_stats AS (
          SELECT
            stage,
            COUNT(DISTINCT user_id) AS user_count
          FROM adoption_funnel_events e
          JOIN bounds b ON e.event_time >= b.date_from AND e.event_time < b.date_to
          GROUP BY stage
        ),
        collaboration_metrics AS (
          SELECT
            AVG(cm.decision_accuracy_pct) AS decision_accuracy_pct,
            AVG(cm.override_rate_pct) AS override_rate_pct,
            AVG(cm.cognitive_load_reduction_pct) AS cognitive_load_reduction_pct,
            AVG(cm.handoff_time_seconds) AS handoff_time_seconds,
            AVG(cm.team_satisfaction_score) AS team_satisfaction_score,
            SUM(cm.innovation_count) AS innovation_count
          FROM human_ai_collaboration_metrics cm
          JOIN bounds b ON cm.period_start >= b.date_from AND cm.period_end < b.date_to
          WHERE 1=1
            AND ($4::text IS NULL OR cm.agent_type = $4)
            AND ($5::text IS NULL OR cm.business_type = $5)
        ),
        risk_stats AS (
          SELECT
            COUNT(*) AS total_risks,
            AVG((COALESCE(rm.risk_ethics_score, 0) + COALESCE(rm.risk_reputation_score, 0) + COALESCE(rm.risk_operational_score, 0) + COALESCE(rm.risk_legal_score, 0))) AS avg_risk_score,
            COUNT(*) FILTER (WHERE rm.audit_required) AS audit_required_count,
            COUNT(*) FILTER (WHERE rm.audit_completed) AS audit_completed_count,
            COUNT(*) FILTER (WHERE rm.human_reviewed) AS human_reviewed_count
          FROM risk_management rm
          JOIN bounds b ON rm.created_at >= b.date_from AND rm.created_at < b.date_to
          WHERE 1=1
            AND ($4::text IS NULL OR rm.agent_type = $4)
            AND ($5::text IS NULL OR rm.business_type = $5)
        )
        SELECT
          (SELECT date_from FROM bounds) AS date_from,
          (SELECT date_to FROM bounds) AS date_to,
          req.total_requests,
          req_prev.total_requests AS prev_total_requests,
          req.completed_requests,
          req.pending_requests,
          agent_base.avg_latency,
          agent_base.avg_error_rate,
          agent_base.avg_queue_time,
          agent_base.requests_processed,
          agent_base.ai_assisted_decisions,
          agent_base.ai_validated_decisions,
          agent_base.ai_recommendations,
          agent_base.decisions_overridden,
          agent_base.avg_cognitive_load_before,
          agent_base.avg_cognitive_load_after,
          agent_base.avg_handoff_time_seconds,
          agent_base.avg_team_satisfaction_score,
          agent_base.innovation_count,
          collaboration_metrics.decision_accuracy_pct,
          collaboration_metrics.override_rate_pct,
          collaboration_metrics.cognitive_load_reduction_pct,
          collaboration_metrics.handoff_time_seconds AS collaboration_handoff_time_seconds,
          collaboration_metrics.team_satisfaction_score AS collaboration_team_satisfaction_score,
          collaboration_metrics.innovation_count AS collaboration_innovation_count,
          risk_stats.total_risks,
          risk_stats.avg_risk_score,
          risk_stats.audit_required_count,
          risk_stats.audit_completed_count,
          risk_stats.human_reviewed_count,
          task_stats.total_tasks,
          task_stats.success_tasks,
          task_stats.error_tasks,
          user_stats.total_users,
          mapped_users.mapped_users,
          COALESCE((SELECT JSONB_AGG(agent_breakdown) FROM agent_breakdown), '[]'::jsonb) AS breakdown,
          COALESCE((SELECT JSONB_AGG(domain_stats) FROM domain_stats), '[]'::jsonb) AS domain_stats,
          COALESCE((SELECT JSONB_AGG(funnel_stats) FROM funnel_stats), '[]'::jsonb) AS funnel_stats
        FROM req, req_prev, agent_base, task_stats, user_stats, mapped_users, collaboration_metrics, risk_stats;
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
      const avgQueueTime = Number(row.avg_queue_time || 0);
      const errorRateRaw = Number(row.avg_error_rate || 0);
      const normalizedErrorRate = normalizeErrorRate(errorRateRaw) ?? 0;
      const errorRatePct = normalizedErrorRate * 100;
      const qualityScore = Math.max(0, (1 - normalizedErrorRate) * 5);
      const stabilityScore = Math.max(0, 100 - errorRatePct);

      let baselineMinutes = baselineMap.get('baseline_minutes_per_request')?.value ?? 12;
      let costPerHour = baselineMap.get('cost_per_hour')?.value ?? 45000;
      const slaLatencyMs = baselineMap.get('sla_latency_ms')?.value ?? 2000;
      const investmentCostInput = baselineMap.get('investment_cost')?.value ?? 0;
      const totalRoles = baselineMap.get('total_roles')?.value ?? 0;
      const rolesRedefined = baselineMap.get('roles_redefined')?.value ?? 0;
      const customerNpsDelta = baselineMap.get('customer_nps_delta')?.value ?? 0;
      const errorReductionPct = baselineMap.get('error_reduction_pct')?.value ?? 0;
      const decisionSpeedImprovementPct = baselineMap.get('decision_speed_improvement_pct')?.value ?? 0;
      const avgResponseMinutes = (avgLatency + avgQueueTime) / 1000 / 60;
      const completedRequests = Number(row.completed_requests || 0);
      let baselineCostOverride: number | null = null;

      if (businessType) {
        const taskBaseline = await query(
          `SELECT AVG(before_time_min) AS before_time_min, AVG(before_cost) AS before_cost
           FROM business_task_baseline
           WHERE domain = $1`,
          [businessType]
        );
        if (taskBaseline.rows[0]?.before_time_min) {
          baselineMinutes = Number(taskBaseline.rows[0].before_time_min);
        }
        if (taskBaseline.rows[0]?.before_cost) {
          baselineCostOverride = Number(taskBaseline.rows[0].before_cost) * completedRequests;
        }
      }

      const laborCost = await query(
        `SELECT hourly_cost
         FROM labor_cost
         WHERE (business_type = $1 OR business_type IS NULL)
         ORDER BY business_type DESC NULLS LAST
         LIMIT 1`,
        [businessType || null]
      );
      if (laborCost.rows[0]?.hourly_cost) {
        costPerHour = Number(laborCost.rows[0].hourly_cost);
      }

      const timeSavingsMinutes = Math.max(0, (baselineMinutes - avgResponseMinutes) * completedRequests);
      const costSavings = (timeSavingsMinutes / 60) * costPerHour;
      const baselineCost = baselineCostOverride ?? (baselineMinutes / 60) * completedRequests * costPerHour;
      const normalizedInvestmentCost = investmentCostInput > 0 ? investmentCostInput : baselineCost;
      const roiRatio = normalizedInvestmentCost > 0 ? (costSavings / normalizedInvestmentCost) * 100 : 0;

      const totalTasks = Number(row.total_tasks || 0);
      const successTasks = Number(row.success_tasks || 0);
      const errorTasks = Number(row.error_tasks || 0);
      const taskSuccessRate = totalTasks > 0 ? (successTasks / totalTasks) * 100 : 0;
      const taskErrorRate = totalTasks > 0 ? (errorTasks / totalTasks) * 100 : 0;

      const avgLatencyTotal = avgLatency + avgQueueTime;
      const slaCompliance = avgLatencyTotal <= slaLatencyMs
        ? 100
        : Math.max(0, 100 - ((avgLatencyTotal - slaLatencyMs) / slaLatencyMs) * 100);

      const prevTotal = Number(row.prev_total_requests || 0);
      const growthRate = prevTotal > 0 ? ((Number(row.total_requests || 0) - prevTotal) / prevTotal) * 100 : 0;

      const totalUsers = Number(row.total_users || 0);
      const mappedUsers = Number(row.mapped_users || 0);
      const userCoverage = totalUsers > 0 ? (mappedUsers / totalUsers) * 100 : 0;

      const assistedDecisions = Number(row.ai_assisted_decisions || 0);
      const validatedDecisions = Number(row.ai_validated_decisions || 0);
      const aiRecommendations = Number(row.ai_recommendations || 0);
      const overriddenDecisions = Number(row.decisions_overridden || 0);
      const avgCognitiveLoadBefore = Number(row.avg_cognitive_load_before || 0);
      const avgCognitiveLoadAfter = Number(row.avg_cognitive_load_after || 0);
      const avgHandoffTime = Number(row.avg_handoff_time_seconds || 0);
      const avgTeamSatisfaction = Number(row.avg_team_satisfaction_score || 0);
      const innovationCount = Number(row.innovation_count || 0);

      const decisionAccuracyFallback = assistedDecisions > 0 ? (validatedDecisions / assistedDecisions) * 100 : 0;
      const overrideRateFallback = aiRecommendations > 0 ? (overriddenDecisions / aiRecommendations) * 100 : 0;
      const cognitiveLoadReductionFallback = avgCognitiveLoadBefore > 0
        ? ((avgCognitiveLoadBefore - avgCognitiveLoadAfter) / avgCognitiveLoadBefore) * 100
        : 0;

      const collaborationDecisionAccuracy = row.decision_accuracy_pct !== null && row.decision_accuracy_pct !== undefined
        ? Number(row.decision_accuracy_pct)
        : null;
      const collaborationOverrideRate = row.override_rate_pct !== null && row.override_rate_pct !== undefined
        ? Number(row.override_rate_pct)
        : null;
      const collaborationCognitiveReduction = row.cognitive_load_reduction_pct !== null && row.cognitive_load_reduction_pct !== undefined
        ? Number(row.cognitive_load_reduction_pct)
        : null;
      const collaborationHandoff = row.collaboration_handoff_time_seconds !== null && row.collaboration_handoff_time_seconds !== undefined
        ? Number(row.collaboration_handoff_time_seconds)
        : null;
      const collaborationSatisfaction = row.collaboration_team_satisfaction_score !== null && row.collaboration_team_satisfaction_score !== undefined
        ? Number(row.collaboration_team_satisfaction_score)
        : null;
      const collaborationInnovation = row.collaboration_innovation_count !== null && row.collaboration_innovation_count !== undefined
        ? Number(row.collaboration_innovation_count)
        : null;

      const totalRisks = Number(row.total_risks || 0);
      const avgRiskScore = Number(row.avg_risk_score || 0);
      const auditRequiredCount = Number(row.audit_required_count || 0);
      const auditCompletedCount = Number(row.audit_completed_count || 0);
      const humanReviewedCount = Number(row.human_reviewed_count || 0);

      const auditRequiredRate = totalRisks > 0 ? (auditRequiredCount / totalRisks) * 100 : 0;
      const auditCompletedRate = totalRisks > 0 ? (auditCompletedCount / totalRisks) * 100 : 0;
      const humanReviewRate = totalRisks > 0 ? (humanReviewedCount / totalRisks) * 100 : 0;

      const roleRedesignRatio = totalRoles > 0 ? (rolesRedefined / totalRoles) * 100 : 0;

      try {
        await query(
          `INSERT INTO roi_metrics (period_start, period_end, business_type, agent_type, saved_hours, saved_cost, roi_ratio_pct)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (period_start, period_end, business_type, agent_type)
           DO UPDATE SET saved_hours = EXCLUDED.saved_hours, saved_cost = EXCLUDED.saved_cost, roi_ratio_pct = EXCLUDED.roi_ratio_pct, updated_at = CURRENT_TIMESTAMP`,
          [
            row.date_from,
            row.date_to,
            businessType || null,
            agentType || null,
            Number((timeSavingsMinutes / 60).toFixed(2)),
            Number(costSavings.toFixed(2)),
            Number(roiRatio.toFixed(2))
          ]
        );
      } catch (error) {
        console.warn('ROI metrics cache update failed:', error);
      }

      const domainStats = (row.domain_stats || []) as Array<{ business_type: string; request_count: number }>;
      const totalRequests = Number(row.total_requests || 0);
      const domainPenetration = domainStats.map((item) => ({
        business_type: item.business_type,
        request_count: Number(item.request_count || 0),
        penetration_pct: totalRequests > 0 ? (Number(item.request_count || 0) / totalRequests) * 100 : 0
      }));
      const funnelStats = (row.funnel_stats || []) as Array<{ stage: string; user_count: number }>;

      return res.json({
        period,
        date_from: row.date_from,
        date_to: row.date_to,
        total_requests: Number(row.total_requests || 0),
        prev_total_requests: prevTotal,
        growth_rate_pct: Number(growthRate.toFixed(2)),
        completed_requests: completedRequests,
        pending_requests: Number(row.pending_requests || 0),
        avg_latency_ms: avgLatency,
        error_rate_pct: errorRatePct,
        quality_score: Number(qualityScore.toFixed(2)),
        stability_score: Number(stabilityScore.toFixed(2)),
        avg_queue_time_ms: avgQueueTime,
        task_success_rate_pct: Number(taskSuccessRate.toFixed(2)),
        task_error_rate_pct: Number(taskErrorRate.toFixed(2)),
        sla_compliance_pct: Number(slaCompliance.toFixed(2)),
        user_coverage_pct: Number(userCoverage.toFixed(2)),
        requests_processed: Number(row.requests_processed || 0),
        breakdown: row.breakdown || [],
        domain_stats: domainStats,
        domain_penetration: domainPenetration,
        funnel_stats: funnelStats,
        baselines: Array.from(baselineMap.entries()).map(([key, value]) => ({
          metric_key: key,
          value: value.value,
          unit: value.unit || null,
          description: value.description || null
        })),
        collaboration: {
          decision_accuracy_pct: Number(
            ((collaborationDecisionAccuracy ?? decisionAccuracyFallback) as number).toFixed(2)
          ),
          override_rate_pct: Number(((collaborationOverrideRate ?? overrideRateFallback) as number).toFixed(2)),
          cognitive_load_reduction_pct: Number(
            ((collaborationCognitiveReduction ?? cognitiveLoadReductionFallback) as number).toFixed(2)
          ),
          handoff_time_seconds: Number(
            ((collaborationHandoff ?? avgHandoffTime) as number).toFixed(2)
          ),
          team_satisfaction_score: Number(
            ((collaborationSatisfaction ?? avgTeamSatisfaction) as number).toFixed(2)
          ),
          innovation_count: Number((collaborationInnovation ?? innovationCount).toFixed(0))
        },
        risk: {
          risk_exposure_score: Number(avgRiskScore.toFixed(2)),
          audit_required_rate_pct: Number(auditRequiredRate.toFixed(2)),
          audit_completed_rate_pct: Number(auditCompletedRate.toFixed(2)),
          human_review_rate_pct: Number(humanReviewRate.toFixed(2)),
          total_risk_items: totalRisks
        },
        value: {
          role_redesign_ratio_pct: Number(roleRedesignRatio.toFixed(2)),
          customer_nps_delta: Number(customerNpsDelta.toFixed(2)),
          error_reduction_pct: Number(errorReductionPct.toFixed(2)),
          decision_speed_improvement_pct: Number(decisionSpeedImprovementPct.toFixed(2))
        },
        savings: {
          baseline_minutes_per_request: baselineMinutes,
          avg_response_minutes: Number(avgResponseMinutes.toFixed(4)),
          time_savings_minutes: Number(timeSavingsMinutes.toFixed(2)),
          cost_savings: Number(costSavings.toFixed(2)),
          baseline_cost: Number(baselineCost.toFixed(2)),
          investment_cost: Number(normalizedInvestmentCost.toFixed(2)),
          roi_ratio_pct: Number(roiRatio.toFixed(2)),
          sla_latency_ms: slaLatencyMs
        }
      });
    }

    const hanaAgentFilter: string[] = [];
    const hanaRequestFilter: string[] = [];
    const hanaRequestParams: any[] = [];
    const hanaAgentParams: any[] = [];
    const hanaMetricFilter: string[] = [];
    const hanaMetricParams: any[] = [];

    if (agentType) {
      hanaAgentFilter.push('A.TYPE = ?');
      hanaRequestFilter.push('A.TYPE = ?');
      hanaRequestParams.push(agentType);
      hanaAgentParams.push(agentType);
      hanaMetricFilter.push('AGENT_TYPE = ?');
      hanaMetricParams.push(agentType);
    }
    if (businessType) {
      hanaAgentFilter.push('A.BUSINESS_TYPE = ?');
      hanaRequestFilter.push('COALESCE(R.BUSINESS_TYPE, A.BUSINESS_TYPE) = ?');
      hanaRequestParams.push(businessType);
      hanaAgentParams.push(businessType);
      hanaMetricFilter.push('BUSINESS_TYPE = ?');
      hanaMetricParams.push(businessType);
    }

    const hanaAgentFilterSql = hanaAgentFilter.length ? `AND ${hanaAgentFilter.join(' AND ')}` : '';
    const hanaRequestFilterSql = hanaRequestFilter.length ? `AND ${hanaRequestFilter.join(' AND ')}` : '';
    const hanaMetricFilterSql = hanaMetricFilter.length ? `AND ${hanaMetricFilter.join(' AND ')}` : '';

    const hanaMetricsSql = `
      SELECT
        (SELECT COUNT(*)
         FROM EAR.EAR_REQUESTS R
         LEFT JOIN EAR.AGENTS A ON A.ID = R.AGENT_ID
         WHERE R.CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaRequestFilterSql}) AS TOTAL_REQUESTS,
        (SELECT COUNT(*)
         FROM EAR.EAR_REQUESTS R
         LEFT JOIN EAR.AGENTS A ON A.ID = R.AGENT_ID
         WHERE R.CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days * 2})
           AND R.CREATED_AT < ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaRequestFilterSql}) AS PREV_TOTAL_REQUESTS,
        (SELECT COUNT(*)
         FROM EAR.EAR_REQUESTS R
         LEFT JOIN EAR.AGENTS A ON A.ID = R.AGENT_ID
         WHERE R.STATUS = 'completed' AND R.CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaRequestFilterSql}) AS COMPLETED_REQUESTS,
        (SELECT COUNT(*)
         FROM EAR.EAR_REQUESTS R
         LEFT JOIN EAR.AGENTS A ON A.ID = R.AGENT_ID
         WHERE R.STATUS IN ('pending','in_progress') AND R.CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaRequestFilterSql}) AS PENDING_REQUESTS,
        (SELECT AVG(AVG_LATENCY)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_LATENCY,
        (SELECT AVG(ERROR_RATE)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_ERROR_RATE,
        (SELECT AVG(QUEUE_TIME)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_QUEUE_TIME,
        (SELECT SUM(REQUESTS_PROCESSED)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS REQUESTS_PROCESSED,
        (SELECT SUM(AI_ASSISTED_DECISIONS)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AI_ASSISTED_DECISIONS,
        (SELECT SUM(AI_ASSISTED_DECISIONS_VALIDATED)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AI_ASSISTED_DECISIONS_VALIDATED,
        (SELECT SUM(AI_RECOMMENDATIONS)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AI_RECOMMENDATIONS,
        (SELECT SUM(DECISIONS_OVERRIDDEN)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS DECISIONS_OVERRIDDEN,
        (SELECT AVG(COGNITIVE_LOAD_BEFORE_SCORE)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_COGNITIVE_LOAD_BEFORE,
        (SELECT AVG(COGNITIVE_LOAD_AFTER_SCORE)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_COGNITIVE_LOAD_AFTER,
        (SELECT AVG(HANDOFF_TIME_SECONDS)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_HANDOFF_TIME_SECONDS,
        (SELECT AVG(TEAM_SATISFACTION_SCORE)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS AVG_TEAM_SATISFACTION_SCORE,
        (SELECT SUM(INNOVATION_COUNT)
         FROM EAR.AGENT_METRICS AM
         JOIN EAR.AGENTS A ON A.ID = AM.AGENT_ID
         WHERE AM.TIMESTAMP >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS INNOVATION_COUNT,
        (SELECT COUNT(*)
         FROM EAR.AGENT_TASKS T
         JOIN EAR.AGENTS A ON A.ID = T.AGENT_ID
         WHERE T.RECEIVED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS TOTAL_TASKS,
        (SELECT COUNT(*)
         FROM EAR.AGENT_TASKS T
         JOIN EAR.AGENTS A ON A.ID = T.AGENT_ID
         WHERE T.STATUS IN ('completed', 'success') AND T.RECEIVED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS SUCCESS_TASKS,
        (SELECT COUNT(*)
         FROM EAR.AGENT_TASKS T
         JOIN EAR.AGENTS A ON A.ID = T.AGENT_ID
         WHERE T.STATUS IN ('failed', 'error') AND T.RECEIVED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaAgentFilterSql}) AS ERROR_TASKS,
        (SELECT COUNT(*) FROM EAR.USERS) AS TOTAL_USERS,
        (SELECT COUNT(DISTINCT USER_ID) FROM EAR.USER_BUSINESS_DOMAIN) AS MAPPED_USERS,
        (SELECT AVG(DECISION_ACCURACY_PCT)
         FROM EAR.HUMAN_AI_COLLABORATION_METRICS
         WHERE PERIOD_START >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS DECISION_ACCURACY_PCT,
        (SELECT AVG(OVERRIDE_RATE_PCT)
         FROM EAR.HUMAN_AI_COLLABORATION_METRICS
         WHERE PERIOD_START >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS OVERRIDE_RATE_PCT,
        (SELECT AVG(COGNITIVE_LOAD_REDUCTION_PCT)
         FROM EAR.HUMAN_AI_COLLABORATION_METRICS
         WHERE PERIOD_START >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS COGNITIVE_LOAD_REDUCTION_PCT,
        (SELECT AVG(HANDOFF_TIME_SECONDS)
         FROM EAR.HUMAN_AI_COLLABORATION_METRICS
         WHERE PERIOD_START >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS COLLAB_HANDOFF_TIME_SECONDS,
        (SELECT AVG(TEAM_SATISFACTION_SCORE)
         FROM EAR.HUMAN_AI_COLLABORATION_METRICS
         WHERE PERIOD_START >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS COLLAB_TEAM_SATISFACTION_SCORE,
        (SELECT SUM(INNOVATION_COUNT)
         FROM EAR.HUMAN_AI_COLLABORATION_METRICS
         WHERE PERIOD_START >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS COLLAB_INNOVATION_COUNT,
        (SELECT COUNT(*)
         FROM EAR.RISK_MANAGEMENT
         WHERE CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS TOTAL_RISKS,
        (SELECT AVG(COALESCE(RISK_ETHICS_SCORE, 0) + COALESCE(RISK_REPUTATION_SCORE, 0) + COALESCE(RISK_OPERATIONAL_SCORE, 0) + COALESCE(RISK_LEGAL_SCORE, 0))
         FROM EAR.RISK_MANAGEMENT
         WHERE CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days})
         ${hanaMetricFilterSql}) AS AVG_RISK_SCORE,
        (SELECT COUNT(*)
         FROM EAR.RISK_MANAGEMENT
         WHERE CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days}) AND AUDIT_REQUIRED = TRUE
         ${hanaMetricFilterSql}) AS AUDIT_REQUIRED_COUNT,
        (SELECT COUNT(*)
         FROM EAR.RISK_MANAGEMENT
         WHERE CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days}) AND AUDIT_COMPLETED = TRUE
         ${hanaMetricFilterSql}) AS AUDIT_COMPLETED_COUNT,
        (SELECT COUNT(*)
         FROM EAR.RISK_MANAGEMENT
         WHERE CREATED_AT >= ADD_DAYS(CURRENT_DATE, -${days}) AND HUMAN_REVIEWED = TRUE
         ${hanaMetricFilterSql}) AS HUMAN_REVIEWED_COUNT
      FROM DUMMY;
    `;

    const hanaParams = [
      ...Array(4).fill(hanaRequestParams).flat(),
      ...Array(16).fill(hanaAgentParams).flat(),
      ...Array(11).fill(hanaMetricParams).flat()
    ];
    const hanaResult = await query(hanaMetricsSql, hanaParams);
    const row = hanaResult.rows?.[0] || hanaResult[0] || {};
    const avgLatency = Number(row.AVG_LATENCY || 0);
    const avgQueueTime = Number(row.AVG_QUEUE_TIME || 0);
    const errorRateRaw = Number(row.AVG_ERROR_RATE || 0);
    const normalizedErrorRate = normalizeErrorRate(errorRateRaw) ?? 0;
    const errorRatePct = normalizedErrorRate * 100;
    const qualityScore = Math.max(0, (1 - normalizedErrorRate) * 5);
    const stabilityScore = Math.max(0, 100 - errorRatePct);
    const totalTasks = Number(row.TOTAL_TASKS || 0);
    const successTasks = Number(row.SUCCESS_TASKS || 0);
    const errorTasks = Number(row.ERROR_TASKS || 0);
    const taskSuccessRate = totalTasks > 0 ? (successTasks / totalTasks) * 100 : 0;
    const taskErrorRate = totalTasks > 0 ? (errorTasks / totalTasks) * 100 : 0;
    const avgLatencyTotal = avgLatency + avgQueueTime;
    const baselineRows = await query(
      'SELECT METRIC_KEY, VALUE, UNIT, DESCRIPTION FROM EAR.PORTAL_METRIC_INPUTS'
    );
    const baselineMap = new Map<string, { value: number; unit?: string; description?: string }>();
    (baselineRows.rows || baselineRows || []).forEach((item: any) => {
      baselineMap.set(item.METRIC_KEY || item.metric_key, {
        value: Number(item.VALUE || item.value),
        unit: item.UNIT || item.unit,
        description: item.DESCRIPTION || item.description
      });
    });
    DEFAULT_BASELINES.forEach((item) => {
      if (!baselineMap.has(item.metric_key)) {
        baselineMap.set(item.metric_key, { value: item.value, unit: item.unit, description: item.description });
      }
    });

    let baselineMinutes = baselineMap.get('baseline_minutes_per_request')?.value ?? 12;
    let costPerHour = baselineMap.get('cost_per_hour')?.value ?? 45000;
    const slaLatencyMs = baselineMap.get('sla_latency_ms')?.value ?? DEFAULT_BASELINES[2].value;
    const investmentCostInput = baselineMap.get('investment_cost')?.value ?? 0;
    const totalRoles = baselineMap.get('total_roles')?.value ?? 0;
    const rolesRedefined = baselineMap.get('roles_redefined')?.value ?? 0;
    const customerNpsDelta = baselineMap.get('customer_nps_delta')?.value ?? 0;
    const errorReductionPct = baselineMap.get('error_reduction_pct')?.value ?? 0;
    const decisionSpeedImprovementPct = baselineMap.get('decision_speed_improvement_pct')?.value ?? 0;
    const slaCompliance = avgLatencyTotal <= slaLatencyMs
      ? 100
      : Math.max(0, 100 - ((avgLatencyTotal - slaLatencyMs) / slaLatencyMs) * 100);
    const totalUsers = Number(row.TOTAL_USERS || 0);
    const mappedUsers = Number(row.MAPPED_USERS || 0);
    const userCoverage = totalUsers > 0 ? (mappedUsers / totalUsers) * 100 : 0;
    const prevTotal = Number(row.PREV_TOTAL_REQUESTS || 0);
    const growthRate = prevTotal > 0 ? ((Number(row.TOTAL_REQUESTS || 0) - prevTotal) / prevTotal) * 100 : 0;
    const avgResponseMinutes = (avgLatency + avgQueueTime) / 1000 / 60;
    const completedRequests = Number(row.COMPLETED_REQUESTS || 0);
    let baselineCostOverride: number | null = null;

    if (businessType) {
      const taskBaseline = await query(
        'SELECT AVG(BEFORE_TIME_MIN) AS BEFORE_TIME_MIN, AVG(BEFORE_COST) AS BEFORE_COST FROM EAR.BUSINESS_TASK_BASELINE WHERE DOMAIN = ?',
        [businessType]
      );
      const taskRow = taskBaseline.rows?.[0] || taskBaseline[0] || {};
      if (taskRow.BEFORE_TIME_MIN) {
        baselineMinutes = Number(taskRow.BEFORE_TIME_MIN);
      }
      if (taskRow.BEFORE_COST) {
        baselineCostOverride = Number(taskRow.BEFORE_COST) * completedRequests;
      }
    }

    const laborCost = await query(
      'SELECT HOURLY_COST FROM EAR.LABOR_COST WHERE (BUSINESS_TYPE = ? OR BUSINESS_TYPE IS NULL) ORDER BY BUSINESS_TYPE DESC LIMIT 1',
      [businessType || null]
    );
    const laborRow = laborCost.rows?.[0] || laborCost[0] || {};
    if (laborRow.HOURLY_COST) {
      costPerHour = Number(laborRow.HOURLY_COST);
    }

    const timeSavingsMinutes = Math.max(0, (baselineMinutes - avgResponseMinutes) * completedRequests);
    const costSavings = (timeSavingsMinutes / 60) * costPerHour;
    const baselineCost = baselineCostOverride ?? (baselineMinutes / 60) * completedRequests * costPerHour;
    const normalizedInvestmentCost = investmentCostInput > 0 ? investmentCostInput : baselineCost;
    const roiRatio = normalizedInvestmentCost > 0 ? (costSavings / normalizedInvestmentCost) * 100 : 0;

    const assistedDecisions = Number(row.AI_ASSISTED_DECISIONS || 0);
    const validatedDecisions = Number(row.AI_ASSISTED_DECISIONS_VALIDATED || 0);
    const aiRecommendations = Number(row.AI_RECOMMENDATIONS || 0);
    const overriddenDecisions = Number(row.DECISIONS_OVERRIDDEN || 0);
    const avgCognitiveLoadBefore = Number(row.AVG_COGNITIVE_LOAD_BEFORE || 0);
    const avgCognitiveLoadAfter = Number(row.AVG_COGNITIVE_LOAD_AFTER || 0);
    const avgHandoffTime = Number(row.AVG_HANDOFF_TIME_SECONDS || 0);
    const avgTeamSatisfaction = Number(row.AVG_TEAM_SATISFACTION_SCORE || 0);
    const innovationCount = Number(row.INNOVATION_COUNT || 0);

    const decisionAccuracyFallback = assistedDecisions > 0 ? (validatedDecisions / assistedDecisions) * 100 : 0;
    const overrideRateFallback = aiRecommendations > 0 ? (overriddenDecisions / aiRecommendations) * 100 : 0;
    const cognitiveLoadReductionFallback = avgCognitiveLoadBefore > 0
      ? ((avgCognitiveLoadBefore - avgCognitiveLoadAfter) / avgCognitiveLoadBefore) * 100
      : 0;

    const collaborationDecisionAccuracy = row.DECISION_ACCURACY_PCT !== null && row.DECISION_ACCURACY_PCT !== undefined
      ? Number(row.DECISION_ACCURACY_PCT)
      : null;
    const collaborationOverrideRate = row.OVERRIDE_RATE_PCT !== null && row.OVERRIDE_RATE_PCT !== undefined
      ? Number(row.OVERRIDE_RATE_PCT)
      : null;
    const collaborationCognitiveReduction = row.COGNITIVE_LOAD_REDUCTION_PCT !== null && row.COGNITIVE_LOAD_REDUCTION_PCT !== undefined
      ? Number(row.COGNITIVE_LOAD_REDUCTION_PCT)
      : null;
    const collaborationHandoff = row.COLLAB_HANDOFF_TIME_SECONDS !== null && row.COLLAB_HANDOFF_TIME_SECONDS !== undefined
      ? Number(row.COLLAB_HANDOFF_TIME_SECONDS)
      : null;
    const collaborationSatisfaction = row.COLLAB_TEAM_SATISFACTION_SCORE !== null && row.COLLAB_TEAM_SATISFACTION_SCORE !== undefined
      ? Number(row.COLLAB_TEAM_SATISFACTION_SCORE)
      : null;
    const collaborationInnovation = row.COLLAB_INNOVATION_COUNT !== null && row.COLLAB_INNOVATION_COUNT !== undefined
      ? Number(row.COLLAB_INNOVATION_COUNT)
      : null;

    const totalRisks = Number(row.TOTAL_RISKS || 0);
    const avgRiskScore = Number(row.AVG_RISK_SCORE || 0);
    const auditRequiredCount = Number(row.AUDIT_REQUIRED_COUNT || 0);
    const auditCompletedCount = Number(row.AUDIT_COMPLETED_COUNT || 0);
    const humanReviewedCount = Number(row.HUMAN_REVIEWED_COUNT || 0);

    const auditRequiredRate = totalRisks > 0 ? (auditRequiredCount / totalRisks) * 100 : 0;
    const auditCompletedRate = totalRisks > 0 ? (auditCompletedCount / totalRisks) * 100 : 0;
    const humanReviewRate = totalRisks > 0 ? (humanReviewedCount / totalRisks) * 100 : 0;

    const roleRedesignRatio = totalRoles > 0 ? (rolesRedefined / totalRoles) * 100 : 0;

    try {
      await query(
        `MERGE INTO EAR.ROI_METRICS AS target
         USING (SELECT ADD_DAYS(CURRENT_DATE, -${days}) AS PERIOD_START, CURRENT_DATE AS PERIOD_END, ? AS BUSINESS_TYPE, ? AS AGENT_TYPE FROM DUMMY) AS source
         ON (target.PERIOD_START = source.PERIOD_START
             AND target.PERIOD_END = source.PERIOD_END
             AND ((target.BUSINESS_TYPE = source.BUSINESS_TYPE) OR (target.BUSINESS_TYPE IS NULL AND source.BUSINESS_TYPE IS NULL))
             AND ((target.AGENT_TYPE = source.AGENT_TYPE) OR (target.AGENT_TYPE IS NULL AND source.AGENT_TYPE IS NULL)))
         WHEN MATCHED THEN
           UPDATE SET SAVED_HOURS = ?, SAVED_COST = ?, ROI_RATIO_PCT = ?, UPDATED_AT = CURRENT_TIMESTAMP
         WHEN NOT MATCHED THEN
           INSERT (PERIOD_START, PERIOD_END, BUSINESS_TYPE, AGENT_TYPE, SAVED_HOURS, SAVED_COST, ROI_RATIO_PCT, CREATED_AT, UPDATED_AT)
           VALUES (source.PERIOD_START, source.PERIOD_END, source.BUSINESS_TYPE, source.AGENT_TYPE, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
        [
          businessType || null,
          agentType || null,
          Number((timeSavingsMinutes / 60).toFixed(2)),
          Number(costSavings.toFixed(2)),
          Number(roiRatio.toFixed(2)),
          Number((timeSavingsMinutes / 60).toFixed(2)),
          Number(costSavings.toFixed(2)),
          Number(roiRatio.toFixed(2))
        ]
      );
    } catch (error) {
      console.warn('HANA ROI metrics cache update failed:', error);
    }

    return res.json({
      period,
      total_requests: Number(row.TOTAL_REQUESTS || 0),
      prev_total_requests: prevTotal,
      growth_rate_pct: Number(growthRate.toFixed(2)),
      completed_requests: Number(row.COMPLETED_REQUESTS || 0),
      pending_requests: Number(row.PENDING_REQUESTS || 0),
      avg_latency_ms: avgLatency,
      error_rate_pct: errorRatePct,
      quality_score: Number(qualityScore.toFixed(2)),
      stability_score: Number(stabilityScore.toFixed(2)),
      avg_queue_time_ms: avgQueueTime,
      task_success_rate_pct: Number(taskSuccessRate.toFixed(2)),
      task_error_rate_pct: Number(taskErrorRate.toFixed(2)),
      sla_compliance_pct: Number(slaCompliance.toFixed(2)),
      user_coverage_pct: Number(userCoverage.toFixed(2)),
      requests_processed: Number(row.REQUESTS_PROCESSED || 0),
      breakdown: [],
      domain_stats: [],
      funnel_stats: [],
      baselines: Array.from(baselineMap.entries()).map(([key, value]) => ({
        metric_key: key,
        value: value.value,
        unit: value.unit || null,
        description: value.description || null
      })),
      collaboration: {
        decision_accuracy_pct: Number(
          ((collaborationDecisionAccuracy ?? decisionAccuracyFallback) as number).toFixed(2)
        ),
        override_rate_pct: Number(((collaborationOverrideRate ?? overrideRateFallback) as number).toFixed(2)),
        cognitive_load_reduction_pct: Number(
          ((collaborationCognitiveReduction ?? cognitiveLoadReductionFallback) as number).toFixed(2)
        ),
        handoff_time_seconds: Number(((collaborationHandoff ?? avgHandoffTime) as number).toFixed(2)),
        team_satisfaction_score: Number(((collaborationSatisfaction ?? avgTeamSatisfaction) as number).toFixed(2)),
        innovation_count: Number((collaborationInnovation ?? innovationCount).toFixed(0))
      },
      risk: {
        risk_exposure_score: Number(avgRiskScore.toFixed(2)),
        audit_required_rate_pct: Number(auditRequiredRate.toFixed(2)),
        audit_completed_rate_pct: Number(auditCompletedRate.toFixed(2)),
        human_review_rate_pct: Number(humanReviewRate.toFixed(2)),
        total_risk_items: totalRisks
      },
      value: {
        role_redesign_ratio_pct: Number(roleRedesignRatio.toFixed(2)),
        customer_nps_delta: Number(customerNpsDelta.toFixed(2)),
        error_reduction_pct: Number(errorReductionPct.toFixed(2)),
        decision_speed_improvement_pct: Number(decisionSpeedImprovementPct.toFixed(2))
      },
      savings: {
        baseline_minutes_per_request: baselineMinutes,
        avg_response_minutes: Number(avgResponseMinutes.toFixed(4)),
        time_savings_minutes: Number(timeSavingsMinutes.toFixed(2)),
        cost_savings: Number(costSavings.toFixed(2)),
        baseline_cost: Number(baselineCost.toFixed(2)),
        investment_cost: Number(normalizedInvestmentCost.toFixed(2)),
        roi_ratio_pct: Number(roiRatio.toFixed(2)),
        sla_latency_ms: slaLatencyMs
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

router.get('/task-baselines', async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'SELECT id, task_code, domain, before_time_min, before_cost, description FROM business_task_baseline ORDER BY task_code'
      );
      return res.json({ baselines: result.rows });
    }

    const hanaResult = await query(
      'SELECT ID, TASK_CODE, DOMAIN, BEFORE_TIME_MIN, BEFORE_COST, DESCRIPTION FROM EAR.BUSINESS_TASK_BASELINE ORDER BY TASK_CODE'
    );
    return res.json({ baselines: hanaResult.rows || hanaResult });
  } catch (error) {
    console.error('Task baseline fetch error:', error);
    res.status(500).json({ error: '업무 기준값을 불러오지 못했습니다.' });
  }
});

router.post('/task-baselines', async (req, res) => {
  try {
    const { task_code, domain, before_time_min, before_cost, description } = req.body || {};
    if (!task_code || before_time_min === undefined) {
      return res.status(400).json({ error: 'task_code와 before_time_min은 필수입니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `INSERT INTO business_task_baseline (task_code, domain, before_time_min, before_cost, description)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (task_code, domain)
         DO UPDATE SET before_time_min = EXCLUDED.before_time_min, before_cost = EXCLUDED.before_cost, description = EXCLUDED.description, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [task_code, domain || null, before_time_min, before_cost || null, description || null]
      );
      return res.json({ baseline: result.rows[0] });
    }

    await query(
      `MERGE INTO EAR.BUSINESS_TASK_BASELINE AS target
       USING (SELECT ? AS TASK_CODE, ? AS DOMAIN, ? AS BEFORE_TIME_MIN, ? AS BEFORE_COST, ? AS DESCRIPTION FROM DUMMY) AS source
       ON (target.TASK_CODE = source.TASK_CODE AND ((target.DOMAIN = source.DOMAIN) OR (target.DOMAIN IS NULL AND source.DOMAIN IS NULL)))
       WHEN MATCHED THEN
         UPDATE SET BEFORE_TIME_MIN = source.BEFORE_TIME_MIN, BEFORE_COST = source.BEFORE_COST, DESCRIPTION = source.DESCRIPTION, UPDATED_AT = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (TASK_CODE, DOMAIN, BEFORE_TIME_MIN, BEFORE_COST, DESCRIPTION, CREATED_AT, UPDATED_AT)
         VALUES (source.TASK_CODE, source.DOMAIN, source.BEFORE_TIME_MIN, source.BEFORE_COST, source.DESCRIPTION, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [task_code, domain || null, before_time_min, before_cost || null, description || null]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Task baseline update error:', error);
    res.status(500).json({ error: '업무 기준값을 저장하지 못했습니다.' });
  }
});

router.get('/labor-costs', async (req, res) => {
  try {
    if (DB_TYPE === 'postgres') {
      const result = await query(
        'SELECT id, role, hourly_cost, currency, business_type FROM labor_cost ORDER BY role'
      );
      return res.json({ costs: result.rows });
    }

    const hanaResult = await query(
      'SELECT ID, ROLE, HOURLY_COST, CURRENCY, BUSINESS_TYPE FROM EAR.LABOR_COST ORDER BY ROLE'
    );
    return res.json({ costs: hanaResult.rows || hanaResult });
  } catch (error) {
    console.error('Labor cost fetch error:', error);
    res.status(500).json({ error: '단가 정보를 불러오지 못했습니다.' });
  }
});

router.post('/labor-costs', async (req, res) => {
  try {
    const { role, hourly_cost, currency, business_type } = req.body || {};
    if (!role || hourly_cost === undefined) {
      return res.status(400).json({ error: 'role과 hourly_cost는 필수입니다.' });
    }

    if (DB_TYPE === 'postgres') {
      const result = await query(
        `INSERT INTO labor_cost (role, hourly_cost, currency, business_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (role, business_type)
         DO UPDATE SET hourly_cost = EXCLUDED.hourly_cost, currency = EXCLUDED.currency, updated_at = CURRENT_TIMESTAMP
         RETURNING *`,
        [role, hourly_cost, currency || null, business_type || null]
      );
      return res.json({ cost: result.rows[0] });
    }

    await query(
      `MERGE INTO EAR.LABOR_COST AS target
       USING (SELECT ? AS ROLE, ? AS HOURLY_COST, ? AS CURRENCY, ? AS BUSINESS_TYPE FROM DUMMY) AS source
       ON (target.ROLE = source.ROLE AND ((target.BUSINESS_TYPE = source.BUSINESS_TYPE) OR (target.BUSINESS_TYPE IS NULL AND source.BUSINESS_TYPE IS NULL)))
       WHEN MATCHED THEN
         UPDATE SET HOURLY_COST = source.HOURLY_COST, CURRENCY = source.CURRENCY, UPDATED_AT = CURRENT_TIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (ROLE, HOURLY_COST, CURRENCY, BUSINESS_TYPE, CREATED_AT, UPDATED_AT)
         VALUES (source.ROLE, source.HOURLY_COST, source.CURRENCY, source.BUSINESS_TYPE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
      [role, hourly_cost, currency || null, business_type || null]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error('Labor cost update error:', error);
    res.status(500).json({ error: '단가 정보를 저장하지 못했습니다.' });
  }
});

router.post('/adoption-events', async (req, res) => {
  try {
    const { user_id, stage, business_type, agent_type, metadata } = req.body || {};
    if (!user_id || !stage) {
      return res.status(400).json({ error: 'user_id와 stage는 필수입니다.' });
    }

    if (DB_TYPE === 'postgres') {
      await query(
        `INSERT INTO adoption_funnel_events (user_id, stage, business_type, agent_type, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [user_id, stage, business_type || null, agent_type || null, metadata ? JSON.stringify(metadata) : null]
      );
      return res.json({ success: true });
    }

    await query(
      `INSERT INTO EAR.ADOPTION_FUNNEL_EVENTS (USER_ID, STAGE, BUSINESS_TYPE, AGENT_TYPE, METADATA, EVENT_TIME)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [user_id, stage, business_type || null, agent_type || null, metadata ? JSON.stringify(metadata) : null]
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Adoption event insert error:', error);
    res.status(500).json({ error: 'Adoption 이벤트를 저장하지 못했습니다.' });
  }
});

export default router;
