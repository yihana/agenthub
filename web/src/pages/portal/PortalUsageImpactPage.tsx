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
    investment_cost?: number;
  };
  collaboration?: {
    decision_accuracy_pct: number;
    override_rate_pct: number;
    cognitive_load_reduction_pct: number;
    handoff_time_seconds: number;
    team_satisfaction_score: number;
    innovation_count: number;
  };
  risk?: {
    risk_exposure_score: number;
    audit_required_rate_pct: number;
    audit_completed_rate_pct: number;
    human_review_rate_pct: number;
    total_risk_items: number;
  };
  value?: {
    role_redesign_ratio_pct: number;
    customer_nps_delta: number;
    error_reduction_pct: number;
    decision_speed_improvement_pct: number;
  };
}

const PortalUsageImpactPage: React.FC = () => {
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

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
              <strong>투자 비용</strong>
              <span>{metrics?.savings.investment_cost ? `₩${Math.round(metrics.savings.investment_cost).toLocaleString()}` : '₩14M'}</span>
            </div>
          </div>
        </WidgetCard>
        <WidgetCard title="Human-AI 협업 지표" description="의사결정 정확도와 협업 품질을 요약합니다.">
          <div className="ear-progress-group">
            <ProgressRow
              label="의사결정 정확도"
              value={metrics?.collaboration ? `${metrics.collaboration.decision_accuracy_pct.toFixed(1)}%` : '74.8%'}
              percent={clampPercent(metrics?.collaboration?.decision_accuracy_pct ?? 75)}
            />
            <ProgressRow
              label="인간 개입율"
              value={metrics?.collaboration ? `${metrics.collaboration.override_rate_pct.toFixed(1)}%` : '21.4%'}
              percent={clampPercent(metrics?.collaboration?.override_rate_pct ?? 21)}
            />
            <ProgressRow
              label="인지 부담 감소"
              value={metrics?.collaboration ? `${metrics.collaboration.cognitive_load_reduction_pct.toFixed(1)}%` : '18.2%'}
              percent={clampPercent(metrics?.collaboration?.cognitive_load_reduction_pct ?? 18)}
            />
          </div>
          <div className="ear-insight">
            <div>
              <strong>작업 인계 시간</strong>
              <span>{metrics?.collaboration ? `${metrics.collaboration.handoff_time_seconds.toFixed(1)}s` : '6.4s'}</span>
            </div>
            <div>
              <strong>팀 만족도</strong>
              <span>{metrics?.collaboration ? `${metrics.collaboration.team_satisfaction_score.toFixed(1)}/5` : '4.2/5'}</span>
            </div>
            <div>
              <strong>혁신 건수</strong>
              <span>{metrics?.collaboration ? `${metrics.collaboration.innovation_count.toLocaleString()}건` : '14건'}</span>
            </div>
          </div>
        </WidgetCard>
        <WidgetCard title="위험/신뢰 지표" description="리스크 노출과 감사 범위를 점검합니다.">
          <div className="ear-progress-group">
            <ProgressRow
              label="위험 노출 점수"
              value={metrics?.risk ? `${metrics.risk.risk_exposure_score.toFixed(1)}점` : '7.8점'}
              percent={clampPercent((metrics?.risk?.risk_exposure_score ?? 7.8) * 10)}
            />
            <ProgressRow
              label="감사 필요 비율"
              value={metrics?.risk ? `${metrics.risk.audit_required_rate_pct.toFixed(1)}%` : '32.5%'}
              percent={clampPercent(metrics?.risk?.audit_required_rate_pct ?? 33)}
            />
            <ProgressRow
              label="인간 검토율"
              value={metrics?.risk ? `${metrics.risk.human_review_rate_pct.toFixed(1)}%` : '68.4%'}
              percent={clampPercent(metrics?.risk?.human_review_rate_pct ?? 68)}
            />
          </div>
          <div className="ear-insight">
            <div>
              <strong>감사 완료율</strong>
              <span>{metrics?.risk ? `${metrics.risk.audit_completed_rate_pct.toFixed(1)}%` : '61.0%'}</span>
            </div>
            <div>
              <strong>관리 대상 건수</strong>
              <span>{metrics?.risk ? `${metrics.risk.total_risk_items.toLocaleString()}건` : '42건'}</span>
            </div>
            <div>
              <strong>신뢰 메시지</strong>
              <span>Human-in-the-loop 유지</span>
            </div>
          </div>
        </WidgetCard>
        <WidgetCard title="가치 창출 지표" description="고객 및 조직 영향 변화를 추적합니다.">
          <div className="ear-progress-group">
            <ProgressRow
              label="역할 재설계 비율"
              value={metrics?.value ? `${metrics.value.role_redesign_ratio_pct.toFixed(1)}%` : '24.0%'}
              percent={clampPercent(metrics?.value?.role_redesign_ratio_pct ?? 24)}
            />
            <ProgressRow
              label="오류 감소율"
              value={metrics?.value ? `${metrics.value.error_reduction_pct.toFixed(1)}%` : '16.5%'}
              percent={clampPercent(metrics?.value?.error_reduction_pct ?? 17)}
            />
            <ProgressRow
              label="의사결정 속도 개선"
              value={metrics?.value ? `${metrics.value.decision_speed_improvement_pct.toFixed(1)}%` : '28.3%'}
              percent={clampPercent(metrics?.value?.decision_speed_improvement_pct ?? 28)}
            />
          </div>
          <div className="ear-insight">
            <div>
              <strong>고객 만족도 변화</strong>
              <span>{metrics?.value ? `${metrics.value.customer_nps_delta.toFixed(1)}p` : '+6.2p'}</span>
            </div>
            <div>
              <strong>강화 메시지</strong>
              <span>업무 재투자 진행</span>
            </div>
            <div>
              <strong>혁신 활동</strong>
              <span>프로세스 개선 확대</span>
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
