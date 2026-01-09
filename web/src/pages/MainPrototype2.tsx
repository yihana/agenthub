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
  BarChart3,
  ArrowRight,
  Plus,
  Search
} from 'lucide-react';
import './MainPrototype2.css';

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const MainPrototype2: React.FC = () => {
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
      const response = await fetch('/api/ear/requests?limit=3', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const requests = data.requests || [];
        setRecentRequests(requests);
        
        // 통계 계산
        const total = data.pagination?.total || 0;
        const pending = requests.filter((r: any) => r.status === 'pending').length;
        const inProgress = requests.filter((r: any) => r.status === 'in_progress').length;
        const completed = requests.filter((r: any) => r.status === 'completed').length;
        
        setStats({ total, pending, inProgress, completed });
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
        pageTitle="메인 프로토타입 2"
      />
      
      <main className="main-prototype2">
        {/* 채팅 버튼 */}
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

        <div className="prototype2-container">
          {/* 상단 액션 바 */}
          <div className="top-action-bar">
            <div className="welcome-text">
              <h1>{user?.fullName || user?.userid}님, 무엇을 도와드릴까요?</h1>
            </div>
            <div className="quick-actions">
              <button 
                className="primary-action-btn"
                onClick={() => navigate('/ear-request-registration')}
              >
                <Plus size={20} />
                <span>새 요청 등록</span>
              </button>
              <button 
                className="secondary-action-btn"
                onClick={() => navigate('/ear-request-list')}
              >
                <Search size={20} />
                <span>요청 조회</span>
              </button>
            </div>
          </div>

          {/* 대시보드 그리드 */}
          <div className="dashboard-grid">
            {/* 통계 카드들 */}
            <div className="stats-dashboard">
              <div className="dashboard-header">
                <BarChart3 size={24} />
                <h2>요청 현황</h2>
              </div>
              <div className="stats-cards">
                <div className="stat-card-large total">
                  <div className="stat-icon-wrapper">
                    <TrendingUp size={32} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-label">전체 요청</div>
                    <div className="stat-value-large">{stats.total}</div>
                  </div>
                </div>
                <div className="stat-card-large pending">
                  <div className="stat-icon-wrapper">
                    <Clock size={32} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-label">대기중</div>
                    <div className="stat-value-large">{stats.pending}</div>
                  </div>
                </div>
                <div className="stat-card-large progress">
                  <div className="stat-icon-wrapper">
                    <AlertCircle size={32} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-label">진행중</div>
                    <div className="stat-value-large">{stats.inProgress}</div>
                  </div>
                </div>
                <div className="stat-card-large completed">
                  <div className="stat-icon-wrapper">
                    <CheckCircle size={32} />
                  </div>
                  <div className="stat-info">
                    <div className="stat-label">완료</div>
                    <div className="stat-value-large">{stats.completed}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* 주요 기능 카드 */}
            <div className="main-features">
              <div className="dashboard-header">
                <FileText size={24} />
                <h2>주요 기능</h2>
              </div>
              <div className="feature-cards">
                <div 
                  className="feature-card"
                  onClick={() => navigate('/ear-request-registration')}
                >
                  <div className="feature-icon primary">
                    <FileText size={28} />
                  </div>
                  <div className="feature-content">
                    <h3>EAR 요청등록</h3>
                    <p>새로운 요청을 빠르게 등록하세요</p>
                  </div>
                  <ArrowRight size={20} className="feature-arrow" />
                </div>
                <div 
                  className="feature-card"
                  onClick={() => navigate('/ear-request-list')}
                >
                  <div className="feature-icon secondary">
                    <List size={28} />
                  </div>
                  <div className="feature-content">
                    <h3>요청처리현황</h3>
                    <p>내 요청의 처리 상태를 확인하세요</p>
                  </div>
                  <ArrowRight size={20} className="feature-arrow" />
                </div>
              </div>
            </div>

            {/* 최근 요청 */}
            <div className="recent-section">
              <div className="dashboard-header">
                <List size={24} />
                <h2>최근 요청</h2>
                <button 
                  className="view-all-link"
                  onClick={() => navigate('/ear-request-list')}
                >
                  전체보기 <ArrowRight size={16} />
                </button>
              </div>
              <div className="recent-requests">
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
                      className="recent-request-item"
                      onClick={() => navigate(`/ear-request-list?id=${request.id}`)}
                    >
                      <div className="request-status-indicator" style={{ backgroundColor: getStatusColor(request.status) }} />
                      <div className="request-details">
                        <h4>{request.request_title}</h4>
                        <p>{request.request_content?.substring(0, 80)}...</p>
                        <div className="request-meta">
                          <span className="request-date">
                            {new Date(request.created_at).toLocaleDateString('ko-KR')}
                          </span>
                          <span 
                            className="status-tag"
                            style={{ backgroundColor: getStatusColor(request.status) }}
                          >
                            {getStatusLabel(request.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 공지사항 */}
            <div className="notice-dashboard">
              <div className="dashboard-header">
                <Bell size={24} />
                <h2>공지사항</h2>
              </div>
              <div className="notice-items">
                <div className="notice-item-new">
                  <div className="notice-badge">NEW</div>
                  <div className="notice-text">
                    <h4>시스템 개선 사항 안내</h4>
                    <p>더 빠르고 편리한 요청 등록을 위해 시스템이 개선되었습니다.</p>
                  </div>
                </div>
                <div className="notice-item">
                  <div className="notice-text">
                    <h4>채팅 기능 업데이트</h4>
                    <p>AI 어시스턴트를 통해 더 쉽게 요청을 등록할 수 있습니다.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainPrototype2;


