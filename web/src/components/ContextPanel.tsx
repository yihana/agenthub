import React from 'react';
import { Node } from 'reactflow';
import { ProcessData } from '../types/process';
import './ContextPanel.css';

interface ContextPanelProps {
  selectedNode: Node<ProcessData> | null;
  onAction: (action: string, nodeId: string) => void;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ selectedNode, onAction }) => {
  if (!selectedNode) {
    return (
      <div className="context-panel">
        <div className="panel-header">
          <h3>컨텍스트 패널</h3>
        </div>
        <div className="panel-content">
          <p className="no-selection">노드를 선택하여 상세 정보를 확인하세요.</p>
        </div>
      </div>
    );
  }

  const { data } = selectedNode;


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
    <div className="context-panel">
      <div className="panel-header">
        <h3>컨텍스트 패널</h3>
        <span 
          className={`status-indicator status-${data.status}`}
        >
          {getStatusText(data.status)}
        </span>
      </div>

      <div className="panel-content">
        <div className="section">
          <h4>KPI 지표</h4>
          <div className="kpi-grid">
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
        </div>

        <div className="section">
          <h4>미결 현황</h4>
          <div className="backlog-info">
            <span className="backlog-count">{data.backlog}건</span>
            <span className="backlog-status">대기중</span>
          </div>
        </div>

        <div className="section">
          <h4>최근 처리건</h4>
          <div className="recent-items">
            {data.recentItems.map((item, index) => (
              <div key={index} className="recent-item">
                <span className="item-number">{item}</span>
                <span className="item-status">처리완료</span>
              </div>
            ))}
          </div>
        </div>

        {data.errors.length > 0 && (
          <div className="section">
            <h4>오류/예외</h4>
            <div className="errors-list">
              {data.errors.map((error, index) => (
                <div key={index} className="error-item">
                  <span className="error-icon">⚠️</span>
                  <span className="error-text">{error}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section">
          <h4>액션</h4>
          <div className="action-buttons">
            {data.permissions.includes('approve') && (
              <button 
                className="action-btn approve"
                onClick={() => onAction('approve', selectedNode.id)}
              >
                승인
              </button>
            )}
            {data.permissions.includes('reject') && (
              <button 
                className="action-btn reject"
                onClick={() => onAction('reject', selectedNode.id)}
              >
                거부
              </button>
            )}
            <button 
              className="action-btn reset"
              onClick={() => onAction('reset', selectedNode.id)}
            >
              초기화
            </button>
            <button 
              className="action-btn escalate"
              onClick={() => onAction('escalate', selectedNode.id)}
            >
              에스컬레이션
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContextPanel;
