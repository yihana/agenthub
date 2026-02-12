import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import '../../../styles/subflow-manager.css';

const pretty = (value: unknown) => JSON.stringify(value, null, 2);

type DeployTab = 'deploy' | 'flows';
type FlowSource = 'admin-api' | 'flows-file';

type NodeRedNode = {
  id: string;
  type: string;
  z?: string;
  name?: string;
  wires?: string[][];
  [key: string]: unknown;
};

const isNodeArray = (value: unknown): value is NodeRedNode[] => Array.isArray(value);

const extractFlowNodes = (data: any): NodeRedNode[] => {
  if (isNodeArray(data)) {
    return data;
  }

  if (isNodeArray(data?.flows)) {
    return data.flows;
  }

  if (isNodeArray(data?.data)) {
    return data.data;
  }

  if (isNodeArray(data?.data?.flows)) {
    return data.data.flows;
  }

  return [];
};

const SubflowDeployPage = () => {
  const [tab, setTab] = useState<DeployTab>('deploy');
  const [flowSource, setFlowSource] = useState<FlowSource>('admin-api');
  const [adminUrl, setAdminUrl] = useState('http://localhost:1880');
  const [flowFilePath, setFlowFilePath] = useState('agent/subflow/node-red-2step-flow.json');
  const [flowsFilePath, setFlowsFilePath] = useState('');
  const [targetExportPath, setTargetExportPath] = useState('node-red/flows/flows.dev.json');
  const [token, setToken] = useState('');
  const [flowJsonText, setFlowJsonText] = useState('');
  const [selectedTabId, setSelectedTabId] = useState<string>('');
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
      return data;
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.');
      return null;
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

  const fetchRegisteredFlows = async () => run(() => {
    if (flowSource === 'admin-api') {
      return request(`/api/subflow-manager/v1/node-red/flows?admin_url=${encodeURIComponent(adminUrl)}${token ? `&token=${encodeURIComponent(token)}` : ''}`);
    }

    return request(`/api/subflow-manager/v1/node-red/flows-file${flowsFilePath ? `?flows_file_path=${encodeURIComponent(flowsFilePath)}` : ''}`);
  });

  const exportFlowsToFile = async () => run(() => request('/api/subflow-manager/v1/node-red/export-file', {
    method: 'POST',
    body: JSON.stringify({
      admin_url: adminUrl,
      token: token || undefined,
      target_file_path: targetExportPath
    })
  }));

  const nodes = useMemo(() => extractFlowNodes(result), [result]);

  const flowTabs = useMemo(() => {
    return nodes.filter((node) => node.type === 'tab').map((node) => ({
      id: node.id,
      label: String(node.label || node.name || node.id)
    }));
  }, [nodes]);

  useEffect(() => {
    if (!selectedTabId && flowTabs.length > 0) {
      setSelectedTabId(flowTabs[0].id);
      return;
    }

    if (selectedTabId && !flowTabs.some((tabItem) => tabItem.id === selectedTabId)) {
      setSelectedTabId(flowTabs[0]?.id ?? '');
    }
  }, [flowTabs, selectedTabId]);

  const selectedTabNodes = useMemo(() => {
    if (!selectedTabId) {
      return [] as NodeRedNode[];
    }

    return nodes.filter((node) => node.z === selectedTabId || node.id === selectedTabId);
  }, [nodes, selectedTabId]);

  const flowEdges = useMemo(() => {
    const edges: Array<{ from: string; to: string }> = [];
    selectedTabNodes.forEach((node) => {
      if (Array.isArray(node.wires)) {
        node.wires.forEach((wireGroup) => {
          if (Array.isArray(wireGroup)) {
            wireGroup.forEach((targetId) => {
              edges.push({ from: node.id, to: targetId });
            });
          }
        });
      }
    });

    return edges;
  }, [selectedTabNodes]);

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
            <input value={adminUrl} onChange={(e) => setAdminUrl(e.target.value)} placeholder="http://127.0.0.1:1880" />
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
        <>
          <section className="subflow-card">
            <h2>로컬 Node-RED 등록 플로우 조회</h2>
            <div className="subflow-actions" style={{ marginBottom: 10 }}>
              <button className={flowSource === 'admin-api' ? 'active' : ''} onClick={() => setFlowSource('admin-api')}>Admin API /flows</button>
              <button className={flowSource === 'flows-file' ? 'active' : ''} onClick={() => setFlowSource('flows-file')}>flows.json 파일 읽기</button>
            </div>

            {flowSource === 'flows-file' && (
              <label className="subflow-textarea-label" style={{ marginBottom: 10 }}>
                flows.json 경로(선택)
                <input
                  value={flowsFilePath}
                  onChange={(e) => setFlowsFilePath(e.target.value)}
                  placeholder="기본값: C:\\Users\\<user>\\.node-red\\flows.json"
                />
              </label>
            )}

            <div className="subflow-actions">
              <button disabled={loading} onClick={fetchRegisteredFlows}>조회 실행</button>
            </div>
            <label className="subflow-textarea-label" style={{ marginTop: 10 }}>
              Git 저장용 Export 파일 경로
              <input
                value={targetExportPath}
                onChange={(e) => setTargetExportPath(e.target.value)}
                placeholder="node-red/flows/flows.dev.json"
              />
            </label>
            <div className="subflow-actions">
              <button disabled={loading} onClick={exportFlowsToFile}>조회 결과를 파일로 Export</button>
            </div>
            <p style={{ marginTop: 10 }}>탭 단위로 선택하고, 선택 탭의 노드 흐름(연결) + JSON 상세를 동시에 볼 수 있습니다.</p>
            {error && <p className="subflow-error">{error}</p>}
          </section>

          <section className="subflow-card">
            <h2>Flow 탭 목록</h2>
            <div className="subflow-tab-strip">
              {flowTabs.length === 0 && <span>조회 후 탭 목록이 표시됩니다.</span>}
              {flowTabs.map((tabItem) => (
                <button
                  key={tabItem.id}
                  className={selectedTabId === tabItem.id ? 'active' : ''}
                  onClick={() => setSelectedTabId(tabItem.id)}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>
          </section>

          <section className="subflow-card">
            <h2>선택 탭 흐름 (간단 뷰)</h2>
            <div className="subflow-flow-rows">
              {selectedTabNodes.length === 0 && <div>선택된 탭의 노드가 없습니다.</div>}
              {selectedTabNodes.map((node) => (
                <div key={node.id} className="subflow-flow-row">
                  <strong>{node.type}</strong> · {String(node.name || node.label || node.id)}
                </div>
              ))}
            </div>
            <h3 style={{ marginTop: 12 }}>연결</h3>
            <pre>{flowEdges.length > 0 ? pretty(flowEdges) : '연결 정보 없음'}</pre>
          </section>

          <section className="subflow-card">
            <h2>선택 탭 JSON 상세</h2>
            <pre>{selectedTabNodes.length > 0 ? pretty(selectedTabNodes) : '탭을 선택하고 조회를 실행하세요.'}</pre>
          </section>
        </>
      )}

      <section className="subflow-card">
        <h2>원본 결과(JSON)</h2>
        <pre>{result ? pretty(result) : '아직 실행 결과가 없습니다.'}</pre>
      </section>
    </div>
  );
};

export default SubflowDeployPage;
