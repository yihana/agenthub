import React from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import TagPill from '../../components/portal-dashboard/TagPill';


interface BaselineEntry {
  metric_key?: string;
  metricKey?: string;
  value?: number | string;
  unit?: string;
  description?: string;
}

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

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toTaskCode = (task: TaskBaseline) => task.task_code ?? task.taskCode ?? 'TASK';
const toTaskTime = (task: TaskBaseline) => toNumber(task.before_time_min ?? task.beforeTimeMin);
const toTaskCost = (task: TaskBaseline) => toNumber(task.before_cost ?? task.beforeCost);

const PortalDashboardHome: React.FC = () => {
  const { widgets } = usePortalDashboardConfig();
  const enabledWidgets = widgets.filter((widget) => widget.enabled);

  const [metrics, setMetrics] = useState<PortalMetrics | null>(null);
  const [baselines, setBaselines] = useState<BaselineEntry[]>([]);
  const [taskBaselines, setTaskBaselines] = useState<TaskBaseline[]>([]);
  const [laborCosts, setLaborCosts] = useState<LaborCostEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);

      const [metricsResult, baselineResult, taskBaselineResult, laborCostResult] = await Promise.allSettled([
        fetch('/api/portal-dashboard/metrics?period=week'),
        fetch('/api/portal-dashboard/baselines'),
        fetch('/api/portal-dashboard/task-baselines'),
        fetch('/api/portal-dashboard/labor-costs')
      ]);

      if (metricsResult.status === 'fulfilled' && metricsResult.value.ok) {
        setMetrics(await metricsResult.value.json());
      }

      if (baselineResult.status === 'fulfilled' && baselineResult.value.ok) {
        const payload = await baselineResult.value.json();
        setBaselines(Array.isArray(payload.baselines) ? payload.baselines : []);
      }


      if (taskBaselineResult.status === 'fulfilled' && taskBaselineResult.value.ok) {
        const payload = await taskBaselineResult.value.json();
        setTaskBaselines(Array.isArray(payload.baselines) ? payload.baselines : []);
      }

      if (laborCostResult.status === 'fulfilled' && laborCostResult.value.ok) {
        const payload = await laborCostResult.value.json();
        setLaborCosts(Array.isArray(payload.costs) ? payload.costs : []);
      }

      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const agentUpdates = useMemo(() => {
    const topTasks = [...taskBaselines]
      .sort((a, b) => toTaskCost(b) - toTaskCost(a) || toTaskTime(b) - toTaskTime(a))
      .slice(0, 3);

    if (!topTasks.length) {
      return [
        { name: 'Finance Insight', owner: '재무팀', status: '운영', tone: 'success' as const },
        { name: 'Policy Guard', owner: '보안실', status: '점검', tone: 'warning' as const },
        { name: 'Support Copilot', owner: '고객지원', status: '승인 대기', tone: 'info' as const }
      ];
    }

    return topTasks.map((task) => {
      const minutes = toTaskTime(task);
      const status = minutes >= 90 ? '집중 관리' : minutes >= 45 ? '최적화 중' : '안정';
      const tone = minutes >= 90 ? 'warning' : minutes >= 45 ? 'info' : 'success';

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
          detail: `현재 대기 ${metrics.pending_requests.toLocaleString()}건으로 모니터링이 필요합니다.`
        });
      }

      if (metrics.user_coverage_pct < 70) {
        result.push({
          title: '커버리지 확장 필요',
          detail: `사용자 커버리지 ${metrics.user_coverage_pct.toFixed(1)}%로 확장 여지가 있습니다.`
        });
      }
    }

    if (!taskBaselines.length) {
      result.push({ title: 'Task 기준값 없음', detail: 'task-baseline 데이터가 없어 일부 ROI 계산이 추정치로 표시됩니다.' });
    }

    if (!laborCosts.length) {
      result.push({ title: '인건비 기준값 없음', detail: 'labor-cost 데이터가 없어 비용 절감 추정이 제한됩니다.' });
    }

    return result.slice(0, 3);
  }, [laborCosts.length, metrics, taskBaselines.length]);

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
      { label: '주간 요청', value: `${metrics.total_requests.toLocaleString()}`, delta: `${metrics.growth_rate_pct.toFixed(1)}%` },
      { label: '자동화 성공률', value: `${metrics.task_success_rate_pct.toFixed(1)}%`, delta: `${metrics.sla_compliance_pct.toFixed(1)}% SLA` },
      { label: '평균 응답', value: `${((metrics.avg_latency_ms + metrics.avg_queue_time_ms) / 1000).toFixed(1)}s`, delta: `${metrics.pending_requests}건 대기` },
      { label: 'ROI', value: `${metrics.savings.roi_ratio_pct.toFixed(1)}%`, delta: `₩${Math.round(metrics.savings.cost_savings).toLocaleString()}` }
    ];
  }, [metrics]);

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.type) {
      case 'status': {
        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <div className="ear-stat-grid">
              <StatTile label="완료 요청" value={`${metrics?.completed_requests ?? 18}`} delta={`/${metrics?.total_requests ?? 24}`} highlight />
              <StatTile label="성공률" value={`${(metrics?.task_success_rate_pct ?? 98.4).toFixed(1)}%`} delta={`품질 ${(metrics?.quality_score ?? 4.8).toFixed(1)}/5`} />
              <StatTile label="SLA 준수율" value={`${(metrics?.sla_compliance_pct ?? 96.2).toFixed(1)}%`} delta={`안정성 ${(metrics?.stability_score ?? 98.7).toFixed(1)}%`} />
              <StatTile label="사용자 커버리지" value={`${(metrics?.user_coverage_pct ?? 62).toFixed(1)}%`} delta={`${baselines.length}개 baseline`} />
            </div>
          </WidgetCard>
        );
      }
      case 'chart': {
        const autoPercent = metrics ? Math.max(0, Math.min(100, metrics.task_success_rate_pct)) : 72;
        const reviewPercent = metrics ? Math.max(0, Math.min(100, 100 - metrics.sla_compliance_pct)) : 18;
        const exceptionPercent = metrics ? Math.max(0, Math.min(100, metrics.error_rate_pct * 4)) : 10;

        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
            actions={<span className="ear-pill ear-pill--neutral">실시간 집계</span>}
          >
            <ChartPlaceholder label="처리량" summary={metrics ? `전주 대비 ${metrics.growth_rate_pct.toFixed(1)}%` : '주간 12% 증가'} />
            <div className="ear-progress-group">
              <ProgressRow label="자동 처리" value={`${autoPercent.toFixed(1)}%`} percent={autoPercent} />
              <ProgressRow label="검토 필요" value={`${reviewPercent.toFixed(1)}%`} percent={reviewPercent} />
              <ProgressRow label="예외 처리" value={`${exceptionPercent.toFixed(1)}%`} percent={exceptionPercent} />
            </div>
          </WidgetCard>
        );
      }
      case 'list':
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
      case 'insight': {
        const topRole = [...laborCosts].sort((a, b) => toNumber(b.hourly_cost ?? b.hourlyCost) - toNumber(a.hourly_cost ?? a.hourlyCost))[0];
        const topRoleCost = topRole ? toNumber(topRole.hourly_cost ?? topRole.hourlyCost) : 0;

        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <div className="ear-insight">
              <div>
                <strong>예상 절감 시간</strong>
                <span>{metrics ? `${Math.round(metrics.savings.time_savings_minutes / 60)}h` : '312h'}</span>
              </div>
              <div>
                <strong>비용 절감 추정</strong>
                <span>{metrics ? `₩${Math.round(metrics.savings.cost_savings).toLocaleString()}` : '₩84M'}</span>
              </div>
              <div>
                <strong>최고 단가 Role</strong>
                <span>{topRole ? `${topRole.role} ${topRole.currency || 'KRW'} ${topRoleCost.toLocaleString()}/h` : '미등록'}</span>
              </div>
            </div>
          </WidgetCard>
        );
      }
      case 'timeline': {
        const timeline = [
          {
            time: 'Now',
            title: '주간 메트릭 동기화',
            detail: metrics ? `요청 ${metrics.total_requests.toLocaleString()}건 집계 완료` : '메트릭 집계 대기 중'
          },
          {
            time: 'T+1',
            title: 'Task Baseline 점검',
            detail: `${taskBaselines.length.toLocaleString()}개 Task baseline 반영`
          },
          {
            time: 'T+2',
            title: '인건비 단가 리프레시',
            detail: `${laborCosts.length.toLocaleString()}개 Role 단가 반영`
          }
        ];

        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <ul className="ear-timeline">
              {timeline.map((item) => (
                <li key={item.title}>
                  <span>{item.time}</span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </WidgetCard>
        );
      }
      case 'activity':
        return (
          <WidgetCard key={widget.id} title={widget.title} description={widget.description} size={widget.size}>
            <div className="ear-activity">
              {alerts.map((alert) => (
                <div key={alert.title}>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
              </div>
            </div>
          </WidgetCard>
        );
      default:
        return null;
    }
  };

  const headerActions = (
    <div className="ear-header__actions">
      <button className="ear-secondary">내보내기</button>
      <button className="ear-primary">리포트 생성</button>
    </div>
  );

  return (
    <PortalDashboardLayout
      title="Agent Portal 관리 대시보드"
      subtitle="운영 현황/성과 지표/리스크를 확인합니다."
      actions={headerActions}
    >
      <section className="ear-hero ear-hero--portal">
        <div>
          <span className="ear-pill ear-pill--info">이번 주 핵심 지표</span>
          <h2>운영 안정성 {metrics ? metrics.stability_score.toFixed(1) : '98.7'}% 유지</h2>
          <p>
            {loading
              ? '지표를 집계 중입니다.'
              : `Baselines ${baselines.length.toLocaleString()}건 · Task ${taskBaselines.length.toLocaleString()}건 · Labor ${laborCosts.length.toLocaleString()}건 반영`}
          </p>
        </div>
        <div className="ear-hero__stats ear-hero__stats--four">
          {heroStats.map((item) => (
            <StatTile
              key={item.label}
              label={item.label}
              value={item.value}
              delta={item.delta}
              highlight={item.label === 'ROI'}
            />
          ))}
        </div>
      </section>
      <div className="ear-grid">{enabledWidgets.map((widget) => renderWidget(widget))}</div>
    </PortalDashboardLayout>
  );
};

export default PortalDashboardHome;
