import { useMemo, useState } from 'react';
import '../../../styles/subflow-manager.css';

type JsonValue = Record<string, unknown>;
type RunMode = 'local' | 'ear';


const defaultInput = {
  kokrs: '1000',
  bukrs: '1000',
  gjahr: '2026',
  aufnr: '50001234',
  user: 'PM_USER'
};

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const SubflowManagerPage = () => {
  const [executionId, setExecutionId] = useState('');
  const [stepId, setStepId] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');
  const [runMode, setRunMode] = useState<RunMode>('local');
  const [destinationName, setDestinationName] = useState('EAR_RFC_DEST');
  const [mainPath, setMainPath] = useState('/rfc/execute');


  const idempotencyKey = useMemo(() => `${executionId || 'pending'}:1`, [executionId]);

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {})
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '요청에 실패했습니다.');
    }
    return data;
  };


  const handleCreateExecution = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/subflow-manager/v1/executions', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: 'subflow-manager',
          user_id: 'demo-user',
          channel: 'portal',
          input_payload: defaultInput,
          meta: { source: 'subflow-ui' }
        })
      });
      setExecutionId(data.execution_id);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartStep = async () => {
    if (!executionId) {
      setError('먼저 Execution을 생성하세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await request(`/api/subflow-manager/v1/executions/${executionId}/steps`, {
        method: 'POST',
        body: JSON.stringify({
          step_seq: 1,
          step_name: 'ZCO_EAR_CHK_AFE_AUTH',
          step_type: 'RFC',
          target_system: 'SAP',
          target_name: 'RFC_DEST_EAR_DEV',
          request_payload: {
            IV_KOKRS: defaultInput.kokrs,
            IV_BUKRS: defaultInput.bukrs,
            IV_GJAHR: defaultInput.gjahr,
            IV_AUFNR: defaultInput.aufnr,
            IV_USER: defaultInput.user
          },
          idempotency_key: idempotencyKey
        })
      });

      setStepId(data.step_id);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndStep = async (status: 'SUCCEEDED' | 'FAILED') => {
    if (!stepId) {
      setError('먼저 Step을 시작하세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload: JsonValue = {
        status,
        response_payload: {
          EV_R_CD: status === 'SUCCEEDED' ? 'S' : 'E',
          EV_MESSAGE: status === 'SUCCEEDED' ? 'Step success' : 'Step failed (mock)'
        },
        metrics: {
          source: 'subflow-ui'
        }
      };

      if (status === 'FAILED') {
        payload.error_code = 'RFC_ERROR';
        payload.error_message = 'Mock RFC failure from UI';
      }

      const data = await request(`/api/subflow-manager/v1/steps/${stepId}/end`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEndExecution = async (status: 'SUCCEEDED' | 'FAILED') => {
    if (!executionId) {
      setError('먼저 Execution을 생성하세요.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await request(`/api/subflow-manager/v1/executions/${executionId}/end`, {
        method: 'PATCH',
        body: JSON.stringify({
          status,
          output_payload: { summary: `Execution ${status}` },
          error_code: status === 'FAILED' ? 'SUBFLOW_FAILED' : undefined,
          error_message: status === 'FAILED' ? 'Mock execution failure from UI' : undefined
        })
      });
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGetExecution = async () => {
    if (!executionId) {
      setError('조회할 execution_id가 없습니다.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await request(`/api/subflow-manager/v1/executions/${executionId}`);
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunEarIntegrated = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await request('/api/subflow-manager/v1/ear/execute', {
        method: 'POST',
        body: JSON.stringify({
          mode: runMode,
          agent_id: 'subflow-manager',
          user_id: 'demo-user',
          channel: 'portal',
          input_payload: defaultInput,
          step_name: 'ZCO_EAR_CHK_AFE_AUTH',
          step_type: 'RFC',
          target_system: 'EAR',
          target_name: runMode === 'ear' ? destinationName : 'LOCAL_MOCK',
          request_payload: {
            IV_KOKRS: defaultInput.kokrs,
            IV_BUKRS: defaultInput.bukrs,
            IV_GJAHR: defaultInput.gjahr,
            IV_AUFNR: defaultInput.aufnr,
            IV_USER: defaultInput.user
          },
          ear: runMode === 'ear'
            ? {
              destination_name: destinationName,
              main_path: mainPath,
              method: 'post'
            }
            : undefined
        })
      });

      setExecutionId(data.execution?.execution_id ?? '');
      setStepId(data.step?.step_id ?? '');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subflow-page">
      <h1>Subflow Manager Agent</h1>
      <p>Agent Hub 실행/스텝 추적 구조를 유지하면서 EAR 연동(Cloud Foundry Destination)과 로컬 목업을 모두 테스트합니다.</p>

      <div className="subflow-grid">
        <section className="subflow-card">
          <h2>EAR 연동 실행 (권장)</h2>
          <div className="subflow-form-grid">
            <label>
              Mode
              <select value={runMode} onChange={(e) => setRunMode(e.target.value as RunMode)}>
                <option value="local">local (목업)</option>
                <option value="ear">ear (실제 연동)</option>
              </select>
            </label>
            <label>
              Destination Name
              <input value={destinationName} onChange={(e) => setDestinationName(e.target.value)} disabled={runMode !== 'ear'} />
            </label>
            <label>
              EAR Main Path
              <input value={mainPath} onChange={(e) => setMainPath(e.target.value)} disabled={runMode !== 'ear'} />
            </label>
          </div>
          <div className="subflow-actions">
            <button disabled={loading} onClick={handleRunEarIntegrated}>Run EAR Integrated Subflow</button>
          </div>
          <small>
            mode=ear 인 경우 destination_name + main_path로 SAP Cloud Foundry EAR 대상 HTTP 호출을 수행합니다.
          </small>
        </section>

        <section className="subflow-card">
          <h2>기본 API 수동 시나리오</h2>
          <ol>
            <li>Execution 생성</li>
            <li>Step 시작</li>
            <li>Step 종료 (성공/실패)</li>
            <li>Execution 종료</li>
            <li>Execution 상세 조회</li>
          </ol>
          <div className="subflow-meta">
            <div><strong>execution_id</strong>: {executionId || '-'}</div>
            <div><strong>step_id</strong>: {stepId || '-'}</div>
          </div>
          <div className="subflow-actions">
            <button disabled={loading} onClick={handleCreateExecution}>1) Create Execution</button>
            <button disabled={loading} onClick={handleStartStep}>2) Start Step</button>
            <button disabled={loading} onClick={() => handleEndStep('SUCCEEDED')}>3) End Step Success</button>
            <button disabled={loading} onClick={() => handleEndStep('FAILED')}>3) End Step Failed</button>
            <button disabled={loading} onClick={() => handleEndExecution('SUCCEEDED')}>4) End Execution Success</button>
            <button disabled={loading} onClick={() => handleEndExecution('FAILED')}>4) End Execution Failed</button>
            <button disabled={loading} onClick={handleGetExecution}>5) Get Execution Detail</button>
          </div>
          {error && <p className="subflow-error">{error}</p>}
        </section>
      </div>

      <section className="subflow-card">
        <h2>API Result</h2>
        <pre>{result ? pretty(result) : '아직 실행 결과가 없습니다.'}</pre>
      </section>
    </div>
  );
};

export default SubflowManagerPage;
