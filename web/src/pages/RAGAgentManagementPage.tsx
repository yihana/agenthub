import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Bot
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import './UserManagementPage.css';

interface RAGAgent {
  id: number;
  company_code: string;
  agent_description: string;
  agent_url: string;
  agent_token: string;
  is_active: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
}

interface RAGAgentFormData {
  company_code: string;
  agent_description: string;
  agent_url: string;
  agent_token: string;
  is_active: string;
}

const RAGAgentManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [agents, setAgents] = useState<RAGAgent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<RAGAgent | null>(null);
  
  // 폼 데이터
  const [formData, setFormData] = useState<RAGAgentFormData>({
    company_code: '',
    agent_description: '',
    agent_url: '',
    agent_token: '',
    is_active: 'N'
  });

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/error');
        return;
      }

      const response = await fetch('/api/rag-agents', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      } else if (response.status === 401) {
        navigate('/error');
      } else if (response.status === 403) {
        setError('관리자 권한이 필요합니다.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'RAG Agent 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('RAG Agent 목록 로드 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/rag-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('RAG Agent가 생성되었습니다.');
        setShowCreateModal(false);
        resetForm();
        loadAgents();
      } else {
        setError(data.error || 'RAG Agent 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('RAG Agent 생성 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/rag-agents/${selectedAgent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('RAG Agent 정보가 수정되었습니다.');
        setShowEditModal(false);
        setSelectedAgent(null);
        resetForm();
        loadAgents();
      } else {
        setError(data.error || 'RAG Agent 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('RAG Agent 수정 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAgent = async (agent: RAGAgent) => {
    if (!confirm(`정말로 RAG Agent "${agent.company_code}" (${agent.agent_description || '설명 없음'})을(를) 삭제하시겠습니까?`)) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/rag-agents/${agent.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('RAG Agent가 삭제되었습니다.');
        loadAgents();
      } else {
        setError(data.error || 'RAG Agent 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('RAG Agent 삭제 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      company_code: '',
      agent_description: '',
      agent_url: '',
      agent_token: '',
      is_active: 'N'
    });
  };

  const openEditModal = (agent: RAGAgent) => {
    setSelectedAgent(agent);
    setFormData({
      company_code: agent.company_code,
      agent_description: agent.agent_description || '',
      agent_url: agent.agent_url,
      agent_token: agent.agent_token,
      is_active: agent.is_active
    });
    setShowEditModal(true);
  };

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleString('ko-KR');
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="RAG Agent 관리"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="user-management-container" style={{ width: '90%', margin: '0 auto' }}>
          <div className="search-section">
            <div className="search-group">
              <div className="input-group">
                <Search size={16} className="input-icon" />
                <input
                  type="text"
                  placeholder="회사구분코드로 검색"
                  onChange={(e) => {
                    // 검색 기능은 나중에 구현 가능
                  }}
                />
              </div>
              <div className="search-actions">
                <button 
                  onClick={loadAgents} 
                  className="btn btn-secondary btn-icon"
                  disabled={isLoading}
                  title="새로고침"
                >
                  <RefreshCw size={20} className={isLoading ? 'spinning' : ''} />
                </button>
                <button 
                  onClick={() => {
                    resetForm();
                    setShowCreateModal(true);
                  }}
                  className="btn btn-primary"
                >
                  <Plus size={16} />
                  RAG Agent 추가
                </button>
              </div>
            </div>
          </div>

          {/* 메시지 */}
          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="success-message">
              <CheckCircle size={16} />
              <span>{success}</span>
            </div>
          )}

          {/* RAG Agent 목록 테이블 */}
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>회사구분코드</th>
                  <th>Agent Description</th>
                  <th>Agent URL</th>
                  <th>사용여부</th>
                  <th>등록자</th>
                  <th>수정자</th>
                  <th>등록일시</th>
                  <th>수정일시</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={9} className="loading-cell">
                      <RefreshCw size={20} className="spinning" />
                      로딩 중...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="empty-cell">
                      RAG Agent가 없습니다.
                    </td>
                  </tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id}>
                      <td>
                        <div className="user-info">
                          <Bot size={16} />
                          <span className="username">{agent.company_code}</span>
                        </div>
                      </td>
                      <td>{agent.agent_description || '-'}</td>
                      <td>
                        <div style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {agent.agent_url}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${agent.is_active === 'Y' ? 'active' : 'inactive'}`}>
                          {agent.is_active === 'Y' ? 'Y' : 'N'}
                        </span>
                      </td>
                      <td>{agent.created_by || '-'}</td>
                      <td>{agent.updated_by || '-'}</td>
                      <td>{formatDateTime(agent.created_at)}</td>
                      <td>{formatDateTime(agent.updated_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => openEditModal(agent)}
                            className="btn-icon"
                            title="수정"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteAgent(agent)}
                            className="btn-icon btn-danger"
                            title="삭제"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <AppBottom />

      {/* 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>RAG Agent 추가</h2>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateAgent}>
              <div className="form-group">
                <label>회사구분코드 *</label>
                <input
                  type="text"
                  value={formData.company_code}
                  onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                  required
                  placeholder="예: SKN"
                />
              </div>
              <div className="form-group">
                <label>Agent Description</label>
                <input
                  type="text"
                  value={formData.agent_description}
                  onChange={(e) => setFormData({ ...formData, agent_description: e.target.value })}
                  placeholder="Agent 설명"
                />
              </div>
              <div className="form-group">
                <label>Agent URL *</label>
                <input
                  type="text"
                  value={formData.agent_url}
                  onChange={(e) => setFormData({ ...formData, agent_url: e.target.value })}
                  required
                  placeholder="https://..."
                />
              </div>
              <div className="form-group">
                <label>Agent Token *</label>
                <input
                  type="text"
                  value={formData.agent_token}
                  onChange={(e) => setFormData({ ...formData, agent_token: e.target.value })}
                  required
                  placeholder="Bearer token"
                />
              </div>
              <div className="form-group">
                <label>사용여부</label>
                <select
                  value={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value })}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && selectedAgent && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>RAG Agent 수정</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <form onSubmit={handleEditAgent}>
              <div className="form-group">
                <label>회사구분코드 *</label>
                <input
                  type="text"
                  value={formData.company_code}
                  onChange={(e) => setFormData({ ...formData, company_code: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Agent Description</label>
                <input
                  type="text"
                  value={formData.agent_description}
                  onChange={(e) => setFormData({ ...formData, agent_description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Agent URL *</label>
                <input
                  type="text"
                  value={formData.agent_url}
                  onChange={(e) => setFormData({ ...formData, agent_url: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Agent Token *</label>
                <input
                  type="text"
                  value={formData.agent_token}
                  onChange={(e) => setFormData({ ...formData, agent_token: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>사용여부</label>
                <select
                  value={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.value })}
                >
                  <option value="Y">Y</option>
                  <option value="N">N</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                  취소
                </button>
                <button type="submit" className="btn btn-primary" disabled={isLoading}>
                  {isLoading ? '수정 중...' : '수정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGAgentManagementPage;

