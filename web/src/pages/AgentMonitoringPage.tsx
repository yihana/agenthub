import React, { useEffect, useState } from 'react';
import { AlertCircle, Save } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { useAuth } from '../hooks/useAuth';
import { useAgentManagementApi } from '../hooks/useAgentManagementApi';
import './AgentManagement.css';

const AgentMonitoringPage: React.FC = () => {
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { listJobs, createJob } = useAgentManagementApi();
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    payload: '{\n  "task": "sample"\n}',
    priority: '0',
    scheduledAt: '',
    assignedAgentId: ''
  });

  const loadJobs = async () => {
    setError('');
    try {
      const data = await listJobs();
      setJobs(data.jobs || []);
    } catch (err: any) {
      setError(err.message || '작업 큐를 불러오지 못했습니다.');
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    try {
      const payloadObj = formData.payload ? JSON.parse(formData.payload) : null;
      await createJob({
        payload: payloadObj,
        priority: Number(formData.priority),
        scheduledAt: formData.scheduledAt || undefined,
        assignedAgentId: formData.assignedAgentId ? Number(formData.assignedAgentId) : null
      });
      await loadJobs();
    } catch (err: any) {
      setError(err.message || '작업 생성 중 오류가 발생했습니다.');
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="agent-page">
      <AppHeader user={user} onLogin={handleLogin} onLogout={handleLogout} isLoggedIn={isLoggedIn} />
      <div className="agent-page__content">
        <div className="agent-page__header">
          <div>
            <h2>업무량/모니터링</h2>
            <p>작업 큐 현황을 확인하고 스케줄 작업을 등록합니다.</p>
          </div>
        </div>

        {error && (
          <div className="agent-alert agent-alert--error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="agent-panel">
          <h3>작업 생성</h3>
          <form className="agent-form" onSubmit={handleSubmit}>
            <label>
              작업 Payload (JSON)
              <textarea name="payload" value={formData.payload} onChange={handleChange} rows={4} />
            </label>
            <label>
              우선순위
              <input type="number" name="priority" value={formData.priority} onChange={handleChange} />
            </label>
            <label>
              예약 실행 시각
              <input type="datetime-local" name="scheduledAt" value={formData.scheduledAt} onChange={handleChange} />
            </label>
            <label>
              지정 에이전트 ID
              <input type="number" name="assignedAgentId" value={formData.assignedAgentId} onChange={handleChange} />
            </label>
            <div className="agent-form__actions">
              <button type="submit" className="agent-primary">
                <Save size={16} />
                작업 등록
              </button>
            </div>
          </form>
        </div>

        <div className="agent-panel">
          <h3>작업 큐 현황</h3>
          <div className="agent-table">
            <table>
              <thead>
                <tr>
                  <th>작업 ID</th>
                  <th>상태</th>
                  <th>우선순위</th>
                  <th>지정 에이전트</th>
                  <th>생성 시각</th>
                  <th>예약 시각</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="agent-empty">등록된 작업이 없습니다.</td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.job_id || job.JOB_ID}>
                      <td>{job.job_id || job.JOB_ID}</td>
                      <td>{job.status || job.STATUS}</td>
                      <td>{job.priority ?? job.PRIORITY}</td>
                      <td>{job.assigned_agent_id || job.ASSIGNED_AGENT_ID || '-'}</td>
                      <td>{job.created_at || job.CREATED_AT}</td>
                      <td>{job.scheduled_at || job.SCHEDULED_AT || '-'}</td>
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

export default AgentMonitoringPage;
