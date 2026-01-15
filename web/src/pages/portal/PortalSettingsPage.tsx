import React, { useEffect, useMemo, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import TagPill from '../../components/portal-dashboard/TagPill';
import {
  DashboardWidgetConfig,
  WidgetSize,
  WidgetType
} from '../../data/portalDashboardConfig';
import { usePortalDashboardConfig } from '../../hooks/usePortalDashboardConfig';

const sizeLabels: Record<WidgetSize, string> = {
  small: '작게',
  medium: '보통',
  large: '크게'
};

const typeLabels: Record<WidgetType, string> = {
  list: '리스트',
  chart: '차트',
  status: '상태',
  activity: '알림',
  insight: '인사이트',
  timeline: '타임라인'
};

const PortalSettingsPage: React.FC = () => {
  const { widgets, setWidgets, resetWidgets } = usePortalDashboardConfig();
  const [query, setQuery] = useState('');
  const [baselineValues, setBaselineValues] = useState({
    baseline_minutes_per_request: '12',
    cost_per_hour: '45000',
    sla_latency_ms: '2000'
  });
  const [baselineStatus, setBaselineStatus] = useState('');
  const [taskBaselineValues, setTaskBaselineValues] = useState({
    task_code: '',
    domain: '',
    before_time_min: '',
    before_cost: ''
  });
  const [laborCostValues, setLaborCostValues] = useState({
    role: '',
    hourly_cost: '',
    business_type: ''
  });
  const [catalogStatus, setCatalogStatus] = useState('');

  const filteredWidgets = useMemo(() => {
    return widgets.filter((widget) =>
      widget.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, widgets]);

  useEffect(() => {
    const fetchBaselines = async () => {
      try {
        const response = await fetch('/api/portal-dashboard/baselines');
        if (!response.ok) {
          throw new Error('Failed to load baselines');
        }
        const data = await response.json();
        const baselineMap = new Map(
          (data.baselines || []).map((item: any) => [item.metric_key, item.value])
        );
        setBaselineValues({
          baseline_minutes_per_request: String(baselineMap.get('baseline_minutes_per_request') ?? '12'),
          cost_per_hour: String(baselineMap.get('cost_per_hour') ?? '45000'),
          sla_latency_ms: String(baselineMap.get('sla_latency_ms') ?? '2000')
        });
      } catch (error) {
        console.error('Baseline fetch error:', error);
      }
    };

    fetchBaselines();
  }, []);

  const toggleWidget = (widget: DashboardWidgetConfig) => {
    const updated = widgets.map((item) =>
      item.id === widget.id ? { ...item, enabled: !item.enabled } : item
    );
    setWidgets(updated);
  };

  const updateSize = (widget: DashboardWidgetConfig, size: WidgetSize) => {
    const updated = widgets.map((item) =>
      item.id === widget.id ? { ...item, size } : item
    );
    setWidgets(updated);
  };

  const handleBaselineChange = (field: string, value: string) => {
    setBaselineValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const saveBaseline = async (metricKey: string, value: string, unit: string, description: string) => {
    const response = await fetch('/api/portal-dashboard/baselines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric_key: metricKey, value: Number(value), unit, description })
    });

    if (!response.ok) {
      throw new Error('Failed to save baseline');
    }
  };

  const handleBaselineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBaselineStatus('저장 중...');
    try {
      await Promise.all([
        saveBaseline(
          'baseline_minutes_per_request',
          baselineValues.baseline_minutes_per_request,
          'minute',
          '요청 1건당 기준 처리 시간 (분)'
        ),
        saveBaseline(
          'cost_per_hour',
          baselineValues.cost_per_hour,
          'KRW',
          '시간당 인건비 단가'
        ),
        saveBaseline(
          'sla_latency_ms',
          baselineValues.sla_latency_ms,
          'ms',
          'SLA 기준 응답 시간 (ms)'
        )
      ]);
      setBaselineStatus('저장 완료');
    } catch (error) {
      console.error('Baseline save error:', error);
      setBaselineStatus('저장 실패');
    }
  };

  const handleTaskBaselineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCatalogStatus('저장 중...');
    try {
      const response = await fetch('/api/portal-dashboard/task-baselines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_code: taskBaselineValues.task_code,
          domain: taskBaselineValues.domain || null,
          before_time_min: Number(taskBaselineValues.before_time_min),
          before_cost: taskBaselineValues.before_cost ? Number(taskBaselineValues.before_cost) : null
        })
      });
      if (!response.ok) {
        throw new Error('Failed to save task baseline');
      }
      setCatalogStatus('저장 완료');
      setTaskBaselineValues({ task_code: '', domain: '', before_time_min: '', before_cost: '' });
    } catch (error) {
      console.error('Task baseline save error:', error);
      setCatalogStatus('저장 실패');
    }
  };

  const handleLaborCostSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setCatalogStatus('저장 중...');
    try {
      const response = await fetch('/api/portal-dashboard/labor-costs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: laborCostValues.role,
          hourly_cost: Number(laborCostValues.hourly_cost),
          business_type: laborCostValues.business_type || null,
          currency: 'KRW'
        })
      });
      if (!response.ok) {
        throw new Error('Failed to save labor cost');
      }
      setCatalogStatus('저장 완료');
      setLaborCostValues({ role: '', hourly_cost: '', business_type: '' });
    } catch (error) {
      console.error('Labor cost save error:', error);
      setCatalogStatus('저장 실패');
    }
  };

  return (
    <PortalDashboardLayout
      title="화면 구성"
      subtitle="대시보드 위젯을 사용자화해서 저장합니다."
      actions={
        <>
          <button className="ear-secondary" onClick={resetWidgets}>기본값 복원</button>
          <button className="ear-primary">저장</button>
        </>
      }
    >
      <section className="ear-settings">
        <WidgetCard title="Baseline/단가 입력" description="회사 내부 기준값을 입력하면 지표 계산에 반영됩니다.">
          <form className="ear-form" onSubmit={handleBaselineSubmit}>
            <label>
              기준 처리 시간 (분/요청)
              <input
                className="ear-input"
                type="number"
                value={baselineValues.baseline_minutes_per_request}
                onChange={(event) => handleBaselineChange('baseline_minutes_per_request', event.target.value)}
              />
            </label>
            <label>
              시간당 인건비 단가 (KRW)
              <input
                className="ear-input"
                type="number"
                value={baselineValues.cost_per_hour}
                onChange={(event) => handleBaselineChange('cost_per_hour', event.target.value)}
              />
            </label>
            <label>
              SLA 기준 응답 시간 (ms)
              <input
                className="ear-input"
                type="number"
                value={baselineValues.sla_latency_ms}
                onChange={(event) => handleBaselineChange('sla_latency_ms', event.target.value)}
              />
            </label>
            <button type="submit" className="ear-primary">Baseline 저장</button>
            {baselineStatus && <span className="ear-muted">{baselineStatus}</span>}
          </form>
        </WidgetCard>
        <WidgetCard title="업무 Baseline Catalog" description="업무별 처리시간/비용 기준값을 입력합니다.">
          <form className="ear-form" onSubmit={handleTaskBaselineSubmit}>
            <label>
              업무 코드
              <input
                className="ear-input"
                value={taskBaselineValues.task_code}
                onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, task_code: event.target.value }))}
              />
            </label>
            <label>
              도메인
              <input
                className="ear-input"
                value={taskBaselineValues.domain}
                onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, domain: event.target.value }))}
              />
            </label>
            <label>
              기준 처리시간 (분)
              <input
                className="ear-input"
                type="number"
                value={taskBaselineValues.before_time_min}
                onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, before_time_min: event.target.value }))}
              />
            </label>
            <label>
              기준 비용 (KRW)
              <input
                className="ear-input"
                type="number"
                value={taskBaselineValues.before_cost}
                onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, before_cost: event.target.value }))}
              />
            </label>
            <button type="submit" className="ear-primary">업무 기준 저장</button>
          </form>
        </WidgetCard>
        <WidgetCard title="Labor Cost Catalog" description="직무별 시간당 단가를 입력합니다.">
          <form className="ear-form" onSubmit={handleLaborCostSubmit}>
            <label>
              직무/역할
              <input
                className="ear-input"
                value={laborCostValues.role}
                onChange={(event) => setLaborCostValues((prev) => ({ ...prev, role: event.target.value }))}
              />
            </label>
            <label>
              시간당 단가 (KRW)
              <input
                className="ear-input"
                type="number"
                value={laborCostValues.hourly_cost}
                onChange={(event) => setLaborCostValues((prev) => ({ ...prev, hourly_cost: event.target.value }))}
              />
            </label>
            <label>
              도메인
              <input
                className="ear-input"
                value={laborCostValues.business_type}
                onChange={(event) => setLaborCostValues((prev) => ({ ...prev, business_type: event.target.value }))}
              />
            </label>
            <button type="submit" className="ear-primary">단가 저장</button>
            {catalogStatus && <span className="ear-muted">{catalogStatus}</span>}
          </form>
        </WidgetCard>
        <WidgetCard title="위젯 탐색" description="표시 여부와 크기를 선택할 수 있습니다.">
          <div className="ear-settings__search">
            <input
              type="text"
              placeholder="위젯 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <TagPill label={`${widgets.filter((widget) => widget.enabled).length}개 활성`} tone="info" />
          </div>
          <div className="ear-settings__list">
            {filteredWidgets.map((widget) => (
              <div key={widget.id} className="ear-settings__item">
                <div>
                  <strong>{widget.title}</strong>
                  <p>{widget.description}</p>
                  <div className="ear-settings__meta">
                    <span>{typeLabels[widget.type]}</span>
                    <span>카테고리: {widget.category}</span>
                  </div>
                </div>
                <div className="ear-settings__controls">
                  <button
                    type="button"
                    className={widget.enabled ? 'ear-primary' : 'ear-secondary'}
                    onClick={() => toggleWidget(widget)}
                  >
                    {widget.enabled ? '표시 중' : '숨김'}
                  </button>
                  <div className="ear-settings__sizes">
                    {(Object.keys(sizeLabels) as WidgetSize[]).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={widget.size === size ? 'ear-pill ear-pill--info' : 'ear-pill'}
                        onClick={() => updateSize(widget, size)}
                      >
                        {sizeLabels[size]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WidgetCard>
        <WidgetCard title="레이아웃 미리보기" description="활성 위젯이 어떻게 배치되는지 확인합니다.">
          <div className="ear-preview">
            {widgets.filter((widget) => widget.enabled).map((widget) => (
              <div key={widget.id} className={`ear-preview__item ear-preview__item--${widget.size}`}>
                <span>{widget.title}</span>
                <small>{sizeLabels[widget.size]}</small>
              </div>
            ))}
          </div>
        </WidgetCard>
      </section>
    </PortalDashboardLayout>
  );
};

export default PortalSettingsPage;
