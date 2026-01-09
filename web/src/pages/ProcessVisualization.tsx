import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactFlow, Node, Edge, addEdge, Connection, useNodesState, useEdgesState, Controls, Background, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import ProcessNode from '../components/ProcessNode';
import ContextPanel from '../components/ContextPanel';
import AIPanel from '../components/AIPanel';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
// import { Invoice, ProcessStep, ProcessData } from '../types/process';
import './ProcessVisualization.css';

// 초기 노드 데이터
const initialNodes: Node[] = [
  {
    id: '1',
    type: 'processNode',
    position: { x: 100, y: 100 },
    data: { 
      label: 'Invoice 접수',
      step: 'INVOICE_RECEIVED',
      status: 'completed',
      kpi: { count: 150, avgTime: '2시간', successRate: '98%' },
      backlog: 3,
      recentItems: ['INV-2024-001', 'INV-2024-002', 'INV-2024-003'],
      errors: [],
      permissions: ['view', 'edit', 'approve']
    },
  },
  {
    id: '2',
    type: 'processNode',
    position: { x: 400, y: 100 },
    data: { 
      label: 'Invoice 검증',
      step: 'INVOICE_VALIDATION',
      status: 'in_progress',
      kpi: { count: 120, avgTime: '4시간', successRate: '95%' },
      backlog: 8,
      recentItems: ['INV-2024-004', 'INV-2024-005', 'INV-2024-006'],
      errors: ['INV-2024-007: 금액 불일치', 'INV-2024-008: 공급업체 정보 누락'],
      permissions: ['view', 'edit', 'approve']
    },
  },
  {
    id: '3',
    type: 'processNode',
    position: { x: 700, y: 100 },
    data: { 
      label: '승인 처리',
      step: 'APPROVAL',
      status: 'pending',
      kpi: { count: 100, avgTime: '1일', successRate: '99%' },
      backlog: 15,
      recentItems: ['INV-2024-009', 'INV-2024-010'],
      errors: [],
      permissions: ['view', 'approve', 'reject']
    },
  },
  {
    id: '4',
    type: 'processNode',
    position: { x: 1000, y: 100 },
    data: { 
      label: '결제 처리',
      step: 'PAYMENT',
      status: 'pending',
      kpi: { count: 85, avgTime: '2일', successRate: '100%' },
      backlog: 12,
      recentItems: ['INV-2024-011'],
      errors: [],
      permissions: ['view', 'execute']
    },
  },
  {
    id: '5',
    type: 'processNode',
    position: { x: 1300, y: 100 },
    data: { 
      label: '완료 처리',
      step: 'COMPLETION',
      status: 'pending',
      kpi: { count: 80, avgTime: '1시간', successRate: '100%' },
      backlog: 5,
      recentItems: ['INV-2024-012', 'INV-2024-013'],
      errors: [],
      permissions: ['view', 'archive']
    },
  },
];

// 초기 엣지 데이터
const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
  },
  {
    id: 'e4-5',
    source: '4',
    target: '5',
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#3b82f6', strokeWidth: 2 },
  },
];

// 노드 타입 정의
const nodeTypes: NodeTypes = {
  processNode: ProcessNode,
};

const ProcessVisualization: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleAiSubmit = async (query: string) => {
    setIsAiLoading(true);
    setAiResponse('');
    
    try {
      // AI API 호출
      const response = await fetch('/api/process/ai-query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          selectedNode: selectedNode?.data,
          processData: nodes.map(n => n.data)
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setAiResponse(result.response);
        
        // AI가 상태 변경을 요청한 경우 노드 업데이트
        if (result.action && result.targetNodeId) {
          updateNodeStatus(result.targetNodeId, result.action);
        }
      } else {
        setAiResponse('AI 응답을 가져오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      setAiResponse('네트워크 오류가 발생했습니다.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateNodeStatus = (nodeId: string, newStatus: string) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                status: newStatus,
              },
            }
          : node
      )
    );
  };

  const handleContextAction = (action: string, nodeId: string) => {
    switch (action) {
      case 'approve':
        updateNodeStatus(nodeId, 'completed');
        break;
      case 'reject':
        updateNodeStatus(nodeId, 'rejected');
        break;
      case 'reset':
        updateNodeStatus(nodeId, 'pending');
        break;
      default:
        console.log('Unknown action:', action);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="프로세스 시각화"
        onTitleClick={handleBack}
      />
      <main className="app-main process-visualization-main">
        {/* 프로세스 검색 섹션 */}
        <div className="process-search-section">
          <div className="process-search-container">
            <div className="search-input-group">
              <input 
                type="text" 
                className="search-input" 
                placeholder="프로세스 검색..."
              />
              <button className="search-button" disabled>
                검색
              </button>
            </div>
            <div className="process-controls">
              <button className="refresh-btn" disabled>
                새로고침
              </button>
            </div>
          </div>
        </div>
        
        <div className="process-content" style={{ width: '100%', margin: '0' }}>
          <div className="process-graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={handleNodeClick}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>

        <div className="process-panels">
          <ContextPanel 
            selectedNode={selectedNode}
            onAction={handleContextAction}
          />
          <AIPanel 
            query={aiQuery}
            setQuery={setAiQuery}
            response={aiResponse}
            isLoading={isAiLoading}
            onSubmit={handleAiSubmit}
          />
        </div>
        </div>
      </main>
    </div>
  );
};

export default ProcessVisualization;
