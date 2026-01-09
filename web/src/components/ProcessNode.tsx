import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { ProcessData } from '../types/process';
import './ProcessNode.css';

interface ProcessNodeData extends ProcessData {
  label: string;
}

const ProcessNode: React.FC<NodeProps<ProcessNodeData>> = ({ data, selected }) => {

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '완료';
      case 'in_progress':
        return '진행중';
      case 'pending':
        return '대기';
      case 'rejected':
        return '거부';
      case 'error':
        return '오류';
      default:
        return '대기';
    }
  };

  return (
    <div className={`process-node ${selected ? 'selected' : ''}`}>
      <Handle type="target" position={Position.Left} style={{ background: '#555' }} />
      
      <div className="node-header">
        <h3>{data.label}</h3>
        <span 
          className={`status-badge status-${data.status}`}
        >
          {getStatusText(data.status)}
        </span>
      </div>

      <div className="node-content">
        <div className="kpi-section">
          <div className="kpi-item">
            <span className="kpi-label">처리건수</span>
            <span className="kpi-value">{data.kpi.count}</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-label">평균시간</span>
            <span className="kpi-value">{data.kpi.avgTime}</span>
          </div>
          <div className="kpi-item">
            <span className="kpi-label">성공률</span>
            <span className="kpi-value">{data.kpi.successRate}</span>
          </div>
        </div>

        <div className="backlog-section">
          <span className="backlog-label">미결건수</span>
          <span className="backlog-value">{data.backlog}</span>
        </div>

        {data.errors.length > 0 && (
          <div className="errors-section">
            <span className="errors-label">오류</span>
            <span className="errors-count">{data.errors.length}건</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#555' }} />
    </div>
  );
};

export default ProcessNode;
