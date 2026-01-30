import React, { useMemo, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import TagPill from '../../components/portal-dashboard/TagPill';

interface AgentRecord {
  id: string;
  name: string;
  owner: string;
  status: '운영' | '점검' | '보류';
  category: string;
  risk: '낮음' | '중간' | '높음';
  lastUpdated: string;
}

interface AgentTaskRecord {
  id: number;
  agentId: number;
  jobId: string;
  status: string;
  receivedAt: string;
  startedAt: string;
  finishedAt: string;
}

interface AgentMetricRecord {
  id: number;
  agentId: number;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  cpuUsage: number;
  memoryUsage: number;
  requestsProcessed: number;
  avgLatency: number;
  errorRate: number;
  queueTime: number;
  inputTokenUsage: number;
  outputTokenUsage: number;
  totalTokenUsage: number;
  tokenCost: number;
  activeUsers: number;
  totalUsers: number;
  positiveFeedback: number;
  totalFeedback: number;
  retriesPerRequest: number;
  avgTimeToFirstToken: number;
  refusalRate: number;
  avgResponseTime: number;
  humanIntervention: number;
}

interface AgentInfraCostRecord {
  id: number;
  agentId: number;
  monthlyCost: number;
  createdAt: string;
  updatedAt: string | null;
}

interface AgentLifecycleEvent {
  id: number;
  agentId: number;
  eventType: string;
  eventTime: string;
  previousState: string;
  newState: string;
  description: string;
}

interface AgentDetailRecord {
  id: number;
  agentName: string;
  type: string;
  businessType: string;
  status: string;
  registeredAt: string;
  updatedAt: string;
  tasks: AgentTaskRecord[];
  metrics: AgentMetricRecord[];
  infraCosts: AgentInfraCostRecord[];
  lifecycleEvents: AgentLifecycleEvent[];
}

interface AgentPerformanceSummary {
  agentId: number;
  agentName: string;
  tasksTotal: number;
  successfulTasks: number;
  successRatePct: number;
  tokenCost: number;
  infraCostProrated: number;
  totalCost: number;
}

const STORAGE_KEY = 'portal-agent-list';
const ANALYSIS_RANGE = {
  start: '2026-01-15 00:00:00',
  end: '2026-01-21 23:59:59'
};
const PRORATION_DAYS = 35.5;

const baseAgentDetails: AgentDetailRecord[] = [
  {
    id: 1,
    agentName: 'OrderBot',
    type: 'system',
    businessType: 'commerce',
    status: 'ACTIVE',
    registeredAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    tasks: [
      {
        id: 101,
        agentId: 1,
        jobId: 'J-1001',
        status: 'COMPLETED',
        receivedAt: '2026-01-15 08:00:00',
        startedAt: '2026-01-15 08:00:05',
        finishedAt: '2026-01-15 08:00:20'
      },
      {
        id: 102,
        agentId: 1,
        jobId: 'J-1002',
        status: 'FAILED',
        receivedAt: '2026-01-15 09:10:00',
        startedAt: '2026-01-15 09:10:02',
        finishedAt: '2026-01-15 09:10:10'
      },
      {
        id: 103,
        agentId: 1,
        jobId: 'J-1003',
        status: 'COMPLETED',
        receivedAt: '2026-01-16 10:00:00',
        startedAt: '2026-01-16 10:00:03',
        finishedAt: '2026-01-16 10:00:30'
      }
    ],
    metrics: [
      {
        id: 1,
        agentId: 1,
        startTime: '2026-01-15 08:00:00',
        endTime: '2026-01-15 10:00:00',
        durationSeconds: 7200,
        cpuUsage: 0.45,
        memoryUsage: 0.6,
        requestsProcessed: 30,
        avgLatency: 0.35,
        errorRate: 0.067,
        queueTime: 0.05,
        inputTokenUsage: 12000,
        outputTokenUsage: 9000,
        totalTokenUsage: 21000,
        tokenCost: 0.21,
        activeUsers: 20,
        totalUsers: 50,
        positiveFeedback: 30,
        totalFeedback: 35,
        retriesPerRequest: 0,
        avgTimeToFirstToken: 0.12,
        refusalRate: 0.01,
        avgResponseTime: 0.42,
        humanIntervention: 0.05
      },
      {
        id: 2,
        agentId: 1,
        startTime: '2026-01-16 10:00:00',
        endTime: '2026-01-16 12:00:00',
        durationSeconds: 7200,
        cpuUsage: 0.4,
        memoryUsage: 0.55,
        requestsProcessed: 25,
        avgLatency: 0.3,
        errorRate: 0.04,
        queueTime: 0.04,
        inputTokenUsage: 10000,
        outputTokenUsage: 8500,
        totalTokenUsage: 18500,
        tokenCost: 0.185,
        activeUsers: 18,
        totalUsers: 45,
        positiveFeedback: 28,
        totalFeedback: 32,
        retriesPerRequest: 0,
        avgTimeToFirstToken: 0.11,
        refusalRate: 0.005,
        avgResponseTime: 0.38,
        humanIntervention: 0.04
      }
    ],
    infraCosts: [
      {
        id: 1,
        agentId: 1,
        monthlyCost: 120,
        createdAt: '2025-12-01 00:00:00',
        updatedAt: null
      }
    ],
    lifecycleEvents: [
      {
        id: 11,
        agentId: 1,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-15 08:00:00',
        previousState: 'STARTING',
        newState: 'RUNNING',
        description: 'started'
      },
      {
        id: 12,
        agentId: 1,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-15 09:30:00',
        previousState: 'RUNNING',
        newState: 'ERROR',
        description: 'transient error'
      },
      {
        id: 13,
        agentId: 1,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-15 09:45:00',
        previousState: 'ERROR',
        newState: 'RUNNING',
        description: 'recovered'
      }
    ]
  },
  {
    id: 2,
    agentName: 'SupportGPT',
    type: 'assistant',
    businessType: 'support',
    status: 'ACTIVE',
    registeredAt: '2026-01-02 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    tasks: [
      {
        id: 104,
        agentId: 2,
        jobId: 'J-2001',
        status: 'COMPLETED',
        receivedAt: '2026-01-17 11:00:00',
        startedAt: '2026-01-17 11:00:04',
        finishedAt: '2026-01-17 11:01:04'
      },
      {
        id: 105,
        agentId: 2,
        jobId: 'J-2002',
        status: 'COMPLETED',
        receivedAt: '2026-01-18 12:00:00',
        startedAt: '2026-01-18 12:00:01',
        finishedAt: '2026-01-18 12:00:20'
      },
      {
        id: 106,
        agentId: 2,
        jobId: 'J-2003',
        status: 'ERROR',
        receivedAt: '2026-01-18 12:30:00',
        startedAt: '2026-01-18 12:30:01',
        finishedAt: '2026-01-18 12:30:05'
      }
    ],
    metrics: [
      {
        id: 3,
        agentId: 2,
        startTime: '2026-01-17 11:00:00',
        endTime: '2026-01-17 13:00:00',
        durationSeconds: 7200,
        cpuUsage: 0.55,
        memoryUsage: 0.65,
        requestsProcessed: 40,
        avgLatency: 0.6,
        errorRate: 0.025,
        queueTime: 0.08,
        inputTokenUsage: 18000,
        outputTokenUsage: 12000,
        totalTokenUsage: 30000,
        tokenCost: 0.3,
        activeUsers: 35,
        totalUsers: 60,
        positiveFeedback: 42,
        totalFeedback: 50,
        retriesPerRequest: 1,
        avgTimeToFirstToken: 0.14,
        refusalRate: 0,
        avgResponseTime: 0.9,
        humanIntervention: 0.03
      },
      {
        id: 4,
        agentId: 2,
        startTime: '2026-01-18 12:00:00',
        endTime: '2026-01-18 14:00:00',
        durationSeconds: 7200,
        cpuUsage: 0.5,
        memoryUsage: 0.62,
        requestsProcessed: 35,
        avgLatency: 0.55,
        errorRate: 0.057,
        queueTime: 0.06,
        inputTokenUsage: 16000,
        outputTokenUsage: 11000,
        totalTokenUsage: 27000,
        tokenCost: 0.27,
        activeUsers: 30,
        totalUsers: 55,
        positiveFeedback: 38,
        totalFeedback: 48,
        retriesPerRequest: 1,
        avgTimeToFirstToken: 0.13,
        refusalRate: 0.01,
        avgResponseTime: 0.82,
        humanIntervention: 0.04
      }
    ],
    infraCosts: [
      {
        id: 2,
        agentId: 2,
        monthlyCost: 200,
        createdAt: '2025-12-01 00:00:00',
        updatedAt: null
      }
    ],
    lifecycleEvents: [
      {
        id: 21,
        agentId: 2,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-17 10:50:00',
        previousState: 'STARTING',
        newState: 'RUNNING',
        description: 'started'
      },
      {
        id: 22,
        agentId: 2,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-18 12:30:00',
        previousState: 'RUNNING',
        newState: 'DEGRADED',
        description: 'rate limits'
      },
      {
        id: 23,
        agentId: 2,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-18 12:50:00',
        previousState: 'DEGRADED',
        newState: 'RUNNING',
        description: 'recovered'
      }
    ]
  },
  {
    id: 3,
    agentName: 'PricingAI',
    type: 'service',
    businessType: 'analytics',
    status: 'ACTIVE',
    registeredAt: '2026-01-05 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    tasks: [
      {
        id: 107,
        agentId: 3,
        jobId: 'J-3001',
        status: 'COMPLETED',
        receivedAt: '2026-01-19 13:00:00',
        startedAt: '2026-01-19 13:00:02',
        finishedAt: '2026-01-19 13:00:07'
      }
    ],
    metrics: [
      {
        id: 5,
        agentId: 3,
        startTime: '2026-01-19 13:00:00',
        endTime: '2026-01-19 15:00:00',
        durationSeconds: 7200,
        cpuUsage: 0.35,
        memoryUsage: 0.45,
        requestsProcessed: 15,
        avgLatency: 0.25,
        errorRate: 0,
        queueTime: 0.03,
        inputTokenUsage: 6000,
        outputTokenUsage: 4500,
        totalTokenUsage: 10500,
        tokenCost: 0.105,
        activeUsers: 10,
        totalUsers: 20,
        positiveFeedback: 15,
        totalFeedback: 17,
        retriesPerRequest: 0,
        avgTimeToFirstToken: 0.09,
        refusalRate: 0,
        avgResponseTime: 0.3,
        humanIntervention: 0.02
      }
    ],
    infraCosts: [
      {
        id: 3,
        agentId: 3,
        monthlyCost: 80,
        createdAt: '2025-12-01 00:00:00',
        updatedAt: null
      }
    ],
    lifecycleEvents: [
      {
        id: 31,
        agentId: 3,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-19 12:55:00',
        previousState: 'STARTING',
        newState: 'RUNNING',
        description: 'started'
      }
    ]
  }
];

const parseDate = (value: string) => new Date(value.replace(' ', 'T'));

const isWithinRange = (value: string, start: string, end: string) => {
  const target = parseDate(value).getTime();
  return target >= parseDate(start).getTime() && target <= parseDate(end).getTime();
};

const calculatePerformanceSummary = (
  agentDetails: AgentDetailRecord[],
  range: { start: string; end: string }
): AgentPerformanceSummary[] => {
  const rangeDays = Math.max(
    1,
    Math.round(
      (parseDate(range.end).getTime() - parseDate(range.start).getTime()) / (1000 * 60 * 60 * 24)
    ) + 1
  );

  return agentDetails.map((agent) => {
    const tasksInRange = agent.tasks.filter((task) => isWithinRange(task.receivedAt, range.start, range.end));
    const successfulTasks = tasksInRange.filter((task) => task.status === 'COMPLETED').length;
    const metricsInRange = agent.metrics.filter((metric) => isWithinRange(metric.startTime, range.start, range.end));
    const tokenCost = metricsInRange.reduce((sum, metric) => sum + metric.tokenCost, 0);
    const infraCost = agent.infraCosts[0]?.monthlyCost ?? 0;
    const infraCostProrated = infraCost > 0 ? (infraCost / PRORATION_DAYS) * rangeDays : 0;
    const totalCost = tokenCost + infraCostProrated;
    const successRatePct = tasksInRange.length > 0 ? (successfulTasks / tasksInRange.length) * 100 : 0;

    return {
      agentId: agent.id,
      agentName: agent.agentName,
      tasksTotal: tasksInRange.length,
      successfulTasks,
      successRatePct,
      tokenCost,
      infraCostProrated,
      totalCost
    };
  });
};

const baseAgentDetailByName = new Map(
  baseAgentDetails.map((agent) => [agent.agentName, agent])
);

const hashString = (value: string) =>
  value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const buildGeneratedDetail = (agent: AgentRecord): AgentDetailRecord => {
  const seed = hashString(agent.id);
  const agentId = Number.isFinite(Number(agent.id)) ? Number(agent.id) : seed % 1000;
  const taskCount = clamp((seed % 3) + 2, 2, 4);
  const taskBaseHour = 8 + (seed % 5);
  const tasks: AgentTaskRecord[] = Array.from({ length: taskCount }).map((_, index) => {
    const dayOffset = index % 5;
    const startMinute = (seed + index * 7) % 50;
    const receivedAt = `2026-01-${15 + dayOffset} ${String(taskBaseHour).padStart(2, '0')}:${String(
      startMinute
    ).padStart(2, '0')}:00`;
    const startedAt = `2026-01-${15 + dayOffset} ${String(taskBaseHour).padStart(2, '0')}:${String(
      startMinute + 1
    ).padStart(2, '0')}:02`;
    const finishedAt = `2026-01-${15 + dayOffset} ${String(taskBaseHour).padStart(2, '0')}:${String(
      startMinute + 4
    ).padStart(2, '0')}:20`;
    const status = index === taskCount - 1 && seed % 2 === 0 ? 'FAILED' : 'COMPLETED';

    return {
      id: agentId * 100 + index + 1,
      agentId,
      jobId: `J-${agentId}${index + 1}`.padEnd(6, '0'),
      status,
      receivedAt,
      startedAt,
      finishedAt
    };
  });

  const metrics: AgentMetricRecord[] = Array.from({ length: 2 }).map((_, index) => {
    const startTime = `2026-01-${15 + index * 2} ${String(8 + index).padStart(2, '0')}:00:00`;
    const endTime = `2026-01-${15 + index * 2} ${String(10 + index).padStart(2, '0')}:00:00`;
    const requestsProcessed = 20 + ((seed + index) % 15);
    const avgLatency = Number((0.25 + ((seed % 15) / 100)).toFixed(3));
    const errorRate = Number(((seed % 7) / 100).toFixed(3));
    const totalTokenUsage = 10000 + index * 2000 + (seed % 4000);
    const tokenCost = Number((totalTokenUsage / 100000).toFixed(3));

    return {
      id: agentId * 10 + index + 1,
      agentId,
      startTime,
      endTime,
      durationSeconds: 7200,
      cpuUsage: Number((0.35 + (seed % 20) / 100).toFixed(2)),
      memoryUsage: Number((0.45 + (seed % 15) / 100).toFixed(2)),
      requestsProcessed,
      avgLatency,
      errorRate,
      queueTime: Number((0.03 + (seed % 8) / 100).toFixed(3)),
      inputTokenUsage: Math.round(totalTokenUsage * 0.55),
      outputTokenUsage: Math.round(totalTokenUsage * 0.45),
      totalTokenUsage,
      tokenCost,
      activeUsers: 10 + (seed % 15),
      totalUsers: 25 + (seed % 30),
      positiveFeedback: 10 + (seed % 20),
      totalFeedback: 15 + (seed % 25),
      retriesPerRequest: seed % 2,
      avgTimeToFirstToken: Number((0.1 + (seed % 5) / 100).toFixed(3)),
      refusalRate: Number(((seed % 3) / 100).toFixed(3)),
      avgResponseTime: Number((0.3 + (seed % 10) / 100).toFixed(3)),
      humanIntervention: Number((0.02 + (seed % 4) / 100).toFixed(3))
    };
  });

  return {
    id: agentId,
    agentName: agent.name,
    type: agent.category,
    businessType: agent.category,
    status: agent.status,
    registeredAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    tasks,
    metrics,
    infraCosts: [
      {
        id: agentId,
        agentId,
        monthlyCost: 90 + (seed % 120),
        createdAt: '2025-12-01 00:00:00',
        updatedAt: null
      }
    ],
    lifecycleEvents: [
      {
        id: agentId * 10 + 1,
        agentId,
        eventType: 'STATE_CHANGE',
        eventTime: '2026-01-15 08:00:00',
        previousState: 'STARTING',
        newState: 'RUNNING',
        description: 'started'
      }
    ]
  };
};

const defaultAgents: AgentRecord[] = baseAgentDetails.map((agent, index) => ({
  id: String(agent.id),
  name: agent.agentName,
  owner: agent.businessType === 'commerce' ? '커머스팀' : agent.businessType === 'support' ? '지원팀' : '데이터팀',
  status: '운영',
  category: agent.businessType,
  risk: index === 1 ? '중간' : '낮음',
  lastUpdated: agent.updatedAt.slice(0, 10)
}));

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

const formatPercent = (value: number) => `${numberFormatter.format(value)}%`;
const formatNumber = (value: number) => numberFormatter.format(value);
const formatCost = (value: number) => numberFormatter.format(value);

const statusToneMap: Record<AgentRecord['status'], 'success' | 'warning' | 'neutral'> = {
  운영: 'success',
  점검: 'warning',
  보류: 'neutral'
};

const riskToneMap: Record<AgentRecord['risk'], 'success' | 'warning' | 'neutral'> = {
  낮음: 'success',
  중간: 'warning',
  높음: 'neutral'
};

const loadAgents = () => {
  if (typeof window === 'undefined') {
    return defaultAgents;
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return defaultAgents;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return defaultAgents;
    }
    return parsed as AgentRecord[];
  } catch {
    return defaultAgents;
  }
};

const PortalAgentListPage: React.FC = () => {
  const [agents, setAgents] = useState<AgentRecord[]>(() => loadAgents());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [riskFilter, setRiskFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => defaultAgents[0]?.id ?? '');
  const [selectedDetailTab, setSelectedDetailTab] = useState<'overview' | 'tasks' | 'metrics' | 'costs'>('overview');
  const [formValues, setFormValues] = useState({
    name: '',
    owner: '',
    category: '재무',
    status: '운영' as AgentRecord['status'],
    risk: '낮음' as AgentRecord['risk']
  });

  const persistAgents = (updater: (prev: AgentRecord[]) => AgentRecord[]) => {
    setAgents((prev) => {
      const nextAgents = updater(prev);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAgents));
      }
      return nextAgents;
    });
  };

  const filteredAgents = useMemo(() => {
    return agents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === '전체' || agent.status === statusFilter;
      const matchesRisk = riskFilter === '전체' || agent.risk === riskFilter;
      const matchesCategory = categoryFilter === '전체' || agent.category === categoryFilter;
      return matchesSearch && matchesStatus && matchesRisk && matchesCategory;
    });
  }, [agents, categoryFilter, riskFilter, search, statusFilter]);

  const handleFormChange = (field: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddAgent = (event: React.FormEvent) => {
    event.preventDefault();

    if (!formValues.name.trim() || !formValues.owner.trim()) {
      window.alert('에이전트 이름과 담당 조직을 입력해 주세요.');
      return;
    }

    const nextAgent: AgentRecord = {
      id: `PORTAL-${Date.now().toString().slice(-4)}`,
      name: formValues.name.trim(),
      owner: formValues.owner.trim(),
      status: formValues.status,
      category: formValues.category,
      risk: formValues.risk,
      lastUpdated: new Date().toISOString().slice(0, 10)
    };

    persistAgents((prev) => [nextAgent, ...prev]);
    setFormValues((prev) => ({
      ...prev,
      name: '',
      owner: ''
    }));
  };

  const agentDetails = useMemo(() => {
    return agents.map((agent) => {
      const baseDetail = baseAgentDetailByName.get(agent.name);
      if (baseDetail) {
        return {
          ...baseDetail,
          id: Number(agent.id) || baseDetail.id,
          agentName: agent.name,
          businessType: agent.category,
          status: agent.status,
          updatedAt: agent.lastUpdated ? `${agent.lastUpdated} 09:00:00` : baseDetail.updatedAt
        };
      }
      return buildGeneratedDetail(agent);
    });
  }, [agents]);

  const performanceSummary = useMemo(
    () => calculatePerformanceSummary(agentDetails, ANALYSIS_RANGE),
    [agentDetails]
  );

  const selectedAgent = agentDetails.find((agent) => String(agent.id) === selectedAgentId);
  const selectedSummary = performanceSummary.find((summary) => String(summary.agentId) === selectedAgentId);
  const tasksInRange = selectedAgent
    ? selectedAgent.tasks.filter((task) => isWithinRange(task.receivedAt, ANALYSIS_RANGE.start, ANALYSIS_RANGE.end))
    : [];
  const metricsInRange = selectedAgent
    ? selectedAgent.metrics.filter((metric) => isWithinRange(metric.startTime, ANALYSIS_RANGE.start, ANALYSIS_RANGE.end))
    : [];
  const totalTokenCost = metricsInRange.reduce((sum, metric) => sum + metric.tokenCost, 0);
  const totalTokenUsage = metricsInRange.reduce((sum, metric) => sum + metric.totalTokenUsage, 0);
  const avgLatency = metricsInRange.length
    ? metricsInRange.reduce((sum, metric) => sum + metric.avgLatency, 0) / metricsInRange.length
    : 0;
  const avgTimeToFirstToken = metricsInRange.length
    ? metricsInRange.reduce((sum, metric) => sum + metric.avgTimeToFirstToken, 0) / metricsInRange.length
    : 0;
  const avgErrorRate = metricsInRange.length
    ? metricsInRange.reduce((sum, metric) => sum + metric.errorRate, 0) / metricsInRange.length
    : 0;

  const taskMetricById = new Map(
    tasksInRange.map((task) => {
      const durationSeconds = task.startedAt && task.finishedAt
        ? Math.max(0, (parseDate(task.finishedAt).getTime() - parseDate(task.startedAt).getTime()) / 1000)
        : 0;
      const perTaskTokenCost = tasksInRange.length > 0 ? totalTokenCost / tasksInRange.length : 0;
      const perTaskTokenUsage = tasksInRange.length > 0 ? totalTokenUsage / tasksInRange.length : 0;

      return [
        task.id,
        {
          durationSeconds,
          perTaskTokenCost,
          perTaskTokenUsage,
          avgLatency,
          avgTimeToFirstToken,
          avgErrorRate
        }
      ];
    })
  );

  return (
    <PortalDashboardLayout
      title="에이전트 목록"
      subtitle="운영 중인 에이전트를 상태와 리스크 기준으로 필터링합니다."
      actions={<button className="ear-primary">에이전트 등록</button>}
    >
      <div className="ear-grid ear-grid--sidebar">
        <aside className="ear-filter">
          <h3>필터</h3>
          <label>
            검색
            <input
              type="text"
              placeholder="에이전트 이름 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            상태
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="전체">전체</option>
              <option value="운영">운영</option>
              <option value="점검">점검</option>
              <option value="보류">보류</option>
            </select>
          </label>
          <label>
            리스크
            <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="전체">전체</option>
              <option value="낮음">낮음</option>
              <option value="중간">중간</option>
              <option value="높음">높음</option>
            </select>
          </label>
          <label>
            유형
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="전체">전체</option>
              <option value="재무">재무</option>
              <option value="거버넌스">거버넌스</option>
              <option value="CS">CS</option>
              <option value="인사">인사</option>
            </select>
          </label>
          <button className="ear-secondary">필터 저장</button>
          <form className="ear-form" onSubmit={handleAddAgent}>
            <h3>에이전트 등록</h3>
            <label>
              에이전트 이름
              <input
                type="text"
                placeholder="예: Finance Insight"
                value={formValues.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
              />
            </label>
            <label>
              담당 조직
              <input
                type="text"
                placeholder="예: 재무팀"
                value={formValues.owner}
                onChange={(event) => handleFormChange('owner', event.target.value)}
              />
            </label>
            <label>
              상태
              <select
                value={formValues.status}
                onChange={(event) => handleFormChange('status', event.target.value)}
              >
                <option value="운영">운영</option>
                <option value="점검">점검</option>
                <option value="보류">보류</option>
              </select>
            </label>
            <label>
              리스크
              <select
                value={formValues.risk}
                onChange={(event) => handleFormChange('risk', event.target.value)}
              >
                <option value="낮음">낮음</option>
                <option value="중간">중간</option>
                <option value="높음">높음</option>
              </select>
            </label>
            <label>
              유형
              <select
                value={formValues.category}
                onChange={(event) => handleFormChange('category', event.target.value)}
              >
                <option value="재무">재무</option>
                <option value="거버넌스">거버넌스</option>
                <option value="CS">CS</option>
                <option value="인사">인사</option>
              </select>
            </label>
            <button type="submit" className="ear-primary">등록 저장</button>
          </form>
        </aside>

        <section className="ear-table-card">
          <div className="ear-table-card__header">
            <div>
              <h3>에이전트 목록</h3>
              <p>총 {filteredAgents.length}개 에이전트</p>
            </div>
            <div className="ear-table-card__actions">
              <button className="ear-ghost">CSV 내보내기</button>
              <button className="ear-secondary">정렬</button>
            </div>
          </div>
          <table className="ear-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>이름</th>
                <th>소유 조직</th>
                <th>상태</th>
                <th>리스크</th>
                <th>최근 업데이트</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => (
                <tr
                  key={agent.id}
                  className={agent.id === selectedAgentId ? 'ear-table__row ear-table__row--active' : 'ear-table__row'}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setSelectedDetailTab('overview');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setSelectedAgentId(agent.id);
                      setSelectedDetailTab('overview');
                    }
                  }}
                >
                  <td>{agent.id}</td>
                  <td>
                    <strong>{agent.name}</strong>
                    <span className="ear-muted">{agent.category}</span>
                  </td>
                  <td>{agent.owner}</td>
                  <td>
                    <TagPill label={agent.status} tone={statusToneMap[agent.status]} />
                  </td>
                  <td>
                    <TagPill label={agent.risk} tone={riskToneMap[agent.risk]} />
                  </td>
                  <td>{agent.lastUpdated}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedAgent && (
            <div className="ear-card ear-card--large">
              <div className="ear-card__header">
                <div>
                  <h3>{selectedAgent.agentName} 상세</h3>
                  <p>샘플 데이터 ({ANALYSIS_RANGE.start} ~ {ANALYSIS_RANGE.end}) 기준 요약</p>
                </div>
              </div>

              <div className="ear-tabs">
                <button
                  type="button"
                  className={`ear-tab ${selectedDetailTab === 'overview' ? 'ear-tab--active' : ''}`}
                  onClick={() => setSelectedDetailTab('overview')}
                >
                  요약
                </button>
                <button
                  type="button"
                  className={`ear-tab ${selectedDetailTab === 'tasks' ? 'ear-tab--active' : ''}`}
                  onClick={() => setSelectedDetailTab('tasks')}
                >
                  작업
                </button>
                <button
                  type="button"
                  className={`ear-tab ${selectedDetailTab === 'metrics' ? 'ear-tab--active' : ''}`}
                  onClick={() => setSelectedDetailTab('metrics')}
                >
                  메트릭
                </button>
                <button
                  type="button"
                  className={`ear-tab ${selectedDetailTab === 'costs' ? 'ear-tab--active' : ''}`}
                  onClick={() => setSelectedDetailTab('costs')}
                >
                  비용
                </button>
              </div>

              {selectedDetailTab === 'overview' && (
                <div className="ear-card__body">
                  <div className="ear-stat-grid">
                    <div className="ear-stat">
                      <span>등록일</span>
                      <strong>{selectedAgent.registeredAt}</strong>
                    </div>
                    <div className="ear-stat">
                      <span>최근 업데이트</span>
                      <strong>{selectedAgent.updatedAt}</strong>
                    </div>
                    <div className="ear-stat">
                      <span>업무 유형</span>
                      <strong>{selectedAgent.type}</strong>
                    </div>
                    <div className="ear-stat">
                      <span>비즈니스 타입</span>
                      <strong>{selectedAgent.businessType}</strong>
                    </div>
                  </div>

                  {selectedSummary && (
                    <table className="ear-table ear-table--compact">
                      <thead>
                        <tr>
                          <th>에이전트</th>
                          <th>작업 수</th>
                          <th>성공 작업</th>
                          <th>성공률</th>
                          <th>Token Cost Σ</th>
                          <th>Infra Cost (Prorated)</th>
                          <th>Total Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>{selectedSummary.agentName}</td>
                          <td>{selectedSummary.tasksTotal}</td>
                          <td>{selectedSummary.successfulTasks}</td>
                          <td>{formatPercent(selectedSummary.successRatePct)}</td>
                          <td>{formatCost(selectedSummary.tokenCost)}</td>
                          <td>{formatCost(selectedSummary.infraCostProrated)}</td>
                          <td>{formatCost(selectedSummary.totalCost)}</td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  <h4>사용자 관점 흐름</h4>
                  <div className="ear-list">
                    <div className="ear-list__row">
                      <strong>요청 접수</strong>
                      <span>사용자 요청 → EAR_REQUEST 생성</span>
                    </div>
                    <div className="ear-list__row">
                      <strong>대화 시작</strong>
                      <span>AGENT_CONVERSATIONS 생성 후 채팅 이력 기록</span>
                    </div>
                    <div className="ear-list__row">
                      <strong>작업 실행</strong>
                      <span>AGENT_TASKS/AGENT_METRICS에 Task·Metric 집계</span>
                    </div>
                    <div className="ear-list__row">
                      <strong>성과 확인</strong>
                      <span>Token/Infra 비용과 성공률을 성과 지표로 반영</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedDetailTab === 'tasks' && (
                <div className="ear-card__body">
                  <table className="ear-table ear-table--compact">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Job ID</th>
                        <th>Status</th>
                        <th>Received</th>
                        <th>Started</th>
                        <th>Finished</th>
                        <th>Duration (s)</th>
                        <th>Avg Latency</th>
                        <th>TTFT</th>
                        <th>Error Rate</th>
                        <th>Token Usage</th>
                        <th>Token Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksInRange.map((task) => {
                        const metrics = taskMetricById.get(task.id);
                        return (
                          <tr key={task.id}>
                          <td>{task.id}</td>
                          <td>{task.jobId}</td>
                          <td>{task.status}</td>
                          <td>{task.receivedAt}</td>
                          <td>{task.startedAt}</td>
                          <td>{task.finishedAt}</td>
                          <td>{metrics ? formatNumber(metrics.durationSeconds) : '-'}</td>
                          <td>{metrics ? formatNumber(metrics.avgLatency) : '-'}</td>
                          <td>{metrics ? formatNumber(metrics.avgTimeToFirstToken) : '-'}</td>
                          <td>{metrics ? formatPercent(metrics.avgErrorRate * 100) : '-'}</td>
                          <td>{metrics ? formatNumber(metrics.perTaskTokenUsage) : '-'}</td>
                          <td>{metrics ? formatCost(metrics.perTaskTokenCost) : '-'}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedDetailTab === 'metrics' && (
                <div className="ear-card__body">
                  <table className="ear-table ear-table--compact">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>기간</th>
                        <th>Requests</th>
                        <th>Latency (avg)</th>
                        <th>Error Rate</th>
                        <th>Queue Time</th>
                        <th>Token Usage</th>
                        <th>Token Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metricsInRange.map((metric) => (
                        <tr key={metric.id}>
                          <td>{metric.id}</td>
                          <td>{metric.startTime} ~ {metric.endTime}</td>
                          <td>{metric.requestsProcessed}</td>
                          <td>{formatNumber(metric.avgLatency)}</td>
                          <td>{formatPercent(metric.errorRate * 100)}</td>
                          <td>{formatNumber(metric.queueTime)}</td>
                          <td>{formatNumber(metric.totalTokenUsage)}</td>
                          <td>{formatCost(metric.tokenCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedDetailTab === 'costs' && (
                <div className="ear-card__body">
                  <table className="ear-table ear-table--compact">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>월 비용</th>
                        <th>시작일</th>
                        <th>종료일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgent.infraCosts.map((cost) => (
                        <tr key={cost.id}>
                          <td>{cost.id}</td>
                          <td>{formatCost(cost.monthlyCost)}</td>
                          <td>{cost.createdAt}</td>
                          <td>{cost.updatedAt ?? 'active'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>Lifecycle Events</h4>
                  <table className="ear-table ear-table--compact">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>시간</th>
                        <th>이전 상태</th>
                        <th>현재 상태</th>
                        <th>설명</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedAgent.lifecycleEvents.map((event) => (
                        <tr key={event.id}>
                          <td>{event.id}</td>
                          <td>{event.eventTime}</td>
                          <td>{event.previousState}</td>
                          <td>{event.newState}</td>
                          <td>{event.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalAgentListPage;
