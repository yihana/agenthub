import React from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import TagPill from '../../components/portal-dashboard/TagPill';

const roadmapStages = [
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

const milestones = [
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
  return (
    <PortalDashboardLayout
      title="로드맵"
      subtitle="에이전트 운영 계획과 주요 마일스톤을 공유합니다."
      actions={<button className="ear-secondary">로드맵 내보내기</button>}
    >
      <div className="ear-grid">
        <WidgetCard title="분기별 로드맵" description="전사 계획과 연계된 주요 과제">
          <div className="ear-roadmap">
            {roadmapStages.map((stage) => (
              <div key={stage.quarter} className="ear-roadmap__stage">
                <div>
                  <span className="ear-muted">{stage.quarter}</span>
                  <h3>{stage.title}</h3>
                </div>
                <TagPill
                  label={stage.status}
                  tone={stage.status === '진행 중' ? 'info' : 'neutral'}
                />
                <ul>
                  {stage.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </WidgetCard>
        <WidgetCard title="주요 마일스톤" description="이번 달 핵심 작업과 담당 조직">
          <div className="ear-list">
            {milestones.map((milestone) => (
              <div key={milestone.title} className="ear-list__row">
                <div>
                  <strong>{milestone.title}</strong>
                  <span>{milestone.owner} · {milestone.due}</span>
                </div>
                <TagPill
                  label={milestone.status}
                  tone={milestone.status === '완료' ? 'success' : 'warning'}
                />
              </div>
            ))}
          </div>
          <button className="ear-primary ear-full">마일스톤 추가</button>
        </WidgetCard>
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalRoadmapPage;
