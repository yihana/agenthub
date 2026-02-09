import { createExecution, createStep, endExecution, endStep, getExecutionDetail, listHeartbeats, registerAgent, upsertHeartbeat } from './store';

registerAgent({
  agent_id: 'subflow-manager',
  agent_name: 'Subflow Manager Agent',
  agent_type: 'ORCHESTRATOR',
  owner_team: 'EAR',
  tags: ['subflow', 'node-red', 'execution-tracking']
});

export const subflowManager = {
  registerAgent,
  createExecution,
  endExecution,
  createStep,
  endStep,
  upsertHeartbeat,
  listHeartbeats,
  getExecutionDetail
};
