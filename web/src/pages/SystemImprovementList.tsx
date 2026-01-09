import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, 
  Calendar, ChevronLeft, ChevronRight, FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { getAuthHeaders } from '../utils/api';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { sanitizeHtml } from '../utils/htmlSanitizer';

interface SystemImprovementRequest {
  id: number;
  title: string;
  content: string;
  attachments: any[];
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  response_count: number;
}

interface SystemImprovementResponse {
  id: number;
  response_text: string;
  responded_by: string;
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const SystemImprovementList: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [requests, setRequests] = useState<SystemImprovementRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<SystemImprovementRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [responses, setResponses] = useState<SystemImprovementResponse[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  useEffect(() => {
    loadRequests();
  }, [filterStatus, pagination.page]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', pagination.page.toString());
      params.append('limit', pagination.limit.toString());
      if (filterStatus !== 'all') params.append('status', filterStatus);
      
      const response = await fetch(`/api/improvement/system-requests?${params.toString()}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok) {
        setRequests(data.requests);
        setPagination(data.pagination);
      } else {
        setError(data.error || '시스템 개선요청을 불러오는 중 오류가 발생했습니다.');
      }
    } catch (err) {
      setError('시스템 개선요청을 불러오는 중 오류가 발생했습니다.');
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
      const response = await fetch(`/api/improvement/system-requests/${requestId}`, {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      
      if (response.ok) {
        setSelectedRequest(data.request);
        setResponses(data.responses || []);
        setShowDetailModal(true);
      } else {
        alert('시스템 개선요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
      }
    } catch (error) {
      console.error('Error fetching request detail:', error);
      alert('시스템 개선요청 상세 정보를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const changePage = (newPage: number) => {
    setPagination({ ...pagination, page: newPage });
  };

  const stripHtml = (html: string) => {
    const tmp = document.createElement('DIV');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  };

  if (loading && requests.length === 0) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="내 시스템 개선요청"
          onTitleClick={() => navigate('/')}
        />
        <main className="app-main">
          <div className="loading-container" style={{ width: '90%', margin: '0 auto' }}>
            <div className="loading-spinner"></div>
            <p>시스템 개선요청을 불러오는 중...</p>
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
          pageTitle="내 시스템 개선요청"
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
        pageTitle="내 시스템 개선요청"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="system-improvement-list-container" style={{ width: '90%', margin: '0 auto', maxWidth: '65vw' }}>
        <div className="filter-group">
          <label htmlFor="status-filter">상태별 필터:</label>
          <select
            id="status-filter"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPagination({ ...pagination, page: 1 });
            }}
            className="filter-select"
          >
            <option value="all">전체</option>
            <option value="pending">대기중</option>
            <option value="in_progress">처리중</option>
            <option value="resolved">해결됨</option>
            <option value="rejected">거부됨</option>
          </select>
        </div>

        <div className="pagination-info">
          전체 {pagination.total}개 중 {((pagination.page - 1) * pagination.limit) + 1}-
          {Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
        </div>

      {/* 시스템 개선요청 목록 */}
      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="empty-state">
            <MessageSquare size={48} className="empty-icon" />
            <h3>시스템 개선요청이 없습니다</h3>
            <p>"시스템 개선요청" 메뉴에서 개선요청을 제출해주세요.</p>
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
                  <span className="request-main-title">{request.title}</span>
                  {request.response_count > 0 && (
                    <span className="response-count-badge">
                      응답 {request.response_count}개
                    </span>
                  )}
                </div>
                <div className={`status-badge ${getStatusColor(request.status)}`}>
                  {getStatusIcon(request.status)}
                  {getStatusText(request.status)}
                </div>
              </div>

              <div className="request-content">
                <div className="request-preview">
                  {stripHtml(request.content).substring(0, 200)}
                  {stripHtml(request.content).length > 200 && '...'}
                </div>
              </div>

              <div className="request-meta">
                <div className="meta-item">
                  <Calendar size={14} />
                  <span>{formatDate(request.created_at)}</span>
                </div>
                {request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0 && (
                  <div className="meta-item">
                    <FileText size={14} />
                    <span>첨부파일 {request.attachments.length}개</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 페이징 */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => changePage(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="pagination-button"
          >
            <ChevronLeft size={16} />
            이전
          </button>

          <div className="pagination-pages">
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => {
              if (
                page === 1 ||
                page === pagination.totalPages ||
                (page >= pagination.page - 2 && page <= pagination.page + 2)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => changePage(page)}
                    className={`pagination-page ${page === pagination.page ? 'active' : ''}`}
                  >
                    {page}
                  </button>
                );
              } else if (page === pagination.page - 3 || page === pagination.page + 3) {
                return <span key={page} className="pagination-ellipsis">...</span>;
              }
              return null;
            })}
          </div>

          <button
            onClick={() => changePage(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="pagination-button"
          >
            다음
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 상세 모달 (읽기 전용) */}
      {showDetailModal && selectedRequest && (
        <div className="improvement-modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="improvement-modal system-improvement-modal" onClick={(e) => e.stopPropagation()}>
            <div className="improvement-modal-header">
              <h2>시스템 개선요청 상세</h2>
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
                    <label>제목:</label>
                    <span>{selectedRequest.title.replace(/[<>]/g, '')}</span>
                  </div>
                  <div className="detail-item">
                    <label>상태:</label>
                    <span className={`status-badge ${getStatusColor(selectedRequest.status)}`}>
                      {getStatusIcon(selectedRequest.status)}
                      {getStatusText(selectedRequest.status)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>신청일:</label>
                    <span>{formatDate(selectedRequest.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>요청 내용</h3>
                <div className="content-display">
                  <ReactQuill
                    value={sanitizeHtml(selectedRequest.content, true)}
                    readOnly={true}
                    theme="bubble"
                  />
                </div>
              </div>

              {selectedRequest.attachments && Array.isArray(selectedRequest.attachments) && selectedRequest.attachments.length > 0 && (
                <div className="detail-section">
                  <h3>첨부파일</h3>
                  <div className="attachments-list">
                    {selectedRequest.attachments.map((file: any, index: number) => (
                      <div key={index} className="attachment-item">
                        <FileText size={16} />
                        <span>{file.originalName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>관리자 응답</h3>
                {responses.length === 0 ? (
                  <div className="empty-responses">
                    <p>아직 관리자의 응답이 없습니다.</p>
                  </div>
                ) : (
                  <div className="responses-list">
                    {responses.map((response) => (
                      <div key={response.id} className="response-item">
                        <div className="response-header">
                          <span className="response-author">{response.responded_by}</span>
                          <span className="response-date">{formatDate(response.created_at)}</span>
                        </div>
                        <div className="response-content">
                          {response.response_text.replace(/[<>]/g, '')}
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
      <AppBottom />
    </div>
  );
};

export default SystemImprovementList;

