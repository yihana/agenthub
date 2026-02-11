import { useState } from 'react';
import '../../../styles/subflow-manager.css';

type RunMode = 'local' | 'ear';

type RfcStep = {
  id: string;
  seq: number;
  name: string;
  rfcName: string;
  targetSystem: string;
  targetName: string;
  parallelWith?: string;
};

const RFC_OPTIONS = [
  'ZCO_EAR_CHK_AFE_AUTH',
  'ZCO_EAR_GET_FCTR_BY_KOSTL',
  'ZCO_EAR_GET_CC_INFO',
  'ZCO_EAR_VALIDATE_BUDGET'
];


const defaultInput = {
  kokrs: '1000',
  bukrs: '1000',
  gjahr: '2026',
  aufnr: '50001234',
  user: 'PM_USER'
};


const createStep = (seq: number): RfcStep => ({
  id: `${Date.now()}-${seq}-${Math.random().toString(36).slice(2, 7)}`,
  seq,
  name: `Step ${seq}`,
  rfcName: RFC_OPTIONS[0],
  targetSystem: 'EAR',
  targetName: 'RFC_DEST_EAR_DEV',
  parallelWith: ''
});

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const SubflowManagerPage = () => {
  const [runMode, setRunMode] = useState<RunMode>('local');
  const [destinationName, setDestinationName] = useState('EAR_RFC_DEST');
  const [mainPath, setMainPath] = useState('/rfc/execute');
  const [inputPayloadText, setInputPayloadText] = useState(JSON.stringify(defaultInput, null, 2));
  const [steps, setSteps] = useState<RfcStep[]>([createStep(1), createStep(2)]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [error, setError] = useState('');


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


  const updateStep = (id: string, patch: Partial<RfcStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const reindex = (list: RfcStep[]) => list.map((step, index) => ({ ...step, seq: index + 1 }));

  const addStep = () => {
    setSteps((prev) => [...prev, createStep(prev.length + 1)]);
  };

  const removeStep = (id: string) => {
    setSteps((prev) => reindex(prev.filter((step) => step.id !== id)));
  };

  const moveStep = (index: number, direction: -1 | 1) => {
    setSteps((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const cloned = [...prev];
      const [moved] = cloned.splice(index, 1);
      cloned.splice(target, 0, moved);
      return reindex(cloned);
    });
  };

  const runSubflow = async () => {
    if (steps.length === 0) {
      setError('최소 1개 이상의 스텝이 필요합니다.');

      return;
    }

    setLoading(true);
    setError('');

    try {
      let parsedInput: Record<string, unknown>;
      try {
        parsedInput = JSON.parse(inputPayloadText);
      } catch {
        throw new Error('Input Payload JSON 형식이 올바르지 않습니다.');
      }

      const body = {
        mode: runMode,
        agent_id: 'subflow-manager',
        user_id: 'demo-user',
        channel: 'portal',
        input_payload: parsedInput,
        steps: steps.map((step, index) => ({
          seq: index + 1,
          name: step.name,
          rfcName: step.rfcName,
          targetSystem: step.targetSystem,
          targetName: step.targetName,
          parallelWith: step.parallelWith || undefined
        })),
        ear: runMode === 'ear'
          ? {
            destination_name: destinationName,
            main_path: mainPath,
            method: 'post'
          }
          : undefined
      };

      const data = await request('/api/subflow-manager/v1/ear/execute', {
        method: 'POST',
        body: JSON.stringify(body)
      });


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
      <p>동적 RFC 스텝 + 병렬 그룹(parallelWith) 기반으로 EAR/로컬 실행을 테스트합니다.</p>

      <section className="subflow-card">
        <h2>실행 설정</h2>
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

        <label className="subflow-textarea-label">
          Input Payload(JSON)
          <textarea value={inputPayloadText} onChange={(e) => setInputPayloadText(e.target.value)} rows={8} />
        </label>
      </section>

      <section className="subflow-card">
        <div className="subflow-steps-header">
          <h2>RFC Steps</h2>
          <button disabled={loading} onClick={addStep}>+ Add Step</button>
        </div>

        <div className="subflow-steps-list">
          {steps.map((step, index) => (
            <div key={step.id} className="subflow-step-item">
              <div className="subflow-step-top">
                <strong>#{index + 1}</strong>
                <div className="subflow-inline-actions">
                  <button disabled={loading || index === 0} onClick={() => moveStep(index, -1)}>↑</button>
                  <button disabled={loading || index === steps.length - 1} onClick={() => moveStep(index, 1)}>↓</button>
                  <button disabled={loading} onClick={() => removeStep(step.id)}>삭제</button>
                </div>
              </div>

              <div className="subflow-form-grid">
                <label>
                  Name
                  <input value={step.name} onChange={(e) => updateStep(step.id, { name: e.target.value })} />
                </label>
                <label>
                  RFC Name
                  <select value={step.rfcName} onChange={(e) => updateStep(step.id, { rfcName: e.target.value })}>
                    {RFC_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Target System
                  <input value={step.targetSystem} onChange={(e) => updateStep(step.id, { targetSystem: e.target.value })} />
                </label>
                <label>
                  Target Name
                  <input value={step.targetName} onChange={(e) => updateStep(step.id, { targetName: e.target.value })} />
                </label>
                <label>
                  Parallel Group
                  <input
                    placeholder="예: g1 (같으면 병렬 실행)"
                    value={step.parallelWith || ''}
                    onChange={(e) => updateStep(step.id, { parallelWith: e.target.value })}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="subflow-actions">
          <button disabled={loading} onClick={runSubflow}>Run Dynamic Subflow</button>
        </div>
        {error && <p className="subflow-error">{error}</p>}
      </section>


      <section className="subflow-card">
        <h2>API Result</h2>
        <pre>{result ? pretty(result) : '아직 실행 결과가 없습니다.'}</pre>
      </section>
    </div>
  );
};

export default SubflowManagerPage;
