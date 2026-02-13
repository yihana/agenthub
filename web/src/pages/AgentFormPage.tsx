import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, AlertCircle } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { useAuth } from '../hooks/useAuth';
import { useAgentManagementApi } from '../hooks/useAgentManagementApi';
import './AgentManagement.css';

const AgentFormPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { getAgent, createAgent, updateAgent, createJob } = useAgentManagementApi();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    status: 'inactive',
    envConfig: '',
    maxConcurrency: '1',
    tags: '',
    roles: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({
    payload: '{"type":"manual"}',
    priority: '3',
    scheduledAt: ''
  });
  const [taskSaving, setTaskSaving] = useState(false);

  useEffect(() => {
    const loadAgent = async () => {
      if (!id || !isLoggedIn) return;
      const token = localStorage.getItem('token');
      if (!token) {
        setError('인증 토큰이 필요합니다.');
        return;
      }

      setLoading(true);
      setError('');
      try {
        const data = await getAgent(id);
        const agent = data.agent;
        setFormData({
          name: agent.name,
          description: agent.description || '',
          type: agent.type,
          status: agent.status,
          envConfig: JSON.stringify(agent.envConfig || {}, null, 2),
          maxConcurrency: String(agent.maxConcurrency || 1),
          tags: (agent.tags || []).join(', '),
          roles: (agent.roles || []).join(', ')
        });
      } catch (err: any) {
        setError(err.message || '에이전트 정보를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [id, getAgent, isLoggedIn]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('인증 토큰이 필요합니다.');
        return;
      }

      let envConfigObj = null;
      if (formData.envConfig.trim()) {
        envConfigObj = JSON.parse(formData.envConfig);
      }

      const payload = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        status: formData.status,
        envConfig: envConfigObj,
        maxConcurrency: Number(formData.maxConcurrency),
        tags: formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        roles: formData.roles.split(',').map((role) => role.trim()).filter(Boolean)
      };

      if (id) {
        await updateAgent(id, payload);
      } else {
        await createAgent(payload);
      }

      navigate('/agent-management');
    } catch (err: any) {
      setError(err.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setTaskForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOptionalTaskSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!id) {
      setError('에이전트를 먼저 저장한 뒤 Task를 등록할 수 있습니다.');
      return;
    }

    setTaskSaving(true);
    try {
      const parsedPayload = taskForm.payload.trim() ? JSON.parse(taskForm.payload) : {};
      await createJob({
        payload: parsedPayload,
        priority: Number(taskForm.priority || 3),
        scheduledAt: taskForm.scheduledAt || undefined,
        assignedAgentId: Number(id)
      });
      setTaskForm({ payload: '{"type":"manual"}', priority: '3', scheduledAt: '' });
      setTaskFormOpen(false);
    } catch (err: any) {
      setError(err.message || 'Task 등록 중 오류가 발생했습니다.');
    } finally {
      setTaskSaving(false);
    }
  };


  return (
    <div className="agent-page">
      <AppHeader user={user} onLogin={handleLogin} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
      <div className="agent-page__content">
        <div className="agent-page__header">
          <div>
            <h2>{id ? '에이전트 수정' : '에이전트 등록'}</h2>
            <p>에이전트 기본 정보와 역할, 실행 환경을 설정합니다.</p>
          </div>
          <button className="agent-secondary" onClick={() => navigate('/agent-management')}>
            <ArrowLeft size={16} />
            목록
          </button>
        </div>

        {error && (
          <div className="agent-alert agent-alert--error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="agent-form" onSubmit={handleSubmit}>
          <label>
            에이전트 이름
            <input name="name" value={formData.name} onChange={handleChange} required />
          </label>
          <label>
            설명
            <textarea name="description" value={formData.description} onChange={handleChange} rows={3} />
          </label>
          <label>
            에이전트 유형
            <input name="type" value={formData.type} onChange={handleChange} required disabled={!!id} />
          </label>
          <label>
            상태
            <select name="status" value={formData.status} onChange={handleChange}>
              <option value="active">활성</option>
              <option value="inactive">비활성</option>
              <option value="running">실행 중</option>
              <option value="error">오류</option>
            </select>
          </label>
          <label>
            실행 환경 (JSON)
            <textarea name="envConfig" value={formData.envConfig} onChange={handleChange} rows={4} />
          </label>
          <label>
            최대 동시 처리량
            <input
              type="number"
              name="maxConcurrency"
              value={formData.maxConcurrency}
              onChange={handleChange}
              min={1}
            />
          </label>
          <label>
            태그 (쉼표로 구분)
            <input name="tags" value={formData.tags} onChange={handleChange} />
          </label>
          <label>
            역할 (쉼표로 구분)
            <input name="roles" value={formData.roles} onChange={handleChange} />
          </label>

          <div className="agent-form__actions">
            <button type="submit" className="agent-primary" disabled={loading}>
              <Save size={16} />
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>

        <section className="agent-panel">
          <div className="agent-panel__header">
            <h3>옵션 Task 등록</h3>
            <button type="button" className="agent-secondary" onClick={() => setTaskFormOpen((prev) => !prev)}>
              {taskFormOpen ? '접기' : 'Task 등록 열기'}
            </button>
          </div>
          {taskFormOpen && (
            <form className="agent-form" onSubmit={handleOptionalTaskSubmit}>
              <label>
                Payload (JSON)
                <textarea name="payload" rows={4} value={taskForm.payload} onChange={handleTaskChange} />
              </label>
              <label>
                Priority
                <input type="number" name="priority" min={1} max={5} value={taskForm.priority} onChange={handleTaskChange} />
              </label>
              <label>
                Scheduled At (선택)
                <input type="datetime-local" name="scheduledAt" value={taskForm.scheduledAt} onChange={handleTaskChange} />
              </label>
              <div className="agent-form__actions">
                <button type="submit" className="agent-primary" disabled={taskSaving}>
                  {taskSaving ? 'Task 저장 중...' : 'Task 등록'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
      <AppBottom />
    </div>
  );
};

export default AgentFormPage;
