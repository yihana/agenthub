import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import TagPill from '../../components/portal-dashboard/TagPill';

type TaskStatus = 'SUCCESS' | 'FAILED' | 'ERROR' | 'RUNNING';

interface TaskRecord {
  id: string;
  agentName: string;
  taskName: string;
  businessType: string;
  status: TaskStatus;
  receivedAt: string;
  processingTimeSec: number;
  queueTimeSec: number;
  tokenCost: number;
  baselineMinutes: number;
  humanMinutes: number;
  laborHourlyCost: number;
}

const statusToneMap: Record<TaskStatus, 'success' | 'warning' | 'neutral'> = {
  SUCCESS: 'success',
  FAILED: 'warning',
  ERROR: 'warning',
  RUNNING: 'neutral'
};

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const formatNumber = (value: number) => numberFormatter.format(value);
const formatMinutes = (value: number) => `${formatNumber(value)}분`;
const formatCost = (value: number) => formatNumber(value);
const formatPercent = (value: number) => `${formatNumber(value)}%`;

const toTaskStatus = (value: string): TaskStatus => {
  const normalized = value.toUpperCase();
  if (normalized === 'COMPLETED' || normalized === 'SUCCESS') return 'SUCCESS';
  if (normalized === 'FAILED') return 'FAILED';
  if (normalized === 'ERROR') return 'ERROR';
  return 'RUNNING';
};

const toDateTime = (value: string | null | undefined) => {
  if (!value) return '';
  return String(value).replace('T', ' ').slice(0, 19);
};

const PortalTaskManagementPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | '전체'>('전체');
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const agentFilter = searchParams.get('agent');
  const normalizedAgentFilter = agentFilter?.trim().toLowerCase();

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const response = await fetch('/api/portal-dashboard/tasks?limit=500');
        if (!response.ok) {
          throw new Error('failed');
        }
        const data = await response.json();
        const rows = Array.isArray(data?.rows) ? data.rows : [];
        const mapped: TaskRecord[] = rows.map((row: any) => {
          const startedAt = row.started_at || row.STARTED_AT;
          const finishedAt = row.finished_at || row.FINISHED_AT;
          const receivedAt = row.received_at || row.RECEIVED_AT;
          const processingTimeSec = startedAt && finishedAt
            ? Math.max(0, (new Date(finishedAt).getTime() - new Date(startedAt).getTime()) / 1000)
            : 0;
          const queueTimeSec = startedAt && receivedAt
            ? Math.max(0, (new Date(startedAt).getTime() - new Date(receivedAt).getTime()) / 1000)
            : 0;

          return {
            id: String(row.job_id || row.JOB_ID || row.id || row.ID || ''),
            agentName: String(row.agent_name || row.AGENT_NAME || 'Unknown Agent'),
            taskName: String(row.job_id || row.JOB_ID || 'Task'),
            businessType: String(row.business_type || row.BUSINESS_TYPE || 'COMMON'),
            status: toTaskStatus(String(row.status || row.STATUS || 'running')),
            receivedAt: toDateTime(receivedAt),
            processingTimeSec,
            queueTimeSec,
            tokenCost: 0,
            baselineMinutes: Number(row.baseline_minutes || row.BASELINE_MINUTES || 0),
            humanMinutes: 0,
            laborHourlyCost: Number(row.labor_hourly_cost || row.LABOR_HOURLY_COST || 0)
          };
        });

        setTasks(mapped);
      } catch (error) {
        console.error('Failed to load tasks:', error);
        setTasks([]);
      }
    };

    loadTasks();
  }, []);

  const taskRows = useMemo(() => {
    return tasks.map((task) => {
      const agentMinutes = task.processingTimeSec / 60;
      const totalAgentMinutes = agentMinutes + task.humanMinutes;
      const savedMinutes = Math.max(0, task.baselineMinutes - totalAgentMinutes);
      const savedCost = (savedMinutes / 60) * task.laborHourlyCost;
      const agentCost = task.tokenCost;
      const roiRatio = agentCost > 0 ? ((savedCost - agentCost) / agentCost) * 100 : 0;
      const fteEquivalent = savedMinutes / 9600;

      return {
        ...task,
        agentMinutes,
        savedMinutes,
        savedCost,
        roiRatio,
        fteEquivalent
      };
    });
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return taskRows.filter((task) => {
      const matchesSearch = task.taskName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === '전체' || task.status === statusFilter;
      const matchesAgent = normalizedAgentFilter
        ? task.agentName.toLowerCase() === normalizedAgentFilter
        : true;
      return matchesSearch && matchesStatus && matchesAgent;
    });
  }, [normalizedAgentFilter, search, statusFilter, taskRows]);

  const totals = useMemo(() => {
    return filteredTasks.reduce(
      (acc, task) => {
        acc.savedMinutes += task.savedMinutes;
        acc.savedCost += task.savedCost;
        acc.tokenCost += task.tokenCost;
        acc.fte += task.fteEquivalent;
        return acc;
      },
      { savedMinutes: 0, savedCost: 0, tokenCost: 0, fte: 0 }
    );
  }, [filteredTasks]);

  return (
    <PortalDashboardLayout
      title="태스크 관리"
      subtitle="Task 단위 생산성/ROI를 추적하고 FTE 환산 지표를 확인합니다."
      actions={<button className="ear-primary">태스크 리포트 생성</button>}
    >
      {agentFilter && (
        <section className="ear-card">
          <div className="ear-card__header">
            <div>
              <h3>에이전트 필터 적용됨</h3>
              <p>{agentFilter} 기준으로 태스크를 표시합니다.</p>
            </div>
            <div className="ear-card__actions">
              <button
                type="button"
                className="ear-secondary"
                onClick={() => {
                  const nextParams = new URLSearchParams(searchParams);
                  nextParams.delete('agent');
                  setSearchParams(nextParams);
                }}
              >
                필터 해제
              </button>
              <button
                type="button"
                className="ear-ghost"
                onClick={() => navigate('/portal-agents')}
              >
                에이전트 화면으로 이동
              </button>
            </div>
          </div>
        </section>
      )}
      <section className="ear-card ear-card--large">
        <div className="ear-card__header">
          <div>
            <h3>Task 요약</h3>
            <p>백엔드 task 데이터 집계 기준</p>
          </div>
        </div>
        <div className="ear-stat-grid">
          <div className="ear-stat">
            <span>절감 시간</span>
            <strong>{formatMinutes(totals.savedMinutes)}</strong>
          </div>
          <div className="ear-stat">
            <span>절감 비용</span>
            <strong>{formatCost(totals.savedCost)}</strong>
          </div>
          <div className="ear-stat">
            <span>Token Cost</span>
            <strong>{formatCost(totals.tokenCost)}</strong>
          </div>
          <div className="ear-stat">
            <span>FTE 환산</span>
            <strong>{formatNumber(totals.fte)}</strong>
          </div>
        </div>
      </section>

      <section className="ear-card ear-card--large">
        <div className="ear-card__header">
          <div>
            <h3>Task 목록</h3>
            <p>총 {filteredTasks.length}건</p>
          </div>
          <div className="ear-card__actions">
            <label className="ear-input">
              <input
                type="text"
                placeholder="Task 이름 검색"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <label className="ear-select">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TaskStatus | '전체')}>
                <option value="전체">전체</option>
                <option value="SUCCESS">SUCCESS</option>
                <option value="FAILED">FAILED</option>
                <option value="ERROR">ERROR</option>
                <option value="RUNNING">RUNNING</option>
              </select>
            </label>
          </div>
        </div>
        <div className="ear-table-wrapper">
          <table className="ear-table">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Agent</th>
                <th>업무유형</th>
                <th>상태</th>
                <th>수신시각</th>
                <th>처리시간(초)</th>
                <th>Queue(초)</th>
                <th>절감시간(분)</th>
                <th>절감비용</th>
                <th>ROI</th>
                <th>FTE</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.id}</td>
                  <td>{task.agentName}</td>
                  <td>{task.businessType}</td>
                  <td>
                    <TagPill tone={statusToneMap[task.status]}>{task.status}</TagPill>
                  </td>
                  <td>{task.receivedAt}</td>
                  <td>{formatNumber(task.processingTimeSec)}</td>
                  <td>{formatNumber(task.queueTimeSec)}</td>
                  <td>{formatNumber(task.savedMinutes)}</td>
                  <td>{formatCost(task.savedCost)}</td>
                  <td>{formatPercent(task.roiRatio)}</td>
                  <td>{formatNumber(task.fteEquivalent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PortalDashboardLayout>
  );
};

export default PortalTaskManagementPage;
