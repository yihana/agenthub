import React, { useState } from 'react';
import './AIPanel.css';

interface AIPanelProps {
  query: string;
  setQuery: (query: string) => void;
  response: string;
  isLoading: boolean;
  onSubmit: (query: string) => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ 
  query, 
  setQuery, 
  response, 
  isLoading, 
  onSubmit 
}) => {
  const [quickActions] = useState([
    '현재 프로세스 상태를 요약해줘',
    '미결건을 확인하고 우선순위를 알려줘',
    '오류가 있는 항목들을 분석해줘',
    '승인이 필요한 건들을 승인해줘',
    '프로세스 성능을 개선할 방안을 제안해줘'
  ]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSubmit(query);
      setQuery('');
    }
  };

  const handleQuickAction = (action: string) => {
    setQuery(action);
    onSubmit(action);
  };

  return (
    <div className="ai-panel">
      <div className="panel-header">
        <h3>AI 어시스턴트</h3>
        <span className="ai-status">온라인</span>
      </div>

      <div className="panel-content">
        <div className="chat-section">
          <div className="messages">
            {response && (
              <div className="message ai-message">
                <div className="message-header">
                  <span className="sender">AI</span>
                  <span className="timestamp">{new Date().toLocaleTimeString()}</span>
                </div>
                <div className="message-content">
                  {response}
                </div>
              </div>
            )}
            
            {isLoading && (
              <div className="message ai-message loading">
                <div className="message-header">
                  <span className="sender">AI</span>
                </div>
                <div className="message-content">
                  <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="message-form">
            <div className="input-group">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="프로세스에 대해 질문하세요..."
                className="message-input"
                disabled={isLoading}
              />
              <button 
                type="submit" 
                className="send-button"
                disabled={isLoading || !query.trim()}
              >
                전송
              </button>
            </div>
          </form>
        </div>

        <div className="quick-actions-section">
          <h4>빠른 액션</h4>
          <div className="quick-actions">
            {quickActions.map((action, index) => (
              <button
                key={index}
                className="quick-action-btn"
                onClick={() => handleQuickAction(action)}
                disabled={isLoading}
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        <div className="ai-capabilities">
          <h4>AI 기능</h4>
          <div className="capabilities-list">
            <div className="capability-item">
              <span className="capability-icon">📊</span>
              <span className="capability-text">프로세스 분석 및 리포트</span>
            </div>
            <div className="capability-item">
              <span className="capability-icon">🔍</span>
              <span className="capability-text">문제 진단 및 해결방안</span>
            </div>
            <div className="capability-item">
              <span className="capability-icon">⚡</span>
              <span className="capability-text">자동 승인/반려 처리</span>
            </div>
            <div className="capability-item">
              <span className="capability-icon">📈</span>
              <span className="capability-text">성능 최적화 제안</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIPanel;
