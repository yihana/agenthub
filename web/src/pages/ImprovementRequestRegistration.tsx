import React, { useState, useEffect } from 'react';
import { MessageSquare, CheckCircle, MessageCircle, User, Bot, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface ChatHistory {
  id: number;
  session_id: string;
  user_message: string;
  assistant_response: string;
  sources: any[];
  created_at: string;
}

const ImprovementRequestRegistration: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [chatHistories, setChatHistories] = useState<ChatHistory[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<ChatHistory | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [formData, setFormData] = useState({
    category: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  const categories = [
    { value: '응답품질', label: '응답품질' },
    { value: '말도안되는 답변', label: '말도안되는 답변' },
    { value: '오류 개선', label: '오류 개선' }
  ];

  useEffect(() => {
    loadChatHistories();
  }, []);

  const loadChatHistories = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const response = await fetch('/api/chat/all-histories', {
        headers
      });
      const data = await response.json();
      
      if (response.ok) {
        if (data.histories) {
          setChatHistories(data.histories);
        } else {
          setChatHistories([]);
        }
      } else {
        if (response.status === 401) {
          alert('인증이 필요합니다. 다시 로그인해주세요.');
          // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
          window.location.href = '/error';
        } else {
          console.error('Error loading chat histories:', data.error);
          setChatHistories([]);
        }
      }
    } catch (error) {
      console.error('Error loading chat histories:', error);
      setChatHistories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleHistorySelect = (history: ChatHistory) => {
    setSelectedHistory(history);
    setSelectedText('');
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  const handleTextAreaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSelectedText(e.target.value);
  };

  const handleSubmit = async () => {
    if (!selectedHistory || !formData.category || !formData.description) {
      alert('채팅 히스토리를 선택하고, 개선요청 분류와 내용을 입력해주세요.');
      return;
    }

    const textToSubmit = selectedText || selectedHistory.assistant_response;

    setIsSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const response = await fetch('/api/improvement/requests', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sessionId: selectedHistory.session_id,
          chatHistoryId: selectedHistory.id,
          selectedText: textToSubmit,
          category: formData.category,
          description: formData.description,
          createdBy: 'user'
        }),
      });

      if (response.ok) {
        setSubmitSuccess(true);
        setTimeout(() => {
          navigate('/rag-quality-improvement-list');
        }, 2000);
      } else {
        const error = await response.json();
        if (response.status === 401) {
          alert('인증이 필요합니다. 다시 로그인해주세요.');
          // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
          window.location.href = '/error';
        } else {
          alert(`개선요청 제출 중 오류가 발생했습니다: ${error.error}`);
        }
      }
    } catch (error) {
      console.error('Error submitting improvement request:', error);
      alert('개선요청 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    navigate('/');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  if (loading) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="답변품질 개선요청 등록"
          onTitleClick={handleBack}
        />
        <main className="app-main">
          <div className="loading-container" style={{ width: '90%', margin: '0 auto' }}>
            <div className="loading-spinner"></div>
            <p>채팅 히스토리를 불러오는 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="답변품질 개선요청 등록"
          onTitleClick={handleBack}
        />
        <main className="app-main">
          <div className="success-container" style={{ width: '90%', margin: '0 auto' }}>
            <CheckCircle size={64} color="#10b981" />
            <h2>개선요청이 성공적으로 제출되었습니다!</h2>
            <p>관리자가 검토 후 응답드리겠습니다.</p>
            <p>잠시 후 개선요청 조회 페이지로 이동합니다...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="답변품질 개선요청 등록"
        onTitleClick={handleBack}
      />
      <main className="app-main">
        <div className="improvement-registration-container" style={{ width: '90%', margin: '0 auto' }}>
        <div className="top-section">
          <div className="chat-history-section">
            <h3>채팅 히스토리 선택</h3>
            <div className="chat-history-list">
              {chatHistories.length === 0 ? (
                <div className="empty-state">
                  <MessageCircle size={48} className="empty-icon" />
                  <h4>채팅 히스토리가 없습니다</h4>
                  <p>먼저 채팅을 진행한 후 개선요청을 제출해주세요.</p>
                </div>
              ) : (
                chatHistories.map((history) => (
                  <div
                    key={history.id}
                    className={`chat-history-item ${selectedHistory?.id === history.id ? 'selected' : ''}`}
                    onClick={() => handleHistorySelect(history)}
                  >
                    <div className="chat-history-header">
                      <span className="session-id">세션: {history.session_id}</span>
                      <span className="chat-date">
                        <Calendar size={14} />
                        {formatDate(history.created_at)}
                      </span>
                    </div>
                    <div className="chat-content">
                      <div className="user-message">
                        <User size={16} />
                        <span>{history.user_message}</span>
                      </div>
                      <div className="assistant-message">
                        <Bot size={16} />
                        <span>{history.assistant_response.substring(0, 100)}...</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="selected-chat-section">
            <h3>선택된 채팅 내용</h3>
            {selectedHistory ? (
              <>
                <div className="chat-detail">
                  <div className="chat-message">
                    <div className="message-header">
                      <User size={16} />
                      <span>사용자</span>
                    </div>
                    <div className="message-content">{selectedHistory.user_message}</div>
                  </div>
                  <div className="chat-message">
                    <div className="message-header">
                      <Bot size={16} />
                      <span>어시스턴트</span>
                    </div>
                    <div 
                      className="message-content selectable"
                      onMouseUp={handleTextSelection}
                    >
                      {selectedHistory.assistant_response}
                    </div>
                  </div>
                </div>
                
                <div className="text-selection">
                  <label htmlFor="selected-text">개선이 필요한 텍스트:</label>
                  <textarea
                    id="selected-text"
                    value={selectedText}
                    onChange={handleTextAreaChange}
                    placeholder="개선이 필요한 부분을 선택하거나 직접 입력하세요"
                    className="form-textarea"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <div className="empty-state">
                <MessageCircle size={48} className="empty-icon" />
                <h4>채팅 히스토리를 선택해주세요</h4>
                <p>왼쪽에서 개선요청을 제출할 채팅을 선택해주세요.</p>
              </div>
            )}
          </div>
        </div>

        {selectedHistory && (
          <div className="form-section">
            <div className="form-group">
              <label htmlFor="category">개선요청 분류 *</label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="form-select"
              >
                <option value="">분류를 선택하세요</option>
                {categories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="description">개선요청 내용 *</label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="어떤 부분이 불만족스러운지, 어떻게 개선되었으면 하는지 구체적으로 설명해주세요."
                className="form-textarea"
                rows={6}
              />
            </div>

            <div className="form-actions">
              <button
                onClick={handleSubmit}
                disabled={!selectedHistory || !formData.category || !formData.description || isSubmitting}
                className="submit-button"
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner" />
                    제출 중...
                  </>
                ) : (
                  <>
                    <MessageSquare size={16} />
                    개선요청 제출
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default ImprovementRequestRegistration;