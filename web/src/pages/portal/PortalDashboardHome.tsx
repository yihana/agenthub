import React from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import StatTile from '../../components/portal-dashboard/StatTile';
import TagPill from '../../components/portal-dashboard/TagPill';
import ChartPlaceholder from '../../components/portal-dashboard/ChartPlaceholder';
import ProgressRow from '../../components/portal-dashboard/ProgressRow';
import { usePortalDashboardConfig } from '../../hooks/usePortalDashboardConfig';
import { DashboardWidgetConfig } from '../../data/portalDashboardConfig';

const agentUpdates: Array<{
  name: string;
  owner: string;
  status: string;
  tone: 'success' | 'warning' | 'info';
}> = [
  { name: 'Finance Insight', owner: '재무팀', status: '운영', tone: 'success' },
  { name: 'Policy Guard', owner: '보안실', status: '점검', tone: 'warning' },
  { name: 'Support Copilot', owner: '고객지원', status: '승인 대기', tone: 'info' }
];

const alerts = [
  { title: 'FAQ 에이전트 오류율 증가', detail: '지난 4시간 동안 오류율 2.4%p 상승' },
  { title: '주요 프롬프트 업데이트', detail: '에이전트 5건이 정책 갱신 완료' },
  { title: '데이터 소스 동기화', detail: 'CRM 데이터 동기화 지연 12분' }
];

const PortalDashboardHome: React.FC = () => {
  const { widgets } = usePortalDashboardConfig();
  const enabledWidgets = widgets.filter((widget) => widget.enabled);

  const renderWidget = (widget: DashboardWidgetConfig) => {
    switch (widget.type) {
      case 'status':
        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
          >
            <div className="ear-stat-grid">
              <StatTile label="정상 운영" value="18" delta="+2" highlight />
              <StatTile label="점검 필요" value="3" delta="-1" />
              <StatTile label="보류" value="2" delta="0" />
              <StatTile label="업데이트" value="6" delta="+3" />
            </div>
          </WidgetCard>
        );
      case 'chart':
        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
            actions={<button className="ear-ghost">보고서 보기</button>}
          >
            <ChartPlaceholder label="처리량" summary="주간 12% 증가" />
            <div className="ear-progress-group">
              <ProgressRow label="자동 처리" value="72%" percent={72} />
              <ProgressRow label="검토 필요" value="18%" percent={18} />
              <ProgressRow label="예외 처리" value="10%" percent={10} />
            </div>
          </WidgetCard>
        );
      case 'list':
        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
          >
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
      case 'insight':
        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
          >
            <div className="ear-insight">
              <div>
                <strong>월간 절감 시간</strong>
                <span>312h</span>
              </div>
              <div>
                <strong>CS 처리 개선</strong>
                <span>+28%</span>
              </div>
              <div>
                <strong>리스크 감소</strong>
                <span>정책 위반 0건</span>
              </div>
            </div>
          </WidgetCard>
        );
      case 'timeline':
        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
          >
            <ul className="ear-timeline">
              <li>
                <span>10:00</span>
                <div>
                  <strong>새 모델 배포</strong>
                  <p>FAQ 에이전트 v2.3 롤아웃</p>
                </div>
              </li>
              <li>
                <span>14:30</span>
                <div>
                  <strong>품질 점검</strong>
                  <p>리스크 점검 리포트 공유</p>
                </div>
              </li>
              <li>
                <span>17:00</span>
                <div>
                  <strong>정책 워크숍</strong>
                  <p>거버넌스 위원회 주간 미팅</p>
                </div>
              </li>
            </ul>
          </WidgetCard>
        );
      case 'activity':
        return (
          <WidgetCard
            key={widget.id}
            title={widget.title}
            description={widget.description}
            size={widget.size}
          >
            <div className="ear-activity">
              {alerts.map((alert) => (
                <div key={alert.title}>
                  <strong>{alert.title}</strong>
                  <span>{alert.detail}</span>
                </div>
              ))}
            </div>
          </WidgetCard>
        );
      default:
        return null;
    }
  };

  return (
    <PortalDashboardLayout
      title="Agent Portal 관리 대시보드"
      subtitle="실시간 운영 현황과 효과 지표를 한 화면에서 확인합니다."
      actions={
        <>
          <button className="ear-secondary">공유</button>
          <button className="ear-primary">새 리포트</button>
        </>
      }
    >
      <section className="ear-hero">
        <div>
          <span className="ear-pill ear-pill--info">이번 주 핵심 지표</span>
          <h2>운영 안정성 98.7% 유지</h2>
          <p>자동화 처리량과 품질 관리 지표가 모두 상승하고 있습니다.</p>
        </div>
        <div className="ear-hero__stats">
          <StatTile label="주간 요청" value="12.4K" delta="+9%" />
          <StatTile label="품질 점수" value="4.8/5" delta="+0.2" highlight />
          <StatTile label="평균 응답" value="1.3s" delta="-0.4s" />
        </div>
      </section>
      <div className="ear-grid">
        {enabledWidgets.map((widget) => renderWidget(widget))}
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalDashboardHome;
