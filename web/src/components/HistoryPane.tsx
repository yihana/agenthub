import React, { useState, useEffect } from 'react';
import { History, Trash2, Plus } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  preview: string;
  lastMessage: string;
  createdAt: string;
}

interface HistoryPaneProps {
  onSessionSelect?: (sessionId: string) => void;
  onNewChat?: (sessionId: string) => void;
  onSessionDelete?: (sessionId: string) => void;
}

const HistoryPane: React.FC<HistoryPaneProps> = ({ onSessionSelect, onNewChat, onSessionDelete }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
    
    // 채팅 히스토리 업데이트 이벤트 리스너
    const handleHistoryUpdate = () => {
      loadSessions();
    };
    
    window.addEventListener('chatHistoryUpdated', handleHistoryUpdate);
    
    return () => {
      window.removeEventListener('chatHistoryUpdated', handleHistoryUpdate);
    };
  }, []);

  const loadSessions = async () => {
    try {
      // 서버에서만 세션 목록을 가져옴 (localStorage 의존성 제거)
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/sessions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.sessions) {
        // 최신순으로 정렬
        const sortedSessions = data.sessions.sort((a: ChatSession, b: ChatSession) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setSessions(sortedSessions);
      } else {
        setSessions([]);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      setSessions([]);
    }
  };

  const deleteSession = async (sessionId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 부모 클릭 이벤트 방지
    
    if (window.confirm('이 채팅 세션을 삭제하시겠습니까?')) {
      try {
        // 서버에서 세션 삭제
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/chat/session/${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          // 상태에서 제거
          setSessions(prevSessions => prevSessions.filter(session => session.id !== sessionId));
          
          // 현재 활성 세션이 삭제된 세션이면 활성 세션 해제
          if (activeSession === sessionId) {
            setActiveSession(null);
            // 부모 컴포넌트에 세션 삭제 알림
            onSessionDelete?.(sessionId);
          }
          
          // 히스토리 업데이트 이벤트 발생
          window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
        } else {
          console.error('Failed to delete session');
          alert('세션 삭제에 실패했습니다.');
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        alert('세션 삭제 중 오류가 발생했습니다.');
      }
    }
  };


  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
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
      return dateString;
    }
  };

  return (
    <div className="history-pane">
        <div className="history-header">
          <h3 className="history-title">
            <History size={18} style={{ marginRight: '0.5rem' }} />
            채팅 히스토리
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="new-chat-button" 
              onClick={() => {
                // 새 세션 ID 생성
                const newSessionId = `session_${Date.now()}`;
                
                // 활성 세션만 설정 (서버에 저장하지 않음)
                setActiveSession(newSessionId);
                
                // 부모 컴포넌트에 새 세션 ID 전달
                onNewChat?.(newSessionId);
              }}
              title="새 채팅 시작"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        <div className="history-list">
          {sessions.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              color: '#6b7280', 
              padding: '2rem 1rem',
              fontSize: '0.9rem'
            }}>
              <History size={32} style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
              <p>아직 채팅 기록이 없습니다.</p>
              <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
                새로운 대화를 시작해보세요!
              </p>
            </div>
          ) : (
            sessions.map((session) => (
              <div
                key={session.id}
                className={`history-item ${activeSession === session.id ? 'active' : ''}`}
                onClick={() => {
                  setActiveSession(session.id);
                  onSessionSelect?.(session.id);
                }}
              >
                <div className="history-item-content">
                  <div className="history-item-title">{session.title}</div>
                  <div className="history-item-preview">{session.preview}</div>
                  <div className="history-item-date">{formatDate(session.createdAt)}</div>
                </div>
                <button 
                  className="history-item-delete"
                  onClick={(e) => deleteSession(session.id, e)}
                  title="이 세션 삭제"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
    </div>
  );
};

export default HistoryPane;
