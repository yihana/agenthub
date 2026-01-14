import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { useAuth } from '../hooks/useAuth';
import { useAgentManagementApi } from '../hooks/useAgentManagementApi';
import './AgentManagement.css';

interface SummaryData {
  statusBreakdown: { status: string; count: number }[];
  totals: {
    total: number;
    active: number;
    inactive: number;
    error: number;
  };
  metrics: {
    total_requests: number;
    avg_latency: number;
    avg_error_rate: number;
  };
}

const AgentDashboardPage: React.FC = () => {
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { getSummary } = useAgentManagementApi();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getSummary();
        setSummary(data);
      } catch (err: any) {
        setError(err.message || '요약 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [getSummary]);

  return (
    <div className="agent-page">
      <AppHeader user={user} onLogin={handleLogin} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
      <div className="agent-page__content">
        <div className="agent-page__header">
          <div>
            <h2>에이전트 대시보드</h2>
            <p>현재 운영 중인 에이전트의 상태와 성능 요약을 확인합니다.</p>
          </div>
        </div>

        {error && (
          <div className="agent-alert agent-alert--error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="agent-loading">데이터를 불러오는 중...</div>
        ) : (
          summary && (() => {
            const avgLatency = Number(summary.metrics?.avg_latency || 0);
            const avgErrorRate = Number(summary.metrics?.avg_error_rate || 0);
            const totalRequests = Number(summary.metrics?.total_requests || 0);

            return (
            <div className="agent-dashboard">
              <div className="agent-card-grid">
                <div className="agent-card">
                  <h4>전체 에이전트</h4>
                  <strong>{summary.totals.total}</strong>
                </div>
                <div className="agent-card">
                  <h4>활성 에이전트</h4>
                  <strong>{summary.totals.active}</strong>
                </div>
                <div className="agent-card">
                  <h4>비활성 에이전트</h4>
                  <strong>{summary.totals.inactive}</strong>
                </div>
                <div className="agent-card">
                  <h4>오류 상태</h4>
                  <strong>{summary.totals.error}</strong>
                </div>
                <div className="agent-card">
                  <h4>최근 1시간 요청 수</h4>
                  <strong>{totalRequests}</strong>
                </div>
                <div className="agent-card">
                  <h4>평균 응답 지연</h4>
                  <strong>{avgLatency.toFixed(2)} ms</strong>
                </div>
                <div className="agent-card">
                  <h4>평균 오류율</h4>
                  <strong>{avgErrorRate.toFixed(2)}%</strong>
                </div>
              </div>

              <div className="agent-panel">
                <div className="agent-panel__header">
                  <Activity size={18} />
                  <h3>상태 분포</h3>
                </div>
                <ul className="agent-status-list">
                  {summary.statusBreakdown.map((item) => (
                    <li key={item.status}>
                      <span>{item.status}</span>
                      <strong>{item.count}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            );
          })()
        )}
      </div>
      <AppBottom />
    </div>
  );
};

export default AgentDashboardPage;
