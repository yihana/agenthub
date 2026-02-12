import { useState } from 'react';
import { Link } from 'react-router-dom';
import '../../../styles/subflow-manager.css';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

type DeployTab = 'deploy' | 'flows';

const SubflowDeployPage = () => {
  const [tab, setTab] = useState<DeployTab>('deploy');
  const [adminUrl, setAdminUrl] = useState('http://localhost:1880');
  const [flowFilePath, setFlowFilePath] = useState('agent/subflow/node-red-2step-flow.json');
  const [token, setToken] = useState('');
  const [flowJsonText, setFlowJsonText] = useState('');
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

  const run = async (handler: () => Promise<any>) => {
    setLoading(true);
    setError('');
    try {
      const data = await handler();
      setResult(data);
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplate = async () => run(async () => {
    const data = await request(`/api/subflow-manager/v1/node-red/flow-template?flow_file_path=${encodeURIComponent(flowFilePath)}`);
    setFlowJsonText(pretty(data.flow_json));
    return data;
  });

  const deployByAdminApi = async () => run(async () => {
    let flowJson: unknown = undefined;
    if (flowJsonText.trim()) {
      flowJson = JSON.parse(flowJsonText);
    }

    return request('/api/subflow-manager/v1/node-red/deploy/admin-api', {
      method: 'POST',
      body: JSON.stringify({
        admin_url: adminUrl,
        flow_file_path: flowFilePath,
        token: token || undefined,
        flow_json: flowJson
      })
    });
  });

  const deployByCli = async () => run(() => request('/api/subflow-manager/v1/node-red/deploy/cli', {
    method: 'POST',
    body: JSON.stringify({ admin_url: adminUrl, flow_file_path: flowFilePath })
  }));

  const fetchRegisteredFlows = async () => run(() => request(`/api/subflow-manager/v1/node-red/flows?admin_url=${encodeURIComponent(adminUrl)}${token ? `&token=${encodeURIComponent(token)}` : ''}`));

  return (
    <div className="subflow-page">
      <h1>Subflow 개발/배포 (Node-RED 자동 반영)</h1>
      <p>RFC step 테스트 화면과 분리된 배포 전용 화면입니다. <Link to="/agent/subflow">Flow 생성/실행 화면으로 이동</Link></p>

      <div className="subflow-tab-strip">
        <button className={tab === 'deploy' ? 'active' : ''} onClick={() => setTab('deploy')}>배포/반영</button>
        <button className={tab === 'flows' ? 'active' : ''} onClick={() => setTab('flows')}>로컬 Node-RED 플로우 조회</button>
      </div>

      <section className="subflow-card">
        <h2>공통 설정</h2>
        <div className="subflow-form-grid">
          <label>
            Node-RED Admin URL
            <input value={adminUrl} onChange={(e) => setAdminUrl(e.target.value)} placeholder="http://localhost:1880" />
          </label>
          <label>
            Flow File Path
            <input value={flowFilePath} onChange={(e) => setFlowFilePath(e.target.value)} />
          </label>
          <label>
            Admin Token (선택)
            <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token without prefix" />
          </label>
        </div>
      </section>

      {tab === 'deploy' && (
        <section className="subflow-card">
          <h2>배포/반영</h2>
          <div className="subflow-actions">
            <button disabled={loading} onClick={loadTemplate}>1) Flow 템플릿 미리보기</button>
            <button disabled={loading} onClick={deployByAdminApi}>2) Admin API로 반영</button>
            <button disabled={loading} onClick={deployByCli}>3) CLI로 반영</button>
          </div>
          <label className="subflow-textarea-label" style={{ marginTop: 12 }}>
            Flow JSON (선택: 편집 후 Admin API 반영)
            <textarea value={flowJsonText} onChange={(e) => setFlowJsonText(e.target.value)} rows={12} />
          </label>
          {error && <p className="subflow-error">{error}</p>}
        </section>
      )}

      {tab === 'flows' && (
        <section className="subflow-card">
          <h2>로컬 Node-RED 등록 플로우 조회</h2>
          <div className="subflow-actions">
            <button disabled={loading} onClick={fetchRegisteredFlows}>Node-RED /flows 조회</button>
          </div>
          <p style={{ marginTop: 10 }}>조회 후 결과(JSON)에서 현재 활성화된 flows/rev를 확인할 수 있습니다.</p>
          {error && <p className="subflow-error">{error}</p>}
        </section>
      )}

      <section className="subflow-card">
        <h2>결과</h2>
        <pre>{result ? pretty(result) : '아직 실행 결과가 없습니다.'}</pre>
      </section>
    </div>
  );
};

export default SubflowDeployPage;
