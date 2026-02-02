import React, { useMemo, useState } from 'react';
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
  inputTokens: number;
  outputTokens: number;
  tokenCost: number;
  baselineMinutes: number;
  humanMinutes: number;
  laborHourlyCost: number;
}

const sampleTasks: TaskRecord[] = [
  {
    id: 'TASK-1001',
    agentName: 'OrderBot',
    taskName: '주문 검증',
    businessType: 'commerce',
    status: 'SUCCESS',
    receivedAt: '2026-01-15 08:00:00',
    processingTimeSec: 18,
    queueTimeSec: 5,
    inputTokens: 400,
    outputTokens: 220,
    tokenCost: 0.12,
    baselineMinutes: 12,
    humanMinutes: 1.2,
    laborHourlyCost: 45000
  },
  {
    id: 'TASK-1002',
    agentName: 'OrderBot',
    taskName: '결제 이슈 대응',
    businessType: 'commerce',
    status: 'FAILED',
    receivedAt: '2026-01-15 09:10:00',
    processingTimeSec: 8,
    queueTimeSec: 4,
    inputTokens: 320,
    outputTokens: 180,
    tokenCost: 0.08,
    baselineMinutes: 15,
    humanMinutes: 6.5,
    laborHourlyCost: 45000
  },
  {
    id: 'TASK-2001',
    agentName: 'SupportGPT',
    taskName: 'CS 응답 요약',
    businessType: 'support',
    status: 'SUCCESS',
    receivedAt: '2026-01-17 11:00:00',
    processingTimeSec: 64,
    queueTimeSec: 12,
    inputTokens: 900,
    outputTokens: 520,
    tokenCost: 0.18,
    baselineMinutes: 20,
    humanMinutes: 2.1,
    laborHourlyCost: 52000
  },
  {
    id: 'TASK-2002',
    agentName: 'SupportGPT',
    taskName: 'VOC 분류',
    businessType: 'support',
    status: 'ERROR',
    receivedAt: '2026-01-18 12:30:00',
    processingTimeSec: 5,
    queueTimeSec: 10,
    inputTokens: 620,
    outputTokens: 410,
    tokenCost: 0.14,
    baselineMinutes: 18,
    humanMinutes: 4.4,
    laborHourlyCost: 52000
  },
  {
    id: 'TASK-3001',
    agentName: 'PricingAI',
    taskName: '가격 시뮬레이션',
    businessType: 'analytics',
    status: 'SUCCESS',
    receivedAt: '2026-01-19 13:00:00',
    processingTimeSec: 12,
    queueTimeSec: 6,
    inputTokens: 280,
    outputTokens: 150,
    tokenCost: 0.06,
    baselineMinutes: 25,
    humanMinutes: 0.8,
    laborHourlyCost: 60000
  }
];

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

const PortalTaskManagementPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | '전체'>('전체');

  const taskRows = useMemo(() => {
    return sampleTasks.map((task) => {
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
  }, []);

  const filteredTasks = useMemo(() => {
    return taskRows.filter((task) => {
      const matchesSearch = task.taskName.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === '전체' || task.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter, taskRows]);

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
      <section className="ear-card ear-card--large">
        <div className="ear-card__header">
          <div>
            <h3>Task 요약</h3>
            <p>2026-01-15 ~ 2026-01-21 기준 샘플 데이터</p>
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
        <table className="ear-table">
          <thead>
            <tr>
              <th>Task ID</th>
              <th>에이전트</th>
              <th>Task</th>
              <th>Status</th>
              <th>처리 시간</th>
              <th>Queue</th>
              <th>Token Cost</th>
              <th>절감 시간</th>
              <th>절감 비용</th>
              <th>ROI</th>
              <th>FTE</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => (
              <tr key={task.id}>
                <td>{task.id}</td>
                <td>
                  <strong>{task.agentName}</strong>
                  <span className="ear-muted">{task.businessType}</span>
                </td>
                <td>{task.taskName}</td>
                <td>
                  <TagPill label={task.status} tone={statusToneMap[task.status]} />
                </td>
                <td>{formatMinutes(task.agentMinutes)}</td>
                <td>{formatMinutes(task.queueTimeSec / 60)}</td>
                <td>{formatCost(task.tokenCost)}</td>
                <td>{formatMinutes(task.savedMinutes)}</td>
                <td>{formatCost(task.savedCost)}</td>
                <td>{formatPercent(task.roiRatio)}</td>
                <td>{formatNumber(task.fteEquivalent)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </PortalDashboardLayout>
  );
};

export default PortalTaskManagementPage;
