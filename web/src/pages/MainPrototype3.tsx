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
  Sparkles,
  ArrowRight
} from 'lucide-react';
import './MainPrototype3.css';

interface RequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
}

const MainPrototype3: React.FC = () => {
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
      const response = await fetch('/api/ear/requests?limit=4', {
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
        pageTitle="메인 프로토타입 3"
      />
      
      <main className="main-prototype3">
        {/* 채팅 버튼 */}
        {!showChat && (
          <button 
            className="chat-toggle-btn"
            onClick={() => setShowChat(true)}
            title="채팅 열기"
          >
            <MessageCircle size={20} />
            <span>AI 채팅</span>
          </button>
        )}

        {/* 채팅 패널 */}
        {showChat && (
          <div className="chat-panel-overlay">
            <div className="chat-panel-container">
              <div className="chat-panel-header">
                <div className="chat-header-left">
                  <Sparkles size={20} />
                  <h3>AI 어시스턴트</h3>
                </div>
                <button 
                  className="chat-close-btn"
                  onClick={() => setShowChat(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="chat-panel-content">
                <ChatPane selectedSessionId={null} />
              </div>
            </div>
          </div>
        )}

        <div className="prototype3-container">
          {/* 히어로 섹션 */}
          <div className="hero-section">
            <div className="hero-content">
              <h1>
                <span className="hero-greeting">안녕하세요,</span>
                <span className="hero-name">{user?.fullName || user?.userid}님</span>
              </h1>
              <p className="hero-description">
                간편하게 요청을 등록하고 처리 현황을 확인하세요
              </p>
            </div>
            <div className="hero-actions">
              <button 
                className="hero-primary-btn"
                onClick={() => navigate('/ear-request-registration')}
              >
                <FileText size={20} />
                <span>요청 등록</span>
              </button>
              <button 
                className="hero-secondary-btn"
                onClick={() => navigate('/ear-request-list')}
              >
                <List size={20} />
                <span>처리 현황</span>
              </button>
            </div>
          </div>

          {/* 통계 미니 카드 */}
          <div className="stats-mini">
            <div className="stat-mini-card">
              <div className="stat-mini-value">{stats.total}</div>
              <div className="stat-mini-label">전체</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value">{stats.pending}</div>
              <div className="stat-mini-label">대기</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value">{stats.inProgress}</div>
              <div className="stat-mini-label">진행</div>
            </div>
            <div className="stat-mini-card">
              <div className="stat-mini-value">{stats.completed}</div>
              <div className="stat-mini-label">완료</div>
            </div>
          </div>

          {/* 메인 콘텐츠 영역 */}
          <div className="main-content-area">
            {/* 왼쪽: 주요 기능 */}
            <div className="features-panel">
              <h2 className="panel-title">주요 기능</h2>
              <div className="feature-list">
                <div 
                  className="feature-item"
                  onClick={() => navigate('/ear-request-registration')}
                >
                  <div className="feature-icon-box">
                    <FileText size={24} />
                  </div>
                  <div className="feature-text">
                    <h3>EAR 요청등록</h3>
                    <p>새로운 요청을 등록합니다</p>
                  </div>
                  <ArrowRight size={18} />
                </div>
                <div 
                  className="feature-item"
                  onClick={() => navigate('/ear-request-list')}
                >
                  <div className="feature-icon-box">
                    <List size={24} />
                  </div>
                  <div className="feature-text">
                    <h3>요청처리현황</h3>
                    <p>내 요청의 처리 상태를 확인합니다</p>
                  </div>
                  <ArrowRight size={18} />
                </div>
              </div>
            </div>

            {/* 오른쪽: 최근 요청 */}
            <div className="requests-panel">
              <div className="panel-header">
                <h2 className="panel-title">최근 요청</h2>
                <button 
                  className="view-more-btn"
                  onClick={() => navigate('/ear-request-list')}
                >
                  더보기
                </button>
              </div>
              <div className="requests-list">
                {loading ? (
                  <div className="loading-state">로딩 중...</div>
                ) : recentRequests.length === 0 ? (
                  <div className="empty-state">
                    <FileText size={40} />
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
                      className="request-card"
                      onClick={() => navigate(`/ear-request-list?id=${request.id}`)}
                    >
                      <div className="request-card-header">
                        <h4>{request.request_title}</h4>
                        <span 
                          className="request-status"
                          style={{ color: getStatusColor(request.status) }}
                        >
                          {getStatusLabel(request.status)}
                        </span>
                      </div>
                      <p className="request-excerpt">
                        {request.request_content?.substring(0, 60)}...
                      </p>
                      <div className="request-card-footer">
                        <span className="request-time">
                          {new Date(request.created_at).toLocaleDateString('ko-KR', {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 공지사항 */}
          <div className="notice-panel">
            <div className="panel-header">
              <Bell size={18} />
              <h2 className="panel-title">공지사항</h2>
            </div>
            <div className="notice-list">
              <div className="notice-card new">
                <div className="notice-indicator" />
                <div className="notice-content">
                  <h4>시스템 개선 사항 안내</h4>
                  <p>더 빠르고 편리한 요청 등록을 위해 시스템이 개선되었습니다.</p>
                </div>
              </div>
              <div className="notice-card">
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

export default MainPrototype3;


