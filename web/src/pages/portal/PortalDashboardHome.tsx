import React from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import TagPill from '../../components/portal-dashboard/TagPill';

const stepTwoAgents = [
  { name: 'Routing Agent', status: '완료', tone: 'success' as const },
  { name: 'Finance KPI Agent', status: '대기', tone: 'neutral' as const },
  { name: 'Cost Analysis Agent', status: '대기', tone: 'neutral' as const },
  { name: 'Compute Agent', status: '대기', tone: 'neutral' as const }
];

const stepTwoStages = [
  { label: 'Request received', status: 'done' },
  { label: 'Intent classified: Profit Analysis', status: 'done' },
  { label: 'Tasks generated (Revenue / Cost / Profit)', status: 'pending' },
  { label: 'Agents dispatched', status: 'pending' }
];

const stepThreeProcessing = [
  { label: 'Routing Agent 실행 완료', status: 'done' },
  { label: 'Finance KPI Agent 완료', status: 'done' },
  { label: 'Cost Analysis Agent 완료', status: 'done' },
  { label: 'Compute Agent 완료', status: 'done' }
];

const stepThreeAgents = [
  { name: 'Routing Agent', status: '완료', tone: 'success' as const },
  { name: 'Finance KPI Agent', status: '완료', tone: 'success' as const },
  { name: 'Cost Analysis Agent', status: '완료', tone: 'success' as const },
  { name: 'Compute Agent', status: '완료', tone: 'success' as const }
];

const PortalDashboardHome: React.FC = () => {
  return (
    <PortalDashboardLayout
      title="Agent Portal 관리 대시보드"
      subtitle="사용자 요청부터 멀티 에이전트 처리 결과까지 흐름을 시각화합니다."
      actions={
        <button className="ear-primary">구글 리포트 작성</button>
      }
    >
      <section className="ear-section">
        <div className="ear-section__title">Step 2. 사용자 분석 요청</div>
        <div className="ear-section__subtitle">
          Step 2 ↔ 시퀀스 ①~④ (사용자 요청 &amp; 라우팅)
          <span>① 질문 입력 → ② Conversation Manager 요청 수신 → ③ Routing Agent 의도 분석 → ④ 작업 분해</span>
        </div>
        <div className="ear-split">
          <div className="ear-card ear-card--large ear-flow-card">
            <div className="ear-hero ear-hero--compact">
              <div>
                <span className="ear-pill ear-pill--info">사용자 입력 예시</span>
                <h2>2025년 11월 단위 원가, 매출, 이익 계산해줘</h2>
              </div>
              <div className="ear-hero__stats">
                <div className="ear-stat">
                  <span>평균 응답</span>
                  <strong>3.4s</strong>
                </div>
                <div className="ear-stat">
                  <span>처리량</span>
                  <strong>4,500</strong>
                </div>
                <div className="ear-stat">
                  <span>성공률</span>
                  <strong>6.0%</strong>
                </div>
              </div>
            </div>
            <div className="ear-system-panel">
              <h4>시스템 응답 상태</h4>
              <ul>
                <li>요청 접수 완료</li>
                <li>의도 분석 완료</li>
                <li>
                  처리 의도: <strong>Profit Analysis (수익성 분석)</strong>
                </li>
              </ul>
            </div>
          </div>
          <aside className="ear-card ear-task-panel">
            <div className="ear-task-panel__header">
              <h4>Tasks</h4>
              <span className="ear-muted">4</span>
            </div>
            <div className="ear-task-list">
              {stepTwoAgents.map((agent) => (
                <div className="ear-task-item" key={agent.name}>
                  <span className={`ear-status-dot ear-status-dot--${agent.tone}`} />
                  <span>{agent.name}</span>
                  <TagPill label={agent.status} tone={agent.tone} />
                </div>
              ))}
            </div>
            <div className="ear-divider" />
            <div className="ear-step-list">
              <strong>처리 단계 표시</strong>
              <ul>
                {stepTwoStages.map((step) => (
                  <li key={step.label} className={`ear-step-item ear-step-item--${step.status}`}>
                    <span />
                    {step.label}
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <section className="ear-section">
        <div className="ear-section__title">Step 3. 멀티 에이전트 처리 및 결과</div>
        <div className="ear-section__subtitle">
          Step 3 ↔ 시퀀스 ⑤~⑫ (멀티 에이전트 실행)
          <span>⑤ Revenue → ⑥ Cost → ⑦ Profit → ⑧ Query → ⑨ Data Retriever → ⑩ Compute → ⑪ 결과 생성 → ⑫ Audit</span>
        </div>
        <div className="ear-split">
          <div className="ear-card ear-card--large ear-flow-card">
            <div className="ear-hero ear-hero--compact">
              <div>
                <span className="ear-pill ear-pill--info">Processing</span>
                <h2>단위당 수익성 분석 워크플로</h2>
              </div>
              <div className="ear-hero__stats">
                <div className="ear-stat">
                  <span>분석 단계</span>
                  <strong>8</strong>
                </div>
                <div className="ear-stat">
                  <span>진행률</span>
                  <strong>100%</strong>
                </div>
              </div>
            </div>
            <div className="ear-dual-pane">
              <div className="ear-system-panel">
                <h4>처리 상태</h4>
                <ul>
                  {stepThreeProcessing.map((step) => (
                    <li key={step.label}>{step.label}</li>
                  ))}
                </ul>
              </div>
              <div className="ear-system-panel">
                <h4>Tasks</h4>
                <div className="ear-task-list">
                  {stepThreeAgents.map((agent) => (
                    <div className="ear-task-item" key={agent.name}>
                      <span className={`ear-status-dot ear-status-dot--${agent.tone}`} />
                      <span>{agent.name}</span>
                      <TagPill label={agent.status} tone={agent.tone} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <aside className="ear-card ear-result-panel">
            <div className="ear-result-header">
              <h4>단위당 수익성 분석 완료</h4>
              <span className="ear-muted">파란 원에서 보기</span>
            </div>
            <div className="ear-result-block">
              <strong>분석 결과 - 단위당 수익성 분석 리포트</strong>
              <ul>
                <li>매출: ₩123,400,000</li>
                <li>비용: ₩85,300,000</li>
                <li>이익: ₩18,000</li>
              </ul>
            </div>
            <div className="ear-result-block">
              <strong>처리 메타 정보</strong>
              <ul>
                <li>사용 에이전트 수: 4</li>
                <li>평균 처리 시간: 1.8s</li>
                <li>데이터 출처: ERP / Internal DB</li>
              </ul>
            </div>
            <button className="ear-primary ear-full">사용자 상세 요약 보기</button>
          </aside>
        </div>
      </section>
    </PortalDashboardLayout>
  );
};

export default PortalDashboardHome;
