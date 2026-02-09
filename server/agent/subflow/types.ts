export type ExecutionStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';
export type StepStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface AgentRecord {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  owner_team: string;
  is_active: boolean;
  version: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ExecutionRecord {
  execution_id: string;
  agent_id: string;
  request_id?: string;
  conversation_id?: string;
  user_id?: string;
  channel?: string;
  status: ExecutionStatus;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  error_code?: string;
  error_message?: string;
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface ExecutionStepRecord {
  step_id: string;
  execution_id: string;
  step_seq: number;
  step_name: string;
  step_type: string;
  target_system?: string;
  target_name?: string;
  status: StepStatus;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  retry_count: number;
  idempotency_key?: string;
  request_payload?: Record<string, unknown>;
  response_payload?: Record<string, unknown>;
  error_code?: string;
  error_message?: string;
  metrics?: Record<string, unknown>;
}

export interface MetricEventRecord {
  event_id: string;
  execution_id: string;
  step_id?: string;
  event_type: string;
  event_time: string;
  payload?: Record<string, unknown>;
}

export interface WorkerHeartbeatRecord {
  worker_id: string;
  host: string;
  env: string;
  last_seen_at: string;
  meta?: Record<string, unknown>;
}
