import { callEar } from './integration';
import {
  createExecution,
  createStep,
  endExecution,
  endStep,
  getExecutionDetail,
  listHeartbeats,
  registerAgent,
  upsertHeartbeat
} from './store';
import { EarSubflowRunRequest } from './types';

registerAgent({
  agent_id: 'subflow-manager',
  agent_name: 'Subflow Manager Agent',
  agent_type: 'ORCHESTRATOR',
  owner_team: 'EAR',
  tags: ['subflow', 'node-red', 'execution-tracking']
});

const buildLocalMockResult = (requestPayload?: Record<string, unknown>) => ({
  EV_R_CD: 'S',
  EV_MESSAGE: 'LOCAL_MOCK_SUCCESS',
  echo: requestPayload ?? {}
});

const isSuccessResult = (payload: any) => {
  const code = payload?.EV_R_CD || payload?.EV_TYPE || payload?.status;
  return code === 'S' || code === 'SUCCEEDED' || code === 'SUCCESS' || code === 200;
};

const runEarIntegratedStep = async (executionId: string, input: EarSubflowRunRequest) => {
  const step = createStep(executionId, {
    step_seq: 1,
    step_name: input.step_name,
    step_type: input.step_type ?? 'RFC',
    target_system: input.target_system ?? 'EAR',
    target_name: input.target_name ?? (input.mode === 'ear' ? (input.ear?.destination_name || input.ear?.base_url || 'EAR_ENDPOINT') : 'LOCAL_MOCK'),
    request_payload: input.request_payload,
    idempotency_key: `${executionId}:1`
  });

  if (!step) {
    throw new Error('failed to create step');
  }

  const startedAt = Date.now();

  try {
    let responsePayload: any;

    if (input.mode === 'ear') {
      if (!input.ear?.main_path) {
        throw new Error('ear.main_path is required when mode is ear');
      }

      const earConfig = {
        destinationName: input.ear.destination_name,
        baseUrl: input.ear.base_url,
        timeoutMs: input.ear.timeout_ms
      };

      if (input.ear.pre_path) {
        await callEar(earConfig, {
          method: 'get',
          path: input.ear.pre_path,
          headers: input.ear.headers
        });
      }

      const mainResponse = await callEar(earConfig, {
        method: input.ear.method ?? 'post',
        path: input.ear.main_path,
        data: input.request_payload,
        headers: input.ear.headers
      });

      if (input.ear.post_path) {
        await callEar(earConfig, {
          method: 'post',
          path: input.ear.post_path,
          data: {
            execution_id: executionId,
            step_id: step.step_id,
            status: mainResponse.status,
            request_payload: input.request_payload
          },
          headers: input.ear.headers
        });
      }

      responsePayload = {
        http_status: mainResponse.status,
        data: mainResponse.data
      };
    } else {
      responsePayload = buildLocalMockResult(input.request_payload);
    }

    const success = isSuccessResult(responsePayload?.data ?? responsePayload);
    const endedStep = endStep(
      step.step_id,
      success ? 'SUCCEEDED' : 'FAILED',
      responsePayload,
      {
        duration_ms: Date.now() - startedAt,
        mode: input.mode ?? 'local'
      },
      success ? undefined : { code: 'EAR_CALL_FAILED', message: 'EAR response indicates failure' }
    );

    if (!endedStep) {
      throw new Error('failed to end step');
    }

    return {
      step: endedStep,
      success,
      responsePayload
    };
  } catch (error: any) {
    endStep(step.step_id, 'FAILED', undefined, { duration_ms: Date.now() - startedAt, mode: input.mode ?? 'local' }, {
      code: 'EAR_CALL_EXCEPTION',
      message: error.message || 'EAR call failed'
    });
    throw error;
  }
};

const executeEarSubflow = async (input: EarSubflowRunRequest) => {
  const execution = createExecution({
    agent_id: input.agent_id,
    request_id: input.request_id,
    conversation_id: input.conversation_id,
    user_id: input.user_id,
    channel: input.channel,
    input_payload: input.input_payload,
    meta: {
      mode: input.mode ?? 'local',
      integration: 'ear'
    }
  });

  const runResult = await runEarIntegratedStep(execution.execution_id, input);

  const autoEnd = input.auto_end_execution ?? true;
  const endedExecution = autoEnd
    ? endExecution(
      execution.execution_id,
      runResult.success ? 'SUCCEEDED' : 'FAILED',
      {
        step_id: runResult.step.step_id,
        result: runResult.responsePayload
      },
      runResult.success ? undefined : { code: 'SUBFLOW_FAILED', message: 'EAR integrated subflow failed' }
    )
    : execution;

  return {
    execution: endedExecution,
    step: runResult.step,
    detail: getExecutionDetail(execution.execution_id)
  };
};

export const subflowManager = {
  registerAgent,
  createExecution,
  endExecution,
  createStep,
  endStep,
  upsertHeartbeat,
  listHeartbeats,
  getExecutionDetail,
  executeEarSubflow
};
