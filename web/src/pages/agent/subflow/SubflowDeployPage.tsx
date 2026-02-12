import { useState } from 'react';
import '../../../styles/subflow-manager.css';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

const SubflowDeployPage = () => {
  const [adminUrl, setAdminUrl] = useState('http://localhost:1880');
  const [flowFilePath, setFlowFilePath] = useState('server/agent/subflow/node-red-2step-flow.json');
  const [token, setToken] = useState('');
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

  return (
    <div className="subflow-page">
      <h1>Subflow 개발/배포 (Node-RED 자동 반영)</h1>
      <p>RFC step 테스트 화면과 분리된 배포 전용 화면입니다. Node-RED Admin API/CLI로 플로우를 자동 반영할 수 있습니다.</p>

      <section className="subflow-card">
        <h2>배포 설정</h2>
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

        <div className="subflow-actions">
          <button disabled={loading} onClick={() => run(() => request(`/api/subflow-manager/v1/node-red/flow-template?flow_file_path=${encodeURIComponent(flowFilePath)}`))}>
            1) Flow 템플릿 미리보기
          </button>
          <button disabled={loading} onClick={() => run(() => request('/api/subflow-manager/v1/node-red/deploy/admin-api', {
            method: 'POST',
            body: JSON.stringify({ admin_url: adminUrl, flow_file_path: flowFilePath, token: token || undefined })
          }))}>
            2) Admin API로 반영
          </button>
          <button disabled={loading} onClick={() => run(() => request('/api/subflow-manager/v1/node-red/deploy/cli', {
            method: 'POST',
            body: JSON.stringify({ admin_url: adminUrl, flow_file_path: flowFilePath })
          }))}>
            3) CLI로 반영
          </button>
        </div>

        {error && <p className="subflow-error">{error}</p>}
      </section>

      <section className="subflow-card">
        <h2>결과</h2>
        <pre>{result ? pretty(result) : '아직 실행 결과가 없습니다.'}</pre>
      </section>
    </div>
  );
};

export default SubflowDeployPage;
