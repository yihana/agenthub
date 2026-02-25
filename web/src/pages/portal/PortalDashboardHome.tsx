import React, { useEffect, useMemo, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import TagPill from '../../components/portal-dashboard/TagPill';

import { usePortalDashboardConfig } from '../../hooks/usePortalDashboardConfig';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import StatTile from '../../components/portal-dashboard/StatTile';
import ChartPlaceholder from '../../components/portal-dashboard/ChartPlaceholder';
import ProgressRow from '../../components/portal-dashboard/ProgressRow';

import DashboardWidgetConfig from '../../data/portalDashboardConfig';
import type PortalMetrics from '../../types/portal-dashboard';

/* =======================
 * Types
 * ======================= */
interface BaselineEntry {
  metric_key?: string;
  metricKey?: string;
  value?: number | string;
  unit?: string;
  description?: string;
}

interface TaskBaseline {
  task_code?: string;
  taskCode?: string;
  domain?: string;
  before_time_min?: number | string;
  beforeTimeMin?: number | string;
  before_cost?: number | string;
  beforeCost?: number | string;
  description?: string;
}

interface LaborCostEntry {
  role?: string;
  hourly_cost?: number | string;
  hourlyCost?: number | string;
  currency?: string;
}

type AgentUpdateTone = 'success' | 'warning' | 'info';

interface AgentUpdate {
  name: string;
  owner: string;
  status: string;
  tone: AgentUpdateTone;
}


/* =======================
 * Utils
 * ======================= */
const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTaskCode = (task: TaskBaseline) => task.task_code ?? task.taskCode ?? 'TASK';
const toTaskTime = (task: TaskBaseline) => toNumber(task.before_time_min ?? task.beforeTimeMin);
const toTaskCost = (task: TaskBaseline) => toNumber(task.before_cost ?? task.beforeCost);

/* =======================
 * Component
 * ======================= */
const PortalDashboardHome: React.FC = () => {
  const { widgets } = usePortalDashboardConfig();
  const enabledWidgets = widgets.filter((w) => w.enabled);

  const [metrics, setMetrics] = useState<PortalMetrics | null>(null);
  const [baselines, setBaselines] = useState<BaselineEntry[]>([]);
  const [taskBaselines, setTaskBaselines] = useState<TaskBaseline[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCostEntry[]>([]);
  const [loading, setLoading] = useState(false);

  /* =======================
   * Data Fetch
   * ======================= */
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      const [m, b, t, l] = await Promise.allSettled([
        fetch('/api/portal-dashboard/metrics?period=week'),
        fetch('/api/portal-dashboard/baselines'),
        fetch('/api/portal-dashboard/task-baselines'),
        fetch('/api/portal-dashboard/labor-costs')
      ]);


      if (m.status === 'fulfilled' && m.value.ok) {
        setMetrics(await m.value.json());
      }

      if (b.status === 'fulfilled' && b.value.ok) {
        const payload = await b.value.json();
        setBaselines(Array.isArray(payload.baselines) ? payload.baselines : []);
      }

      if (t.status === 'fulfilled' && t.value.ok) {
        const payload = await t.value.json();
        setTaskBaselines(Array.isArray(payload.baselines) ? payload.baselines : []);
      }

      if (l.status === 'fulfilled' && l.value.ok) {
        const payload = await l.value.json();
        setLaborCosts(Array.isArray(payload.costs) ? payload.costs : []);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  /* =======================
   * Derived Data
   * ======================= */
  const agentUpdates = useMemo<AgentUpdate[]>(() => {
    const topTasks = [...taskBaselines]
      .sort((a, b) => toTaskCost(b) - toTaskCost(a) || toTaskTime(b) - toTaskTime(a))
      .slice(0, 3);

    if (!topTasks.length) {
      return [
        { name: 'Finance Insight', owner: '재무팀', status: '운영', tone: 'success' },
        { name: 'Policy Guard', owner: '보안실', status: '점검', tone: 'warning' },
        { name: 'Support Copilot', owner: '고객지원', status: '승인 대기', tone: 'info' }
      ];
    }

    return topTasks.map((task) => {
      const minutes = toTaskTime(task);
      const status = minutes >= 90 ? '집중 관리' : minutes >= 45 ? '최적화 중' : '안정';
      const tone: AgentUpdateTone = minutes >= 90 ? 'warning' : minutes >= 45 ? 'info' : 'success';

      return {
        name: toTaskCode(task),
        owner: task.domain || '공통 도메인',
        status,
        tone
      };
    });
  }, [taskBaselines]);

  const alerts = useMemo(() => {
    const result: Array<{ title: string; detail: string }> = [];

    if (metrics) {
      if (metrics.error_rate_pct >= 3) {
        result.push({
          title: '오류율 경고',
          detail: `오류율 ${metrics.error_rate_pct.toFixed(1)}%로 기준치를 초과했습니다.`
        });
      }

      if (metrics.pending_requests >= Math.max(20, Math.round(metrics.total_requests * 0.15))) {
        result.push({
          title: '대기열 증가',
          detail: `현재 대기 ${metrics.pending_requests.toLocaleString()}건`
        });
      }
    }

    if (!taskBaselines.length) {
      result.push({ title: 'Task 기준값 없음', detail: 'baseline 데이터가 없습니다.' });
    }

    if (!laborCosts.length) {
      result.push({ title: '인건비 기준값 없음', detail: 'labor-cost 데이터가 없습니다.' });
    }

    return result.slice(0, 3);
  }, [metrics, taskBaselines.length, laborCosts.length]);

  const heroStats = useMemo(() => {
    if (!metrics) {
      return [
        { label: '주간 요청', value: '12.4K', delta: '+9%' },
        { label: '자동화 성공률', value: '98.4%', delta: '+0.4%' },
        { label: '평균 응답', value: '1.3s', delta: '-0.4s' },
        { label: 'ROI', value: '18.0%', delta: '+2.1%' }
      ];
    }

    return [
      { label: '주간 요청', value: metrics.total_requests.toLocaleString(), delta: `${metrics.growth_rate_pct.toFixed(1)}%` },
      { label: '자동화 성공률', value: `${metrics.task_success_rate_pct.toFixed(1)}%`, delta: `${metrics.sla_compliance_pct.toFixed(1)}% SLA` },
      { label: '평균 응답', value: `${((metrics.avg_latency_ms + metrics.avg_queue_time_ms) / 1000).toFixed(1)}s`, delta: `${metrics.pending_requests}건 대기` },
      { label: 'ROI', value: `${metrics.savings.roi_ratio_pct.toFixed(1)}%`, delta: `₩${Math.round(metrics.savings.cost_savings).toLocaleString()}` }
    ];
  }, [metrics]);

  /* =======================
   * Widget Renderer (SAFE)
   * ======================= */

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.type) {
      case 'status': {
        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <div className="ear-stat-grid">
              <StatTile label="완료 요청" value={`${metrics?.completed_requests ?? 18}`} delta={`/${metrics?.total_requests ?? 24}`} highlight />
              <StatTile label="성공률" value={`${(metrics?.task_success_rate_pct ?? 98.4).toFixed(1)}%`} />
              <StatTile label="SLA 준수율" value={`${(metrics?.sla_compliance_pct ?? 96.2).toFixed(1)}%`} />
              <StatTile label="사용자 커버리지" value={`${(metrics?.user_coverage_pct ?? 62).toFixed(1)}%`} delta={`${baselines.length} baseline`} />
            </div>
          </WidgetCard>
        );
      }

      case 'chart': {
        const auto = metrics ? Math.max(0, Math.min(100, metrics.task_success_rate_pct)) : 72;
        const review = metrics ? Math.max(0, Math.min(100, 100 - metrics.sla_compliance_pct)) : 18;
        const exception = metrics ? Math.max(0, Math.min(100, metrics.error_rate_pct * 4)) : 10;

        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <ChartPlaceholder label="처리량" summary={metrics ? `${metrics.growth_rate_pct.toFixed(1)}% 증가` : '주간 증가'} />
            <div className="ear-progress-group">
              <ProgressRow label="자동 처리" value={`${auto.toFixed(1)}%`} percent={auto} />
              <ProgressRow label="검토 필요" value={`${review.toFixed(1)}%`} percent={review} />
              <ProgressRow label="예외 처리" value={`${exception.toFixed(1)}%`} percent={exception} />
            </div>
          </WidgetCard>
        );
      }

      case 'list': {
        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <div className="ear-list">
              {agentUpdates.map((item) => (
                <div className="ear-list__row" key={item.name}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.owner}</span>
                  </div>
                  <TagPill label={item.status} tone={item.tone} />
                </div>
              ))}
            </div>
          </WidgetCard>
        );
      }

      case 'activity': {
        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <div className="ear-activity">
              {alerts.map((a) => (
                <div key={a.title}>
                  <strong>{a.title}</strong>
                  <span>{a.detail}</span>
                </div>
              ))} 
            </div>
          </WidgetCard>
        );
      }

      default:
        return null;
    }
  };


  /* =======================
   * Render
   * ======================= */
  return (
    <PortalDashboardLayout
      title="Agent Hub 관리 대시보드"
      subtitle="운영 현황 / 성과 지표 / 리스크"
    >
      <section className="ear-hero">
        <div className="ear-hero__stats ear-hero__stats--four">
          {heroStats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} delta={s.delta} highlight={s.label === 'ROI'} />
          ))}
        </div>
      </section>
      <div className="ear-grid">{enabledWidgets.map(renderWidget)}</div>

    </PortalDashboardLayout>
  );
};

export default PortalDashboardHome;
