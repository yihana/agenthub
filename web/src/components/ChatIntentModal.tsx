import React, { useState } from 'react';
import { X, Lock, Shield, User, FileText, AlertCircle, Settings, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface IntentOption {
  id: number;
  title: string;
  description?: string;
  actionType: string;
  actionData: any;
  iconName?: string;
}

interface ChatIntentModalProps {
  responseMessage: string;
  options: IntentOption[];
  sessionId?: string;
  lastUserMessage?: string;
  onClose: () => void;
}

const ChatIntentModal: React.FC<ChatIntentModalProps> = ({
  responseMessage,
  options,
  sessionId,
  lastUserMessage,
  onClose
}) => {
  const navigate = useNavigate();
  const [isGeneratingFromChat, setIsGeneratingFromChat] = useState(false);

  const getIcon = (iconName?: string) => {
    const iconMap: { [key: string]: any } = {
      Lock, Shield, User, FileText, AlertCircle, Settings, HelpCircle
    };
    const Icon = iconName ? iconMap[iconName] || FileText : FileText;
    return <Icon size={20} />;
  };

  const handleOptionSelect = async (option: IntentOption) => {
    if (option.actionType === 'ear_request') {
      // EAR 요청 등록 페이지로 이동 (템플릿 정보 포함)
      const params = new URLSearchParams();
      if (option.actionData?.template_id) {
        params.set('template_id', option.actionData.template_id);
      }
      if (option.actionData?.keyword_id) {
        params.set('keyword_id', option.actionData.keyword_id);
      }
      const queryString = params.toString();
      navigate(`/ear-request-registration${queryString ? `?${queryString}` : ''}`);
      onClose();
    } else if (option.actionType === 'esm_request') {
      // 채팅 히스토리 기반으로 요청 제목/내용 생성
      setIsGeneratingFromChat(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('로그인이 필요합니다.');
          setIsGeneratingFromChat(false);
          return;
        }

        if (!sessionId) {
          alert('세션 정보를 찾을 수 없습니다.');
          setIsGeneratingFromChat(false);
          return;
        }

        const response = await fetch('/api/agent/generate-request-from-chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: sessionId,
            lastUserMessage: lastUserMessage || ''
          })
        });

        if (!response.ok) {
          throw new Error('요청 제목/내용 생성에 실패했습니다.');
        }

        const data = await response.json();
        const { title, content } = data;

        // URL 파라미터로 제목과 내용 전달
        const params = new URLSearchParams();
        params.set('title', encodeURIComponent(title));
        params.set('content', encodeURIComponent(content));
        
        // template_id가 있으면 함께 전달
        if (option.actionData?.template_id) {
          params.set('template_id', option.actionData.template_id);
        }
        
        const queryString = params.toString();
        navigate(`/esm-request-registration?${queryString}`);
        onClose();
      } catch (error) {
        console.error('요청 제목/내용 생성 오류:', error);
        alert('요청 제목/내용 생성 중 오류가 발생했습니다.');
      } finally {
        setIsGeneratingFromChat(false);
      }
    } else if (option.actionType === 'navigate') {
      // 일반 페이지 이동
      const route = option.actionData?.route || '/';
      // 절대 URL이 아닌 경우에만 navigate 사용
      if (route.startsWith('http://') || route.startsWith('https://')) {
        window.location.href = route;
      } else {
        navigate(route);
      }
      onClose();
    }
  };

  return (
    <div className="chat-intent-modal">
      <div className="chat-intent-modal-content">
        <div className="chat-intent-modal-header">
          <h2 className="chat-intent-modal-title">요청 선택</h2>
          <button className="close-button" onClick={onClose} title="모달 닫기">
            <X size={20} />
          </button>
        </div>

        <div className="chat-intent-message">
          {responseMessage}
        </div>

        <div className="chat-intent-options">
          {options.map((option) => {
            const isGenerating = isGeneratingFromChat && option.actionType === 'esm_request';
            return (
              <div
                key={option.id}
                className={`chat-intent-option ${isGenerating ? 'disabled' : ''}`}
                onClick={isGenerating ? undefined : () => handleOptionSelect(option)}
                style={{ opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'wait' : 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ color: '#3b82f6' }}>
                    {getIcon(option.iconName)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="chat-intent-option-title">
                      {isGenerating ? '요청 제목/내용 작성 중...' : option.title}
                    </div>
                    {option.description && (
                      <div className="chat-intent-option-description">
                        {isGenerating ? 'AI가 대화 내역을 바탕으로 요청 제목과 내용을 자동으로 작성하고 있습니다.' : option.description}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChatIntentModal;

