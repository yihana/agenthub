import { randomUUID } from 'crypto';
import {
  AgentRecord,
  ExecutionRecord,
  ExecutionStepRecord,
  ExecutionStatus,
  MetricEventRecord,
  StepStatus,
  WorkerHeartbeatRecord
} from './types';

const agents = new Map<string, AgentRecord>();
const executions = new Map<string, ExecutionRecord>();
const steps = new Map<string, ExecutionStepRecord>();
const executionSteps = new Map<string, string[]>();
const metricEvents = new Map<string, MetricEventRecord>();
const heartbeats = new Map<string, WorkerHeartbeatRecord>();

const nowIso = () => new Date().toISOString();

const emitMetricEvent = (execution_id: string, event_type: string, payload?: Record<string, unknown>, step_id?: string) => {
  const event: MetricEventRecord = {
    event_id: randomUUID(),
    execution_id,
    step_id,
    event_type,
    event_time: nowIso(),
    payload
  };

  metricEvents.set(event.event_id, event);
  return event;
};

export const registerAgent = (input: Partial<AgentRecord> & Pick<AgentRecord, 'agent_id' | 'agent_name'>) => {
  const existing = agents.get(input.agent_id);
  const now = nowIso();

  const agent: AgentRecord = {
    agent_id: input.agent_id,
    agent_name: input.agent_name,
    agent_type: input.agent_type ?? existing?.agent_type ?? 'SUBFLOW_MANAGER',
    owner_team: input.owner_team ?? existing?.owner_team ?? 'EAR',
    is_active: input.is_active ?? existing?.is_active ?? true,
    version: input.version ?? existing?.version ?? '0.1.0',
    tags: input.tags ?? existing?.tags ?? ['subflow', 'node-red'],
    created_at: existing?.created_at ?? now,
    updated_at: now
  };

  agents.set(agent.agent_id, agent);
  return agent;
};

export const createExecution = (input: Omit<ExecutionRecord, 'execution_id' | 'status' | 'started_at'> & { status?: ExecutionStatus }) => {
  const execution: ExecutionRecord = {
    execution_id: randomUUID(),
    agent_id: input.agent_id,
    request_id: input.request_id,
    conversation_id: input.conversation_id,
    user_id: input.user_id,
    channel: input.channel,
    status: input.status ?? 'RUNNING',
    started_at: nowIso(),
    input_payload: input.input_payload,
    output_payload: input.output_payload,
    meta: input.meta
  };

  executions.set(execution.execution_id, execution);
  executionSteps.set(execution.execution_id, []);
  emitMetricEvent(execution.execution_id, 'EXECUTION_STARTED', { agent_id: execution.agent_id, channel: execution.channel });

  return execution;
};

export const endExecution = (executionId: string, status: ExecutionStatus, output_payload?: Record<string, unknown>, error?: { code?: string; message?: string }) => {
  const execution = executions.get(executionId);
  if (!execution) {
    return null;
  }

  const endedAt = nowIso();
  const durationMs = Date.parse(endedAt) - Date.parse(execution.started_at);

  execution.status = status;
  execution.ended_at = endedAt;
  execution.duration_ms = durationMs;
  execution.output_payload = output_payload ?? execution.output_payload;
  execution.error_code = error?.code;
  execution.error_message = error?.message;

  executions.set(execution.execution_id, execution);
  emitMetricEvent(execution.execution_id, 'EXECUTION_ENDED', { status, duration_ms: durationMs, error_code: error?.code });

  return execution;
};

export const createStep = (executionId: string, input: Omit<ExecutionStepRecord, 'step_id' | 'execution_id' | 'status' | 'started_at' | 'retry_count'> & { retry_count?: number }) => {
  const execution = executions.get(executionId);
  if (!execution) {
    return null;
  }

  const step: ExecutionStepRecord = {
    step_id: randomUUID(),
    execution_id: executionId,
    step_seq: input.step_seq,
    step_name: input.step_name,
    step_type: input.step_type,
    target_system: input.target_system,
    target_name: input.target_name,
    status: 'RUNNING',
    started_at: nowIso(),
    retry_count: input.retry_count ?? 0,
    idempotency_key: input.idempotency_key,
    request_payload: input.request_payload
  };

  steps.set(step.step_id, step);
  executionSteps.set(executionId, [...(executionSteps.get(executionId) ?? []), step.step_id]);

  emitMetricEvent(executionId, 'STEP_STARTED', {
    step_name: step.step_name,
    step_type: step.step_type,
    step_seq: step.step_seq
  }, step.step_id);

  return step;
};

export const endStep = (
  stepId: string,
  status: StepStatus,
  response_payload?: Record<string, unknown>,
  metrics?: Record<string, unknown>,
  error?: { code?: string; message?: string }
) => {
  const step = steps.get(stepId);
  if (!step) {
    return null;
  }

  const endedAt = nowIso();
  const durationMs = Date.parse(endedAt) - Date.parse(step.started_at);

  step.status = status;
  step.ended_at = endedAt;
  step.duration_ms = durationMs;
  step.response_payload = response_payload;
  step.metrics = { ...(metrics ?? {}), duration_ms: durationMs };
  step.error_code = error?.code;
  step.error_message = error?.message;

  steps.set(step.step_id, step);

  emitMetricEvent(step.execution_id, 'STEP_ENDED', {
    step_name: step.step_name,
    status,
    duration_ms: durationMs,
    error_code: error?.code
  }, step.step_id);

  return step;
};

export const upsertHeartbeat = (input: WorkerHeartbeatRecord) => {
  const record: WorkerHeartbeatRecord = {
    ...input,
    last_seen_at: nowIso()
  };

  heartbeats.set(record.worker_id, record);
  return record;
};

export const getExecutionDetail = (executionId: string) => {
  const execution = executions.get(executionId);
  if (!execution) {
    return null;
  }

  const stepIds = executionSteps.get(executionId) ?? [];
  const executionStepRecords = stepIds
    .map((stepId) => steps.get(stepId))
    .filter((step): step is ExecutionStepRecord => Boolean(step))
    .sort((a, b) => a.step_seq - b.step_seq);

  const events = Array.from(metricEvents.values())
    .filter((event) => event.execution_id === executionId)
    .sort((a, b) => Date.parse(a.event_time) - Date.parse(b.event_time));

  return {
    execution,
    steps: executionStepRecords,
    events
  };
};

export const listHeartbeats = () => Array.from(heartbeats.values()).sort((a, b) => Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
