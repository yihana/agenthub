import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, 
  Download, 
  Calendar,
  User,
  Clock,
  MessageSquare,
  RefreshCw,
  XCircle,
  X
} from 'lucide-react';
import './ChatHistoryPage.css';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface ChatSession {
  session_id: string;
  user_id: string;
  last_activity: string;
  first_activity: string;
  message_count: number;
  last_user_message: string;
  last_assistant_response: string;
  full_name: string | null;
  department: string | null;
  position: string | null;
}

interface ChatMessage {
  id: number;
  session_id: string;
  user_id: string;
  user_message: string;
  assistant_response: string;
  sources: any[] | null;
  intent_options: any[] | null;
  created_at: string;
}

const ChatHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<ChatMessage[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  
  // 필터 상태
  const [filters, setFilters] = useState({
    page: 1,
    limit: 10,
    userid: '',
    startDate: '',
    endDate: '',
    searchKeyword: ''
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const loadChatHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
        return;
      }

      // 날짜 파라미터 처리 - startDate는 00:00:00, endDate는 23:59:59로 설정
      const queryParams = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        ...(filters.userid && { userid: filters.userid }),
        ...(filters.searchKeyword && { searchKeyword: filters.searchKeyword }),
        ...(filters.startDate && { startDate: `${filters.startDate}T00:00:00` }),
        ...(filters.endDate && { endDate: `${filters.endDate}T23:59:59` }),
        _t: Date.now().toString() // 캐시 방지를 위한 타임스탬프
      });

      const response = await fetch(`/api/chat-history?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        cache: 'no-store' // fetch API의 캐시 옵션
      });

      if (response.ok) {
        const data = await response.json();
        console.log('채팅 히스토리 응답 데이터:', data);
        console.log('세션 개수:', data.sessions?.length || 0);
        
        // 데이터 구조 확인
        if (!data.sessions) {
          console.error('응답에 sessions 필드가 없습니다:', data);
          setError('서버 응답 형식이 올바르지 않습니다.');
          setSessions([]);
          return;
        }
        
        setSessions(data.sessions || []);
        setPagination(data.pagination || {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0
        });
      } else if (response.status === 401) {
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
      } else if (response.status === 403) {
        // 관리자 권한 없음
        const errorData = await response.json().catch(() => ({ error: '관리자 권한이 필요합니다.' }));
        setError(errorData.error || '관리자 권한이 필요합니다.');
        setSessions([]);
      } else {
        const errorData = await response.json().catch(() => ({ error: '서버 오류가 발생했습니다.' }));
        setError(errorData.error || '채팅 히스토리를 불러오는데 실패했습니다.');
        setSessions([]);
      }
    } catch (error) {
      console.error('채팅 히스토리 로드 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, navigate]);

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      page: 1 // 필터 변경 시 첫 페이지로
    }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters(prev => ({
      ...prev,
      page: newPage
    }));
  };

  const formatDateTime = (dateTime: string) => {
    if (!dateTime) return '-';
    try {
      const date = new Date(dateTime);
      if (isNaN(date.getTime())) return dateTime;
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      // 오전/오후 판단
      const ampm = hours < 12 ? '오전' : '오후';
      const displayHours = hours === 0 ? 12 : (hours > 12 ? hours - 12 : hours);
      const displayHoursStr = String(displayHours).padStart(2, '0');
      
      return `${year}-${month}-${day} ${ampm} ${displayHoursStr}:${minutes}:${seconds}`;
    } catch (error) {
      return dateTime;
    }
  };

  const truncateText = (text: string, maxLength: number = 100) => {
    if (!text) return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // 선택한 세션의 전체 대화 내용 로드 (관리자는 모든 메시지 조회)
  const loadSessionMessages = useCallback(async (sessionId: string, userId: string) => {
    setIsLoadingMessages(true);
    try {
      const token = localStorage.getItem('token');
      // 관리자용: userId를 쿼리 파라미터로 전달하지 않으면 모든 메시지 조회
      // 하지만 현재 API는 userId를 필터링하므로, 관리자용 엔드포인트 사용
      const response = await fetch(`/api/chat-history/session/${sessionId}?limit=1000`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const messages = (data.history || []).map((msg: any) => ({
          id: msg.id || msg.ID || 0,
          session_id: msg.session_id || msg.SESSION_ID || sessionId,
          user_id: msg.user_id || msg.USER_ID || userId,
          user_message: msg.user_message || msg.USER_MESSAGE || '',
          assistant_response: msg.assistant_response || msg.ASSISTANT_RESPONSE || '',
          sources: msg.sources || msg.SOURCES ? (typeof (msg.sources || msg.SOURCES) === 'string' ? JSON.parse(msg.sources || msg.SOURCES) : (msg.sources || msg.SOURCES)) : null,
          intent_options: msg.intent_options || msg.INTENT_OPTIONS ? (typeof (msg.intent_options || msg.INTENT_OPTIONS) === 'string' ? JSON.parse(msg.intent_options || msg.INTENT_OPTIONS) : (msg.intent_options || msg.INTENT_OPTIONS)) : null,
          created_at: msg.created_at || msg.CREATED_AT || ''
        }));
        setSessionMessages(messages);
      } else {
        // 폴백: 기존 API 사용
        const fallbackResponse = await fetch(`/api/chat/history/${sessionId}?limit=1000`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Cache-Control': 'no-cache'
          }
        });
        if (fallbackResponse.ok) {
          const data = await fallbackResponse.json();
          const messages = (data.history || []).map((msg: any) => ({
            id: msg.id || msg.ID || 0,
            session_id: msg.session_id || msg.SESSION_ID || sessionId,
            user_id: msg.user_id || msg.USER_ID || userId,
            user_message: msg.user_message || msg.USER_MESSAGE || '',
            assistant_response: msg.assistant_response || msg.ASSISTANT_RESPONSE || '',
            sources: msg.sources || msg.SOURCES ? (typeof (msg.sources || msg.SOURCES) === 'string' ? JSON.parse(msg.sources || msg.SOURCES) : (msg.sources || msg.SOURCES)) : null,
            intent_options: msg.intent_options || msg.INTENT_OPTIONS ? (typeof (msg.intent_options || msg.INTENT_OPTIONS) === 'string' ? JSON.parse(msg.intent_options || msg.INTENT_OPTIONS) : (msg.intent_options || msg.INTENT_OPTIONS)) : null,
            created_at: msg.created_at || msg.CREATED_AT || ''
          }));
          setSessionMessages(messages);
        }
      }
    } catch (error) {
      console.error('세션 메시지 로드 오류:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const handleSessionClick = (session: ChatSession) => {
    setSelectedSession(session);
    loadSessionMessages(session.session_id, session.user_id);
  };

  const exportToCSV = () => {
    const headers = ['세션ID', '사용자ID', '이름', '부서/직급', '마지막 사용자 메시지', '마지막 어시스턴트 응답', '메시지 수', '마지막 활동일시'];
    const csvContent = [
      headers.join(','),
      ...sessions.map(session => [
        session.session_id,
        session.user_id,
        session.full_name || '',
        session.department && session.position 
          ? `${session.department} / ${session.position}`
          : session.department || session.position || '',
        `"${(session.last_user_message || '').replace(/"/g, '""')}"`,
        `"${(session.last_assistant_response || '').replace(/"/g, '""')}"`,
        session.message_count,
        formatDateTime(session.last_activity)
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `chat_history_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="채팅 히스토리 조회"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="chat-history-container" style={{ width: '90%', margin: '0 auto' }}>
          {/* 필터 섹션 */}
          <div className="filters-section">
            <div className="filter-group">
              <div className="filter-item">
                <label>사용자ID</label>
                <div className="input-group">
                  <Search size={16} className="input-icon" />
                  <input
                    type="text"
                    placeholder="사용자ID 검색"
                    value={filters.userid}
                    onChange={(e) => handleFilterChange('userid', e.target.value)}
                  />
                </div>
              </div>
              
              <div className="filter-item">
                <label>검색어</label>
                <div className="input-group">
                  <Search size={16} className="input-icon" />
                  <input
                    type="text"
                    placeholder="채팅 내용 검색"
                    value={filters.searchKeyword}
                    onChange={(e) => handleFilterChange('searchKeyword', e.target.value)}
                  />
                </div>
              </div>

              <div className="filter-item">
                <label htmlFor="start-date-filter">시작 날짜</label>
                <div className="input-group">
                  <Calendar size={16} className="input-icon" />
                  <input
                    id="start-date-filter"
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => handleFilterChange('startDate', e.target.value)}
                    title="시작 날짜 선택"
                  />
                </div>
              </div>

              <div className="filter-item">
                <label htmlFor="end-date-filter">종료 날짜</label>
                <div className="input-group">
                  <Calendar size={16} className="input-icon" />
                  <input
                    id="end-date-filter"
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => handleFilterChange('endDate', e.target.value)}
                    title="종료 날짜 선택"
                  />
                </div>
              </div>
              
              <div className="filter-actions">
                <button 
                  onClick={loadChatHistory} 
                  className="btn btn-secondary btn-icon"
                  disabled={isLoading}
                  title="새로고침"
                >
                  <RefreshCw size={20} className={isLoading ? 'spinning' : ''} />
                </button>
                <button 
                  onClick={exportToCSV} 
                  className="btn btn-primary"
                  disabled={sessions.length === 0}
                >
                  <Download size={16} />
                  내보내기
                </button>
              </div>
            </div>
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="error-message">
              <XCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* 채팅 히스토리 테이블 */}
          <div className="table-container">
            <table className="chat-history-table">
              <thead>
                <tr>
                  <th>대화세션ID</th>
                  <th>사용자ID</th>
                  <th>이름</th>
                  <th>부서/직급</th>
                  <th>메시지 수</th>
                  <th>마지막 메시지</th>
                  <th>마지막 활동일시</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="loading-cell">
                      <RefreshCw size={20} className="spinning" />
                      로딩 중...
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      채팅 히스토리가 없습니다.
                    </td>
                  </tr>
                ) : (
                  sessions.map((session) => (
                    <tr 
                      key={session.session_id}
                      onClick={() => handleSessionClick(session)}
                      style={{ cursor: 'pointer' }}
                      className="chat-history-row"
                    >
                      <td>
                        <div className="session-info">
                          <MessageSquare size={14} />
                          <span className="session-id">
                            {session.session_id ? (session.session_id.length > 8 ? session.session_id.substring(0, 8) + '...' : session.session_id) : '-'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="user-info">
                          <User size={16} />
                          <span>{session.user_id || '-'}</span>
                        </div>
                      </td>
                      <td>{session.full_name || '-'}</td>
                      <td>
                        {session.department && session.position 
                          ? `${session.department} / ${session.position}`
                          : session.department || session.position || '-'
                        }
                      </td>
                      <td>
                        <span className="message-count">{session.message_count}개</span>
                      </td>
                      <td>
                        <div className="message-content">
                          <div className="user-message-preview">
                            {truncateText(session.last_user_message || '', 30)}
                          </div>
                          <div className="assistant-message-preview">
                            {truncateText(session.last_assistant_response || '', 30)}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="datetime-info">
                          <Clock size={14} />
                          <span>{session.last_activity ? formatDateTime(session.last_activity) : '-'}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {pagination.totalPages > 1 && (
            <div className="pagination-container">
              <div className="pagination-info">
                총 {pagination.total}개 항목 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}개 표시
              </div>
              
              <div className="pagination">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={pagination.page === 1 || isLoading}
                  className="pagination-btn"
                  title="첫 페이지"
                >
                  «
                </button>
                
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1 || isLoading}
                  className="pagination-btn"
                  title="이전 페이지"
                >
                  ‹
                </button>
                
                {/* 페이지 번호 버튼들 */}
                {(() => {
                  const pages = [];
                  const currentPage = pagination.page;
                  const totalPages = pagination.totalPages;
                  const maxVisiblePages = 5;
                  
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                  
                  // 끝 페이지가 조정되면 시작 페이지도 조정
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => handlePageChange(i)}
                        disabled={isLoading}
                        className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
                      >
                        {i}
                      </button>
                    );
                  }
                  
                  return pages;
                })()}
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages || isLoading}
                  className="pagination-btn"
                  title="다음 페이지"
                >
                  ›
                </button>
                
                <button
                  onClick={() => handlePageChange(pagination.totalPages)}
                  disabled={pagination.page === pagination.totalPages || isLoading}
                  className="pagination-btn"
                  title="마지막 페이지"
                >
                  »
                </button>
              </div>
              
              <div className="pagination-size">
                <label htmlFor="page-size">페이지당 항목:</label>
                <select
                  id="page-size"
                  value={filters.limit}
                  onChange={(e) => {
                    const newLimit = parseInt(e.target.value);
                    setFilters(prev => ({
                      ...prev,
                      limit: newLimit,
                      page: 1
                    }));
                  }}
                  disabled={isLoading}
                  className="page-size-select"
                >
                  <option value={10}>10개</option>
                  <option value={20}>20개</option>
                  <option value={50}>50개</option>
                  <option value={100}>100개</option>
                </select>
              </div>
            </div>
          )}

          {/* 채팅 히스토리 상세 모달 */}
          {selectedSession && (
            <div 
              className="chat-history-detail-modal-overlay"
              onClick={() => {
                setSelectedSession(null);
                setSessionMessages([]);
              }}
            >
              <div 
                className="chat-history-detail-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="chat-history-detail-header">
                  <h3 className="chat-history-detail-title">채팅 세션 상세</h3>
                  <button 
                    className="chat-history-detail-close"
                    onClick={() => {
                      setSelectedSession(null);
                      setSessionMessages([]);
                    }}
                    title="닫기"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="chat-history-detail-body">
                  {/* 기본 정보 */}
                  <div className="chat-history-detail-section">
                    <h4>세션 정보</h4>
                    <div className="chat-history-detail-grid">
                      <div className="chat-history-detail-item">
                        <label>세션 ID:</label>
                        <span>{selectedSession.session_id || '-'}</span>
                      </div>
                      <div className="chat-history-detail-item">
                        <label>사용자 ID:</label>
                        <span>{selectedSession.user_id || '-'}</span>
                      </div>
                      <div className="chat-history-detail-item">
                        <label>이름:</label>
                        <span>{selectedSession.full_name || '-'}</span>
                      </div>
                      <div className="chat-history-detail-item">
                        <label>부서/직급:</label>
                        <span>
                          {selectedSession.department && selectedSession.position 
                            ? `${selectedSession.department} / ${selectedSession.position}`
                            : selectedSession.department || selectedSession.position || '-'
                          }
                        </span>
                      </div>
                      <div className="chat-history-detail-item">
                        <label>메시지 수:</label>
                        <span>{selectedSession.message_count}개</span>
                      </div>
                      <div className="chat-history-detail-item">
                        <label>시작일시:</label>
                        <span>{selectedSession.first_activity ? formatDateTime(selectedSession.first_activity) : '-'}</span>
                      </div>
                      <div className="chat-history-detail-item">
                        <label>마지막 활동:</label>
                        <span>{selectedSession.last_activity ? formatDateTime(selectedSession.last_activity) : '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 대화 내용 */}
                  <div className="chat-history-detail-section">
                    <h4>대화 내용</h4>
                    {isLoadingMessages ? (
                      <div className="chat-history-detail-loading">
                        <RefreshCw size={20} className="spinning" />
                        로딩 중...
                      </div>
                    ) : sessionMessages.length === 0 ? (
                      <div className="chat-history-detail-empty">
                        대화 내용이 없습니다.
                      </div>
                    ) : (
                      <div className="chat-history-detail-messages">
                        {sessionMessages.map((message, index) => (
                          <div key={message.id || index} className="chat-history-detail-message-wrapper">
                            <div className="chat-history-detail-message-time">
                              {formatDateTime(message.created_at)}
                            </div>
                            {message.user_message && (
                              <div className="chat-history-detail-message user-message">
                                <div className="chat-history-detail-message-label">사용자</div>
                                <div className="chat-history-detail-message-content">
                                  {message.user_message}
                                </div>
                              </div>
                            )}
                            {message.assistant_response && (
                              <div className="chat-history-detail-message assistant-message">
                                <div className="chat-history-detail-message-label">어시스턴트</div>
                                <div className="chat-history-detail-message-content">
                                  {message.assistant_response}
                                </div>
                                {message.sources && Array.isArray(message.sources) && message.sources.length > 0 && (
                                  <div className="chat-history-detail-sources-inline">
                                    {message.sources.map((source: any, idx: number) => (
                                      <div key={idx} className="chat-history-detail-source-inline">
                                        {source.title && <strong>{source.title}</strong>}
                                        {source.url && <a href={source.url} target="_blank" rel="noopener noreferrer">{source.url}</a>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
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

export default ChatHistoryPage;

