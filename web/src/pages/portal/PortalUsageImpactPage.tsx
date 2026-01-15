import React, { useEffect, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import StatTile from '../../components/portal-dashboard/StatTile';
import ChartPlaceholder from '../../components/portal-dashboard/ChartPlaceholder';
import ProgressRow from '../../components/portal-dashboard/ProgressRow';

interface UsageMetrics {
  total_requests: number;
  quality_score: number;
  savings: {
    cost_savings: number;
    time_savings_minutes: number;
    roi_ratio_pct: number;
  };
}

const PortalUsageImpactPage: React.FC = () => {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/portal-dashboard/metrics?period=month');
        if (!response.ok) {
          throw new Error('Failed to load metrics');
        }
        const data = await response.json();
        setMetrics(data);
      } catch (error) {
        console.error('Usage impact metrics error:', error);
      }
    };

    fetchMetrics();
  }, []);

  return (
    <PortalDashboardLayout
      title="사용 현황/효과"
      subtitle="에이전트 활용 현황과 업무 개선 효과를 시각화합니다."
      actions={<button className="ear-primary">효과 리포트 생성</button>}
    >
      <section className="ear-hero ear-hero--compact">
        <div>
          <h2>조직별 활용도 Top 3</h2>
          <p>운영 부서가 평균 62%의 자동화를 달성했습니다.</p>
        </div>
        <div className="ear-hero__stats">
          <StatTile
            label="총 호출"
            value={metrics ? metrics.total_requests.toLocaleString() : '48.2K'}
            delta="+14%"
          />
          <StatTile
            label="업무 절감"
            value={metrics ? `${Math.round(metrics.savings.time_savings_minutes / 60)}h` : '612h'}
            delta="+8%"
            highlight
          />
          <StatTile
            label="품질 점수"
            value={metrics ? `${metrics.quality_score.toFixed(1)}/5` : '4.7/5'}
            delta="+0.1"
          />
        </div>
      </section>

      <div className="ear-grid">
        <WidgetCard title="부서별 활용도" description="업무 자동화율 기준으로 정렬">
          <ChartPlaceholder label="활용도" summary="이번 달 9% 증가" />
        </WidgetCard>
        <WidgetCard title="효과 지표" description="정성/정량 성과를 함께 관리">
          <div className="ear-progress-group">
            <ProgressRow label="처리 시간 감소" value="-31%" percent={69} />
            <ProgressRow label="품질 개선" value="+22%" percent={78} />
            <ProgressRow label="운영 비용 절감" value="-18%" percent={82} />
          </div>
          <div className="ear-insight">
            <div>
              <strong>월간 비용 절감</strong>
              <span>{metrics ? `₩${Math.round(metrics.savings.cost_savings).toLocaleString()}` : '₩84M'}</span>
            </div>
            <div>
              <strong>ROI</strong>
              <span>{metrics ? `${metrics.savings.roi_ratio_pct.toFixed(1)}%` : '18%'}</span>
            </div>
            <div>
              <strong>리스크 대응</strong>
              <span>사전 차단 37건</span>
            </div>
          </div>
        </WidgetCard>
        <WidgetCard title="활용 집중 영역" description="주요 업무 시나리오별 점유율">
          <ul className="ear-timeline ear-timeline--dense">
            <li>
              <span>CS 응답</span>
              <div>
                <strong>34%</strong>
                <p>신규 가이드 반영 완료</p>
              </div>
            </li>
            <li>
              <span>정책 검토</span>
              <div>
                <strong>26%</strong>
                <p>리스크 대응 속도 개선</p>
              </div>
            </li>
            <li>
              <span>리포팅</span>
              <div>
                <strong>18%</strong>
                <p>자동 보고서 12종 배포</p>
              </div>
            </li>
          </ul>
        </WidgetCard>
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalUsageImpactPage;
