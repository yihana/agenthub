import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, AlertCircle } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { useAuth } from '../hooks/useAuth';
import { useAgentManagementApi } from '../hooks/useAgentManagementApi';
import './AgentManagement.css';

interface AgentItem {
  id: number;
  name: string;
  description?: string;
  type: string;
  status: string;
  maxConcurrency: number;
  tags: string[];
  roles: string[];
  lastHeartbeat?: string;
}

const AgentListPage: React.FC = () => {
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { listAgents, deleteAgent } = useAgentManagementApi();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAgents({ search: searchTerm, status: statusFilter, limit: 50 });
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message || '에이전트 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAgents();
  };

  const handleDeactivate = async (id: number) => {
    if (!window.confirm('해당 에이전트를 비활성화하시겠습니까?')) return;
    try {
      await deleteAgent(id);
      await loadAgents();
    } catch (err: any) {
      setError(err.message || '비활성화 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="agent-page">
      <AppHeader user={user} onLogin={handleLogin} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
      <div className="agent-page__content">
        <div className="agent-page__header">
          <div>
            <h2>에이전트 목록</h2>
            <p>등록된 에이전트를 검색하고 상태를 확인합니다.</p>
          </div>
          <button className="agent-primary" onClick={() => navigate('/agent-management/new')}>
            <Plus size={16} />
            신규 등록
          </button>
        </div>

        <form className="agent-filter" onSubmit={handleSearch}>
          <div className="agent-filter__field">
            <Search size={16} />
            <input
              type="text"
              placeholder="에이전트 이름 또는 설명 검색"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">전체 상태</option>
            <option value="active">활성</option>
            <option value="inactive">비활성</option>
            <option value="error">오류</option>
            <option value="running">실행 중</option>
          </select>
          <button type="submit" className="agent-secondary">
            조회
          </button>
          <button type="button" className="agent-secondary" onClick={loadAgents}>
            <RefreshCw size={16} />
            새로고침
          </button>
        </form>

        {error && (
          <div className="agent-alert agent-alert--error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="agent-table">
          {loading ? (
            <div className="agent-loading">불러오는 중...</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>이름</th>
                  <th>유형</th>
                  <th>상태</th>
                  <th>동시 처리량</th>
                  <th>역할</th>
                  <th>태그</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {agents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="agent-empty">등록된 에이전트가 없습니다.</td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id}>
                      <td>{agent.id}</td>
                      <td>
                        <button
                          type="button"
                          className="agent-link"
                          onClick={() => navigate(`/agent-management/${agent.id}`)}
                        >
                          {agent.name}
                        </button>
                      </td>
                      <td>{agent.type}</td>
                      <td>
                        <span className={`agent-status agent-status--${agent.status}`}>
                          {agent.status}
                        </span>
                      </td>
                      <td>{agent.maxConcurrency}</td>
                      <td>{agent.roles.join(', ') || '-'}</td>
                      <td>{agent.tags.join(', ') || '-'}</td>
                      <td>
                        <div className="agent-actions">
                          <button
                            type="button"
                            className="agent-secondary"
                            onClick={() => navigate(`/agent-management/${agent.id}/edit`)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="agent-danger"
                            onClick={() => handleDeactivate(agent.id)}
                          >
                            비활성화
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <AppBottom />
    </div>
  );
};

export default AgentListPage;
