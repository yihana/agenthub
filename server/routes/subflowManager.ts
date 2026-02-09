import { Router } from 'express';
import { subflowManager } from '../agent/subflow';

const router = Router();

router.post('/v1/agents', (req, res) => {
  const { agent_id, agent_name, agent_type, owner_team, is_active, version, tags } = req.body ?? {};

  if (!agent_id || !agent_name) {
    return res.status(400).json({ error: 'agent_id and agent_name are required' });
  }

  const agent = subflowManager.registerAgent({
    agent_id,
    agent_name,
    agent_type,
    owner_team,
    is_active,
    version,
    tags
  });

  return res.status(201).json(agent);
});

router.post('/v1/executions', (req, res) => {
  const { agent_id, request_id, conversation_id, user_id, channel, input_payload, meta } = req.body ?? {};

  if (!agent_id) {
    return res.status(400).json({ error: 'agent_id is required' });
  }

  const execution = subflowManager.createExecution({
    agent_id,
    request_id,
    conversation_id,
    user_id,
    channel,
    input_payload,
    meta
  });

  return res.status(201).json(execution);
});

router.patch('/v1/executions/:executionId/end', (req, res) => {
  const { executionId } = req.params;
  const { status, output_payload, error_code, error_message } = req.body ?? {};

  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  const execution = subflowManager.endExecution(executionId, status, output_payload, {
    code: error_code,
    message: error_message
  });

  if (!execution) {
    return res.status(404).json({ error: 'execution not found' });
  }

  return res.json(execution);
});

router.post('/v1/executions/:executionId/steps', (req, res) => {
  const { executionId } = req.params;
  const {
    step_seq,
    step_name,
    step_type,
    target_system,
    target_name,
    request_payload,
    retry_count,
    idempotency_key
  } = req.body ?? {};

  if (!step_seq || !step_name || !step_type) {
    return res.status(400).json({ error: 'step_seq, step_name and step_type are required' });
  }

  const step = subflowManager.createStep(executionId, {
    step_seq,
    step_name,
    step_type,
    target_system,
    target_name,
    request_payload,
    retry_count,
    idempotency_key
  });

  if (!step) {
    return res.status(404).json({ error: 'execution not found' });
  }

  return res.status(201).json(step);
});

router.patch('/v1/steps/:stepId/end', (req, res) => {
  const { stepId } = req.params;
  const { status, response_payload, metrics, error_code, error_message } = req.body ?? {};

  if (!status) {
    return res.status(400).json({ error: 'status is required' });
  }

  const step = subflowManager.endStep(stepId, status, response_payload, metrics, {
    code: error_code,
    message: error_message
  });

  if (!step) {
    return res.status(404).json({ error: 'step not found' });
  }

  return res.json(step);
});

router.get('/v1/executions/:executionId', (req, res) => {
  const detail = subflowManager.getExecutionDetail(req.params.executionId);

  if (!detail) {
    return res.status(404).json({ error: 'execution not found' });
  }

  return res.json(detail);
});

router.post('/v1/workers/heartbeat', (req, res) => {
  const { worker_id, host, env, meta } = req.body ?? {};

  if (!worker_id || !host || !env) {
    return res.status(400).json({ error: 'worker_id, host and env are required' });
  }

  const heartbeat = subflowManager.upsertHeartbeat({ worker_id, host, env, last_seen_at: new Date().toISOString(), meta });
  return res.json(heartbeat);
});

router.get('/v1/workers/heartbeat', (_req, res) => {
  return res.json({ workers: subflowManager.listHeartbeats() });
});

export default router;
