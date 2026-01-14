import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { useAuth } from '../hooks/useAuth';
import { useAgentManagementApi } from '../hooks/useAgentManagementApi';
import './AgentManagement.css';

const AgentDetailPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { getAgent, getMetrics, getTasks } = useAgentManagementApi();
  const [agent, setAgent] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      setError('');
      try {
        const agentData = await getAgent(id);
        setAgent(agentData.agent);
        const metricsData = await getMetrics(id);
        setMetrics(metricsData.metrics || []);
        const tasksData = await getTasks(id);
        setTasks(tasksData.tasks || []);
      } catch (err: any) {
        setError(err.message || '에이전트 정보를 불러오지 못했습니다.');
      }
    };

    fetchData();
  }, [id, getAgent, getMetrics, getTasks]);

  if (!agent) {
    return (
      <div className="agent-page">
        <AppHeader user={user} onLogin={handleLogin} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
        <div className="agent-page__content">
          {error ? (
            <div className="agent-alert agent-alert--error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          ) : (
            <div className="agent-loading">에이전트 정보를 불러오는 중...</div>
          )}
        </div>
        <AppBottom />
      </div>
    );
  }

  return (
    <div className="agent-page">
      <AppHeader user={user} onLogin={handleLogin} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
      <div className="agent-page__content">
        <div className="agent-page__header">
          <div>
            <h2>{agent.name}</h2>
            <p>{agent.description || '설명이 등록되지 않았습니다.'}</p>
          </div>
          <div className="agent-actions">
            <button className="agent-secondary" onClick={() => navigate('/agent-management')}>
              <ArrowLeft size={16} />
              목록
            </button>
            <button className="agent-primary" onClick={() => navigate(`/agent-management/${agent.id}/edit`)}>
              수정
            </button>
          </div>
        </div>

        {error && (
          <div className="agent-alert agent-alert--error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="agent-panel">
          <h3>기본 정보</h3>
          <div className="agent-detail-grid">
            <div>
              <span className="agent-label">상태</span>
              <strong className={`agent-status agent-status--${agent.status}`}>{agent.status}</strong>
            </div>
            <div>
              <span className="agent-label">유형</span>
              <strong>{agent.type}</strong>
            </div>
            <div>
              <span className="agent-label">최대 동시 처리량</span>
              <strong>{agent.maxConcurrency}</strong>
            </div>
            <div>
              <span className="agent-label">역할</span>
              <strong>{agent.roles?.join(', ') || '-'}</strong>
            </div>
            <div>
              <span className="agent-label">태그</span>
              <strong>{agent.tags?.join(', ') || '-'}</strong>
            </div>
            <div>
              <span className="agent-label">마지막 하트비트</span>
              <strong>{agent.lastHeartbeat || '-'}</strong>
            </div>
          </div>
        </div>

        <div className="agent-panel">
          <h3>최근 성능 지표</h3>
          <div className="agent-table">
            <table>
              <thead>
                <tr>
                  <th>시간</th>
                  <th>CPU</th>
                  <th>메모리</th>
                  <th>요청 수</th>
                  <th>응답 지연</th>
                  <th>오류율</th>
                </tr>
              </thead>
              <tbody>
                {metrics.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="agent-empty">수집된 지표가 없습니다.</td>
                  </tr>
                ) : (
                  metrics.map((metric) => (
                    <tr key={metric.id}>
                      <td>{metric.timestamp}</td>
                      <td>{metric.cpu_usage ?? metric.CPU_USAGE ?? '-'}</td>
                      <td>{metric.memory_usage ?? metric.MEMORY_USAGE ?? '-'}</td>
                      <td>{metric.requests_processed ?? metric.REQUESTS_PROCESSED ?? '-'}</td>
                      <td>{metric.avg_latency ?? metric.AVG_LATENCY ?? '-'}</td>
                      <td>{metric.error_rate ?? metric.ERROR_RATE ?? '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="agent-panel">
          <h3>최근 작업 로그</h3>
          <div className="agent-table">
            <table>
              <thead>
                <tr>
                  <th>작업 ID</th>
                  <th>상태</th>
                  <th>수신 시각</th>
                  <th>시작 시각</th>
                  <th>종료 시각</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="agent-empty">작업 이력이 없습니다.</td>
                  </tr>
                ) : (
                  tasks.map((task) => (
                    <tr key={task.id}>
                      <td>{task.job_id || task.JOB_ID}</td>
                      <td>{task.status || task.STATUS}</td>
                      <td>{task.received_at || task.RECEIVED_AT}</td>
                      <td>{task.started_at || task.STARTED_AT || '-'}</td>
                      <td>{task.finished_at || task.FINISHED_AT || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <AppBottom />
    </div>
  );
};

export default AgentDetailPage;
