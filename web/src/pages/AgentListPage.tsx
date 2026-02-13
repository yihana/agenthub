import React, { useEffect, useMemo, useState } from 'react';
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

interface Level2Item {
  id: number;
  code: string;
  name: string;
  agentCount: number;
}

interface ModuleItem {
  id: number;
  code: string;
  name: string;
  level2: Level2Item[];
  agentCount: number;
}

const LEVEL1_E2E_LABELS: Record<string, string> = {
  MM: 'Procure to Pay',
  PP: 'Plan to Produce',
  HR: 'Hire to Retire',
  SD: 'Order to Cash',
  FI: 'Record to Report',
  CO: 'Plan to Perform',
  BC: 'Basis to Operate'
};

const AgentListPage: React.FC = () => {
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { listAgents, deleteAgent, getAgentTaxonomy } = useAgentManagementApi();
  const navigate = useNavigate();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [selectedLevel1, setSelectedLevel1] = useState<number | null>(null);
  const [selectedLevel2, setSelectedLevel2] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const selectedModule = useMemo(() => modules.find((module) => module.id === selectedLevel1) || null, [modules, selectedLevel1]);

  const loadTaxonomy = async () => {
    try {
      const data = await getAgentTaxonomy();
      const apiModules = (data.modules || []) as ModuleItem[];
      setModules(apiModules);
      if (!selectedLevel1 && apiModules.length > 0) {
        setSelectedLevel1(apiModules[0].id);
      }
    } catch (err: any) {
      setError(err.message || '모듈 정보를 불러오지 못했습니다.');
    }
  };

  const loadAgents = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('인증 토큰이 필요합니다.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await listAgents({
        search: searchTerm,
        status: statusFilter,
        level1Id: selectedLevel1 ?? undefined,
        level2Id: selectedLevel2 ?? undefined,
        limit: 50
      });
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message || '에이전트 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    loadTaxonomy();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    loadAgents();
  }, [isLoggedIn, selectedLevel1, selectedLevel2]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadAgents();
  };

  const handleDeactivate = async (id: number) => {
    if (!window.confirm('해당 에이전트를 비활성화하시겠습니까?')) return;
    try {
      await deleteAgent(id);
      await loadAgents();
      await loadTaxonomy();
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
            <p>SAP 모듈(Level1) 및 업무 영역(Level2) 기준으로 에이전트를 조회합니다.</p>
          </div>
          <button className="agent-primary" onClick={() => navigate('/agent-management/new')}>
            <Plus size={16} />
            신규 등록
          </button>
        </div>

        <section className="agent-module-overview">
          <div className="agent-module-tabs">
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                className={`agent-module-tab ${selectedLevel1 === module.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedLevel1(module.id);
                  setSelectedLevel2(null);
                }}
              >
                {module.code === 'COMMON'
                  ? '통합'
                  : (LEVEL1_E2E_LABELS[module.code] ? `${module.code} · ${LEVEL1_E2E_LABELS[module.code]}` : module.code)}
                <span>{module.agentCount}</span>
              </button>
            ))}
          </div>

          <div className="agent-module-summary">
            <h3>{selectedModule ? (selectedModule.code === 'COMMON' ? '> Level1 > Level2' : `> ${LEVEL1_E2E_LABELS[selectedModule.code] ? `${selectedModule.name} · ${LEVEL1_E2E_LABELS[selectedModule.code]}` : selectedModule.name} > Level2`) : '> Level1 > Level2'}</h3>
            <strong>Agent Count: {selectedModule?.agentCount || 0}</strong>
          </div>

          <div className="agent-level2-grid">
            {(selectedModule?.level2 || []).map((level2) => (
              <button
                key={level2.id}
                type="button"
                className={`agent-level2-card ${selectedLevel2 === level2.id ? 'active' : ''}`}
                onClick={() => setSelectedLevel2((prev) => (prev === level2.id ? null : level2.id))}
              >
                <span>{level2.code}</span>
                <strong>{level2.name}</strong>
                <em>{level2.agentCount}</em>
              </button>
            ))}
          </div>
        </section>

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
