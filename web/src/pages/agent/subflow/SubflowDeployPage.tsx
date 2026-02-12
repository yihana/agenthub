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


type FlowEnvelope = {
  rev?: string;
  flows: NodeRedNode[];
};

const isNodeArray = (value: unknown): value is NodeRedNode[] => Array.isArray(value);

const extractFlowEnvelope = (data: any): FlowEnvelope | null => {
  const payload = data?.data?.flows
    ? data.data
    : data?.flows
      ? data
      : data?.data
        ? data.data
        : data;

  if (isNodeArray(payload)) {
    return { flows: payload };
  }

  if (payload && typeof payload === 'object' && isNodeArray(payload.flows)) {
    return { rev: typeof payload.rev === 'string' ? payload.rev : undefined, flows: payload.flows };
  }

  return null;
};

const mergeTabNodesIntoEnvelope = (envelope: FlowEnvelope, tabId: string, updatedTabNodes: NodeRedNode[]): FlowEnvelope => {
  const untouched = envelope.flows.filter((node) => node.z !== tabId && node.id !== tabId);
  const mergedFlows = [...untouched, ...updatedTabNodes];

  return {
    ...(envelope.rev ? { rev: envelope.rev } : {}),
    flows: mergedFlows
  };
};

const SubflowDeployPage = () => {
  const [tab, setTab] = useState<DeployTab>('flows');
  const [flowSource, setFlowSource] = useState<FlowSource>('admin-api');
  const [adminUrl, setAdminUrl] = useState('http://localhost:1880');
  const [flowFilePath, setFlowFilePath] = useState('agent/subflow/node-red-2step-flow.json');
  const [flowsFilePath, setFlowsFilePath] = useState('');
  const [targetExportPath, setTargetExportPath] = useState('node-red/flows/flows.dev.json');
  const [token, setToken] = useState('');
  const [flowJsonText, setFlowJsonText] = useState('');
  const [selectedTabId, setSelectedTabId] = useState<string>('');
  const [selectedTabEditText, setSelectedTabEditText] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
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
      throw new Error(data.error || (Array.isArray(data.errors) ? data.errors.join('\n') : '요청에 실패했습니다.'));
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

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const flowEnvelope = useMemo(() => extractFlowEnvelope(result), [result]);
  const nodes = flowEnvelope?.flows ?? [];

  useEffect(() => {
    if (tab === 'flows' && !result && !loading) {
      fetchRegisteredFlows();
    }
  }, [tab]);

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

  useEffect(() => {
    setSelectedTabEditText(selectedTabNodes.length > 0 ? pretty(selectedTabNodes) : '[]');
    setValidationMessage('');
  }, [selectedTabId, result]);

  const buildPatchedPayload = () => {
    if (!flowEnvelope || !selectedTabId) {
      throw new Error('조회 결과와 선택 탭이 필요합니다.');
    }

    const updatedTabNodes = JSON.parse(selectedTabEditText);
    if (!Array.isArray(updatedTabNodes)) {
      throw new Error('선택 탭 편집 JSON은 배열이어야 합니다.');
    }

    return mergeTabNodesIntoEnvelope(flowEnvelope, selectedTabId, updatedTabNodes as NodeRedNode[]);
  };

  const validatePatchedFlow = async () => run(async () => {
    const payload = buildPatchedPayload();
    const data = await request('/api/subflow-manager/v1/node-red/validate', {
      method: 'POST',
      body: JSON.stringify({ flow_json: payload })
    });
    setValidationMessage(`검증 성공: nodes=${data.node_count}, tabs=${data.tab_count}, rev=${data.has_rev ? '있음' : '없음'}`);
    return data;
  });

  const deployPatchedFlow = async () => run(async () => {
    const payload = buildPatchedPayload();
    const validation = await request('/api/subflow-manager/v1/node-red/validate', {
      method: 'POST',
      body: JSON.stringify({ flow_json: payload })
    });

    const deployResult = await request('/api/subflow-manager/v1/node-red/deploy/admin-api', {
      method: 'POST',
      body: JSON.stringify({
        admin_url: adminUrl,
        token: token || undefined,
        flow_json: payload
      })
    });

    setValidationMessage(`검증 후 배포 완료: nodes=${validation.node_count}, tabs=${validation.tab_count}`);
    setFlowJsonText(pretty(payload));
    setTab('deploy');

    return {
      validation,
      deploy: deployResult
    };
  });

  const movePatchedFlowToDeployEditor = () => {
    try {
      const payload = buildPatchedPayload();
      setFlowJsonText(pretty(payload));
      setTab('deploy');
    } catch (e: any) {
      setError(e.message || '편집본 이동에 실패했습니다.');
    }
  };


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
      <p>첫 화면은 현재 Node-RED 플로우 조회입니다. 탭별로 확인 후 필요하면 배포/반영 탭에서 JSON을 수정/배포하세요. <Link to="/agent/subflow">Flow 생성/실행 화면으로 이동</Link></p>

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

            <p style={{ marginTop: 10 }}>탭 단위로 선택 후 전체 Flow 구조를 유지한 상태에서 부분 편집/검증/배포를 수행할 수 있습니다.</p>
            {error && <p className="subflow-error">{error}</p>}
            {validationMessage && <p style={{ color: '#2e7d32' }}>{validationMessage}</p>}
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
            <h2>선택 탭 부분 편집(JSON) - 전체 Flow 구조 유지</h2>
            <div className="subflow-actions" style={{ marginBottom: 10 }}>
              <button
                disabled={selectedTabNodes.length === 0}
                onClick={() => copyToClipboard(pretty(selectedTabNodes))}
              >
                선택 탭 JSON 복사
              </button>
              <button disabled={!result || !selectedTabId} onClick={validatePatchedFlow}>스키마 검증</button>
              <button disabled={!result || !selectedTabId} onClick={deployPatchedFlow}>검증 후 즉시 배포</button>
              <button disabled={!result || !selectedTabId} onClick={movePatchedFlowToDeployEditor}>배포 JSON 편집기로 보내기</button>
            </div>
            <p style={{ marginBottom: 8 }}>※ 아래는 선택 탭 노드 배열만 편집합니다. 실제 배포 시에는 시스템이 전체 Flow JSON(rev/다른 탭 포함) 구조로 자동 병합하여 반영합니다.</p>
            <textarea value={selectedTabEditText} onChange={(e) => setSelectedTabEditText(e.target.value)} rows={12} />
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
