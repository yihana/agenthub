import React, { useState } from 'react';
import { User, Bot, MessageSquare, Lock, Shield, FileText, AlertCircle, Settings, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DocumentViewer from './DocumentViewer';
import ImprovementRequestModal from './ImprovementRequestModal';
import ImprovementStepsModal from './ImprovementStepsModal';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    source: string;
    similarity: number;
    created_at: string;
    page_number?: number;
  }>;
  timestamp: Date;
  intentOptions?: Array<{
    id: number;
    title: string;
    description?: string;
    actionType: string;
    actionData: any;
    iconName?: string;
  }>;
  intentCategory?: string;
}

interface MessageItemProps {
  message: Message;
  sessionId?: string;
  chatHistoryId?: number;
  userMessage?: string;
}

const MessageItem: React.FC<MessageItemProps> = ({ message, sessionId, chatHistoryId, userMessage }) => {
  const navigate = useNavigate();
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [selectedPageNumber, setSelectedPageNumber] = useState<number | undefined>(undefined);
  const [showImprovementModal, setShowImprovementModal] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showImprovementStepsModal, setShowImprovementStepsModal] = useState(false);
  const [isGeneratingRequest, setIsGeneratingRequest] = useState(false);
  const [isGeneratingFromChat, setIsGeneratingFromChat] = useState(false);

  const formatTime = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '-';
    
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
  };

  // source에서 document ID 추출 
  // 파일 경로에서 문서 ID를 찾기 위해 데이터베이스에서 조회
  const extractDocumentId = async (source: string): Promise<number | null> => {
    try {
      // 파일 경로에서 문서 ID 조회
      const response = await fetch(`/api/rag/document-by-path`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filePath: source })
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.documentId;
      }
    } catch (error) {
      console.error('Error fetching document ID:', error);
    }
    return null;
  };

  const handleSourceClick = async (source: string, pageNumber?: number) => {
    const documentId = await extractDocumentId(source);
    if (documentId) {
      setSelectedDocumentId(documentId);
      setShowDocumentViewer(true);
      // 페이지 번호를 상태에 저장하여 DocumentViewer에 전달
      if (pageNumber) {
        setSelectedPageNumber(pageNumber);
      }
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      setSelectedText(selection.toString().trim());
    }
  };

  const handleImprovementRequest = () => {
    // 텍스트가 선택되지 않았으면 전체 응답을 선택된 텍스트로 사용
    if (!selectedText) {
      setSelectedText(message.content);
    }
    setShowImprovementModal(true);
  };

  const getIcon = (iconName?: string) => {
    const iconMap: { [key: string]: any } = {
      Lock, Shield, User, FileText, AlertCircle, Settings, HelpCircle
    };
    const Icon = iconName ? iconMap[iconName] || FileText : FileText;
    return <Icon size={20} />;
  };

  const handleOptionSelect = async (option: NonNullable<Message['intentOptions']>[0]) => {
    if (option.actionType === 'intent_yes') {
      // YES 버튼 클릭 시 이벤트 발생
      window.dispatchEvent(new CustomEvent('intentYesClicked', {
        detail: {
          tcode: option.actionData?.tcode,
          contents: option.actionData?.contents
        }
      }));
    } else if (option.actionType === 'esm_request_auto') {
      // 요청등록 버튼 클릭 - LLM으로 제목/내용 생성 후 요청등록 화면으로 이동
      setIsGeneratingRequest(true);
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          alert('로그인이 필요합니다.');
          setIsGeneratingRequest(false);
          return;
        }

        const response = await fetch('/api/agent/generate-request', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            intentId: option.actionData?.intentId,
            contents: option.actionData?.contents
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
        const queryString = params.toString();
        
        navigate(`/esm-request-registration?${queryString}`);
      } catch (error) {
        console.error('요청 제목/내용 생성 오류:', error);
        alert('요청 제목/내용 생성 중 오류가 발생했습니다.');
      } finally {
        setIsGeneratingRequest(false);
      }
    } else if (option.actionType === 'ear_request') {
      const params = new URLSearchParams();
      if (option.actionData?.template_id) {
        params.set('template_id', option.actionData.template_id);
      }
      if (option.actionData?.keyword_id) {
        params.set('keyword_id', option.actionData.keyword_id);
      }
      const queryString = params.toString();
      navigate(`/ear-request-registration${queryString ? `?${queryString}` : ''}`);
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

        // 직전 사용자 메시지 사용 (userMessage가 전달된 경우 사용, 아니면 message의 이전 메시지 찾기)
        const lastUserMsg = userMessage || message.content || '';

        const response = await fetch('/api/agent/generate-request-from-chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId: sessionId,
            lastUserMessage: lastUserMsg
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
      } catch (error) {
        console.error('요청 제목/내용 생성 오류:', error);
        alert('요청 제목/내용 생성 중 오류가 발생했습니다.');
      } finally {
        setIsGeneratingFromChat(false);
      }
    } else if (option.actionType === 'improvement_request') {
      // 프로그램 개선 요청 - 5단계 팝업 표시
      setShowImprovementStepsModal(true);
    } else if (option.actionType === 'improvement_status') {
      // 진행상태 확인 - 추후 구현
      alert('진행상태 확인 기능은 준비 중입니다.');
    } else if (option.actionType === 'navigate') {
      const route = option.actionData?.route || '/';
      if (route.startsWith('http://') || route.startsWith('https://')) {
        window.location.href = route;
      } else {
        navigate(route);
      }
    }
  };

  const formatSources = (sources: Message['sources']) => {
    if (!sources || sources.length === 0) return null;

    return (
      <div className="message-sources">
        <div className="sources-title">📚 참고 문서</div>
        {sources.map((source, index) => {
          // 파일 경로가 있으면 클릭 가능하게 설정
          const isClickable = source.source && source.source.length > 0;
          
          return (
            <div 
              key={index} 
              className={`source-item ${isClickable ? 'clickable' : ''}`}
              onClick={isClickable ? () => handleSourceClick(source.source, source.page_number) : undefined}
              style={isClickable ? { cursor: 'pointer' } : {}}
            >
              • {source.title} ({source.source}) - 유사도: {source.similarity}%
              {source.page_number && (
                <span style={{ color: '#3b82f6', fontWeight: 'bold', marginLeft: '8px' }}>
                  [페이지 {source.page_number}]
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const formatIntentOptions = (options: Message['intentOptions']) => {
    // 디버깅: intentOptions 확인
    if (message.type === 'assistant' && message.id.includes('assistant')) {
      console.log('MessageItem - message.intentOptions:', message.intentOptions);
      console.log('MessageItem - formatIntentOptions 호출, options:', options);
    }
    
    if (!options || !Array.isArray(options) || options.length === 0) {
      if (message.type === 'assistant' && message.id.includes('assistant')) {
        console.log('MessageItem - intentOptions가 없거나 비어있음');
      }
      return null;
    }

    const isApplicationImprovement = message.intentCategory === 'application_improvement';

    return (
      <div className="message-intent-options" style={{ marginTop: '1rem' }}>
        {options.map((option) => {
          // "프로그램 개선 요청"은 추천으로 빨간색 테두리 깜빡임
          const isRecommended = isApplicationImprovement && option.title === '프로그램 개선 요청';
          
          const isGenerating = (isGeneratingRequest && option.actionType === 'esm_request_auto') || 
                               (isGeneratingFromChat && option.actionType === 'esm_request');
          
          return (
            <div
              key={option.id}
              className={`message-intent-option ${isRecommended ? 'recommended-option' : ''} ${isGenerating ? 'disabled' : ''}`}
              onClick={isGenerating ? undefined : () => handleOptionSelect(option)}
              style={{ position: 'relative', opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'wait' : 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ color: '#3b82f6' }}>
                  {getIcon(option.iconName)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="message-intent-option-title">
                    {isGenerating ? '요청 제목/내용 작성 중...' : option.title}
                  </div>
                  {option.description && (
                    <div className="message-intent-option-description">
                      {isGenerating ? 'AI가 대화 내역을 바탕으로 요청 제목과 내용을 자동으로 작성하고 있습니다.' : option.description}
                    </div>
                  )}
                </div>
                {isRecommended && (
                  <div className="ai-recommendation-robot">
                    <svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* 로봇 머리 */}
                      <circle cx="50" cy="30" r="22" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                      {/* 안테나 */}
                      <line x1="50" y1="8" x2="50" y2="15" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="50" cy="6" r="2" fill="#60A5FA"/>
                      {/* 귀/센서 */}
                      <circle cx="35" cy="28" r="4" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                      <circle cx="65" cy="28" r="4" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                      {/* 눈 */}
                      <circle cx="43" cy="28" r="3" fill="#3B82F6"/>
                      <circle cx="57" cy="28" r="3" fill="#3B82F6"/>
                      {/* 눈썹 */}
                      <path d="M40 23 Q43 21 46 23" stroke="#1F2937" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      <path d="M54 23 Q57 21 60 23" stroke="#1F2937" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                      {/* 입 */}
                      <path d="M45 35 Q50 38 55 35" stroke="#1F2937" strokeWidth="2" fill="none" strokeLinecap="round"/>
                      {/* 몸통 */}
                      <rect x="35" y="50" width="30" height="35" rx="5" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                      {/* 하트 */}
                      <path d="M47 58 C47 56, 43 54, 43 58 C43 54, 39 56, 39 58 C39 62, 43 66, 47 70 C51 66, 55 62, 55 58 C55 54, 51 56, 51 58 C51 56, 47 56, 47 58 Z" fill="#3B82F6" opacity="0.8"/>
                      {/* 왼팔 */}
                      <rect x="20" y="58" width="12" height="8" rx="4" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                      <circle cx="26" cy="62" r="4" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                      {/* 오른팔 - 가리키는 제스처 */}
                      <g transform="translate(74, 59) rotate(-15) translate(-74, -59)">
                        <rect x="68" y="56" width="12" height="6" rx="3" fill="white" stroke="#60A5FA" strokeWidth="2"/>
                        <path d="M78 56 L83 51 L83 54 L86 54 L86 58 L83 58 L83 61 Z" fill="#60A5FA" stroke="#60A5FA" strokeWidth="1.5" strokeLinejoin="round"/>
                      </g>
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className={`message ${message.type}`}>
        <div className="message-avatar">
          {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
        </div>
        <div className="message-content">
          <div 
            className="message-text"
            onMouseUp={message.type === 'assistant' ? handleTextSelection : undefined}
            style={{ userSelect: 'text' }}
          >
            {message.content.split('\n').map((line, index, lines) => {
              // "[요청선택 팝업표시됨]" 부분을 다른 색상으로 표시
              if (line.includes('[요청선택 팝업표시됨]')) {
                const parts = line.split('[요청선택 팝업표시됨]');
                return (
                  <React.Fragment key={index}>
                    {parts[0] && <span>{parts[0]}</span>}
                    <span className="popup-indicator">[요청선택 팝업표시됨]</span>
                    {parts[1] && <span>{parts[1]}</span>}
                    {index < lines.length - 1 && <br />}
                  </React.Fragment>
                );
              }
              return (
                <React.Fragment key={index}>
                  {line}
                  {index < lines.length - 1 && <br />}
                </React.Fragment>
              );
            })}
          </div>
          {formatSources(message.sources)}
          {formatIntentOptions(message.intentOptions)}
          
          {/* 개선요청 버튼 (어시스턴트 메시지에만 표시) */}
          {message.type === 'assistant' && sessionId && (
            <div className="message-actions">
              <button 
                className="improvement-request-button"
                onClick={handleImprovementRequest}
                title="개선요청하기"
              >
                <MessageSquare size={14} />
                답변품질 개선요청
              </button>
            </div>
          )}
          
          <div style={{ 
            fontSize: '0.75rem', 
            color: message.type === 'user' ? 'rgba(255,255,255,0.7)' : '#9ca3af',
            marginTop: '0.5rem'
          }}>
            {formatTime(message.timestamp)}
          </div>
        </div>
      </div>

      {showDocumentViewer && selectedDocumentId && (
        <DocumentViewer
          documentId={selectedDocumentId}
          onClose={() => {
            setShowDocumentViewer(false);
            setSelectedDocumentId(null);
            setSelectedPageNumber(undefined);
          }}
          initialPage={selectedPageNumber}
        />
      )}

      {showImprovementModal && (
        <ImprovementRequestModal
          isOpen={showImprovementModal}
          onClose={() => {
            setShowImprovementModal(false);
            setSelectedText('');
          }}
          chatHistoryId={chatHistoryId || 0}
          sessionId={sessionId}
          selectedText={selectedText}
          userMessage={userMessage || ''}
          assistantResponse={message.content}
        />
      )}

      {showImprovementStepsModal && (
        <ImprovementStepsModal
          isOpen={showImprovementStepsModal}
          onClose={() => setShowImprovementStepsModal(false)}
        />
      )}
    </>
  );
};

export default MessageItem;

