import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import ChatPane from '../components/ChatPane';
import { 
  FileText, 
  List, 
  MessageCircle, 
  X, 
  TrendingUp, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Bell,
  BarChart3
} from 'lucide-react';
import './MainPrototype1.css';

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const MainPrototype1: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [stats, setStats] = useState<RequestStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0
  });
  const [recentRequests, setRecentRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserRequests();
  }, []);

  const fetchUserRequests = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/c4c/cases', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        // 응답 형식에 따라 데이터 추출
        // value가 배열인 경우와 단일 객체인 경우 모두 처리
        let cases = [];
        if (data.value) {
          if (Array.isArray(data.value)) {
            cases = data.value;
          } else {
            // value가 단일 객체인 경우
            cases = [data.value];
          }
        } else if (Array.isArray(data)) {
          cases = data;
        }
        
        // SAP C4C 응답을 UI 형식으로 매핑
        const mappedRequests = cases.map((caseItem: any) => {
          // 상태 매핑 (SAP 상태 -> 내부 상태)
          let status = 'pending';
          const statusDesc = caseItem.statusDescription?.toLowerCase() || '';
          const lifeCycleStatus = caseItem.lifeCycleStatus?.toLowerCase() || '';
          
          if (lifeCycleStatus === 'open' && statusDesc === 'open') {
            status = 'in_progress';
          } else if (lifeCycleStatus === 'closed' || statusDesc.includes('완료') || statusDesc.includes('closed')) {
            status = 'completed';
          } else if (statusDesc.includes('대기') || statusDesc.includes('pending')) {
            status = 'pending';
          }
          
          return {
            id: caseItem.id || caseItem.displayId,
            displayId: caseItem.displayId,
            request_title: `[${caseItem.displayId || ''}] ${caseItem.subject || ''}`,
            request_content: caseItem.subject || '',
            status: status,
            statusDescription: caseItem.statusDescription || '',
            priority: caseItem.priorityDescription || '',
            caseType: caseItem.caseTypeDescription || '',
            created_at: caseItem.timePoints?.reportedOn || caseItem.adminData?.createdOn || new Date().toISOString(),
            account: caseItem.account?.name || '',
            contact: caseItem.contact?.name || ''
          };
        });
        
        // 최대 5개만 표시
        const limitedRequests = mappedRequests.slice(0, 5);
        setRecentRequests(limitedRequests);
        
        // 통계 계산
        const total = cases.length;
        const pending = mappedRequests.filter((r: any) => r.status === 'pending').length;
        const inProgress = mappedRequests.filter((r: any) => r.status === 'in_progress').length;
        const completed = mappedRequests.filter((r: any) => r.status === 'completed').length;
        
        setStats({ total, pending, inProgress, completed });
      } else {
        console.error('API 응답 오류:', response.status, response.statusText);
        const errorData = await response.json().catch(() => ({ error: '알 수 없는 오류' }));
        console.error('오류 상세:', errorData);
      }
    } catch (error) {
      console.error('요청 조회 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return '완료';
      case 'in_progress': return '진행중';
      case 'pending': return '대기중';
      case 'rejected': return '거부됨';
      default: return status;
    }
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="메인 프로토타입 1"
      />
      
      <main className="main-prototype1">
        {/* 채팅 버튼 (고정) */}
        {!showChat && (
          <button 
            className="chat-toggle-btn"
            onClick={() => setShowChat(true)}
            title="채팅 열기"
          >
            <MessageCircle size={24} />
          </button>
        )}

        {/* 채팅 패널 */}
        {showChat && (
          <div className="chat-panel-overlay">
            <div className="chat-panel-container">
              <div className="chat-panel-header">
                <h3>AI 어시스턴트</h3>
                <button 
                  className="chat-close-btn"
                  onClick={() => setShowChat(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <div className="chat-panel-content">
                <ChatPane selectedSessionId={null} />
              </div>
            </div>
          </div>
        )}

        <div className="prototype1-container">
          {/* 환영 메시지 */}
          <div className="welcome-section">
            <h1>안녕하세요, {user?.fullName || user?.userid}님</h1>
            <p>ITSM 요청을 빠르고 편리하게 등록하고 관리하세요</p>
          </div>

          {/* 주요 기능 카드 */}
          <div className="main-actions-grid">
            <div 
              className="action-card primary"
              onClick={() => navigate('/ear-request-registration')}
            >
              <div className="action-icon">
                <FileText size={32} />
              </div>
              <h3>EAR 요청등록</h3>
              <p>새로운 요청을 등록하세요</p>
            </div>

            <div 
              className="action-card secondary"
              onClick={() => navigate('/ear-request-list')}
            >
              <div className="action-icon">
                <List size={32} />
              </div>
              <h3>요청처리현황</h3>
              <p>내 요청 현황을 확인하세요</p>
            </div>
          </div>

          {/* 통계 및 최근 요청 */}
          <div className="content-grid">
            {/* 통계 카드 */}
            <div className="stats-section">
              <div className="section-header">
                <BarChart3 size={20} />
                <h2>요청 통계</h2>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon total">
                    <TrendingUp size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">전체 요청</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon pending">
                    <Clock size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-label">대기중</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon progress">
                    <AlertCircle size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.inProgress}</div>
                    <div className="stat-label">진행중</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon completed">
                    <CheckCircle size={24} />
                  </div>
                  <div className="stat-content">
                    <div className="stat-value">{stats.completed}</div>
                    <div className="stat-label">완료</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 최근 요청 */}
            <div className="recent-requests-section">
              <div className="section-header">
                <List size={20} />
                <h2>최근 요청</h2>
                <button 
                  className="view-all-btn"
                  onClick={() => navigate('/ear-request-list')}
                >
                  전체보기
                </button>
              </div>
              <div className="requests-list">
                {loading ? (
                  <div className="loading-state">로딩 중...</div>
                ) : recentRequests.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={48} />
                    <p>등록된 요청이 없습니다</p>
                    <button 
                      className="create-btn"
                      onClick={() => navigate('/ear-request-registration')}
                    >
                      첫 요청 등록하기
                    </button>
                  </div>
                ) : (
                  recentRequests.map((request) => (
                    <div 
                      key={request.id} 
                      className="request-item"
                      onClick={() => navigate(`/ear-request-list?id=${request.id}`)}
                    >
                      <div className="request-header">
                        <h4>{request.request_title}</h4>
                        <span 
                          className="status-badge"
                          style={{ backgroundColor: getStatusColor(request.status) }}
                        >
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      <p className="request-content">
                        {request.request_content?.substring(0, 100)}...
                      </p>
                      <div className="request-footer">
                        <span className="request-date">
                          {new Date(request.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 공지사항 섹션 */}
          <div className="notice-section">
            <div className="section-header">
              <Bell size={20} />
              <h2>공지사항</h2>
            </div>
            <div className="notice-list">
              <div className="notice-item">
                <div className="notice-badge">NEW</div>
                <div className="notice-content">
                  <h4>시스템 개선 사항 안내</h4>
                  <p>더 빠르고 편리한 요청 등록을 위해 시스템이 개선되었습니다.</p>
                </div>
              </div>
              <div className="notice-item">
                <div className="notice-content">
                  <h4>채팅 기능 업데이트</h4>
                  <p>AI 어시스턴트를 통해 더 쉽게 요청을 등록할 수 있습니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainPrototype1;


