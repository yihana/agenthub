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
import { EarSubflowRunRequest, ExecutionStepRecord, RfcStep } from './types';

registerAgent({
  agent_id: 'subflow-manager',
  agent_name: 'Subflow Manager Agent',
  agent_type: 'ORCHESTRATOR',
  owner_team: 'EAR',
  tags: ['subflow', 'node-red', 'execution-tracking']
});

const buildLocalMockResult = (requestPayload?: Record<string, unknown>, rfcName?: string) => ({
  EV_R_CD: 'S',
  EV_MESSAGE: 'LOCAL_MOCK_SUCCESS',
  rfc_name: rfcName,
  echo: requestPayload ?? {}
});

const isSuccessResult = (payload: any) => {
  const code = payload?.EV_R_CD || payload?.EV_TYPE || payload?.status;
  return code === 'S' || code === 'SUCCEEDED' || code === 'SUCCESS' || code === 200;
};

const mergeEchoPayload = (currentPayload: Record<string, unknown>, responsePayload: any) => {
  const echo = responsePayload?.data?.echo || responsePayload?.echo;
  if (echo && typeof echo === 'object' && !Array.isArray(echo)) {
    return { ...currentPayload, ...echo };
  }
  return currentPayload;
};

const groupSteps = (steps: RfcStep[]) => {
  const sorted = [...steps].sort((a, b) => a.seq - b.seq);
  const bySeq = new Map<number, RfcStep[]>();

  sorted.forEach((step) => {
    bySeq.set(step.seq, [...(bySeq.get(step.seq) ?? []), step]);
  });

  const grouped: RfcStep[][] = [];

  Array.from(bySeq.keys()).sort((a, b) => a - b).forEach((seq) => {
    const sameSeq = bySeq.get(seq) ?? [];
    const parallelMap = new Map<string, RfcStep[]>();

    sameSeq.forEach((step) => {
      const key = step.parallelWith?.trim() || `__single__${step.name}`;
      parallelMap.set(key, [...(parallelMap.get(key) ?? []), step]);
    });

    parallelMap.forEach((group) => grouped.push(group));
  });

  return grouped;
};

const runSingleRfcStep = async (
  executionId: string,
  input: EarSubflowRunRequest,
  stepDef: RfcStep,
  currentPayload: Record<string, unknown>
): Promise<{ stepRecord: ExecutionStepRecord; responsePayload: any; success: boolean }> => {
  const stepRecord = createStep(executionId, {
    step_seq: stepDef.seq,
    step_name: stepDef.name,
    step_type: 'RFC',
    target_system: stepDef.targetSystem,
    target_name: stepDef.targetName,
    request_payload: {
      ...currentPayload,
      rfc_name: stepDef.rfcName
    },
    idempotency_key: `${executionId}:${stepDef.seq}:${stepDef.name}`
  });

  if (!stepRecord) {
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
        data: {
          rfc_name: stepDef.rfcName,
          payload: currentPayload,
          meta: {
            execution_id: executionId,
            step_name: stepDef.name,
            seq: stepDef.seq,
            parallel_group: stepDef.parallelWith
          }
        },
        headers: input.ear.headers
      });

      if (input.ear.post_path) {
        await callEar(earConfig, {
          method: 'post',
          path: input.ear.post_path,
          data: {
            execution_id: executionId,
            step_id: stepRecord.step_id,
            status: mainResponse.status,
            request_payload: currentPayload,
            rfc_name: stepDef.rfcName
          },
          headers: input.ear.headers
        });
      }

      responsePayload = {
        http_status: mainResponse.status,
        data: mainResponse.data
      };
    } else {
      responsePayload = buildLocalMockResult(currentPayload, stepDef.rfcName);
    }

    const success = isSuccessResult(responsePayload?.data ?? responsePayload);
    const endedStep = endStep(
      stepRecord.step_id,
      success ? 'SUCCEEDED' : 'FAILED',
      responsePayload,
      {
        duration_ms: Date.now() - startedAt,
        mode: input.mode ?? 'local',
        parallel_with: stepDef.parallelWith ?? null,
        rfc_name: stepDef.rfcName
      },
      success ? undefined : { code: 'EAR_CALL_FAILED', message: 'EAR response indicates failure' }
    );

    if (!endedStep) {
      throw new Error('failed to end step');
    }

    return {
      stepRecord: endedStep,
      responsePayload,
      success
    };
  } catch (error: any) {
    endStep(stepRecord.step_id, 'FAILED', undefined, {
      duration_ms: Date.now() - startedAt,
      mode: input.mode ?? 'local',
      parallel_with: stepDef.parallelWith ?? null,
      rfc_name: stepDef.rfcName
    }, {
      code: 'EAR_CALL_EXCEPTION',
      message: error.message || 'EAR call failed'
    });
    throw error;
  }
};

const executeEarSubflow = async (input: EarSubflowRunRequest) => {
  if (!input.steps || input.steps.length === 0) {
    throw new Error('steps is required');
  }

  const execution = createExecution({
    agent_id: input.agent_id,
    request_id: input.request_id,
    conversation_id: input.conversation_id,
    user_id: input.user_id,
    channel: input.channel,
    input_payload: input.input_payload,
    meta: {
      mode: input.mode ?? 'local',
      integration: 'ear',
      total_steps: input.steps.length
    }
  });

  let currentPayload: Record<string, unknown> = { ...(input.input_payload ?? {}) };
  const groupedSteps = groupSteps(input.steps);
  const stepOutputs: Array<{ definition: RfcStep; success: boolean; response_payload: any }> = [];

  for (const group of groupedSteps) {
    if (group.length === 1) {
      const result = await runSingleRfcStep(execution.execution_id, input, group[0], currentPayload);
      currentPayload = mergeEchoPayload(currentPayload, result.responsePayload);
      stepOutputs.push({ definition: group[0], success: result.success, response_payload: result.responsePayload });
      if (!result.success) {
        break;
      }
    } else {
      const results = await Promise.all(group.map((stepDef) => runSingleRfcStep(execution.execution_id, input, stepDef, currentPayload)));

      results.forEach((result) => {
        currentPayload = mergeEchoPayload(currentPayload, result.responsePayload);
      });

      group.forEach((stepDef, idx) => {
        stepOutputs.push({ definition: stepDef, success: results[idx].success, response_payload: results[idx].responsePayload });
      });

      if (results.some((result) => !result.success)) {
        break;
      }
    }
  }

  const overallSuccess = stepOutputs.length > 0 && stepOutputs.every((s) => s.success) && stepOutputs.length === input.steps.length;
  const autoEnd = input.auto_end_execution ?? true;
  const endedExecution = autoEnd
    ? endExecution(
      execution.execution_id,
      overallSuccess ? 'SUCCEEDED' : 'FAILED',
      {
        merged_payload: currentPayload,
        steps: stepOutputs
      },
      overallSuccess ? undefined : { code: 'SUBFLOW_FAILED', message: 'EAR integrated subflow failed' }
    )
    : execution;

  return {
    execution: endedExecution,
    steps: stepOutputs,
    merged_payload: currentPayload,
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
