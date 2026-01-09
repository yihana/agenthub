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
  Lightbulb,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Activity,
  Zap,
  ArrowRight,
  Brain
} from 'lucide-react';
import './MainPrototype5.css';

interface Insight {
  type: 'recommendation' | 'similar' | 'trend';
  title: string;
  description: string;
  action?: string;
}

interface ActivityItem {
  id: string;
  type: 'request' | 'status' | 'system';
  title: string;
  description: string;
  time: string;
  status?: string;
}

const MainPrototype5: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [showChat, setShowChat] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // AI 인사이트 및 활동 데이터 로드
    setTimeout(() => {
      setInsights([
        {
          type: 'recommendation',
          title: '자주 사용하는 템플릿',
          description: '방화벽 오픈 신청 템플릿을 자주 사용하시네요. 빠른 등록을 위해 템플릿을 사용해보세요.',
          action: '템플릿 사용하기'
        },
        {
          type: 'similar',
          title: '유사한 요청 발견',
          description: '최근 등록하신 요청과 유사한 요청이 완료되었습니다. 참고하시면 도움이 될 것 같아요.',
          action: '유사 요청 보기'
        },
        {
          type: 'trend',
          title: '요청 트렌드',
          description: '이번 주 방화벽 관련 요청이 30% 증가했습니다. 미리 준비하시면 좋을 것 같아요.',
        }
      ]);

      setActivities([
        {
          id: '1',
          type: 'status',
          title: '방화벽 오픈 신청',
          description: '요청이 승인되어 처리 중입니다',
          time: '2시간 전',
          status: 'in_progress'
        },
        {
          id: '2',
          type: 'request',
          title: '시스템 접근 신청',
          description: '새로운 요청이 등록되었습니다',
          time: '1일 전',
          status: 'pending'
        },
        {
          id: '3',
          type: 'status',
          title: '계정 생성 신청',
          description: '요청이 완료되었습니다',
          time: '2일 전',
          status: 'completed'
        },
        {
          id: '4',
          type: 'system',
          title: '시스템 업데이트',
          description: '새로운 기능이 추가되었습니다',
          time: '3일 전'
        }
      ]);

      setLoading(false);
    }, 500);
  }, []);

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'in_progress': return '#3b82f6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed': return CheckCircle;
      case 'in_progress': return Activity;
      case 'pending': return Clock;
      default: return AlertCircle;
    }
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="메인 프로토타입 5"
      />
      
      <main className="main-prototype5">
        {/* 채팅 버튼 */}
        {!showChat && (
          <button 
            className="chat-toggle-btn"
            onClick={() => setShowChat(true)}
            title="AI 채팅 열기"
          >
            <Brain size={20} />
            <span>AI 채팅</span>
          </button>
        )}

        {/* 채팅 패널 */}
        {showChat && (
          <div className="chat-panel-overlay">
            <div className="chat-panel-container">
              <div className="chat-panel-header">
                <div className="chat-header-left">
                  <Brain size={20} />
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

        <div className="prototype5-container">
          {/* 헤더 */}
          <div className="page-header">
            <div className="header-content">
              <h1>
                <Sparkles size={32} />
                AI 인사이트
              </h1>
              <p>AI가 분석한 추천 사항과 인사이트를 확인하세요</p>
            </div>
            <div className="header-actions">
              <button 
                className="primary-btn"
                onClick={() => navigate('/ear-request-registration')}
              >
                <FileText size={18} />
                <span>새 요청</span>
              </button>
              <button 
                className="secondary-btn"
                onClick={() => navigate('/ear-request-list')}
              >
                <List size={18} />
                <span>요청 현황</span>
              </button>
            </div>
          </div>

          {/* AI 인사이트 카드들 */}
          <div className="insights-section">
            <h2 className="section-title">
              <Lightbulb size={24} />
              AI 추천
            </h2>
            {loading ? (
              <div className="loading-state">인사이트를 분석하는 중...</div>
            ) : (
              <div className="insights-grid">
                {insights.map((insight, index) => (
                  <div 
                    key={index}
                    className={`insight-card insight-${insight.type}`}
                  >
                    <div className="insight-header">
                      <div className="insight-icon">
                        {insight.type === 'recommendation' && <Zap size={24} />}
                        {insight.type === 'similar' && <TrendingUp size={24} />}
                        {insight.type === 'trend' && <Activity size={24} />}
                      </div>
                      <span className="insight-type">
                        {insight.type === 'recommendation' && '추천'}
                        {insight.type === 'similar' && '유사 요청'}
                        {insight.type === 'trend' && '트렌드'}
                      </span>
                    </div>
                    <div className="insight-content">
                      <h3>{insight.title}</h3>
                      <p>{insight.description}</p>
                    </div>
                    {insight.action && (
                      <button className="insight-action">
                        {insight.action}
                        <ArrowRight size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 활동 피드 */}
          <div className="activity-feed-section">
            <div className="section-header">
              <h2 className="section-title">
                <Activity size={24} />
                활동 피드
              </h2>
              <button 
                className="view-all-link"
                onClick={() => navigate('/ear-request-list')}
              >
                전체보기 <ArrowRight size={16} />
              </button>
            </div>
            <div className="activity-timeline">
              {loading ? (
                <div className="loading-state">활동 내역을 불러오는 중...</div>
              ) : (
                activities.map((activity, index) => {
                  const StatusIcon = getStatusIcon(activity.status);
                  return (
                    <div key={activity.id} className="timeline-item">
                      <div className="timeline-marker" style={{ backgroundColor: getStatusColor(activity.status) }}>
                        <StatusIcon size={16} />
                      </div>
                      <div className="timeline-content">
                        <div className="activity-header">
                          <h4>{activity.title}</h4>
                          <span className="activity-time">{activity.time}</span>
                        </div>
                        <p>{activity.description}</p>
                        {activity.status && (
                          <span 
                            className="activity-status"
                            style={{ color: getStatusColor(activity.status) }}
                          >
                            {activity.status === 'completed' && '완료'}
                            {activity.status === 'in_progress' && '진행중'}
                            {activity.status === 'pending' && '대기중'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 빠른 액션 */}
          <div className="quick-access-section">
            <h2 className="section-title">빠른 접근</h2>
            <div className="quick-access-grid">
              <div 
                className="quick-access-card"
                onClick={() => navigate('/ear-request-registration')}
              >
                <FileText size={28} />
                <h3>요청 등록</h3>
                <p>새로운 요청을 등록하세요</p>
              </div>
              <div 
                className="quick-access-card"
                onClick={() => navigate('/ear-request-list')}
              >
                <List size={28} />
                <h3>요청 현황</h3>
                <p>내 요청 상태를 확인하세요</p>
              </div>
              <div 
                className="quick-access-card"
                onClick={() => setShowChat(true)}
              >
                <MessageCircle size={28} />
                <h3>AI 채팅</h3>
                <p>AI와 대화하며 요청하세요</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default MainPrototype5;


