import React, { useState, useEffect } from 'react';
import { MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Calendar, User, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import { getAuthHeaders } from '../utils/api';

interface ImprovementRequest {
  id: number;
  chat_history_id: number;
  selected_text: string;
  category: string;
  description: string;
  status: string;
  created_by: string;
  created_by_full_name?: string;
  created_at: string;
  updated_at: string;
  user_message: string;
  assistant_response: string;
  chat_created_at: string;
  response_count: number;
}

interface ImprovementResponse {
  id: number;
  response_text: string;
  responded_by: string;
  created_at: string;
}

const ImprovementRequestAdmin: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, handleLogin, handleLogout } = useAuth();
  const [requests, setRequests] = useState<ImprovementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ImprovementRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [responseText, setResponseText] = useState('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);
  const [responses, setResponses] = useState<ImprovementResponse[]>([]);

  useEffect(() => {
    loadRequests();
  }, [filterStatus, filterCategory]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterCategory !== 'all') params.append('category', filterCategory);
      
      const response = await fetch(`/api/improvement/admin/requests?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok) {
        setRequests(data.requests);
      } else {
        setError(data.error || '답변품질 개선요청을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('답변품질 개선요청을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} className="text-yellow-600" />;
      case 'in_progress':
        return <AlertCircle size={16} className="text-blue-600" />;
      case 'resolved':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'rejected':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return '대기중';
      case 'in_progress':
        return '처리중';
      case 'resolved':
        return '해결됨';
      case 'rejected':
        return '거부됨';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const handleRequestClick = async (requestId: number) => {
    try {
      const response = await fetch(`/api/improvement/requests/${requestId}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok) {
        setSelectedRequest(data.request);
        setResponses(data.responses || []);
        setShowDetailModal(true);
      } else {
        alert('답변품질 개선요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Error fetching request detail:', error);
      alert('개선요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleStatusChange = async (requestId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/improvement/requests/${requestId}/status`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // 상태 업데이트 후 목록 새로고침
        loadRequests();
        if (selectedRequest && selectedRequest.id === requestId) {
          setSelectedRequest({ ...selectedRequest, status: newStatus });
        }
      } else {
        const error = await response.json();
        alert(`상태 업데이트 중 오류가 발생했습니다: ${error.error}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('상태 업데이트 중 오류가 발생했습니다.');
    }
  };

  const handleSubmitResponse = async () => {
    if (!selectedRequest || !responseText.trim()) {
      alert('응답 내용을 입력해주세요.');
      return;
    }

    setIsSubmittingResponse(true);
    try {
      const response = await fetch(`/api/improvement/requests/${selectedRequest.id}/responses`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          responseText: responseText.trim(),
          respondedBy: 'admin' // 실제로는 관리자 정보를 가져와야 함
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResponses([...responses, data.response]);
        setResponseText('');
        // 목록 새로고침
        loadRequests();
        alert('응답이 성공적으로 제출되었습니다.');
      } else {
        const error = await response.json();
        alert(`응답 제출 중 오류가 발생했습니다: ${error.error}`);
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      alert('응답 제출 중 오류가 발생했습니다.');
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  if (loading) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="답변품질 개선요청 관리"
          onTitleClick={() => navigate('/')}
        />
        <main className="app-main">
          <div className="loading-container" style={{ width: '90%', margin: '0 auto' }}>
            <div className="loading-spinner"></div>
            <p>답변품질 개선요청을 불러오는 중...</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="답변품질 개선요청 관리"
          onTitleClick={() => navigate('/')}
        />
        <main className="app-main">
          <div className="error-container" style={{ width: '90%', margin: '0 auto' }}>
            <p>{error}</p>
            <button onClick={loadRequests} className="retry-button">
              다시 시도
            </button>
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
        pageTitle="답변품질 개선요청 관리"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="improvement-admin-container" style={{ maxWidth: '65vw', margin: '0 auto' }}>
        <div className="filter-group">
          <label htmlFor="status-filter">상태별 필터:</label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">전체</option>
            <option value="pending">대기중</option>
            <option value="in_progress">처리중</option>
            <option value="resolved">해결됨</option>
            <option value="rejected">거부됨</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="category-filter">분류별 필터:</label>
          <select
            id="category-filter"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="filter-select"
          >
            <option value="all">전체</option>
            <option value="응답품질">응답품질</option>
            <option value="말도안되는 답변">말도안되는 답변</option>
            <option value="오류 개선">오류 개선</option>
          </select>
        </div>

      {/* 개선요청 목록 */}
      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} className="empty-icon" />
            <h3>답변품질 개선요청이 없습니다</h3>
            <p>현재 필터 조건에 맞는 답변품질 개선요청이 없습니다.</p>
          </div>
        ) : (
          requests.map((request) => (
            <div
              key={request.id}
              className="request-item"
              onClick={() => handleRequestClick(request.id)}
            >
              <div className="request-header">
                <div className="request-title">
                  <span className="request-id">#{request.id}</span>
                  <span className="request-category">{request.category}</span>
                  {request.response_count > 0 && (
                    <span className="response-count">응답 {request.response_count}개</span>
                  )}
                </div>
                <div className={`status-badge ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  {getStatusText(request.status)}
                </div>
              </div>

              <div className="request-content">
                <div className="selected-text-preview">
                  <strong>선택된 텍스트:</strong>
                  <p>{request.selected_text.length > 100 
                    ? request.selected_text.substring(0, 100) + '...' 
                    : request.selected_text}</p>
                </div>
                
                <div className="request-description">
                  <strong>답변품질 개선요청 내용:</strong>
                  <p>{request.description.length > 150 
                    ? request.description.substring(0, 150) + '...' 
                    : request.description}</p>
                </div>
              </div>

              <div className="request-meta">
                <div className="meta-item">
                  <User size={14} />
                  <span>
                    {request.created_by}
                    {request.created_by_full_name && ` (${request.created_by_full_name})`}
                  </span>
                </div>
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>{formatDate(request.created_at)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 상세 모달 */}
      {showDetailModal && selectedRequest && (
        <div className="improvement-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="improvement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="improvement-modal-header">
              <h2>답변품질 개선요청 관리 상세</h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="close-button"
              >
                ×
              </button>
            </div>

            <div className="improvement-modal-content">
              <div className="detail-section">
                <h3>기본 정보</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>요청 ID:</label>
                    <span>#{selectedRequest.id}</span>
                  </div>
                  <div className="detail-item">
                    <label>분류:</label>
                    <span>{selectedRequest.category}</span>
                  </div>
                  <div className="detail-item">
                    <label>상태:</label>
                    <select
                      value={selectedRequest.status}
                      onChange={(e) => handleStatusChange(selectedRequest.id, e.target.value)}
                      className="status-select"
                      aria-label="상태 변경"
                    >
                      <option value="pending">대기중</option>
                      <option value="in_progress">처리중</option>
                      <option value="resolved">해결됨</option>
                      <option value="rejected">거부됨</option>
                    </select>
                  </div>
                  <div className="detail-item">
                    <label>신청자:</label>
                    <span>
                      {selectedRequest.created_by}
                      {selectedRequest.created_by_full_name && ` (${selectedRequest.created_by_full_name})`}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>신청일:</label>
                    <span>{formatDate(selectedRequest.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>관련 채팅 내용</h3>
                <div className="chat-context">
                  <div className="user-message">
                    <strong>사용자:</strong> {selectedRequest.user_message}
                  </div>
                  <div className="assistant-message">
                    <strong>어시스턴트:</strong> {selectedRequest.assistant_response}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>선택된 텍스트</h3>
                <div className="selected-text-detail">
                  {selectedRequest.selected_text}
                </div>
              </div>

              <div className="detail-section">
                <h3>답변품질 개선요청 내용</h3>
                <div className="description-detail">
                  {selectedRequest.description}
                </div>
              </div>

              <div className="detail-section">
                <h3>관리자 응답</h3>
                <div className="response-form">
                  <textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="사용자에게 전달할 응답 내용을 입력하세요..."
                    className="response-textarea"
                    rows={4}
                  />
                  <button
                    onClick={handleSubmitResponse}
                    disabled={!responseText.trim() || isSubmittingResponse}
                    className="submit-response-button"
                  >
                    {isSubmittingResponse ? (
                      <>
                        <div className="loading-spinner" />
                        제출 중...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        응답 제출
                      </>
                    )}
                  </button>
                </div>

                {responses.length > 0 && (
                  <div className="responses-list">
                    {responses.map((response) => (
                      <div key={response.id} className="response-item">
                        <div className="response-header">
                          <span className="response-author">{response.responded_by}</span>
                          <span className="response-date">{formatDate(response.created_at)}</span>
                        </div>
                        <div className="response-content">
                          {response.response_text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        )}
        </div>
      </main>
    </div>
  );
};

export default ImprovementRequestAdmin;
