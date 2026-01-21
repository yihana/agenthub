import React, { useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import TagPill from '../../components/portal-dashboard/TagPill';
import PortalMetricInputs from '../../components/portal-dashboard/PortalMetricInputs';
import { usePortalAuth } from '../../hooks/usePortalAuth';

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
  const { user } = usePortalAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [roadmapStages, setRoadmapStages] = useState(initialRoadmapStages);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [activeTab, setActiveTab] = useState<'roadmap' | 'metrics'>('roadmap');
  const [newMilestone, setNewMilestone] = useState({
    title: '',
    owner: '',
    due: '',
    status: '준비'
  });
  const permissions = user?.permissions ?? [];
  const isAdmin = user?.isAdmin ?? false;
  const canManageMetrics = isAdmin || permissions.includes('metrics:write');
  const canEditRoadmap = isAdmin || permissions.includes('roadmap:edit');

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
  return (
    <PortalDashboardLayout
      title="로드맵"
      subtitle="에이전트 운영 계획과 주요 마일스톤을 공유합니다."
      actions={
        <>
          {canEditRoadmap && activeTab === 'roadmap' && (
            <button className="ear-secondary" onClick={() => setIsEditing((prev) => !prev)}>
              {isEditing ? '편집 완료' : '로드맵 편집'}
            </button>
          )}
          <button className="ear-secondary">로드맵 내보내기</button>
        </>
      }
    >
      <div className="ear-tabs">
        <div className="ear-tab-list">
          <button
            type="button"
            className={`ear-tab${activeTab === 'roadmap' ? ' ear-tab--active' : ''}`}
            onClick={() => setActiveTab('roadmap')}
          >
            로드맵
          </button>
          {canManageMetrics && (
            <button
              type="button"
              className={`ear-tab${activeTab === 'metrics' ? ' ear-tab--active' : ''}`}
              onClick={() => setActiveTab('metrics')}
            >
              지표 입력
            </button>
          )}
        </div>
      </div>
      {activeTab === 'metrics' && canManageMetrics ? (
        <PortalMetricInputs />
      ) : (
        <div className="ear-grid">
          <WidgetCard title="분기별 로드맵" description="전사 계획과 연계된 주요 과제">
            <div className="ear-roadmap">
              {roadmapStages.map((stage, index) => (
                <div key={stage.quarter} className="ear-roadmap__stage">
                  <div>
                    <span className="ear-muted">{stage.quarter}</span>
                    {isEditing ? (
                      <input
                        className="ear-input"
                        value={stage.title}
                        onChange={(event) => handleStageChange(index, 'title', event.target.value)}
                      />
                    ) : (
                      <h3>{stage.title}</h3>
                    )}
                  </div>
                  {isEditing ? (
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
                  {isEditing ? (
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
                    {isEditing ? (
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
                  {isEditing ? (
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
              <button className="ear-primary ear-full">마일스톤 추가</button>
            )}
          </WidgetCard>
        </div>
      )}
    </PortalDashboardLayout>
  );
};

export default PortalRoadmapPage;
