import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Loader2, Square } from 'lucide-react';
import MessageItem from './MessageItem';
import FirewallIntentModal from './FirewallIntentModal';
import ChatIntentModal from './ChatIntentModal';
import { useFirewallIntent } from '../hooks/useFirewallIntent';

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
  chatHistoryId?: number;
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

interface ChatPaneProps {
  selectedSessionId?: string | null;
}

const ChatPane: React.FC<ChatPaneProps> = ({ selectedSessionId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedModule, setSelectedModule] = useState<string>('SKAX Chat Modul');
  const [sessionId, setSessionId] = useState(() => {
    const initialSessionId = `session_${Date.now()}`;
    console.log('[CHATPANE] 컴포넌트 마운트 - 초기 sessionId 생성:', initialSessionId);
    return initialSessionId;
  });
  const [sessionMessageCounts, setSessionMessageCounts] = useState<{[key: string]: number}>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesRef = useRef<Message[]>([]); // 메시지 상태 추적용 ref
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  console.log('[CHATPANE] 렌더링 - 현재 상태:', {
    sessionId: sessionId,
    selectedSessionId: selectedSessionId,
    messagesCount: messages.length
  });
  
  const {
    showFirewallModal,
    firewallTemplates,
    closeFirewallModal
  } = useFirewallIntent();
  
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [intentResponse, setIntentResponse] = useState('');
  const [intentOptions, setIntentOptions] = useState<any[]>([]);
  const [intentLastUserMessage, setIntentLastUserMessage] = useState<string>('');
  const [pendingIntentData, setPendingIntentData] = useState<{
    tcode: string;
    contents: string;
    firstName: string;
  } | null>(null);

  // 히스토리 업데이트 이벤트 발생 (localStorage 제거로 인해 함수 단순화)
  const triggerHistoryUpdate = () => {
    window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
  };

  // messages state가 변경될 때마다 ref 업데이트
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // openIntentChat 이벤트 리스너
  useEffect(() => {
    const handleOpenIntentChat = (event: any) => {
      console.log('=== [CHATPANE] openIntentChat 이벤트 수신 ===');
      console.log('[CHATPANE] 이벤트 detail:', event.detail);
      
      const { sessionId: targetSessionId, intentData, firstName } = event.detail;
      
      if (!targetSessionId || !intentData) {
        console.log('[CHATPANE] ❌ 이벤트 데이터가 불완전함:', { targetSessionId, hasIntentData: !!intentData });
        return;
      }
      
      console.log('[CHATPANE] 세션 ID 비교:', {
        targetSessionId: targetSessionId,
        currentSessionId: sessionId,
        selectedSessionId: selectedSessionId,
        matchesCurrent: targetSessionId === sessionId,
        matchesSelected: targetSessionId === selectedSessionId
      });
      
      // 중요: 이벤트가 발생했으면 무조건 처리 (세션 ID 검증 제거)
      // App.tsx에서 새로운 세션을 생성했으므로, 이 세션으로 전환하고 메시지 표시
      console.log('[CHATPANE] ✅✅✅ 인사 메시지 생성 시작 - 무조건 처리 (이벤트 수신) ✅✅✅');
      console.log('[CHATPANE] 처리 이유: openIntentChat 이벤트 수신됨, 무조건 처리');
      
      // sessionId를 이벤트의 targetSessionId로 업데이트
      if (targetSessionId !== sessionId) {
        console.log('[CHATPANE] sessionId 업데이트:', sessionId, '->', targetSessionId);
        setSessionId(targetSessionId);
      } else {
        console.log('[CHATPANE] sessionId 동일, 업데이트 불필요');
      }
      
      setPendingIntentData({
        tcode: intentData.tcode,
        contents: intentData.contents,
        firstName: firstName || ''
      });
      
      console.log('[CHATPANE] pendingIntentData 설정:', {
        tcode: intentData.tcode,
        contents: (intentData.contents || '').substring(0, 100) + '...',
        firstName: firstName || ''
      });
      
      // 인사 메시지 추가
      const greetingMessage: Message = {
        id: `assistant_${Date.now()}`,
        type: 'assistant',
        content: `안녕하세요 ${firstName || ''}님\n\n${intentData.tcode} 관련된 업무를 처리중에 문의 또는 요청사항이 발생되었군요.\n\n${intentData.contents} 관련된 내용의 처리를 도와줄까요?`,
        timestamp: new Date(),
        intentOptions: [{
          id: 1,
          title: 'YES',
          description: 'LLM에게 처리 도움 요청',
          actionType: 'intent_yes',
          actionData: {
            tcode: intentData.tcode,
            contents: intentData.contents
          }
        }, {
          id: 2,
          title: '요청등록',
          description: '서비스 요청등록을 위한 내용을 AI가 자동작성 합니다.',
          actionType: 'esm_request_auto',
          actionData: {
            intentId: intentData.id,
            contents: intentData.contents,
            tcode: intentData.tcode
          }
        }]
      };
      
      console.log('[CHATPANE] 생성된 인사 메시지:', {
        id: greetingMessage.id,
        type: greetingMessage.type,
        content: greetingMessage.content.substring(0, 100) + '...',
        hasIntentOptions: !!greetingMessage.intentOptions,
        intentOptionsCount: greetingMessage.intentOptions?.length || 0
      });
      
        setMessages([greetingMessage]);
        console.log('[CHATPANE] ✅ 메시지 상태 업데이트 완료');
        
        // 인사 메시지를 데이터베이스에 저장
        const saveGreetingMessage = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) {
              console.warn('[CHATPANE] ⚠️ 토큰이 없어 인사 메시지 저장 불가');
              return;
            }

            const response = await fetch('/api/chat/greeting', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sessionId: sessionId,
                greetingMessage: greetingMessage.content,
                intentOptions: greetingMessage.intentOptions
              })
            });

            if (!response.ok) {
              throw new Error('인사 메시지 저장 실패');
            }

            console.log('[CHATPANE] ✅ 인사 메시지 데이터베이스 저장 완료');
          } catch (error) {
            console.error('[CHATPANE] ❌ 인사 메시지 저장 오류:', error);
          }
        };

        saveGreetingMessage();
        
        // 인사 메시지 표시 후 인사 완료 표시 API 호출
        const intentId = intentData.id;
        if (intentId) {
          console.log('[CHATPANE] 인사 완료 표시 API 호출 시작:', intentId);
          const token = localStorage.getItem('token');
          if (token) {
            fetch('/api/agent/mark-greeted', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ intentId: intentId })
            })
              .then(response => response.json())
              .then(data => {
                console.log('[CHATPANE] ✅ 인사 완료 표시 API 응답:', data);
              })
              .catch(error => {
                console.error('[CHATPANE] ❌ 인사 완료 표시 API 오류:', error);
              });
          } else {
            console.warn('[CHATPANE] ⚠️ 토큰이 없어 인사 완료 표시 API 호출 불가');
          }
        } else {
          console.warn('[CHATPANE] ⚠️ intentId가 없어 인사 완료 표시 API 호출 불가');
        }
      
      console.log('=== [CHATPANE] openIntentChat 이벤트 처리 완료 ===');
    };

    console.log('[CHATPANE] openIntentChat 이벤트 리스너 등록');
    window.addEventListener('openIntentChat', handleOpenIntentChat as EventListener);
    return () => {
      console.log('[CHATPANE] openIntentChat 이벤트 리스너 제거');
      window.removeEventListener('openIntentChat', handleOpenIntentChat as EventListener);
    };
  }, [sessionId, selectedSessionId]);

  // intentYesClicked 이벤트 리스너
  useEffect(() => {
    const handleIntentYesClicked = async (event: any) => {
      const { tcode, contents } = event.detail;
      
      if (!tcode || !contents) {
        console.error('TCODE 또는 CONTENTS가 없습니다.');
        return;
      }
      
      // 사용자 메시지로 "YES" 추가
      const userMessage: Message = {
        id: `user_${Date.now()}`,
        type: 'user',
        content: 'YES',
        timestamp: new Date()
      };
      
      setMessages(prev => {
        const newMessages = [...prev, userMessage];
        return newMessages.sort((a, b) => {
          const timeA = a.timestamp.getTime();
          const timeB = b.timestamp.getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
          if (a.type === 'user' && b.type === 'assistant') return -1;
          if (a.type === 'assistant' && b.type === 'user') return 1;
          return 0;
        });
      });
      
      // LLM에 TCODE와 CONTENTS 전달
      const messageToLLM = `TCODE: ${tcode}\n\nCONTENTS: ${contents}\n\n위 정보를 바탕으로 어떻게 처리할지 안내해주세요.`;
      
      setIsLoading(true);
      
      // AbortController 생성
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: messageToLLM,
            sessionId
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          throw new Error('스트리밍 요청 실패');
        }

        const reader = response.body?.getReader();
        readerRef.current = reader || null;
        const decoder = new TextDecoder();

        // 스트리밍 메시지 생성
        const streamingMessageId = `assistant_${Date.now()}`;
        const streamingMessage: Message = {
          id: streamingMessageId,
          type: 'assistant',
          content: '',
          timestamp: new Date()
        };

        setMessages(prev => {
          const newMessages = [...prev, streamingMessage];
          return newMessages.sort((a, b) => {
            const timeA = a.timestamp.getTime();
            const timeB = b.timestamp.getTime();
            if (timeA !== timeB) {
              return timeA - timeB;
            }
            if (a.type === 'user' && b.type === 'assistant') return -1;
            if (a.type === 'assistant' && b.type === 'user') return 1;
            return 0;
          });
        });

        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6));
                    
                    switch (data.type) {
                      case 'chunk':
                        setMessages(prev => prev.map(msg => 
                          msg.id === streamingMessageId 
                            ? { ...msg, content: msg.content + data.content }
                            : msg
                        ));
                        break;
                      
                      case 'sources':
                        setMessages(prev => prev.map(msg => 
                          msg.id === streamingMessageId 
                            ? { ...msg, sources: data.sources }
                            : msg
                        ));
                        break;
                      
                      case 'done':
                        setMessages(prev => {
                          const updated = prev.map(msg => 
                            msg.id === streamingMessageId 
                              ? { ...msg, content: data.response, sources: data.sources }
                              : msg
                          );
                          return updated.sort((a, b) => {
                            const timeA = a.timestamp.getTime();
                            const timeB = b.timestamp.getTime();
                            if (timeA !== timeB) {
                              return timeA - timeB;
                            }
                            if (a.type === 'user' && b.type === 'assistant') return -1;
                            if (a.type === 'assistant' && b.type === 'user') return 1;
                            return 0;
                          });
                        });
                        break;
                      
                      case 'error':
                        throw new Error(data.error);
                    }
                  } catch (parseError) {
                    console.error('JSON 파싱 오류:', parseError);
                  }
                }
              }
            }
          } catch (readError: any) {
            // AbortError는 정상적인 중지이므로 무시
            if (readError.name !== 'AbortError') {
              throw readError;
            }
          } finally {
            readerRef.current = null;
          }
        }
      } catch (error: any) {
        // AbortError는 정상적인 중지이므로 에러 메시지 표시 안 함
        if (error.name === 'AbortError') {
          console.log('스트리밍이 중지되었습니다.');
          setIsLoading(false);
          abortControllerRef.current = null;
          return;
        }
        console.error('Failed to send intent message:', error);
        const errorMessage: Message = {
          id: `error_${Date.now()}`,
          type: 'assistant',
          content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
          timestamp: new Date()
        };
        setMessages(prev => {
          const newMessages = [...prev, errorMessage];
          return newMessages.sort((a, b) => {
            const timeA = a.timestamp.getTime();
            const timeB = b.timestamp.getTime();
            if (timeA !== timeB) {
              return timeA - timeB;
            }
            if (a.type === 'user' && b.type === 'assistant') return -1;
            if (a.type === 'assistant' && b.type === 'user') return 1;
            return 0;
          });
        });
      } finally {
        setIsLoading(false);
        readerRef.current = null;
        abortControllerRef.current = null;
        window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
      }
    };

    window.addEventListener('intentYesClicked', handleIntentYesClicked as EventListener);
    return () => {
      window.removeEventListener('intentYesClicked', handleIntentYesClicked as EventListener);
    };
  }, [sessionId]);

  // 컴포넌트 마운트 시 초기화
  useEffect(() => {
    console.log('[CHATPANE] 컴포넌트 마운트 시 초기화 체크:', {
      selectedSessionId: selectedSessionId,
      currentSessionId: sessionId
    });
    
    if (selectedSessionId === null) {
      // 새 채팅 상태로 시작
      console.log('[CHATPANE] selectedSessionId가 null이므로 새 채팅 상태로 시작');
      setMessages([]);
      const newSessionId = `session_${Date.now()}`;
      console.log('[CHATPANE] 새 세션 ID 생성 (마운트 시):', newSessionId);
      setSessionId(newSessionId);
      // 새 세션의 메시지 카운트 초기화
      setSessionMessageCounts(prev => ({
        ...prev,
        [newSessionId]: 0
      }));
    } else {
      console.log('[CHATPANE] selectedSessionId가 있음:', selectedSessionId);
    }
  }, []);

  // 선택된 세션이 변경될 때 해당 세션의 히스토리 로드
  useEffect(() => {
    console.log('[CHATPANE] 선택된 세션 변경 감지:', {
      selectedSessionId: selectedSessionId,
      currentSessionId: sessionId,
      isDifferent: selectedSessionId !== sessionId,
      isNull: selectedSessionId === null
    });
    
    if (selectedSessionId && selectedSessionId !== sessionId) {
      // 선택된 세션 ID로 변경하고 해당 세션의 히스토리 로드
      console.log('[CHATPANE] 세션 변경 및 히스토리 로드:', selectedSessionId);
      setSessionId(selectedSessionId);
      
      // 약간의 지연을 두어 openIntentChat 이벤트 처리가 먼저 완료되도록 함
      setTimeout(() => {
        loadChatHistoryForSession(selectedSessionId);
      }, 100);
      
      // 히스토리 패널 새로고침을 위한 이벤트 발생
      window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
    } else if (selectedSessionId === null) {
      // 새 채팅 시작 시 메시지 초기화 및 새로운 세션 ID 생성
      console.log('[CHATPANE] 새 채팅 시작');
      setMessages([]);
      const newSessionId = `session_${Date.now()}`;
      console.log('[CHATPANE] 새 세션 ID 생성:', newSessionId);
      setSessionId(newSessionId);
      // 새 세션의 메시지 카운트 초기화
      setSessionMessageCounts(prev => ({
        ...prev,
        [newSessionId]: 0
      }));
      // 히스토리 패널 새로고침을 위한 이벤트 발생
      window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
    } else {
      console.log('[CHATPANE] 세션 ID가 동일하거나 변경 없음');
    }
  }, [selectedSessionId]);

  // 자동 스크롤 함수
  const scrollToBottom = () => {
    // block: 'nearest' 옵션을 추가하여 페이지 전체 스크롤을 방지
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  };

  // 메시지가 변경될 때마다 자동 스크롤
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // inputValue가 변경될 때 textarea 높이 조정
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }, [inputValue]);


  const loadChatHistoryForSession = async (targetSessionId: string) => {
    try {
      console.log('히스토리 로드 시작:', targetSessionId);
      setIsLoadingHistory(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat/history/${targetSessionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      console.log('히스토리 응답 데이터:', data);
      
      if (data.history && data.history.length > 0) {
        const historyMessages: Message[] = data.history.map((item: any, index: number) => {
          // 디버깅: 첫 번째 항목의 모든 필드 확인
          if (index === 0) {
            console.log('히스토리 첫 번째 항목 원본 데이터:', item);
            console.log('사용 가능한 필드명:', Object.keys(item));
          }
          
          const parsedSources = Array.isArray(item.sources)
            ? item.sources
            : (typeof item.sources === 'string' && item.sources.trim()
                ? (() => { try { return JSON.parse(item.sources); } catch { return undefined; } })()
                : (item.SOURCES && typeof item.SOURCES === 'string' && item.SOURCES.trim()
                    ? (() => { try { return JSON.parse(item.SOURCES); } catch { return undefined; } })()
                    : undefined));

          // intentOptions 파싱 (HANA는 대문자, PostgreSQL은 소문자)
          // 모든 가능한 필드명 확인
          const intentOptionsField = item.intent_options || item.INTENT_OPTIONS || item.intentOptions;
          
          let parsedIntentOptions: any[] | undefined = undefined;
          
          if (intentOptionsField) {
            if (Array.isArray(intentOptionsField)) {
              // 이미 배열인 경우
              parsedIntentOptions = intentOptionsField;
            } else if (typeof intentOptionsField === 'string' && intentOptionsField.trim()) {
              // 문자열인 경우 파싱 시도
              try {
                const parsed = JSON.parse(intentOptionsField);
                if (Array.isArray(parsed)) {
                  parsedIntentOptions = parsed;
                } else {
                  console.warn('intentOptions가 배열이 아님:', parsed);
                }
              } catch (e) {
                console.error('intentOptions 파싱 에러:', e, '원본:', intentOptionsField);
              }
            }
          }
          
          // 디버깅: intentOptions가 있는 메시지만 로그
          if (parsedIntentOptions && parsedIntentOptions.length > 0) {
            console.log(`[${index}] intentOptions 파싱 성공:`, parsedIntentOptions);
          }

          return [
          {
            id: `user_${targetSessionId}_${index}`,
            type: 'user' as const,
            content: item.user_message,
            timestamp: new Date(item.created_at),
            chatHistoryId: item.id
          },
          {
            id: `assistant_${targetSessionId}_${index}`,
            type: 'assistant' as const,
            content: item.assistant_response || item.assistantResponse,
            sources: parsedSources,
            intentOptions: parsedIntentOptions,
            timestamp: new Date(item.created_at || item.CREATED_AT),
            chatHistoryId: item.id || item.ID
          }
          ].flat();
        }).flat();
        
        // timestamp 기준으로 정렬 (오래된 것부터)
        historyMessages.sort((a, b) => {
          const timeA = a.timestamp.getTime();
          const timeB = b.timestamp.getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
          // 같은 시간이면 user가 assistant보다 먼저
          if (a.type === 'user' && b.type === 'assistant') return -1;
          if (a.type === 'assistant' && b.type === 'user') return 1;
          return 0;
        });
        
        console.log('변환된 메시지:', historyMessages.length, '개');
        
        // 히스토리 로드 전 현재 메시지 확인 (인사 메시지가 있는지)
        const currentMessages = messagesRef.current;
        const hasGreetingMessage = currentMessages.some(msg => 
          msg.type === 'assistant' && 
          msg.intentOptions && 
          msg.intentOptions.length > 0 &&
          msg.intentOptions[0].actionType === 'intent_yes'
        );
        
        // 히스토리가 있고, 인사 메시지가 없을 때만 히스토리로 덮어쓰기
        // 히스토리가 있으면 항상 히스토리를 표시 (인사 메시지보다 우선)
        if (historyMessages.length > 0) {
          console.log('[CHATPANE] 히스토리 메시지로 설정:', historyMessages.length, '개');
          setMessages(historyMessages);
        } else if (!hasGreetingMessage) {
          // 히스토리가 비어있고 인사 메시지도 없으면 초기화
          console.log('[CHATPANE] 히스토리와 인사 메시지 모두 없음 - 초기화');
          setMessages([]);
        } else {
          // 히스토리가 비어있지만 인사 메시지가 있으면 유지
          console.log('[CHATPANE] 히스토리 로드 - 인사 메시지 유지 (히스토리 비어있음):', currentMessages.map(m => ({ id: m.id, type: m.type, hasIntentOptions: !!m.intentOptions })));
        }
        
        // 세션별 메시지 카운트 업데이트 (사용자 메시지만 카운트)
        const userMessageCount = historyMessages.filter(msg => msg.type === 'user').length;
        setSessionMessageCounts(prev => ({
          ...prev,
          [targetSessionId]: userMessageCount
        }));
        
        // 히스토리 로드 후 스크롤을 맨 아래로 이동
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      } else {
        // 해당 세션에 히스토리가 없으면 빈 메시지 배열로 설정
        // 단, openIntentChat 이벤트로 인해 메시지가 이미 설정되어 있을 수 있으므로 확인
        console.log('히스토리가 비어있음');
        const currentMessages = messagesRef.current;
        console.log('[CHATPANE] 히스토리 로드 전 현재 메시지 수:', currentMessages.length);
        
        // 현재 메시지가 없거나, 인사 메시지가 아닌 경우에만 초기화
        // (openIntentChat 이벤트로 인사 메시지가 설정된 경우 유지)
        const hasGreetingMessage = currentMessages.some(msg => 
          msg.type === 'assistant' && 
          msg.intentOptions && 
          msg.intentOptions.length > 0 &&
          msg.intentOptions[0].actionType === 'intent_yes'
        );
        
        if (currentMessages.length === 0 || !hasGreetingMessage) {
          console.log('[CHATPANE] 메시지가 없거나 인사 메시지가 아니므로 초기화');
          setMessages([]);
        } else {
          console.log('[CHATPANE] 인사 메시지가 이미 있으므로 유지:', currentMessages.map(m => ({ id: m.id, type: m.type, hasIntentOptions: !!m.intentOptions })));
        }
        
        setSessionMessageCounts(prev => ({
          ...prev,
          [targetSessionId]: 0
        }));
      }
    } catch (error) {
      console.error('Failed to load chat history for session:', error);
      // 에러 발생 시 빈 메시지 배열로 설정
      setMessages([]);
      setSessionMessageCounts(prev => ({
        ...prev,
        [targetSessionId]: 0
      }));
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    // 기능 구현중인 모듈 선택 시 alert 표시
    if (selectedModule === 'SKAX First SKN Second' || selectedModule === 'SKN First SKAX Second') {
      alert('기능 구현중');
      return;
    }

    // 입력보안 검증
    try {
      const token = localStorage.getItem('token');
      const validationResponse = await fetch('/api/input-security/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: inputValue })
      });

      if (!validationResponse.ok) {
        const validationData = await validationResponse.json();
        if (validationData.blocked && validationData.violations) {
          const violationMessages = validationData.violations.map((v: any) => v.message).join('\n');
          alert(`입력이 차단되었습니다:\n${violationMessages}`);
          return;
        }
      }
    } catch (validationError) {
      console.error('입력 검증 오류:', validationError);
      // 검증 실패 시에도 계속 진행 (서버에서도 검증하므로)
    }

      const userMessage: Message = {
      id: `user_${Date.now()}`,
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    // 메시지를 추가하고 timestamp 기준으로 정렬
    setMessages(prev => {
      const newMessages = [...prev, userMessage];
      // timestamp 기준으로 정렬 (오래된 것부터)
      return newMessages.sort((a, b) => {
        const timeA = a.timestamp.getTime();
        const timeB = b.timestamp.getTime();
        if (timeA !== timeB) {
          return timeA - timeB;
        }
        // 같은 시간이면 user가 assistant보다 먼저
        if (a.type === 'user' && b.type === 'assistant') return -1;
        if (a.type === 'assistant' && b.type === 'user') return 1;
        return 0;
      });
    });
    
    // 첫 메시지인 경우 히스토리 업데이트 (새로운 세션에서만)
    const currentMessageCount = sessionMessageCounts[sessionId] || 0;
    
    if (currentMessageCount === 0) {
      triggerHistoryUpdate();
    }
    
    // 세션별 메시지 카운트 업데이트
    setSessionMessageCounts(prev => ({
      ...prev,
      [sessionId]: (prev[sessionId] || 0) + 1
    }));
    
    const currentMessage = inputValue;
    setInputValue('');
    setIsLoading(true);
    
    // 입력창 높이 초기화
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // AbortController 생성
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      // 스트리밍 응답 처리
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: currentMessage,
          sessionId,
          moduleType: selectedModule
        }),
        signal: abortController.signal
      });

      if (!response.ok) {
        throw new Error('스트리밍 요청 실패');
      }

      // 의도 감지 응답인지 확인 (JSON 응답)
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (data.isIntentDetected && data.intentOptions) {
          // displayType이 'inline'이면 메시지로 표시, 'modal'이면 모달 표시
          if (data.displayType === 'inline') {
            // 인라인으로 메시지에 선택지 포함하여 표시
            const assistantMessage: Message = {
              id: `assistant_${Date.now()}`,
              type: 'assistant',
              content: data.response,
              timestamp: new Date(),
              intentOptions: data.intentOptions,
              intentCategory: data.intentCategory
            };
            setMessages(prev => {
              const newMessages = [...prev, assistantMessage];
              // timestamp 기준으로 정렬 (오래된 것부터)
              return newMessages.sort((a, b) => {
                const timeA = a.timestamp.getTime();
                const timeB = b.timestamp.getTime();
                if (timeA !== timeB) {
                  return timeA - timeB;
                }
                if (a.type === 'user' && b.type === 'assistant') return -1;
                if (a.type === 'assistant' && b.type === 'user') return 1;
                return 0;
              });
            });
            setIsLoading(false);
            return;
          } else {
            // 모달 표시 - 메시지에도 표시 (히스토리 저장용)
            const assistantMessage: Message = {
              id: `assistant_${Date.now()}`,
              type: 'assistant',
              content: data.response, // "[요청선택 팝업표시됨]" 포함된 메시지
              timestamp: new Date()
            };
            setMessages(prev => {
              const newMessages = [...prev, assistantMessage];
              // timestamp 기준으로 정렬 (오래된 것부터)
              return newMessages.sort((a, b) => {
                const timeA = a.timestamp.getTime();
                const timeB = b.timestamp.getTime();
                if (timeA !== timeB) {
                  return timeA - timeB;
                }
                if (a.type === 'user' && b.type === 'assistant') return -1;
                if (a.type === 'assistant' && b.type === 'user') return 1;
                return 0;
              });
            });
            // 모달도 표시
            setIntentResponse(data.response);
            setIntentOptions(data.intentOptions);
            setIntentLastUserMessage(currentMessage); // 직전 사용자 메시지 저장
            setShowIntentModal(true);
            setIsLoading(false);
            return;
          }
        } else if (data.isFirewallIntent && data.firewallTemplates) {
          // 방화벽 의도 처리 - 메시지에도 표시 (히스토리 저장용)
          const assistantMessage: Message = {
            id: `assistant_${Date.now()}`,
            type: 'assistant',
            content: data.response, // "[요청선택 팝업표시됨]" 포함된 메시지
            timestamp: new Date()
          };
          setMessages(prev => {
            const newMessages = [...prev, assistantMessage];
            // timestamp 기준으로 정렬 (오래된 것부터)
            return newMessages.sort((a, b) => {
              const timeA = a.timestamp.getTime();
              const timeB = b.timestamp.getTime();
              if (timeA !== timeB) {
                return timeA - timeB;
              }
              if (a.type === 'user' && b.type === 'assistant') return -1;
              if (a.type === 'assistant' && b.type === 'user') return 1;
              return 0;
            });
          });
          // useFirewallIntent 훅을 통해 모달 처리
          setIsLoading(false);
          return;
        }
      }

      const reader = response.body?.getReader();
      readerRef.current = reader || null;
      const decoder = new TextDecoder();

      // 스트리밍 메시지 생성
      const streamingMessageId = `assistant_${Date.now()}`;
      const streamingMessage: Message = {
        id: streamingMessageId,
        type: 'assistant',
        content: '',
        timestamp: new Date()
      };

      // 메시지를 추가하고 timestamp 기준으로 정렬
      setMessages(prev => {
        const newMessages = [...prev, streamingMessage];
        // timestamp 기준으로 정렬 (오래된 것부터)
        return newMessages.sort((a, b) => {
          const timeA = a.timestamp.getTime();
          const timeB = b.timestamp.getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
          // 같은 시간이면 user가 assistant보다 먼저
          if (a.type === 'user' && b.type === 'assistant') return -1;
          if (a.type === 'assistant' && b.type === 'user') return 1;
          return 0;
        });
      });

      if (reader) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  switch (data.type) {
                    case 'chunk':
                      setMessages(prev => prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, content: msg.content + data.content }
                          : msg
                      ));
                      break;
                    
                    case 'sources':
                      setMessages(prev => prev.map(msg => 
                        msg.id === streamingMessageId 
                          ? { ...msg, sources: data.sources }
                          : msg
                      ));
                      break;
                    
                    case 'done':
                      // 최종 메시지 업데이트 및 정렬
                      setMessages(prev => {
                        const updated = prev.map(msg => 
                          msg.id === streamingMessageId 
                            ? { ...msg, content: data.response, sources: data.sources }
                            : msg
                        );
                        // timestamp 기준으로 정렬 (오래된 것부터)
                        return updated.sort((a, b) => {
                          const timeA = a.timestamp.getTime();
                          const timeB = b.timestamp.getTime();
                          if (timeA !== timeB) {
                            return timeA - timeB;
                          }
                          // 같은 시간이면 user가 assistant보다 먼저
                          if (a.type === 'user' && b.type === 'assistant') return -1;
                          if (a.type === 'assistant' && b.type === 'user') return 1;
                          return 0;
                        });
                      });
                      break;
                    
                    case 'error':
                      throw new Error(data.error);
                  }
                } catch (parseError) {
                  console.error('JSON 파싱 오류:', parseError);
                }
              }
            }
          }
        } catch (readError: any) {
          // AbortError는 정상적인 중지이므로 무시
          if (readError.name !== 'AbortError') {
            throw readError;
          }
        } finally {
          readerRef.current = null;
        }
      }
    } catch (error: any) {
      // AbortError는 정상적인 중지이므로 에러 메시지 표시 안 함
      if (error.name === 'AbortError') {
        console.log('스트리밍이 중지되었습니다.');
        setIsLoading(false);
        abortControllerRef.current = null;
        return;
      }
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: `error_${Date.now()}`,
        type: 'assistant',
        content: '죄송합니다. 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date()
      };
      // 메시지를 추가하고 timestamp 기준으로 정렬
      setMessages(prev => {
        const newMessages = [...prev, errorMessage];
        // timestamp 기준으로 정렬 (오래된 것부터)
        return newMessages.sort((a, b) => {
          const timeA = a.timestamp.getTime();
          const timeB = b.timestamp.getTime();
          if (timeA !== timeB) {
            return timeA - timeB;
          }
          // 같은 시간이면 user가 assistant보다 먼저
          if (a.type === 'user' && b.type === 'assistant') return -1;
          if (a.type === 'assistant' && b.type === 'user') return 1;
          return 0;
        });
      });
    } finally {
      setIsLoading(false);
      readerRef.current = null;
      abortControllerRef.current = null;
      // 새 메시지 전송 후 히스토리 패널 새로고침
      window.dispatchEvent(new CustomEvent('chatHistoryUpdated'));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // 스트리밍 중지 함수
  const stopStreaming = async () => {
    try {
      // Reader가 있으면 취소
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }
      
      // AbortController가 있으면 abort
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('스트리밍 중지 중 오류:', error);
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-pane">
      <div className="chat-header">
        <h2 className="chat-title">채팅</h2>
      </div>

      <div className="chat-messages" ref={chatMessagesRef}>
        {isLoadingHistory ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            <Loader2 size={48} className="loading-spinner" style={{ marginBottom: '1rem' }} />
            <p>채팅 기록을 불러오는 중...</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            color: '#6b7280',
            textAlign: 'center'
          }}>
            <MessageCircle size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
            <p>ERP 업무 지원 Copilot 입니다. </p>
            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
              ERP 업무 관련 궁금한 것이 있으시면 언제든 질문해주세요.
            </p>
          </div>
        ) : (
          messages
            .filter(msg => !(msg.type === 'user' && msg.content === '[시스템 인사]'))
            .map((message, index) => {
            // 이전 사용자 메시지를 찾기
            const previousUserMessage = index > 0 && messages[index - 1].type === 'user' 
              ? messages[index - 1].content 
              : '';
            
            return (
              <MessageItem 
                key={message.id} 
                message={message}
                sessionId={sessionId}
                chatHistoryId={message.chatHistoryId}
                userMessage={previousUserMessage}
              />
            );
          })
        )}
        
        {isLoading && (
          <div className="loading-message">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Loader2 size={16} className="loading-spinner" />
              <span>답변을 생성하고 있습니다...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-container">
          <select
            className="chat-module-select"
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
          >
            <option value="SKAX Chat Modul">SKAX Chat Modul</option>
            <option value="SK Networks RAG Module">SK Networks RAG Module</option>
            <option value="SKAX First SKN Second">SKAX First SKN Second</option>
            <option value="SKN First SKAX Second">SKN First SKAX Second</option>
          </select>
          <textarea
            ref={textareaRef}
            className="chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="메시지를 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
            rows={1}
            style={{
              height: 'auto',
              minHeight: '44px',
              maxHeight: '120px',
              overflow: 'auto'
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          {isLoading ? (
            <button
              className="send-button stop-button"
              onClick={stopStreaming}
            >
              <Square size={16} />
              중지
            </button>
          ) : (
            <button
              className="send-button"
              onClick={sendMessage}
              disabled={!inputValue.trim()}
            >
              <Send size={16} />
              전송
            </button>
          )}
        </div>
      </div>

      {showFirewallModal && (
        <FirewallIntentModal
          templates={firewallTemplates}
          onClose={closeFirewallModal}
        />
      )}

      {showIntentModal && (
        <ChatIntentModal
          responseMessage={intentResponse}
          options={intentOptions}
          sessionId={sessionId}
          lastUserMessage={intentLastUserMessage}
          onClose={() => {
            setShowIntentModal(false);
            setIntentResponse('');
            setIntentOptions([]);
            setIntentLastUserMessage('');
          }}
        />
      )}
    </div>
  );
};

export default ChatPane;
