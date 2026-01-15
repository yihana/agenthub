import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, Cpu, Database, Gauge, Layers } from 'lucide-react';
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
  const { getSummary, listAgents, listJobs } = useAgentManagementApi();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) return;

    const fetchSummary = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('인증 토큰이 필요합니다.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const [summaryData, agentsData, jobsData] = await Promise.all([
          getSummary(),
          listAgents({ limit: 5 }),
          listJobs()
        ]);
        setSummary(summaryData);
        setAgents(agentsData.agents || []);
        setJobs((jobsData.jobs || []).slice(0, 5));
      } catch (err: any) {
        setError(err.message || '요약 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [getSummary, isLoggedIn, listAgents, listJobs]);


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
                <div className="agent-card-grid agent-card-grid--wide">
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--primary">
                      <Layers size={18} />
                    </div>
                    <div>
                      <h4>전체 에이전트</h4>
                      <strong>{summary.totals.total}</strong>
                    </div>
                  </div>
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--success">
                      <Activity size={18} />
                    </div>
                    <div>
                      <h4>활성 에이전트</h4>
                      <strong>{summary.totals.active}</strong>
                    </div>
                  </div>
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--neutral">
                      <Database size={18} />
                    </div>
                    <div>
                      <h4>비활성 에이전트</h4>
                      <strong>{summary.totals.inactive}</strong>
                    </div>
                  </div>
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--danger">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <h4>오류 상태</h4>
                      <strong>{summary.totals.error}</strong>
                    </div>
                  </div>
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--primary">
                      <Cpu size={18} />
                    </div>
                    <div>
                      <h4>최근 1시간 요청 수</h4>
                      <strong>{totalRequests}</strong>
                    </div>
                  </div>
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--warning">
                      <Gauge size={18} />
                    </div>
                    <div>
                      <h4>평균 응답 지연</h4>
                      <strong>{avgLatency.toFixed(2)} ms</strong>
                    </div>
                  </div>
                  <div className="agent-card agent-card--kpi">
                    <div className="agent-card__icon agent-card__icon--warning">
                      <AlertCircle size={18} />
                    </div>
                    <div>
                      <h4>평균 오류율</h4>
                      <strong>{avgErrorRate.toFixed(2)}%</strong>
                    </div>
                  </div>
                </div>

                <div className="agent-dashboard-grid">
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

                  <div className="agent-panel">
                    <div className="agent-panel__header">
                      <Layers size={18} />
                      <h3>최근 등록 에이전트</h3>
                    </div>
                    <div className="agent-table agent-table--compact">
                      <table>
                        <thead>
                          <tr>
                            <th>이름</th>
                            <th>유형</th>
                            <th>상태</th>
                            <th>역할</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agents.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="agent-empty">등록된 에이전트가 없습니다.</td>
                            </tr>
                          ) : (
                            agents.map((agent) => (
                              <tr key={agent.id}>
                                <td>{agent.name}</td>
                                <td>{agent.type}</td>
                                <td>
                                  <span className={`agent-status agent-status--${agent.status}`}>
                                    {agent.status}
                                  </span>
                                </td>
                                <td>{(agent.roles || []).join(', ') || '-'}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="agent-panel">
                  <div className="agent-panel__header">
                    <Database size={18} />
                    <h3>작업 큐 현황</h3>
                  </div>
                  <div className="agent-table agent-table--compact">
                    <table>
                      <thead>
                        <tr>
                          <th>작업 ID</th>
                          <th>상태</th>
                          <th>우선순위</th>
                          <th>지정 에이전트</th>
                        </tr>
                      </thead>
                      <tbody>
                        {jobs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="agent-empty">등록된 작업이 없습니다.</td>
                          </tr>
                        ) : (
                          jobs.map((job) => (
                            <tr key={job.job_id || job.JOB_ID}>
                              <td>{job.job_id || job.JOB_ID}</td>
                              <td>{job.status || job.STATUS}</td>
                              <td>{job.priority ?? job.PRIORITY}</td>
                              <td>{job.assigned_agent_id || job.ASSIGNED_AGENT_ID || '-'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
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
