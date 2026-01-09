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
  Sparkles,
  Zap,
  Star,
  Clock,
  TrendingUp,
  LayoutGrid,
  ArrowRight,
  Search
} from 'lucide-react';
import './MainPrototype4.css';

interface Template {
  id: number;
  template_name: string;
  template_description: string;
  keyword_display_name: string;
  category?: string;
}

interface Category {
  name: string;
  icon: string;
  color: string;
}

const MainPrototype4: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [popularTemplates, setPopularTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const categories: Category[] = [
    { name: '보안', icon: 'Shield', color: '#ef4444' },
    { name: '인프라', icon: 'Server', color: '#3b82f6' },
    { name: '계정관리', icon: 'User', color: '#10b981' },
    { name: '시스템', icon: 'Settings', color: '#f59e0b' }
  ];

  useEffect(() => {
    // 인기 템플릿 로드 (실제로는 API에서 가져와야 함)
    // 여기서는 더미 데이터 사용
    setTimeout(() => {
      setPopularTemplates([
        { id: 1, template_name: '방화벽 오픈 신청', template_description: '방화벽 포트 오픈을 신청합니다', keyword_display_name: '방화벽 오픈 신청', category: '보안' },
        { id: 2, template_name: '시스템 접근 신청', template_description: '시스템 접근 권한을 신청합니다', keyword_display_name: '시스템 접근 신청', category: '인프라' },
        { id: 3, template_name: '계정 생성 신청', template_description: '새로운 계정 생성을 신청합니다', keyword_display_name: '계정 생성 신청', category: '계정관리' }
      ]);
      setLoading(false);
    }, 500);
  }, []);

  const handleTemplateClick = (template: Template) => {
    navigate(`/ear-request-registration?template_id=${template.id}`);
  };

  const quickActions = [
    { label: '새 요청 등록', icon: FileText, path: '/ear-request-registration', color: '#667eea' },
    { label: '요청 현황 조회', icon: List, path: '/ear-request-list', color: '#f59e0b' },
    { label: 'AI 채팅 시작', icon: MessageCircle, action: () => setShowChat(true), color: '#10b981' }
  ];

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="메인 프로토타입 4"
      />
      
      <main className="main-prototype4">
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

        <div className="prototype4-container">
          {/* 히어로 섹션 */}
          <div className="hero-section">
            <div className="hero-content">
              <h1>
                <Sparkles size={32} className="hero-icon" />
                빠른 시작
              </h1>
              <p>템플릿을 선택하거나 직접 요청을 등록하세요</p>
            </div>
            <div className="search-box">
              <Search size={20} />
              <input
                type="text"
                placeholder="템플릿 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* 빠른 액션 */}
          <div className="quick-actions-section">
            <h2 className="section-title">빠른 액션</h2>
            <div className="quick-actions-grid">
              {quickActions.map((action, index) => (
                <div
                  key={index}
                  className="quick-action-card"
                  onClick={() => action.action ? action.action() : navigate(action.path)}
                  style={{ '--action-color': action.color } as React.CSSProperties}
                >
                  <div className="quick-action-icon">
                    <action.icon size={28} />
                  </div>
                  <span>{action.label}</span>
                  <ArrowRight size={18} className="action-arrow" />
                </div>
              ))}
            </div>
          </div>

          {/* 인기 템플릿 */}
          <div className="templates-section">
            <div className="section-header">
              <div className="section-title-group">
                <Star size={24} className="section-icon" />
                <h2>인기 템플릿</h2>
              </div>
              <button 
                className="view-all-link"
                onClick={() => navigate('/ear-request-registration')}
              >
                전체보기 <ArrowRight size={16} />
              </button>
            </div>
            {loading ? (
              <div className="loading-state">템플릿을 불러오는 중...</div>
            ) : (
              <div className="templates-grid">
                {popularTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="template-card"
                    onClick={() => handleTemplateClick(template)}
                  >
                    <div className="template-header">
                      <div className="template-icon">
                        <FileText size={24} />
                      </div>
                      <div className="template-badge">{template.category}</div>
                    </div>
                    <div className="template-content">
                      <h3>{template.template_name}</h3>
                      <p>{template.template_description}</p>
                    </div>
                    <div className="template-footer">
                      <span className="template-action">
                        사용하기 <ArrowRight size={16} />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 카테고리별 템플릿 */}
          <div className="categories-section">
            <h2 className="section-title">
              <LayoutGrid size={24} className="section-icon" />
              카테고리별 탐색
            </h2>
            <div className="categories-grid">
              {categories.map((category, index) => (
                <div
                  key={index}
                  className="category-card"
                  onClick={() => navigate(`/ear-request-registration?category=${category.name}`)}
                  style={{ '--category-color': category.color } as React.CSSProperties}
                >
                  <div className="category-icon-wrapper">
                    <Zap size={28} />
                  </div>
                  <h3>{category.name}</h3>
                  <p>관련 템플릿 보기</p>
                </div>
              ))}
            </div>
          </div>

          {/* 최근 활동 */}
          <div className="recent-activity-section">
            <h2 className="section-title">
              <Clock size={24} className="section-icon" />
              최근 활동
            </h2>
            <div className="activity-list">
              <div className="activity-item">
                <div className="activity-icon">
                  <TrendingUp size={20} />
                </div>
                <div className="activity-content">
                  <p><strong>방화벽 오픈 신청</strong>이 승인되었습니다</p>
                  <span className="activity-time">2시간 전</span>
                </div>
              </div>
              <div className="activity-item">
                <div className="activity-icon">
                  <FileText size={20} />
                </div>
                <div className="activity-content">
                  <p><strong>시스템 접근 신청</strong>이 등록되었습니다</p>
                  <span className="activity-time">1일 전</span>
                </div>
              </div>
            </div>
            <button 
              className="view-all-btn"
              onClick={() => navigate('/ear-request-list')}
            >
              전체 활동 보기
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainPrototype4;

