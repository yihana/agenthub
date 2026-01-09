import React, { useState, useEffect } from 'react';
import { MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Calendar, User, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuthHeaders } from '../utils/api';

interface ImprovementRequest {
  id: number;
  chat_history_id: number;
  selected_text: string;
  category: string;
  description: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  user_message: string;
  assistant_response: string;
  chat_created_at: string;
  responses?: Array<{
    id: number;
    response_text: string;
    responded_by: string;
    created_at: string;
  }>;
}

const ImprovementRequestList: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ImprovementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ImprovementRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    loadRequests();
  }, [filterStatus, filterCategory]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.append('status', filterStatus);
      if (filterCategory !== 'all') params.append('category', filterCategory);
      
      const response = await fetch(`/api/improvement/requests?${params.toString()}`, {
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
        setShowDetailModal(true);
      } else {
        alert('답변품질 개선요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Error fetching request detail:', error);
      alert('답변품질 개선요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>답변품질 개선요청 조회</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>답변품질 개선요청을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1>답변품질 개선요청 조회</h1>
        </div>
        <div className="error-container">
          <p>{error}</p>
          <button onClick={loadRequests} className="retry-button">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft size={16} />
          뒤로가기
        </button>
        <h1>개선요청 조회</h1>
        <p>제출한 개선요청의 상태를 확인하고 관리자 응답을 확인할 수 있습니다.</p>
      </div>

      {/* 필터 */}
      <div className="filter-section">
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
      </div>

      {/* 개선요청 목록 */}
      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} className="empty-icon" />
            <h3>답변품질 개선요청이 없습니다</h3>
            <p>아직 제출한 답변품질 개선요청이 없습니다.</p>
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
                  <span>{request.created_by}</span>
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
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>개선요청 상세</h2>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="close-button"
              >
                ×
              </button>
            </div>

            <div className="modal-content">
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
                    <span className={`status-badge ${getStatusColor(selectedRequest.status)}`}>
                      {getStatusIcon(selectedRequest.status)}
                      {getStatusText(selectedRequest.status)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>신청자:</label>
                    <span>{selectedRequest.created_by}</span>
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
                <h3>개선요청 내용</h3>
                <div className="description-detail">
                  {selectedRequest.description}
                </div>
              </div>

              {selectedRequest.responses && selectedRequest.responses.length > 0 && (
                <div className="detail-section">
                  <h3>관리자 응답</h3>
                  {selectedRequest.responses.map((response) => (
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
      )}
    </div>
  );
};

export default ImprovementRequestList;
