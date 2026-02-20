import React, { useEffect, useMemo, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import TagPill from '../../components/portal-dashboard/TagPill';
import { roleLabels, usePortalRole } from '../../hooks/usePortalRole';

const DOMAIN_LABELS: Record<string, string> = {
  MM: 'Procure to Pay',
  PP: 'Plan to Produce',
  HR: 'Hire to Retire',
  SD: 'Order to Cash',
  FI: 'Record to Report',
  CO: 'Plan to Perform',
  BC: 'Basis to Operate'
};


const DOMAIN_LABELS: Record<string, string> = {
  MM: 'Procure to Pay',
  PP: 'Plan to Produce',
  HR: 'Hire to Retire',
  SD: 'Order to Cash',
  FI: 'Record to Report',
  CO: 'Plan to Perform',
  BC: 'Basis to Operate'
};


const initialRoadmapStages = [
  {
    quarter: '2024 Q3',
    title: '통합 운영 센터 구축',
    items: ['거버넌스 지표 통합', '에이전트 KPI 표준화', '운영 알림 센터 공개'],
    status: '진행 중'
  },
  {
    quarter: '2024 Q4',
    title: '정책 자동화 확대',
    items: ['리스크 분류 자동화', '업무별 템플릿 확장', '자동 테스트 시나리오 구축'],
    status: '예정'
  },
  {
    quarter: '2025 Q1',
    title: '효과 분석 고도화',
    items: ['ROI 추적 대시보드', '셀프 서비스 리포트', '실험 기반 개선 루프'],
    status: '계획'
  }
];

const initialMilestones = [
  {
    title: '데이터 소스 정비',
    owner: '플랫폼팀',
    due: '07/15',
    status: '완료'
  },
  {
    title: '프롬프트 품질 점검',
    owner: 'QA 셀',
    due: '07/22',
    status: '진행 중'
  },
  {
    title: '교육 세션 운영',
    owner: 'HR',
    due: '07/29',
    status: '준비'
  }
];

const PortalRoadmapPage: React.FC = () => {
  const { role } = usePortalRole();
  const canEditRoadmap = role === 'operator_admin';
  const canManageMetrics = role === 'operator_admin' || role === 'system_admin';
  const [activeTab, setActiveTab] = useState<'roadmap' | 'metrics' | 'process'>('roadmap');
  const [isEditing, setIsEditing] = useState(false);
  const [roadmapStages, setRoadmapStages] = useState(initialRoadmapStages);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    owner: '',
    due: '',
    status: '준비'
  });

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
  const [processStatus, setProcessStatus] = useState('');
  const [processRows, setProcessRows] = useState<any[]>([]);
  const [domainForm, setDomainForm] = useState({ domain_code: 'SAP', domain_name: 'SAP', description: '' });
  const [level1Form, setLevel1Form] = useState({ domain_code: 'SAP', level1_code: '', level1_name: '', display_order: '10' });
  const [level2Form, setLevel2Form] = useState({ level1_id: '', level2_code: '', level2_name: '', display_order: '10' });

  const domainCodeOptions = useMemo(() => {
    const codes = new Set<string>();
    processRows.forEach((row) => {
      const code = String(row.domain_code || row.domainCode || '').trim().toUpperCase();
      if (code) codes.add(code);
    });
    Object.keys(DOMAIN_LABELS).forEach((code) => codes.add(code));
    return Array.from(codes).sort();
  }, [processRows]);

  const handleStageChange = (index: number, field: 'title' | 'status' | 'items', value: string) => {
    setRoadmapStages((prev) =>
      prev.map((stage, stageIndex) => {
        if (stageIndex !== index) {
          return stage;
        }
        if (field === 'items') {
          const items = value.split('\n').map((item) => item.trim()).filter(Boolean);
          return { ...stage, items };
        }
        return { ...stage, [field]: value };
      })
    );
  };

  const handleMilestoneChange = (index: number, field: 'title' | 'owner' | 'due' | 'status', value: string) => {
    setMilestones((prev) =>
      prev.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, [field]: value } : milestone
      )
    );
  };

  const handleAddMilestone = (event: React.FormEvent) => {
    event.preventDefault();
    if (!newMilestone.title.trim()) {
      return;
    }
    setMilestones((prev) => [
      {
        title: newMilestone.title.trim(),
        owner: newMilestone.owner.trim() || '미지정',
        due: newMilestone.due.trim() || 'TBD',
        status: newMilestone.status
      },
      ...prev
    ]);
    setNewMilestone({ title: '', owner: '', due: '', status: '준비' });
  };

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

  const fetchProcesses = async () => {
    try {
      const response = await fetch('/api/portal-dashboard/processes');
      if (!response.ok) throw new Error('Failed to load processes');
      const data = await response.json();
      setProcessRows(data.rows || []);
    } catch (error) {
      console.error('Process fetch error:', error);
    }
  };

  useEffect(() => {
    fetchProcesses();
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metric_key: metricKey, value: Number(value), unit, description })
    });

    if (!response.ok) {
      throw new Error('Failed to save baseline');
    }
  };

  const handleBaselineSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageMetrics) {
      return;
    }
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
    if (!canManageMetrics) {
      return;
    }
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
    if (!canManageMetrics) {
      return;
    }
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


  const handleAddDomain = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditRoadmap) return;
    setProcessStatus('저장 중...');
    try {
      const response = await fetch('/api/portal-dashboard/processes/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(domainForm)
      });
      if (!response.ok) throw new Error('save failed');
      setProcessStatus('저장 완료');
      await fetchProcesses();
    } catch (error) {
      console.error(error);
      setProcessStatus('저장 실패');
    }
  };

  const handleAddLevel1 = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditRoadmap) return;
    setProcessStatus('저장 중...');
    try {
      const response = await fetch('/api/portal-dashboard/processes/level1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain_code: level1Form.domain_code.trim().toUpperCase(),
          level1_code: level1Form.level1_code.trim().toUpperCase(),
          level1_name: level1Form.level1_name,
          display_order: Number(level1Form.display_order || 0)
        })
      });
      if (!response.ok) throw new Error('save failed');
      setLevel1Form({ domain_code: 'SAP', level1_code: '', level1_name: '', display_order: '10' });
      setProcessStatus('저장 완료');
      await fetchProcesses();
    } catch (error) {
      console.error(error);
      setProcessStatus('저장 실패');
    }
  };

  const handleAddLevel2 = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canEditRoadmap) return;
    setProcessStatus('저장 중...');
    try {
      const response = await fetch('/api/portal-dashboard/processes/level2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          level1_id: Number(level2Form.level1_id),
          level2_code: level2Form.level2_code.trim().toUpperCase(),
          level2_name: level2Form.level2_name,
          display_order: Number(level2Form.display_order || 0)
        })
      });
      if (!response.ok) throw new Error('save failed');
      setLevel2Form({ level1_id: '', level2_code: '', level2_name: '', display_order: '10' });
      setProcessStatus('저장 완료');
      await fetchProcesses();
    } catch (error) {
      console.error(error);
      setProcessStatus('저장 실패');
    }
  };

  const handleDeleteLevel1 = async (id: number) => {
    if (!canEditRoadmap) return;
    if (!window.confirm('Level1을 삭제할까요?')) return;
    await fetch(`/api/portal-dashboard/processes/level1/${id}`, { method: 'DELETE' });
    await fetchProcesses();
  };

  const handleDeleteLevel2 = async (id: number) => {
    if (!canEditRoadmap) return;
    if (!window.confirm('Level2를 삭제할까요?')) return;
    await fetch(`/api/portal-dashboard/processes/level2/${id}`, { method: 'DELETE' });
    await fetchProcesses();
  };

  const handleTabChange = (nextTab: 'roadmap' | 'metrics' | 'process') => {
    setActiveTab(nextTab);
    setIsEditing(false);
  };

  return (
    <PortalDashboardLayout
      title="로드맵"
      subtitle="에이전트 운영 계획과 주요 마일스톤을 공유합니다."
      actions={
        <>
          {activeTab === 'roadmap' && canEditRoadmap && (
            <button className="ear-secondary" onClick={() => setIsEditing((prev) => !prev)}>
              {isEditing ? '편집 완료' : '로드맵 편집'}
            </button>
          )}
          <button className="ear-secondary">로드맵 내보내기</button>
        </>
      }
    >
      <div className="ear-tabs">
        <button
          type="button"
          className={activeTab === 'roadmap' ? 'ear-tab ear-tab--active' : 'ear-tab'}
          onClick={() => handleTabChange('roadmap')}
        >
          로드맵
        </button>
        <button
          type="button"
          className={activeTab === 'metrics' ? 'ear-tab ear-tab--active' : 'ear-tab'}
          onClick={() => handleTabChange('metrics')}
        >
          지표 관리
        </button>
        <button
          type="button"
          className={activeTab === 'process' ? 'ear-tab ear-tab--active' : 'ear-tab'}
          onClick={() => handleTabChange('process')}
        >
          프로세스 관리
        </button>
      </div>
      <div className="ear-grid">
        {activeTab === 'roadmap' ? (
          <>
            {!canEditRoadmap && (
              <WidgetCard
                title="로드맵 권한"
                description={`현재 권한(${roleLabels[role]})은 로드맵을 조회만 할 수 있습니다.`}
              >
                <p className="ear-muted">
                  운영 관리자만 로드맵 수정 및 마일스톤 추가를 수행할 수 있습니다.
                </p>
              </WidgetCard>
            )}
            <WidgetCard title="분기별 로드맵" description="전사 계획과 연계된 주요 과제">
              <div className="ear-roadmap">
                {roadmapStages.map((stage, index) => (
                  <div key={stage.quarter} className="ear-roadmap__stage">
                    <div>
                      <span className="ear-muted">{stage.quarter}</span>
                      {isEditing && canEditRoadmap ? (
                        <input
                          className="ear-input"
                          value={stage.title}
                          onChange={(event) => handleStageChange(index, 'title', event.target.value)}
                        />
                      ) : (
                        <h3>{stage.title}</h3>
                      )}
                    </div>
                    {isEditing && canEditRoadmap ? (
                      <select
                        className="ear-input"
                        value={stage.status}
                        onChange={(event) => handleStageChange(index, 'status', event.target.value)}
                      >
                        <option value="진행 중">진행 중</option>
                        <option value="예정">예정</option>
                        <option value="계획">계획</option>
                      </select>
                    ) : (
                      <TagPill
                        label={stage.status}
                        tone={stage.status === '진행 중' ? 'info' : 'neutral'}
                      />
                    )}
                    {isEditing && canEditRoadmap ? (
                      <textarea
                        className="ear-input ear-textarea"
                        value={stage.items.join('\n')}
                        onChange={(event) => handleStageChange(index, 'items', event.target.value)}
                        rows={4}
                      />
                    ) : (
                      <ul>
                        {stage.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </WidgetCard>
            <WidgetCard title="주요 마일스톤" description="이번 달 핵심 작업과 담당 조직">
              <div className="ear-list">
                {milestones.map((milestone, index) => (
                  <div key={milestone.title} className="ear-list__row">
                    <div>
                      {isEditing && canEditRoadmap ? (
                        <>
                          <input
                            className="ear-input"
                            value={milestone.title}
                            onChange={(event) => handleMilestoneChange(index, 'title', event.target.value)}
                          />
                          <div className="ear-input-group">
                            <input
                              className="ear-input"
                              value={milestone.owner}
                              onChange={(event) => handleMilestoneChange(index, 'owner', event.target.value)}
                              placeholder="담당 조직"
                            />
                            <input
                              className="ear-input"
                              value={milestone.due}
                              onChange={(event) => handleMilestoneChange(index, 'due', event.target.value)}
                              placeholder="기한"
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <strong>{milestone.title}</strong>
                          <span>{milestone.owner} · {milestone.due}</span>
                        </>
                      )}
                    </div>
                    {isEditing && canEditRoadmap ? (
                      <select
                        className="ear-input"
                        value={milestone.status}
                        onChange={(event) => handleMilestoneChange(index, 'status', event.target.value)}
                      >
                        <option value="완료">완료</option>
                        <option value="진행 중">진행 중</option>
                        <option value="준비">준비</option>
                      </select>
                    ) : (
                      <TagPill
                        label={milestone.status}
                        tone={milestone.status === '완료' ? 'success' : 'warning'}
                      />
                    )}
                  </div>
                ))}
              </div>
              {canEditRoadmap ? (
                <form className="ear-form" onSubmit={handleAddMilestone}>
                  <h3>마일스톤 추가</h3>
                  <label>
                    제목
                    <input
                      className="ear-input"
                      value={newMilestone.title}
                      onChange={(event) => setNewMilestone((prev) => ({ ...prev, title: event.target.value }))}
                    />
                  </label>
                  <label>
                    담당 조직
                    <input
                      className="ear-input"
                      value={newMilestone.owner}
                      onChange={(event) => setNewMilestone((prev) => ({ ...prev, owner: event.target.value }))}
                    />
                  </label>
                  <label>
                    기한
                    <input
                      className="ear-input"
                      value={newMilestone.due}
                      onChange={(event) => setNewMilestone((prev) => ({ ...prev, due: event.target.value }))}
                    />
                  </label>
                  <label>
                    상태
                    <select
                      className="ear-input"
                      value={newMilestone.status}
                      onChange={(event) => setNewMilestone((prev) => ({ ...prev, status: event.target.value }))}
                    >
                      <option value="준비">준비</option>
                      <option value="진행 중">진행 중</option>
                      <option value="완료">완료</option>
                    </select>
                  </label>
                  <button type="submit" className="ear-primary ear-full">추가</button>
                </form>
              ) : (
                <button className="ear-primary ear-full" disabled>마일스톤 추가</button>
              )}
            </WidgetCard>
          </>
        ) : activeTab === 'process' ? (
          <>
            {!canEditRoadmap && (
              <WidgetCard title="프로세스 권한" description={`현재 권한(${roleLabels[role]})은 프로세스를 조회만 할 수 있습니다.`}>
                <p className="ear-muted">운영 관리자만 프로세스를 수정/추가/삭제할 수 있습니다.</p>
              </WidgetCard>
            )}
            <WidgetCard title="프로세스 테이블" description="도메인 > Level1 > Level2 등록 정보">
              <table className="ear-table ear-table--compact">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Level1</th>
                    <th>Level2</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {processRows.map((row, index) => (
                    <tr key={`${row.level2_id || row.level2Id || 'none'}-${index}`}>
                      <td>{row.domain_name || row.domainName}</td>
                      <td>{row.level1_code || row.level1Code} · {row.level1_name || row.level1Name}</td>
                      <td>{row.level2_code || row.level2Code ? `${row.level2_code || row.level2Code} · ${row.level2_name || row.level2Name}` : '-'}</td>
                      <td>
                        {(row.level2_id || row.level2Id) ? (
                          <button className="ear-ghost" disabled={!canEditRoadmap} onClick={() => handleDeleteLevel2(Number(row.level2_id || row.level2Id))}>Level2 삭제</button>
                        ) : (row.level1_id || row.level1Id) ? (
                          <button className="ear-ghost" disabled={!canEditRoadmap} onClick={() => handleDeleteLevel1(Number(row.level1_id || row.level1Id))}>Level1 삭제</button>
                        ) : (
                          <button className="ear-ghost" disabled={!canEditRoadmap} onClick={async () => { if (!window.confirm('Domain을 삭제할까요?')) return; await fetch(`/api/portal-dashboard/processes/domain/${row.domain_id || row.domainId}`, { method: 'DELETE' }); await fetchProcesses(); }}>Domain 삭제</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </WidgetCard>
            <WidgetCard title="Domain 추가/수정" description="회사별/영역별 도메인 관리 (예: SAP, BTP)">
              <form className="ear-form" onSubmit={handleAddDomain}>
                <label>Domain Code<input className="ear-input" value={domainForm.domain_code} onChange={(e)=>setDomainForm((p)=>({...p, domain_code:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <label>Domain Name<input className="ear-input" value={domainForm.domain_name} onChange={(e)=>setDomainForm((p)=>({...p, domain_name:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <label>설명<input className="ear-input" value={domainForm.description} onChange={(e)=>setDomainForm((p)=>({...p, description:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <button type="submit" className="ear-primary" disabled={!canEditRoadmap}>Domain 저장</button>
              </form>
            </WidgetCard>
            <WidgetCard title="Level1 추가/수정" description="모듈 탭에 표시되는 Level1 관리">
              <form className="ear-form" onSubmit={handleAddLevel1}>
                <label>
                  Domain Code
                  <select
                    className="ear-input"
                    value={level1Form.domain_code}
                    onChange={(e)=>setLevel1Form((p)=>({...p, domain_code:e.target.value}))}
                    disabled={!canEditRoadmap}
                  >
                    {domainCodeOptions.map((code) => (
                      <option key={code} value={code}>{DOMAIN_LABELS[code] ? `${code} (${DOMAIN_LABELS[code]})` : code}</option>
                    ))}
                  </select>
                </label>
                <label>Level1 Code<input className="ear-input" value={level1Form.level1_code} onChange={(e)=>setLevel1Form((p)=>({...p, level1_code:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <label>Level1 Name<input className="ear-input" value={level1Form.level1_name} onChange={(e)=>setLevel1Form((p)=>({...p, level1_name:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <label>정렬순서<input className="ear-input" type="number" value={level1Form.display_order} onChange={(e)=>setLevel1Form((p)=>({...p, display_order:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <button type="submit" className="ear-primary" disabled={!canEditRoadmap}>Level1 저장</button>
              </form>
            </WidgetCard>
            <WidgetCard title="Level2 추가/수정" description="프로세스 카드(Level2) 관리">
              <form className="ear-form" onSubmit={handleAddLevel2}>
                <label>
                  Level1
                  <select
                    className="ear-input"
                    value={level2Form.level1_id}
                    onChange={(e)=>setLevel2Form((p)=>({...p, level1_id:e.target.value}))}
                    disabled={!canEditRoadmap}
                  >
                    {level1Options.map((option) => (
                      <option key={option.id} value={option.id}>{option.code} · {option.name} (ID:{option.id})</option>
                    ))}
                  </select>
                </label>
                <label>Level2 Code<input className="ear-input" value={level2Form.level2_code} onChange={(e)=>setLevel2Form((p)=>({...p, level2_code:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <label>Level2 Name<input className="ear-input" value={level2Form.level2_name} onChange={(e)=>setLevel2Form((p)=>({...p, level2_name:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <label>정렬순서<input className="ear-input" type="number" value={level2Form.display_order} onChange={(e)=>setLevel2Form((p)=>({...p, display_order:e.target.value}))} disabled={!canEditRoadmap} /></label>
                <button type="submit" className="ear-primary" disabled={!canEditRoadmap}>Level2 저장</button>
                {processStatus && <span className="ear-muted">{processStatus}</span>}
              </form>
            </WidgetCard>
          </>
        ) : (
          <>
            {!canManageMetrics && (
              <WidgetCard
                title="지표 관리 권한"
                description={`현재 권한(${roleLabels[role]})은 지표를 조회만 할 수 있습니다.`}
              >
                <p className="ear-muted">
                  운영 관리자 또는 시스템 관리자만 지표 입력을 수정할 수 있습니다.
                </p>
              </WidgetCard>
            )}
            <WidgetCard title="Baseline/단가 입력" description="회사 내부 기준값을 입력하면 지표 계산에 반영됩니다.">
              <form className="ear-form" onSubmit={handleBaselineSubmit}>
                <label>
                  기준 처리 시간 (분/요청)
                  <input
                    className="ear-input"
                    type="number"
                    value={baselineValues.baseline_minutes_per_request}
                    onChange={(event) => handleBaselineChange('baseline_minutes_per_request', event.target.value)}
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  시간당 인건비 단가 (KRW)
                  <input
                    className="ear-input"
                    type="number"
                    value={baselineValues.cost_per_hour}
                    onChange={(event) => handleBaselineChange('cost_per_hour', event.target.value)}
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  SLA 기준 응답 시간 (ms)
                  <input
                    className="ear-input"
                    type="number"
                    value={baselineValues.sla_latency_ms}
                    onChange={(event) => handleBaselineChange('sla_latency_ms', event.target.value)}
                    disabled={!canManageMetrics}
                  />
                </label>
                <button type="submit" className="ear-primary" disabled={!canManageMetrics}>Baseline 저장</button>
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
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  도메인
                  <input
                    className="ear-input"
                    value={taskBaselineValues.domain}
                    onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, domain: event.target.value }))}
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  기준 처리시간 (분)
                  <input
                    className="ear-input"
                    type="number"
                    value={taskBaselineValues.before_time_min}
                    onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, before_time_min: event.target.value }))}
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  기준 비용 (KRW)
                  <input
                    className="ear-input"
                    type="number"
                    value={taskBaselineValues.before_cost}
                    onChange={(event) => setTaskBaselineValues((prev) => ({ ...prev, before_cost: event.target.value }))}
                    disabled={!canManageMetrics}
                  />
                </label>
                <button type="submit" className="ear-primary" disabled={!canManageMetrics}>업무 기준 저장</button>
                {catalogStatus && <span className="ear-muted">{catalogStatus}</span>}
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
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  시간당 단가 (KRW)
                  <input
                    className="ear-input"
                    type="number"
                    value={laborCostValues.hourly_cost}
                    onChange={(event) => setLaborCostValues((prev) => ({ ...prev, hourly_cost: event.target.value }))}
                    disabled={!canManageMetrics}
                  />
                </label>
                <label>
                  도메인
                  <input
                    className="ear-input"
                    value={laborCostValues.business_type}
                    onChange={(event) => setLaborCostValues((prev) => ({ ...prev, business_type: event.target.value }))}
                    disabled={!canManageMetrics}
                  />
                </label>
                <button type="submit" className="ear-primary" disabled={!canManageMetrics}>단가 저장</button>
                {catalogStatus && <span className="ear-muted">{catalogStatus}</span>}
              </form>
            </WidgetCard>
          </>
        )}
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalRoadmapPage;
