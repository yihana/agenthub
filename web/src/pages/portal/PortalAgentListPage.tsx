import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  runtimeState: 'RUNNING' | 'DEGRADED' | 'IDLE' | 'ERROR';
  runtimeErrors: number;
  processId: string;
  capability: string;
  customerCount: number;
  calls30d: number;
}


interface AgentUsageEvent {
  id: number;
  agentId: string;
  customerId: string;
  requestedAt: string;
  requestCount: number;
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
  runtimeState: string;
  lastHeartbeat: string;
  activeTaskCount: number;
  errorStreak: number;
  tasks: AgentTaskRecord[];
  metrics: AgentMetricRecord[];
  infraCosts: AgentInfraCostRecord[];
  lifecycleEvents: AgentLifecycleEvent[];
  resultSummary: string;
  resultArtifacts: string[];
}

interface ProcessRow {
  domain_id?: number;
  domain_code?: string;
  domain_name?: string;
  level1_id?: number;
  level1_code?: string;
  level1_name?: string;
  level2_id?: number;
  level2_code?: string;
  level2_name?: string;
  domainId?: number;
  domainCode?: string;
  domainName?: string;
  level1Id?: number;
  level1Code?: string;
  level1Name?: string;
  level2Id?: number;
  level2Code?: string;
  level2Name?: string;
}



interface DynamicFilterRule {
  id: string;
  field: string;
  value: string;
}

interface ProcessLevel1Group {
  code: string;
  name: string;
  items: Array<{ id: number; code: string; name: string }>;
}

interface ProcessDomain {
  id: number;
  code: string;
  name: string;
  level1: Array<{
    id: number;
    code: string;
    name: string;
    level2: Array<{ id: number; code: string; name: string }>;
  }>;
}

const STORAGE_KEY = 'portal-agent-list';
const TABLE_COLUMN_OPTIONS = [
  { key: 'processId', label: 'process ID', defaultVisible: true },
  { key: 'processPath', label: '프로세스 경로', defaultVisible: false },
  { key: 'module', label: '모듈', defaultVisible: false },
  { key: 'processLevel1', label: 'Level1', defaultVisible: false },
  { key: 'processLevel2', label: 'Level2', defaultVisible: false },
  { key: 'agentId', label: 'agent ID', defaultVisible: true },
  { key: 'name', label: '이름', defaultVisible: true },
  { key: 'owner', label: '소유 조직', defaultVisible: true },
  { key: 'status', label: '상태', defaultVisible: true },
  { key: 'capability', label: '수행기능', defaultVisible: true },
  { key: 'customerCount', label: '사용고객', defaultVisible: true },
  { key: 'calls30d', label: '최근 30일 호출', defaultVisible: true },
  { key: 'runtimeState', label: '런타임 상태', defaultVisible: true },
  { key: 'runtimeErrors', label: '런타임 에러', defaultVisible: true },
  { key: 'risk', label: '리스크', defaultVisible: true },
  { key: 'lastUpdated', label: '최근 업데이트', defaultVisible: true }
] as const;

const ANALYSIS_RANGE = {
  start: '2026-01-15 00:00:00',
  end: '2026-01-21 23:59:59'
};

const baseAgentDetails: AgentDetailRecord[] = [
  {
    id: 1,
    agentName: 'OrderBot',
    type: 'system',
    businessType: 'commerce',
    status: 'ACTIVE',
    registeredAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    runtimeState: 'RUNNING',
    lastHeartbeat: '2026-01-20 09:05:00',
    activeTaskCount: 2,
    errorStreak: 0,
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
    ,
    resultSummary: '처리 결과: 성공 2건, 실패 1건. 결제 이슈는 수동 검수로 전환됨.',
    resultArtifacts: ['order_validation_report.json', 'payment_issue_trace.log']
  },
  {
    id: 2,
    agentName: 'SupportGPT',
    type: 'assistant',
    businessType: 'support',
    status: 'ACTIVE',
    registeredAt: '2026-01-02 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    runtimeState: 'DEGRADED',
    lastHeartbeat: '2026-01-20 09:08:00',
    activeTaskCount: 1,
    errorStreak: 1,
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
    ,
    resultSummary: '처리 결과: 응답 템플릿 2건 자동 생성, VOC 분류 오류 1건 발생.',
    resultArtifacts: ['support_summary.md', 'voc_classification.csv']
  },
  {
    id: 3,
    agentName: 'PricingAI',
    type: 'service',
    businessType: 'analytics',
    status: 'ACTIVE',
    registeredAt: '2026-01-05 00:00:00',
    updatedAt: '2026-01-20 09:00:00',
    runtimeState: 'RUNNING',
    lastHeartbeat: '2026-01-20 09:10:00',
    activeTaskCount: 0,
    errorStreak: 0,
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
    ,
    resultSummary: '처리 결과: 신규 가격대 3개 제안, 수익 개선 8.6% 추정.',
    resultArtifacts: ['pricing_simulation.xlsx', 'margin_projection.png']
  }
];

const parseDate = (value: string) => new Date(value.replace(' ', 'T'));

const isWithinRange = (value: string, start: string, end: string) => {
  const target = parseDate(value).getTime();
  return target >= parseDate(start).getTime() && target <= parseDate(end).getTime();
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
    runtimeState: agent.runtimeState ?? (seed % 3 === 0 ? 'RUNNING' : seed % 3 === 1 ? 'DEGRADED' : 'IDLE'),
    lastHeartbeat: '2026-01-20 09:05:00',
    activeTaskCount: seed % 3,
    errorStreak: agent.runtimeErrors ?? seed % 2,
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
    ,
    resultSummary: `${agent.name} 결과 요약: ${tasks.length}건 처리, 성공률 ${Math.round(
      (tasks.filter((task) => task.status === 'COMPLETED').length / tasks.length) * 100
    )}%`,
    resultArtifacts: ['result_summary.txt']
  };
};

const defaultAgents: AgentRecord[] = [
  {
    id: '1',
    name: 'OrderBotcommerce',
    owner: '커머스팀',
    status: '운영',
    category: 'SD',
    risk: '낮음',
    lastUpdated: '2026-01-20',
    runtimeState: 'RUNNING',
    runtimeErrors: 0,
    processId: 'SD.1.3',
    capability: '설명',
    customerCount: 8,
    calls30d: 390
  },
  {
    id: '2',
    name: 'SupportGPTsupport',
    owner: '지원팀',
    status: '운영',
    category: 'BC',
    risk: '중간',
    lastUpdated: '2026-01-20',
    runtimeState: 'DEGRADED',
    runtimeErrors: 1,
    processId: 'BC.1.3',
    capability: '설명',
    customerCount: 3,
    calls30d: 866
  },
  {
    id: '3',
    name: 'PricingAIanalytics',
    owner: '데이터팀',
    status: '운영',
    category: 'COMMON',
    risk: '낮음',
    lastUpdated: '2026-01-20',
    runtimeState: 'RUNNING',
    runtimeErrors: 0,
    processId: 'CM.1.1',
    capability: '설명',
    customerCount: 10,
    calls30d: 412
  }
];

const DEFAULT_SAP_PROCESS_CARDS: { moduleCode: string; moduleName: string; items: { processId: string; title: string; count: number; }[] }[] = [
  {
    moduleCode: 'COMMON',
    moduleName: '통합',
    items: [
      { processId: 'CM.1.1', title: '공통 운영 모니터링', count: 3 },
      { processId: 'CM.1.2', title: '공통 정책/권한 관리', count: 2 }
    ]
  },
  {
    moduleCode: 'MM',
    moduleName: 'MM',
    items: [
      { processId: 'MM.1.2', title: 'BP 티켓 자동접수·KYC 체크', count: 8 },
      { processId: 'MM.1.3', title: '구매처 평가 근거 자동첨부', count: 3 },
      { processId: 'MM.2.2', title: '선정 근거 문장 자동작성', count: 10 },
      { processId: 'MM.3.4', title: '계획 변경·승인요청 자동생성', count: 3 },
      { processId: 'MM.5.3', title: '3-way match 예외 분류·라우팅', count: 10 }
    ]
  },
  {
    moduleCode: 'PP',
    moduleName: 'PP',
    items: [
      { processId: 'PP.2.1', title: '수요 이상치 탐지·보정 제안', count: 8 },
      { processId: 'PP.3.1', title: 'MRP 예외 트리아지', count: 3 },
      { processId: 'PP.3.2', title: '오더 사전검증(릴리즈 전)', count: 10 },
      { processId: 'PP.4.2', title: '공정확인 편차 알림', count: 3 },
      { processId: 'PP.5.3', title: '정산 차이 자동분해', count: 10 }
    ]
  },
  {
    moduleCode: 'HR',
    moduleName: 'HR',
    items: [
      { processId: 'HR.2.2', title: '지원자 요약·매칭 스코어', count: 8 },
      { processId: 'HR.2.4', title: '온보딩 티켓 자동생성', count: 3 },
      { processId: 'HR.3.4', title: '근태 예외 자동라우팅', count: 10 },
      { processId: 'HR.4.1', title: '급여 데이터 검증', count: 3 },
      { processId: 'HR.5.1', title: '평가 코멘트 초안+편향체크', count: 10 }
    ]
  },
  {
    moduleCode: 'SD',
    moduleName: 'SD',
    items: [
      { processId: 'SD.1.1', title: '고객마스터', count: 8 },
      { processId: 'SD.1.2', title: '가격/할인', count: 11 },
      { processId: 'SD.1.3', title: '신용한도/위험', count: 12 },
      { processId: 'SD.2.1', title: '견적/계약', count: 11 },
      { processId: 'SD.2.2', title: '판매오더', count: 7 },
      { processId: 'SD.2.3', title: 'ATP/가용성', count: 7 },
      { processId: 'SD.3.1', title: '납품생성', count: 6 },
      { processId: 'SD.3.2', title: '피킹/패킹', count: 11 },
      { processId: 'SD.3.3', title: '출고(PGI)', count: 10 },
      { processId: 'SD.3.4', title: '운송/배송추적', count: 12 },
      { processId: 'SD.4.1', title: '청구문서', count: 7 },
      { processId: 'SD.4.2', title: '세금/조건', count: 11 },
      { processId: 'SD.4.3', title: '청구차이/예외', count: 3 },
      { processId: 'SD.4.4', title: '정산/조정', count: 5 },
      { processId: 'SD.4.5', title: '반품/클레임', count: 11 },
      { processId: 'SD.5.1', title: '수금', count: 8 },
      { processId: 'SD.5.2', title: '대사/미결', count: 10 },
      { processId: 'SD.5.3', title: '연체/독촉', count: 11 },
      { processId: 'SD.5.4', title: '채권분석/대손', count: 11 }
    ]
  },
  {
    moduleCode: 'FI',
    moduleName: 'FI',
    items: [
      { processId: 'FI.2.3', title: '전표 규칙 위반 탐지', count: 8 },
      { processId: 'FI.3.1', title: '송장 캡처·전표 초안', count: 3 },
      { processId: 'FI.3.2', title: '3-way match 예외 분류', count: 10 },
      { processId: 'FI.4.2', title: '대사 후보 자동매칭', count: 3 },
      { processId: 'FI.5.1', title: '결산 체크리스트 모니터', count: 10 }
    ]
  },
  {
    moduleCode: 'CO',
    moduleName: 'CO',
    items: [
      { processId: 'CO.2.3', title: '계획 시나리오 비교', count: 8 },
      { processId: 'CO.3.1', title: '실적전표 오류 탐지', count: 3 },
      { processId: 'CO.4.1', title: '배부 실행 모니터', count: 10 },
      { processId: 'CO.4.2', title: '정산 차이 자동설명', count: 3 },
      { processId: 'CO.5.1', title: '수익성 내러티브 생성', count: 10 }
    ]
  },
  {
    moduleCode: 'BC',
    moduleName: 'BC',
    items: [
      { processId: 'BC.2.2', title: '티켓 분류+필수정보 수집', count: 8 },
      { processId: 'BC.1.3', title: 'SoD 리스크 스코어링', count: 3 },
      { processId: 'BC.3.3', title: '로그 원인 후보·가이드', count: 10 },
      { processId: 'BC.4.2', title: '릴리즈 영향도 요약', count: 3 },
      { processId: 'BC.5.2', title: '취약점 조치안 플래닝', count: 10 }
    ]
  }
];

const SAP_PROCESS_CARDS: { moduleCode: string; moduleName: string; items: { processId: string; title: string; count: number; }[] }[] = [
  {
    moduleCode: 'COMMON',
    moduleName: '통합',
    items: [
      { processId: 'CM.1.1', title: '공통 운영 모니터링', count: 3 },
      { processId: 'CM.1.2', title: '공통 정책/권한 관리', count: 2 }
    ]
  },
  {
    moduleCode: 'MM',
    moduleName: 'MM',
    items: [
      { processId: 'MM.1.2', title: 'BP 티켓 자동접수·KYC 체크', count: 8 },
      { processId: 'MM.1.3', title: '구매처 평가 근거 자동첨부', count: 3 },
      { processId: 'MM.2.2', title: '선정 근거 문장 자동작성', count: 10 },
      { processId: 'MM.3.4', title: '계획 변경·승인요청 자동생성', count: 3 },
      { processId: 'MM.5.3', title: '3-way match 예외 분류·라우팅', count: 10 }
    ]
  },
  {
    moduleCode: 'PP',
    moduleName: 'PP',
    items: [
      { processId: 'PP.2.1', title: '수요 이상치 탐지·보정 제안', count: 8 },
      { processId: 'PP.3.1', title: 'MRP 예외 트리아지', count: 3 },
      { processId: 'PP.3.2', title: '오더 사전검증(릴리즈 전)', count: 10 },
      { processId: 'PP.4.2', title: '공정확인 편차 알림', count: 3 },
      { processId: 'PP.5.3', title: '정산 차이 자동분해', count: 10 }
    ]
  },
  {
    moduleCode: 'HR',
    moduleName: 'HR',
    items: [
      { processId: 'HR.2.2', title: '지원자 요약·매칭 스코어', count: 8 },
      { processId: 'HR.2.4', title: '온보딩 티켓 자동생성', count: 3 },
      { processId: 'HR.3.4', title: '근태 예외 자동라우팅', count: 10 },
      { processId: 'HR.4.1', title: '급여 데이터 검증', count: 3 },
      { processId: 'HR.5.1', title: '평가 코멘트 초안+편향체크', count: 10 }
    ]
  },
  {
    moduleCode: 'SD',
    moduleName: 'SD',
    items: [
      { processId: 'SD.1.1', title: '고객마스터', count: 8 },
      { processId: 'SD.1.2', title: '가격/할인', count: 11 },
      { processId: 'SD.1.3', title: '신용한도/위험', count: 12 },
      { processId: 'SD.2.1', title: '견적/계약', count: 11 },
      { processId: 'SD.2.2', title: '판매오더', count: 7 },
      { processId: 'SD.2.3', title: 'ATP/가용성', count: 7 },
      { processId: 'SD.3.1', title: '납품생성', count: 6 },
      { processId: 'SD.3.2', title: '피킹/패킹', count: 11 },
      { processId: 'SD.3.3', title: '출고(PGI)', count: 10 },
      { processId: 'SD.3.4', title: '운송/배송추적', count: 12 },
      { processId: 'SD.4.1', title: '청구문서', count: 7 },
      { processId: 'SD.4.2', title: '세금/조건', count: 11 },
      { processId: 'SD.4.3', title: '청구차이/예외', count: 3 },
      { processId: 'SD.4.4', title: '정산/조정', count: 5 },
      { processId: 'SD.4.5', title: '반품/클레임', count: 11 },
      { processId: 'SD.5.1', title: '수금', count: 8 },
      { processId: 'SD.5.2', title: '대사/미결', count: 10 },
      { processId: 'SD.5.3', title: '연체/독촉', count: 11 },
      { processId: 'SD.5.4', title: '채권분석/대손', count: 11 }
    ]
  },
  {
    moduleCode: 'FI',
    moduleName: 'FI',
    items: [
      { processId: 'FI.2.3', title: '전표 규칙 위반 탐지', count: 8 },
      { processId: 'FI.3.1', title: '송장 캡처·전표 초안', count: 3 },
      { processId: 'FI.3.2', title: '3-way match 예외 분류', count: 10 },
      { processId: 'FI.4.2', title: '대사 후보 자동매칭', count: 3 },
      { processId: 'FI.5.1', title: '결산 체크리스트 모니터', count: 10 }
    ]
  },
  {
    moduleCode: 'CO',
    moduleName: 'CO',
    items: [
      { processId: 'CO.2.3', title: '계획 시나리오 비교', count: 8 },
      { processId: 'CO.3.1', title: '실적전표 오류 탐지', count: 3 },
      { processId: 'CO.4.1', title: '배부 실행 모니터', count: 10 },
      { processId: 'CO.4.2', title: '정산 차이 자동설명', count: 3 },
      { processId: 'CO.5.1', title: '수익성 내러티브 생성', count: 10 }
    ]
  },
  {
    moduleCode: 'BC',
    moduleName: 'BC',
    items: [
      { processId: 'BC.2.2', title: '티켓 분류+필수정보 수집', count: 8 },
      { processId: 'BC.1.3', title: 'SoD 리스크 스코어링', count: 3 },
      { processId: 'BC.3.3', title: '로그 원인 후보·가이드', count: 10 },
      { processId: 'BC.4.2', title: '릴리즈 영향도 요약', count: 3 },
      { processId: 'BC.5.2', title: '취약점 조치안 플래닝', count: 10 }
    ]
  }
];

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 });

const formatPercent = (value: number) => `${numberFormatter.format(value)}%`;
const formatNumber = (value: number) => numberFormatter.format(value);
const formatCost = (value: number) => numberFormatter.format(value);
const formatMinutes = (value: number) => `${formatNumber(value)}분`;
const truncateText = (value: string, max = 30) => (value.length > max ? `${value.slice(0, max)}...` : value);


const CAPABILITY_MAX_LENGTH = 200;
const USAGE_WINDOW_DAYS = 30;

const toShortDate = (value: Date) => value.toISOString().slice(0, 10);

const AGENT_USAGE_EVENTS: AgentUsageEvent[] = [
  { id: 1, agentId: '1', customerId: 'CUST-001', requestedAt: '2026-01-20', requestCount: 120 },
  { id: 2, agentId: '1', customerId: 'CUST-002', requestedAt: '2026-01-18', requestCount: 84 },
  { id: 3, agentId: '1', customerId: 'CUST-003', requestedAt: '2026-01-15', requestCount: 92 },
  { id: 4, agentId: '2', customerId: 'CUST-001', requestedAt: '2026-01-19', requestCount: 310 },
  { id: 5, agentId: '2', customerId: 'CUST-010', requestedAt: '2026-01-16', requestCount: 287 },
  { id: 6, agentId: '3', customerId: 'CUST-011', requestedAt: '2026-01-20', requestCount: 201 }
];

const buildCapabilityDescription = (agent: AgentRecord, processLabel: string) => {
  const runtimeLabel =
    agent.runtimeState === 'RUNNING' ? '실시간 운영' : agent.runtimeState === 'DEGRADED' ? '성능 저하 대응' : agent.runtimeState === 'ERROR' ? '장애 복구' : '대기';
  const summary = `${agent.name}는 ${processLabel} 업무에서 ${agent.owner} 요청을 자동 분류·처리하고 ${runtimeLabel} 상태 모니터링으로 예외 전파를 줄입니다.`;
  return summary.length > CAPABILITY_MAX_LENGTH ? `${summary.slice(0, CAPABILITY_MAX_LENGTH - 1)}…` : summary;
};

// 사용고객 집계 추천 흐름
// 1) 30일 사용 이벤트(고객ID 단위)에서 우선 집계
// 2) 이벤트가 없으면 Agent Metric의 totalUsers/requestsProcessed를 대체 소스로 사용
// 3) 둘 다 없으면 agent 레코드의 저장값으로 폴백
const aggregateCustomerUsage = (agent: AgentRecord, detail?: AgentDetailRecord) => {
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - USAGE_WINDOW_DAYS);
  const windowStartDate = toShortDate(windowStart);

  const recentEvents = AGENT_USAGE_EVENTS.filter(
    (event) => event.agentId === agent.id && event.requestedAt >= windowStartDate
  );

  if (recentEvents.length > 0) {
    return {
      customerCount: new Set(recentEvents.map((event) => event.customerId)).size,
      calls30d: recentEvents.reduce((sum, event) => sum + event.requestCount, 0)
    };
  }

  if (detail && detail.metrics.length > 0) {
    const latestMetric = detail.metrics[detail.metrics.length - 1];
    return {
      customerCount: latestMetric.totalUsers || latestMetric.activeUsers || agent.customerCount,
      calls30d: detail.metrics.reduce((sum, metric) => sum + metric.requestsProcessed, 0) || agent.calls30d
    };
  }

  return {
    customerCount: agent.customerCount,
    calls30d: agent.calls30d
  };
};


const LEVEL1_E2E_LABELS: Record<string, string> = {
  MM: 'Procure to Pay',
  PP: 'Plan to Produce',
  HR: 'Hire to Retire',
  SD: 'Order to Cash',
  FI: 'Record to Report',
  CO: 'Plan to Perform',
  BC: 'Basis to Operate'
};

const PROCESS_LEVEL1_LABELS: Record<string, string> = {
  'SD.1': '고객/가격 마스터',
  'SD.2': '견적/주문 관리',
  'SD.3': '납품/출고/물류(TD/LE 모듈)',
  'SD.4': '청구/정산',
  'SD.5': '수금/채권/신용'
};


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

const runtimeToneMap: Record<AgentRecord['runtimeState'], 'success' | 'warning' | 'neutral'> = {
  RUNNING: 'success',
  DEGRADED: 'warning',
  IDLE: 'neutral',
  ERROR: 'warning'
};

const normalizeAgent = (agent: AgentRecord): AgentRecord => ({
  ...agent,
  runtimeState: agent.runtimeState ?? 'IDLE',
  runtimeErrors: agent.runtimeErrors ?? 0,
  processId: agent.processId || 'CM.1.1',
  capability: agent.capability || '설명',
  customerCount: Number(agent.customerCount || 0),
  calls30d: Number(agent.calls30d || 0)
});

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
    return (parsed as AgentRecord[]).map((agent) => normalizeAgent(agent));
  } catch {
    return defaultAgents;
  }
};

const PortalAgentListPage: React.FC = () => {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();
  const [agents, setAgents] = useState<AgentRecord[]>(() => loadAgents());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('전체');
  const [riskFilter, setRiskFilter] = useState('전체');
  const [categoryFilter, setCategoryFilter] = useState('전체');
  const [processDomains, setProcessDomains] = useState<ProcessDomain[]>([]);
  const [selectedDomainCode, setSelectedDomainCode] = useState('SAP');
  const [selectedLevel1Code, setSelectedLevel1Code] = useState('COMMON');
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(() => defaultAgents[0]?.id ?? '');
  const [drilldownAgentId, setDrilldownAgentId] = useState<string | null>(null);

  // NOTE: process panel/filter state must stay declared once (merge conflicts previously duplicated this block).
  const [portalActiveProcessLevel1Code, setPortalActiveProcessLevel1Code] = useState<string | null>(null);
  const [portalProcessPanelCollapsed, setPortalProcessPanelCollapsed] = useState(false);
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilterRule[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    TABLE_COLUMN_OPTIONS.filter((item) => item.defaultVisible).map((item) => item.key)
  );
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);



  // NOTE: process panel/filter state must stay declared once (merge conflicts previously duplicated this block).
  const [portalActiveProcessLevel1Code, setPortalActiveProcessLevel1Code] = useState<string | null>(null);
  const [portalProcessPanelCollapsed, setPortalProcessPanelCollapsed] = useState(false);
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilterRule[]>([]);
  const tableColumnOptions = [
    { key: 'processId', label: 'process ID', defaultVisible: true },
    { key: 'processPath', label: '프로세스 경로', defaultVisible: false },
    { key: 'module', label: '모듈', defaultVisible: false },
    { key: 'processLevel1', label: 'Level1', defaultVisible: false },
    { key: 'processLevel2', label: 'Level2', defaultVisible: false },
    { key: 'agentId', label: 'agent ID', defaultVisible: true },
    { key: 'name', label: '이름', defaultVisible: true },
    { key: 'owner', label: '소유 조직', defaultVisible: true },
    { key: 'status', label: '상태', defaultVisible: true },
    { key: 'capability', label: '수행기능', defaultVisible: true },
    { key: 'customerCount', label: '사용고객', defaultVisible: true },
    { key: 'calls30d', label: '최근 30일 호출', defaultVisible: true },
    { key: 'runtimeState', label: '런타임 상태', defaultVisible: true },
    { key: 'runtimeErrors', label: '런타임 에러', defaultVisible: true },
    { key: 'risk', label: '리스크', defaultVisible: true },
    { key: 'lastUpdated', label: '최근 업데이트', defaultVisible: true }
  ] as const;
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    tableColumnOptions.filter((item) => item.defaultVisible).map((item) => item.key)
  );
  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);


  // NOTE: process panel/filter state must stay declared once (merge conflicts previously duplicated this block).
  const [portalActiveProcessLevel1Code, setPortalActiveProcessLevel1Code] = useState<string | null>(null);
  const [portalProcessPanelCollapsed, setPortalProcessPanelCollapsed] = useState(false);
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilterRule[]>([]);
  const tableColumnOptions = [
    { key: 'processId', label: 'process ID', defaultVisible: true },
    { key: 'processPath', label: '프로세스 경로', defaultVisible: false },
    { key: 'module', label: '모듈', defaultVisible: false },
    { key: 'processLevel1', label: 'Level1', defaultVisible: false },
    { key: 'processLevel2', label: 'Level2', defaultVisible: false },
    { key: 'agentId', label: 'agent ID', defaultVisible: true },
    { key: 'name', label: '이름', defaultVisible: true },
    { key: 'owner', label: '소유 조직', defaultVisible: true },
    { key: 'status', label: '상태', defaultVisible: true },
    { key: 'capability', label: '수행기능', defaultVisible: true },
    { key: 'customerCount', label: '사용고객', defaultVisible: true },
    { key: 'calls30d', label: '최근 30일 호출', defaultVisible: true },
    { key: 'runtimeState', label: '런타임 상태', defaultVisible: true },
    { key: 'runtimeErrors', label: '런타임 에러', defaultVisible: true },
    { key: 'risk', label: '리스크', defaultVisible: true },
    { key: 'lastUpdated', label: '최근 업데이트', defaultVisible: true }
  ] as const;
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    tableColumnOptions.filter((item) => item.defaultVisible).map((item) => item.key)
  );

  const [isColumnEditorOpen, setIsColumnEditorOpen] = useState(false);
  const persistAgents = (updater: (prev: AgentRecord[]) => AgentRecord[]) => {
    setAgents((prev) => {
      const nextAgents = updater(prev);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAgents));
      }
      return nextAgents;
    });
  };


  useEffect(() => {
    const loadProcesses = async () => {
      try {
        const response = await fetch('/api/portal-dashboard/processes');
        if (!response.ok) throw new Error('failed');
        const data = await response.json();
        const rows = (data.rows || []) as ProcessRow[];
        const map = new Map<string, ProcessDomain>();
        rows.forEach((raw) => {
          const domainCode = raw.domain_code || raw.domainCode;
          const domainName = raw.domain_name || raw.domainName;
          const domainId = Number(raw.domain_id || raw.domainId || 0);
          const level1Code = raw.level1_code || raw.level1Code;
          const level1Name = raw.level1_name || raw.level1Name;
          const level1Id = Number(raw.level1_id || raw.level1Id || 0);
          const level2Code = raw.level2_code || raw.level2Code;
          const level2Name = raw.level2_name || raw.level2Name;
          const level2Id = Number(raw.level2_id || raw.level2Id || 0);
          if (!domainCode) return;
          if (!map.has(domainCode)) map.set(domainCode, { id: domainId, code: domainCode, name: domainName || domainCode, level1: [] });
          const domain = map.get(domainCode)!;
          if (!level1Code) return;
          let l1 = domain.level1.find((item) => item.code === level1Code);
          if (!l1) {
            l1 = { id: level1Id, code: level1Code, name: level1Name || level1Code, level2: [] };
            domain.level1.push(l1);
          }
          if (level2Code && !l1.level2.some((l2) => l2.code === level2Code)) {
            l1.level2.push({ id: level2Id, code: level2Code, name: level2Name || level2Code });
          }
        });
        const domains = Array.from(map.values());
        if (domains.length > 0) {
          setProcessDomains(domains);
          setSelectedDomainCode(domains[0].code);
          setSelectedLevel1Code(domains[0].level1[0]?.code || 'COMMON');
          setPortalActiveProcessLevel1Code(null);
        }
      } catch {
        const fallback: ProcessDomain = {
          id: 1,
          code: 'SAP',
          name: 'SAP',
          level1: DEFAULT_SAP_PROCESS_CARDS.map((module, index) => ({
            id: index + 1,
            code: module.moduleCode,
            name: module.moduleName,
            level2: module.items.map((item, itemIndex) => ({ id: itemIndex + 1, code: item.processId, name: item.title }))
          }))
        };
        setProcessDomains([fallback]);
      }
    };
    loadProcesses();
  }, []);

  const selectedDomain = useMemo(() => {
    return processDomains.find((item) => item.code === selectedDomainCode) || processDomains[0];
  }, [processDomains, selectedDomainCode]);

  const selectedLevel1 = useMemo(() => {
    return selectedDomain?.level1.find((item) => item.code === selectedLevel1Code) || selectedDomain?.level1[0];
  }, [selectedDomain, selectedLevel1Code]);

  const level2Source = useMemo(() => {
    if (selectedLevel1?.code === 'COMMON') {
      return (selectedDomain?.level1 || []).flatMap((level1) => level1.level2);
    }
    return selectedLevel1?.level2 || [];
  }, [selectedDomain, selectedLevel1]);


  const processLevel1Groups = useMemo<ProcessLevel1Group[]>(() => {
    const map = new Map<string, ProcessLevel1Group>();
    level2Source.forEach((item) => {
      const segments = item.code.split('.');
      const groupCode = segments.length >= 2 ? `${segments[0]}.${segments[1]}` : item.code;
      const groupName = PROCESS_LEVEL1_LABELS[groupCode] || groupCode;
      if (!map.has(groupCode)) {
        map.set(groupCode, { code: groupCode, name: groupName, items: [] });
      }
      map.get(groupCode)!.items.push(item);
    });
    return Array.from(map.values());
  }, [level2Source]);


  const selectedProcessLevel1Group = useMemo(() => {
    if (!processLevel1Groups.length) return undefined;
    return processLevel1Groups.find((group) => group.code === portalActiveProcessLevel1Code) || processLevel1Groups[0];
  }, [processLevel1Groups, portalActiveProcessLevel1Code]);

  const visibleLevel2Items = selectedProcessLevel1Group?.items || level2Source;

  useEffect(() => {
    if (!processLevel1Groups.length) {
      setPortalActiveProcessLevel1Code(null);
      return;
    }
    if (!portalActiveProcessLevel1Code || !processLevel1Groups.some((group) => group.code === portalActiveProcessLevel1Code)) {
      setPortalActiveProcessLevel1Code(processLevel1Groups[0].code);
    }
  }, [processLevel1Groups, portalActiveProcessLevel1Code]);


  const filteredAgents = useMemo(() => {
    const selectedDomain = processDomains.find((item) => item.code === selectedDomainCode) || processDomains[0];
    const selectedLevel1 = selectedDomain?.level1.find((item) => item.code === selectedLevel1Code) || selectedDomain?.level1[0];
    const level2Codes = new Set(visibleLevel2Items.map((item) => item.code));
    const level2CodesInSelectedProcessLevel1 = new Set(
      (selectedLevel1?.level2 || [])
        .filter((item) => {
          if (!portalActiveProcessLevel1Code) return true;
          const segments = item.code.split('.');
          const processLevel1Code = segments.length >= 2 ? `${segments[0]}.${segments[1]}` : item.code;
          return processLevel1Code === portalActiveProcessLevel1Code;
        })
        .map((item) => item.code)
    );
    const knownProcessCodes = new Set(
      processDomains.flatMap((domain) => domain.level1.flatMap((level1) => level1.level2.map((level2) => level2.code)))
    );
    const isCommonLevel1 = selectedLevel1?.code === 'COMMON';

    return agents.filter((agent) => {
      const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === '전체' || agent.status === statusFilter;
      const matchesRisk = riskFilter === '전체' || agent.risk === riskFilter;
      const matchesCategory = categoryFilter === '전체' || agent.category === categoryFilter;
      const isUnclassified = !knownProcessCodes.has(agent.processId);
      const matchesModule = level2Codes.size === 0 || level2Codes.has(agent.processId) || (isCommonLevel1 && isUnclassified);
      const matchesProcessLevel1 = !portalActiveProcessLevel1Code || level2CodesInSelectedProcessLevel1.has(agent.processId);
      const matchesLevel2 = !selectedProcessId || agent.processId === selectedProcessId;
      return matchesSearch && matchesStatus && matchesRisk && matchesCategory && matchesModule && matchesProcessLevel1 && matchesLevel2;
    });
  }, [agents, categoryFilter, riskFilter, search, statusFilter, processDomains, selectedDomainCode, selectedLevel1Code, selectedProcessId, portalActiveProcessLevel1Code]);


  const selectedModuleAgentCount = useMemo(() => {
    const level2Codes = new Set((selectedLevel1?.level2 || []).map((item) => item.code));
    const knownProcessCodes = new Set<string>();
    for (const domain of processDomains) {
      for (const level1 of domain.level1) {
        for (const level2 of level1.level2) {
          knownProcessCodes.add(level2.code);
        }
      }
    }
    const isCommonLevel1 = selectedLevel1?.code === 'COMMON';


    let count = 0;
    for (const agent of agents) {
      const isUnclassified = !knownProcessCodes.has(agent.processId);
      if (level2Codes.has(agent.processId) || (isCommonLevel1 && isUnclassified)) {
        count += 1;
      }
    }

    return count;
  }, [visibleLevel2Items, selectedLevel1, agents, processDomains]);

  const processNameById = useMemo(() => {
    const entries: Array<[string, string]> = [];
    for (const domain of processDomains) {
      for (const level1 of domain.level1) {
        for (const level2 of level1.level2) {
          entries.push([level2.code, `${level1.code} ${level1.name} > ${level2.code} ${level2.name}`]);
        }
      }
    }
    return new Map(entries);
  }, [processDomains]);

  const processMetaByIdMap = useMemo(() => {
    const entries: Array<[
      string,
      { module: string; processLevel1: string; processLevel2: string; processPath: string }
    ]> = [];


    for (const domain of processDomains) {
      for (const module of domain.level1) {
        for (const level2 of module.level2) {
          const segments = level2.code.split('.');
          const processLevel1Code = segments.length >= 2 ? `${segments[0]}.${segments[1]}` : level2.code;
          const processLevel1Name = PROCESS_LEVEL1_LABELS[processLevel1Code] || processLevel1Code;
          entries.push([
            level2.code,
            {
              module: module.code,
              processLevel1: `${processLevel1Code} ${processLevel1Name}`,
              processLevel2: `${level2.code} ${level2.name}`,
              processPath: `${module.code} > ${processLevel1Code} > ${level2.code}`
            }
          ]);
        }
      }
    }
    return new Map(entries);
  }, [processDomains]);


    return new Map(entries);
  }, [processDomains]);


  const addDynamicFilter = () => {
    setDynamicFilters((prev) => [
      ...prev,
      { id: `filter-${Date.now()}-${prev.length}`, field: 'owner', value: '' }
    ]);
  };

  const updateDynamicFilter = (id: string, patch: Partial<DynamicFilterRule>) => {
    setDynamicFilters((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const removeDynamicFilter = (id: string) => {
    setDynamicFilters((prev) => prev.filter((rule) => rule.id !== id));
  };

  const toggleColumnVisibility = (key: string) => {
    setVisibleColumns((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
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
          updatedAt: agent.lastUpdated ? `${agent.lastUpdated} 09:00:00` : baseDetail.updatedAt,
          runtimeState: agent.runtimeState ?? baseDetail.runtimeState,
          errorStreak: agent.runtimeErrors ?? baseDetail.errorStreak
        };
      }
      return buildGeneratedDetail(agent);
    });
  }, [agents]);

  const agentDetailById = useMemo(() => {
    return new Map(agentDetails.map((agent) => [String(agent.id), agent]));
  }, [agentDetails]);


  const displayAgents = useMemo(() => {
    return filteredAgents.map((agent) => {
      const detail = agentDetailById.get(agent.id);
      const processLabel = processNameById.get(agent.processId) || `${agent.processId} 업무`;
      const usage = aggregateCustomerUsage(agent, detail);

      const processMeta = processMetaByIdMap.get(agent.processId) || {
        module: selectedLevel1?.code || '-',
        processLevel1: '-',
        processLevel2: `${agent.processId} -`,
        processPath: '-'
      };

      return {
        ...agent,
        capability: buildCapabilityDescription(agent, processLabel),
        customerCount: usage.customerCount,
        calls30d: usage.calls30d,
        processMeta
      };
    });
  }, [filteredAgents, agentDetailById, processNameById, processMetaByIdMap, selectedLevel1]);


  const getColumnValue = (agent: (typeof displayAgents)[number], field: string) => {
    switch (field) {
      case 'processId':
        return agent.processId;
      case 'processPath':
        return agent.processMeta.processPath;
      case 'module':
        return agent.processMeta.module;
      case 'processLevel1':
        return agent.processMeta.processLevel1;
      case 'processLevel2':
        return agent.processMeta.processLevel2;
      case 'agentId':
        return agent.id;
      case 'name':
        return agent.name;
      case 'owner':
        return agent.owner;
      case 'status':
        return agent.status;
      case 'capability':
        return agent.capability;
      case 'customerCount':
        return String(agent.customerCount);
      case 'calls30d':
        return String(agent.calls30d);
      case 'runtimeState':
        return agent.runtimeState;
      case 'runtimeErrors':
        return String(agent.runtimeErrors);
      case 'risk':
        return agent.risk;
      case 'lastUpdated':
        return agent.lastUpdated;
      default:
        return String((agent as Record<string, unknown>)[field] ?? '');
    }
  };

  const filteredDisplayAgents = useMemo(() => {
    return displayAgents.filter((agent) =>
      dynamicFilters.every((rule) => {
        if (!rule.value.trim()) return true;
        const target = getColumnValue(agent, rule.field).toLowerCase();
        return target.includes(rule.value.toLowerCase());
      })
    );
  }, [displayAgents, dynamicFilters]);

  useEffect(() => {
    if (!agentId) {
      return;
    }
    if (agentId !== selectedAgentId) {
      setSelectedAgentId(agentId);
    }
    if (agentId !== drilldownAgentId) {
      setDrilldownAgentId(null);
    }
  }, [agentId, drilldownAgentId, selectedAgentId]);

  const selectedAgent = agentDetails.find((agent) => String(agent.id) === selectedAgentId);
  const tasksInRange = selectedAgent
    ? selectedAgent.tasks.filter((task) => isWithinRange(task.receivedAt, ANALYSIS_RANGE.start, ANALYSIS_RANGE.end))
    : [];
  const selectedMetricsInRange = selectedAgent
    ? selectedAgent.metrics.filter((metric) => isWithinRange(metric.startTime, ANALYSIS_RANGE.start, ANALYSIS_RANGE.end))
    : [];
  const taskCount = tasksInRange.length;
  const successCount = tasksInRange.filter((task) => task.status === 'COMPLETED').length;
  const successRate = taskCount > 0 ? (successCount / taskCount) * 100 : 0;
  const metricRequestSum = selectedMetricsInRange.reduce((sum, metric) => sum + metric.requestsProcessed, 0);
  const metricTokenSum = selectedMetricsInRange.reduce((sum, metric) => sum + metric.totalTokenUsage, 0);
  const metricCostSum = selectedMetricsInRange.reduce((sum, metric) => sum + metric.tokenCost, 0);
  const avgMetricLatency = selectedMetricsInRange.length > 0
    ? selectedMetricsInRange.reduce((sum, metric) => sum + metric.avgLatency, 0) / selectedMetricsInRange.length
    : 0;

  return (
    <PortalDashboardLayout
      title="에이전트 목록"
      subtitle="운영 중인 에이전트를 상태와 리스크 기준으로 필터링합니다."
      actions={<button className="ear-primary" onClick={() => navigate('/portal-agent-management/new')}>에이전트 등록</button>}
    >
      <section className="ear-card ear-card--panel ear-process-overview">
        <div className="ear-process-overview__domains">
          {processDomains.map((domain) => (
            <button
              key={domain.code}
              type="button"
              className={`ear-process-domain ${selectedDomainCode === domain.code ? 'active' : ''}`}
              onClick={() => {
                setSelectedDomainCode(domain.code);
                setSelectedLevel1Code(domain.level1[0]?.code || 'COMMON');
                setPortalActiveProcessLevel1Code(null);
                setSelectedProcessId(null);
              }}
            >
              {domain.name}
            </button>
          ))}
          <button
            type="button"
            className="ear-ghost"
            onClick={() => setPortalProcessPanelCollapsed((prev) => !prev)}
          >
            {portalProcessPanelCollapsed ? '펼치기' : '접기'}
          </button>
        </div>
        {!portalProcessPanelCollapsed && (
          <>
            <div className="ear-process-overview__section">
              <div className="ear-process-overview__tabs">
                {(selectedDomain?.level1 || []).map((module) => {
                  const moduleCount = module.level2.length;
                  return (
                    <button
                      key={module.code}
                      type="button"
                      className={`ear-process-tab ${selectedLevel1Code === module.code ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedLevel1Code(module.code);
                        setPortalActiveProcessLevel1Code(null);
                        setSelectedProcessId(null);
                      }}
                    >
                      <span>{LEVEL1_E2E_LABELS[module.code] ? `${module.name} · ${LEVEL1_E2E_LABELS[module.code]}` : module.name}</span>
                      <em>{moduleCount}</em>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="ear-process-overview__section">
              <div className="ear-process-overview__tabs">
                {processLevel1Groups.map((group) => (
                  <button
                    key={group.code}
                    type="button"
                    className={`ear-process-tab ${selectedProcessLevel1Group?.code === group.code ? 'active' : ''}`}
                    onClick={() => {
                      setPortalActiveProcessLevel1Code(group.code);
                      setSelectedProcessId(null);
                    }}
                  >
                    <span>{`${group.code} ${group.name}`}</span>
                    <em>{group.items.length}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="ear-process-overview__section">
              <div className="ear-process-overview__summary">
                <h3>{selectedLevel1 ? (selectedLevel1.code === 'COMMON' ? '통합' : `${selectedLevel1.name} · ${LEVEL1_E2E_LABELS[selectedLevel1.code] || selectedLevel1.code}`) : '통합'}</h3>
                <strong>Agent Count {selectedModuleAgentCount}</strong>
              </div>
              <div className="ear-process-overview__cards">
                {visibleLevel2Items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`ear-process-card ${selectedProcessId === item.code ? 'active' : ''}`}
                    onClick={() => setSelectedProcessId((prev) => (prev === item.code ? null : item.code))}
                  >
                    <span>{(() => {
                      const segments = item.code.split('.');
                      const level1Code = segments.length >= 2 ? `${segments[0]}.${segments[1]}` : item.code;
                      const level1Name = PROCESS_LEVEL1_LABELS[level1Code] || selectedLevel1?.name || '프로세스';
                      return `${level1Code} ${level1Name}`;
                    })()}</span>
                    <strong>{`${item.code} ${item.name}`}</strong>
                    <em>{agents.filter((agent) => agent.processId === item.code).length}</em>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </section>

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
              <option value="COMMON">통합</option>
              <option value="SD">SD</option>
              <option value="BC">BC</option>
              <option value="MM">MM</option>
            </select>
          </label>
          <button type="button" className="ear-secondary" onClick={addDynamicFilter}>편집</button>
          {dynamicFilters.map((rule) => (
            <div key={rule.id} className="ear-filter__dynamic-row">
              <select
                value={rule.field}
                onChange={(event) => updateDynamicFilter(rule.id, { field: event.target.value as DynamicFilterRule['field'] })}
              >
                {TABLE_COLUMN_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>{option.label}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="값 입력"
                value={rule.value}
                onChange={(event) => updateDynamicFilter(rule.id, { value: event.target.value })}
              />
              <button type="button" className="ear-ghost" onClick={() => removeDynamicFilter(rule.id)}>삭제</button>
            </div>
          ))}

        </aside>

        <div className="ear-agent-layout">
          <section className="ear-table-card">
            <div className="ear-table-card__header">
              <div>
                <h3>에이전트 목록</h3>
              <p>총 {filteredDisplayAgents.length}개 에이전트</p>
              <p className="ear-muted">사용고객 집계: 30일 이벤트 기준 → 메트릭 대체 → 저장값 폴백</p>
            </div>
            <div className="ear-table-card__actions">
              <button className="ear-ghost">CSV 내보내기</button>
              <button className="ear-secondary">정렬</button>
              <button type="button" className="ear-secondary" onClick={() => setIsColumnEditorOpen((prev) => !prev)}>편집</button>
              {isColumnEditorOpen && (
                <div className="ear-column-picker">
                  {TABLE_COLUMN_OPTIONS.map((option) => (
                    <label key={option.key}>
                      <input
                        type="checkbox"
                        checked={visibleColumns.includes(option.key)}
                        onChange={() => toggleColumnVisibility(option.key)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>
          {showAddAgentForm && (
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
                  <option value="COMMON">통합</option>
                  <option value="SD">SD</option>
                  <option value="BC">BC</option>
                  <option value="MM">MM</option>
                </select>
              </label>
              <label>
                Process ID
                <select
                  value={formValues.processId}
                  onChange={(event) => handleFormChange('processId', event.target.value)}
                >
                  {visibleLevel2Items.map((item) => (
                    <option key={item.id} value={item.code}>{item.code}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className="ear-primary">등록 저장</button>
            </form>
          )}
          <table className="ear-table">
            <thead>
              <tr>
                {TABLE_COLUMN_OPTIONS.filter((option) => visibleColumns.includes(option.key)).map((option) => (
                  <th key={option.key}>{option.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDisplayAgents.map((agent) => {
                const detail = agentDetailById.get(agent.id);
                const isSelected = agent.id === selectedAgentId;
                const isDrilldownOpen = drilldownAgentId === agent.id;

                return (
                  <React.Fragment key={agent.id}>
                    <tr
                      className={isSelected ? 'ear-table__row ear-table__row--active' : 'ear-table__row'}
                      onClick={() => {
                        setSelectedAgentId(agent.id);
                        setDrilldownAgentId(null);
                        navigate(`/portal-agents/${agent.id}`);
                      }}
                      onDoubleClick={() => {
                        setSelectedAgentId(agent.id);
                        setDrilldownAgentId(agent.id);
                        navigate(`/portal-agents/${agent.id}`);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          setSelectedAgentId(agent.id);
                          setDrilldownAgentId(null);
                          navigate(`/portal-agents/${agent.id}`);
                        }
                      }}
                    >
                      {visibleColumns.includes('processId') && <td>{agent.processId}</td>}
                      {visibleColumns.includes('processPath') && <td>{agent.processMeta.processPath}</td>}
                      {visibleColumns.includes('module') && <td>{agent.processMeta.module}</td>}
                      {visibleColumns.includes('processLevel1') && <td>{agent.processMeta.processLevel1}</td>}
                      {visibleColumns.includes('processLevel2') && <td>{agent.processMeta.processLevel2}</td>}
                      {visibleColumns.includes('agentId') && <td>{agent.id}</td>}
                      {visibleColumns.includes('name') && <td><strong>{agent.name}</strong><span className="ear-muted">{agent.category}</span></td>}
                      {visibleColumns.includes('owner') && <td>{agent.owner}</td>}
                      {visibleColumns.includes('status') && <td><TagPill label={agent.status} tone={statusToneMap[agent.status]} /></td>}
                      {visibleColumns.includes('capability') && <td>{truncateText(agent.capability, 30)}</td>}
                      {visibleColumns.includes('customerCount') && <td>{agent.customerCount}</td>}
                      {visibleColumns.includes('calls30d') && <td>{agent.calls30d}</td>}
                      {visibleColumns.includes('runtimeState') && <td><TagPill label={agent.runtimeState} tone={runtimeToneMap[agent.runtimeState]} /></td>}
                      {visibleColumns.includes('runtimeErrors') && <td>{agent.runtimeErrors}</td>}
                      {visibleColumns.includes('risk') && <td><TagPill label={agent.risk} tone={riskToneMap[agent.risk]} /></td>}
                      {visibleColumns.includes('lastUpdated') && <td>{agent.lastUpdated}</td>}
                    </tr>
                    {isDrilldownOpen && (
                      <tr className="ear-table__row ear-table__row--drilldown">
                        <td colSpan={Math.max(visibleColumns.length, 1)}>
                          <div className="ear-drilldown">
                            <div>
                              <strong>Task 드릴다운</strong>
                              <span>선택한 에이전트의 최근 작업</span>
                            </div>
                            <div className="ear-drilldown__actions">
                              <button
                                type="button"
                                className="ear-secondary"
                                onClick={() => navigate(`/portal-tasks?agent=${encodeURIComponent(agent.name)}`)}
                              >
                                크게 보기
                              </button>
                            </div>
                          </div>
                          <div className="ear-drilldown__list">
                            {(detail?.tasks ?? []).slice(0, 3).map((task) => (
                              <div key={task.id} className="ear-drilldown__item">
                                <span>{task.jobId}</span>
                                <span>{task.status}</span>
                              </div>
                            ))}
                            {(!detail || detail.tasks.length === 0) && (
                              <span className="ear-muted">표시할 작업이 없습니다.</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          </section>
          {selectedAgent && (
            <aside className="ear-card ear-card--panel ear-agent-detail">
              <div className="ear-card__header">
                <div>
                  <h3>{selectedAgent.agentName} Task 상세</h3>
                  <p>에이전트 선택 시 Task 정보만 노출됩니다.</p>
                </div>
              <div className="ear-card__actions">
                <button
                  type="button"
                  className="ear-secondary"
                  onClick={() => navigate(`/portal-tasks?agent=${encodeURIComponent(selectedAgent.agentName)}`)}
                >
                  크게 보기
                </button>
                <button
                  type="button"
                  className="ear-ghost"
                  onClick={() => navigate(`/portal-usage?agent=${encodeURIComponent(selectedAgent.agentName)}`)}
                >
                  운영지표 보기
                </button>
              </div>
            </div>
              <div className="ear-card__body">
                <div className="ear-stat-grid ear-stat-grid--compact">
                  <div className="ear-stat">
                    <span>Task 합계</span>
                    <strong>{formatNumber(taskCount)}</strong>
                  </div>
                  <div className="ear-stat">
                    <span>Task 성공률</span>
                    <strong>{formatPercent(successRate)}</strong>
                  </div>
                  <div className="ear-stat">
                    <span>Metric 요청 합</span>
                    <strong>{formatNumber(metricRequestSum)}</strong>
                  </div>
                  <div className="ear-stat">
                    <span>Metric Token 합</span>
                    <strong>{formatNumber(metricTokenSum)}</strong>
                  </div>
                  <div className="ear-stat">
                    <span>Metric Cost 합</span>
                    <strong>{formatCost(metricCostSum)}</strong>
                  </div>
                  <div className="ear-stat">
                    <span>평균 Latency</span>
                    <strong>{formatNumber(avgMetricLatency)}</strong>
                  </div>
                </div>
                <table className="ear-table ear-table--compact">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Job ID</th>
                      <th>Status</th>
                                          </tr>
                  </thead>
                  <tbody>
                    {tasksInRange.map((task) => (
                      <tr key={task.id}>
                        <td>{task.id}</td>
                        <td>{task.jobId}</td>
                        <td>{task.status}</td>
                                              </tr>
                    ))}
                    {tasksInRange.length === 0 && (
                      <tr>
                        <td colSpan={3} className="ear-muted">표시할 Task가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </aside>
          )}
        </div>
      </div>
    </PortalDashboardLayout>
  );
};

export default PortalAgentListPage;
