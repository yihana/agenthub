import React, { useEffect, useState } from 'react';
import WidgetCard from './WidgetCard';
import { getPortalAuthHeaders } from '../../utils/api';

const PortalMetricInputs: React.FC = () => {
  const [baselineValues, setBaselineValues] = useState({
    baseline_minutes_per_request: '12',
    cost_per_hour: '45000',
    sla_latency_ms: '2000',
    investment_cost: '0',
    total_roles: '0',
    roles_redefined: '0',
    customer_nps_delta: '0',
    error_reduction_pct: '0',
    decision_speed_improvement_pct: '0'
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

  useEffect(() => {
    const fetchBaselines = async () => {
      try {
        const response = await fetch('/api/portal-dashboard/baselines', {
          headers: getPortalAuthHeaders()
        });
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
          sla_latency_ms: String(baselineMap.get('sla_latency_ms') ?? '2000'),
          investment_cost: String(baselineMap.get('investment_cost') ?? '0'),
          total_roles: String(baselineMap.get('total_roles') ?? '0'),
          roles_redefined: String(baselineMap.get('roles_redefined') ?? '0'),
          customer_nps_delta: String(baselineMap.get('customer_nps_delta') ?? '0'),
          error_reduction_pct: String(baselineMap.get('error_reduction_pct') ?? '0'),
          decision_speed_improvement_pct: String(baselineMap.get('decision_speed_improvement_pct') ?? '0')
        });
      } catch (error) {
        console.error('Baseline fetch error:', error);
      }
    };

    fetchBaselines();
  }, []);

  const handleBaselineChange = (field: string, value: string) => {
    setBaselineValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const saveBaseline = async (metricKey: string, value: string, unit: string, description: string) => {
    const response = await fetch('/api/portal-dashboard/baselines', {
      method: 'POST',
      headers: getPortalAuthHeaders(),
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
        ),
        saveBaseline(
          'investment_cost',
          baselineValues.investment_cost,
          'KRW',
          '에이전트 개발/운영 투자 비용'
        ),
        saveBaseline(
          'total_roles',
          baselineValues.total_roles,
          'count',
          '전체 역할 수'
        ),
        saveBaseline(
          'roles_redefined',
          baselineValues.roles_redefined,
          'count',
          'AI 협업으로 재설계된 역할 수'
        ),
        saveBaseline(
          'customer_nps_delta',
          baselineValues.customer_nps_delta,
          'point',
          'AI 도입 이후 고객 만족도/NPS 변화'
        ),
        saveBaseline(
          'error_reduction_pct',
          baselineValues.error_reduction_pct,
          'pct',
          '오류율 감소율'
        ),
        saveBaseline(
          'decision_speed_improvement_pct',
          baselineValues.decision_speed_improvement_pct,
          'pct',
          '의사결정 속도 개선율'
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
        headers: getPortalAuthHeaders(),
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
        headers: getPortalAuthHeaders(),
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
    <div className="ear-grid">
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
      <WidgetCard title="협업/가치 지표 입력" description="투자 비용, 협업 성과, 가치 지표를 등록합니다.">
        <form className="ear-form" onSubmit={handleBaselineSubmit}>
          <label>
            투자 비용 (KRW)
            <input
              className="ear-input"
              type="number"
              value={baselineValues.investment_cost}
              onChange={(event) => handleBaselineChange('investment_cost', event.target.value)}
            />
          </label>
          <label>
            전체 역할 수
            <input
              className="ear-input"
              type="number"
              value={baselineValues.total_roles}
              onChange={(event) => handleBaselineChange('total_roles', event.target.value)}
            />
          </label>
          <label>
            재설계 역할 수
            <input
              className="ear-input"
              type="number"
              value={baselineValues.roles_redefined}
              onChange={(event) => handleBaselineChange('roles_redefined', event.target.value)}
            />
          </label>
          <label>
            고객 만족도/NPS 변화 (point)
            <input
              className="ear-input"
              type="number"
              value={baselineValues.customer_nps_delta}
              onChange={(event) => handleBaselineChange('customer_nps_delta', event.target.value)}
            />
          </label>
          <label>
            오류율 감소율 (%)
            <input
              className="ear-input"
              type="number"
              value={baselineValues.error_reduction_pct}
              onChange={(event) => handleBaselineChange('error_reduction_pct', event.target.value)}
            />
          </label>
          <label>
            의사결정 속도 개선율 (%)
            <input
              className="ear-input"
              type="number"
              value={baselineValues.decision_speed_improvement_pct}
              onChange={(event) => handleBaselineChange('decision_speed_improvement_pct', event.target.value)}
            />
          </label>
          <button type="submit" className="ear-primary">협업 지표 저장</button>
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
    </div>
  );
};

export default PortalMetricInputs;
