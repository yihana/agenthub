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
  Search,
  Bell,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Zap,
  ArrowRight,
  Star,
  Bookmark
} from 'lucide-react';
import './MainPrototype6.css';

interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
  action?: string;
}

interface SearchResult {
  type: 'request' | 'template' | 'document';
  title: string;
  description: string;
  metadata?: string;
}

const MainPrototype6: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    // 알림 데이터 로드
    setNotifications([
      {
        id: '1',
        type: 'success',
        title: '요청 승인됨',
        message: '방화벽 오픈 신청이 승인되었습니다',
        time: '5분 전',
        read: false,
        action: '요청 보기'
      },
      {
        id: '2',
        type: 'info',
        title: '처리 중',
        message: '시스템 접근 신청이 처리 중입니다',
        time: '1시간 전',
        read: false
      },
      {
        id: '3',
        type: 'system',
        title: '시스템 업데이트',
        message: '새로운 기능이 추가되었습니다',
        time: '2일 전',
        read: true
      },
      {
        id: '4',
        type: 'warning',
        title: '주의 필요',
        message: '요청에 추가 정보가 필요합니다',
        time: '3일 전',
        read: true
      }
    ]);

    setUnreadCount(notifications.filter(n => !n.read).length);
  }, []);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.length > 0) {
      // 검색 결과 시뮬레이션
      setSearchResults([
        { type: 'request', title: '방화벽 오픈 신청', description: '방화벽 포트 오픈 요청', metadata: '2일 전' },
        { type: 'template', title: '방화벽 오픈 템플릿', description: '방화벽 오픈 신청 템플릿', metadata: '인기' },
        { type: 'document', title: '방화벽 정책 문서', description: '방화벽 정책 및 가이드', metadata: '문서' }
      ]);
    } else {
      setSearchResults([]);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );
    if (notification.action) {
      navigate('/ear-request-list');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success': return CheckCircle;
      case 'warning': return AlertCircle;
      case 'info': return Clock;
      default: return Bell;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'success': return '#10b981';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="메인 프로토타입 6"
      />
      
      <main className="main-prototype6">
        {/* 채팅 버튼 */}
        {!showChat && (
          <button 
            className="chat-toggle-btn"
            onClick={() => setShowChat(true)}
            title="AI 채팅 열기"
          >
            <MessageCircle size={20} />
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
                  <X size={18} />
                </button>
              </div>
              <div className="chat-panel-content">
                <ChatPane selectedSessionId={null} />
              </div>
            </div>
          </div>
        )}

        <div className="prototype6-container">
          {/* 상단 검색 및 알림 바 */}
          <div className="top-bar">
            <div className="search-container">
              <Search size={20} className="search-icon" />
              <input
                type="text"
                placeholder="요청, 템플릿, 문서 검색..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button 
                  className="clear-search"
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <div className="top-actions">
              <button 
                className="notification-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>
            </div>
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="search-results-panel">
              <div className="search-results-header">
                <h3>검색 결과</h3>
                <span className="results-count">{searchResults.length}개</span>
              </div>
              <div className="search-results-list">
                {searchResults.map((result, index) => (
                  <div 
                    key={index}
                    className="search-result-item"
                    onClick={() => {
                      if (result.type === 'request') {
                        navigate('/ear-request-list');
                      } else if (result.type === 'template') {
                        navigate('/ear-request-registration');
                      }
                    }}
                  >
                    <div className="result-icon">
                      {result.type === 'request' && <FileText size={20} />}
                      {result.type === 'template' && <Star size={20} />}
                      {result.type === 'document' && <Bookmark size={20} />}
                    </div>
                    <div className="result-content">
                      <h4>{result.title}</h4>
                      <p>{result.description}</p>
                      {result.metadata && (
                        <span className="result-meta">{result.metadata}</span>
                      )}
                    </div>
                    <ArrowRight size={18} className="result-arrow" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 알림 패널 */}
          {showNotifications && (
            <div className="notifications-panel">
              <div className="notifications-header">
                <h3>알림</h3>
                <button 
                  className="close-notifications"
                  onClick={() => setShowNotifications(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <div className="notifications-list">
                {notifications.length === 0 ? (
                  <div className="empty-notifications">
                    <Bell size={48} />
                    <p>알림이 없습니다</p>
                  </div>
                ) : (
                  notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    return (
                      <div
                        key={notification.id}
                        className={`notification-item ${!notification.read ? 'unread' : ''}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <div 
                          className="notification-icon"
                          style={{ color: getNotificationColor(notification.type) }}
                        >
                          <Icon size={20} />
                        </div>
                        <div className="notification-content">
                          <div className="notification-header">
                            <h4>{notification.title}</h4>
                            <span className="notification-time">{notification.time}</span>
                          </div>
                          <p>{notification.message}</p>
                          {notification.action && (
                            <button className="notification-action">
                              {notification.action}
                              <ArrowRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 메인 콘텐츠 */}
          {!showNotifications && searchResults.length === 0 && (
            <>
              {/* 환영 메시지 */}
              <div className="welcome-section">
                <h1>안녕하세요, {user?.fullName || user?.userid}님</h1>
                <p>검색하거나 빠른 액션을 사용하여 시작하세요</p>
              </div>

              {/* 빠른 액션 */}
              <div className="quick-actions-section">
                <h2 className="section-title">빠른 액션</h2>
                <div className="quick-actions-grid">
                  <div 
                    className="quick-action-card primary"
                    onClick={() => navigate('/ear-request-registration')}
                  >
                    <FileText size={32} />
                    <h3>요청 등록</h3>
                    <p>새로운 요청을 등록하세요</p>
                  </div>
                  <div 
                    className="quick-action-card secondary"
                    onClick={() => navigate('/ear-request-list')}
                  >
                    <List size={32} />
                    <h3>요청 현황</h3>
                    <p>내 요청 상태를 확인하세요</p>
                  </div>
                  <div 
                    className="quick-action-card accent"
                    onClick={() => setShowChat(true)}
                  >
                    <MessageCircle size={32} />
                    <h3>AI 채팅</h3>
                    <p>AI와 대화하며 요청하세요</p>
                  </div>
                </div>
              </div>

              {/* 인기 기능 */}
              <div className="popular-section">
                <h2 className="section-title">
                  <TrendingUp size={24} />
                  인기 기능
                </h2>
                <div className="popular-grid">
                  <div 
                    className="popular-card"
                    onClick={() => navigate('/ear-request-registration?category=보안')}
                  >
                    <div className="popular-icon">
                      <Zap size={24} />
                    </div>
                    <h4>방화벽 오픈</h4>
                    <p>가장 많이 사용되는 요청</p>
                  </div>
                  <div 
                    className="popular-card"
                    onClick={() => navigate('/ear-request-registration?category=인프라')}
                  >
                    <div className="popular-icon">
                      <FileText size={24} />
                    </div>
                    <h4>시스템 접근</h4>
                    <p>시스템 접근 권한 신청</p>
                  </div>
                  <div 
                    className="popular-card"
                    onClick={() => navigate('/ear-request-registration?category=계정관리')}
                  >
                    <div className="popular-icon">
                      <Star size={24} />
                    </div>
                    <h4>계정 생성</h4>
                    <p>새 계정 생성 신청</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default MainPrototype6;


