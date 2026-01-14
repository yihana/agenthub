import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import ChatPane from './components/ChatPane';
import HistoryPane from './components/HistoryPane';
import RequestStatusPane from './components/RequestStatusPane';
import QuickMenuPane from './components/QuickMenuPane';
import AppHeader from './components/AppHeader';
import AppBottom from './components/AppBottom';
import RAGDocumentManagement from './pages/RAGDocumentManagement';
import EARRequestRegistration from './pages/EARRequestRegistration';
import EARRequestList from './pages/EARRequestList';
import ESMRequestRegistration from './pages/ESMRequestRegistration';
import ImprovementRequestList from './pages/ImprovementRequestList';
import RAGQualityImprovementRequestList from './pages/RAGQualityImprovementRequestList';
import ImprovementRequestAdmin from './pages/ImprovementRequestAdmin';
import ImprovementRequestRegistration from './pages/ImprovementRequestRegistration';
import SystemImprovementRequest from './pages/SystemImprovementRequest';
import SystemImprovementList from './pages/SystemImprovementList';
import SystemImprovementAdmin from './pages/SystemImprovementAdmin';
import ProcessVisualization from './pages/ProcessVisualization';
import LoginPage from './pages/LoginPage';
import LoginHistoryPage from './pages/LoginHistoryPage';
import UserManagementPage from './pages/UserManagementPage';
import ChatIntentManagementPage from './pages/ChatIntentManagementPage';
import InterfaceAutomation from './pages/InterfaceAutomation';
import MenuManagementPage from './pages/MenuManagementPage';
import GroupMenuMappingPage from './pages/GroupMenuMappingPage';
import InputSecurityManagementPage from './pages/InputSecurityManagementPage';
import OutputSecurityManagementPage from './pages/OutputSecurityManagementPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import PrivacyPolicyManagementPage from './pages/PrivacyPolicyManagementPage';
import PromptManagementPage from './pages/PromptManagementPage';
import RAGAgentManagementPage from './pages/RAGAgentManagementPage';
import DestinationTestPage from './pages/DestinationTestPage';
import AgentDashboardPage from './pages/AgentDashboardPage';
import AgentListPage from './pages/AgentListPage';
import AgentDetailPage from './pages/AgentDetailPage';
import AgentFormPage from './pages/AgentFormPage';
import AgentMonitoringPage from './pages/AgentMonitoringPage';
import MainPrototype1 from './pages/MainPrototype1';
import MainPrototype2 from './pages/MainPrototype2';
import MainPrototype3 from './pages/MainPrototype3';
import MainPrototype4 from './pages/MainPrototype4';
import MainPrototype5 from './pages/MainPrototype5';
import MainPrototype6 from './pages/MainPrototype6';
import { clearChatStorage } from './utils/clearChatStorage';
import RouteGuard from './components/RouteGuard';
import ErrorPage from './pages/ErrorPage';
import './styles/utility.css';
import './app.css';

function AppContent() {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [isQuickMenuOpen, setIsQuickMenuOpen] = useState(false);
  const navigate = useNavigate();
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 최근 intent 조회 및 채팅 세션 열기 (함수 정의를 먼저)
  const checkRecentIntent = async (user: any) => {
    console.log('=== [FRONTEND] checkRecentIntent 시작 ===');
    console.log('[FRONTEND] user 객체:', user);
    
    try {
      const token = localStorage.getItem('token');
      console.log('[FRONTEND] token 존재 여부:', !!token);
      
      if (!token) {
        console.log('[FRONTEND] ❌ token이 없어서 종료');
        return;
      }

      console.log('[FRONTEND] API 호출 시작: /api/agent/recent-intent');
      const response = await fetch('/api/agent/recent-intent', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      console.log('[FRONTEND] API 응답 상태:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[FRONTEND] API 응답 데이터:', data);
        
        if (data.found && data.data) {
          console.log('[FRONTEND] ✅ Intent 데이터 찾음:', {
            id: data.data.id,
            user_id: data.data.user_id,
            tcode: data.data.tcode,
            contents: (data.data.contents || '').substring(0, 100) + '...',
            created_at: data.data.created_at
          });
          
          // 새로운 세션 생성
          const newSessionId = `session_${Date.now()}`;
          console.log('[FRONTEND] 새 세션 ID 생성:', newSessionId);
          
          // firstName 추출 (givenName, firstName, fullName 중 첫 번째 단어)
          let firstName = user.givenName || user.firstName || '';
          console.log('[FRONTEND] firstName 추출 시도:', {
            givenName: user.givenName,
            firstName: user.firstName,
            fullName: user.fullName,
            extracted: firstName
          });
          
          if (!firstName && user.fullName) {
            // fullName에서 첫 번째 단어 추출
            firstName = user.fullName.split(' ')[0] || user.fullName.split('　')[0] || '';
            console.log('[FRONTEND] fullName에서 firstName 추출:', firstName);
          }
          
          const eventDetail = {
            sessionId: newSessionId,
            intentData: data.data,
            firstName: firstName
          };
          
          console.log('[FRONTEND] openIntentChat 이벤트 발생:', eventDetail);
          
          // selectedSessionId를 먼저 설정하고, 약간의 지연 후 이벤트 발생
          // (React state 업데이트가 완료되도록 함)
          setSelectedSessionId(newSessionId);
          
          // 다음 이벤트 루프에서 이벤트 발생 (state 업데이트가 완료된 후)
          setTimeout(() => {
            console.log('[FRONTEND] openIntentChat 이벤트 전송 (지연 후):', eventDetail);
            window.dispatchEvent(new CustomEvent('openIntentChat', {
              detail: eventDetail
            }));
            console.log('[FRONTEND] ✅ openIntentChat 이벤트 전송 완료');
          }, 50);
        } else {
          console.log('[FRONTEND] ❌ Intent 데이터를 찾지 못함:', {
            found: data.found,
            hasData: !!data.data
          });
        }
      } else {
        const errorText = await response.text();
        console.error('[FRONTEND] ❌ API 호출 실패:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText
        });
      }
    } catch (error) {
      console.error('[FRONTEND] ❌ 최근 intent 조회 오류:', error);
      console.error('[FRONTEND] 오류 스택:', (error as Error).stack);
    }
    
    console.log('=== [FRONTEND] checkRecentIntent 완료 ===');
  };

  // 컴포넌트 마운트 시 로그인 상태 확인 및 localStorage 정리
  useEffect(() => {
    console.log('[FRONTEND] 컴포넌트 마운트 - checkLoginStatus 호출');
    checkLoginStatus();
    // 기존 localStorage의 채팅 데이터 정리 (DB와 동기화를 위해)
    clearChatStorage();
    // 페이지 상단으로 스크롤
    window.scrollTo(0, 0);
  }, []);

  // 로그인 상태와 사용자 정보가 모두 있을 때 checkRecentIntent 호출
  useEffect(() => {
    console.log('[FRONTEND] useEffect - isLoggedIn/user 변경 감지:', {
      isLoggedIn: isLoggedIn,
      hasUser: !!user,
      userId: user?.userid
    });
    
    if (isLoggedIn && user) {
      console.log('[FRONTEND] useEffect - checkRecentIntent 호출 (로그인 상태 확인)');
      // 페이지 상단으로 스크롤
      window.scrollTo(0, 0);
      // 약간의 지연을 두어 다른 상태 업데이트가 완료되도록 함
      setTimeout(() => {
        checkRecentIntent(user);
      }, 100);
    } else {
      console.log('[FRONTEND] useEffect - checkRecentIntent 호출 안함:', {
        isLoggedIn: isLoggedIn,
        hasUser: !!user
      });
    }
  }, [isLoggedIn, user]);

  // 메인화면 렌더링 시 스크롤을 상단으로 이동 (조건부 렌더링 전에 hooks 사용)
  useEffect(() => {
    if (isLoggedIn) {
      window.scrollTo(0, 0);
    }
  }, [isLoggedIn]);

  // IAS 콜백 처리 (Authorization Code Flow: query parameter에서 토큰 추출)
  useEffect(() => {
    const handleIASCallback = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const accessToken = searchParams.get('access_token');
      const error = searchParams.get('error');
      const errorDescription = searchParams.get('error_description');
      const state = searchParams.get('state');
      
      // query parameter가 있으면 처리
      if (accessToken || error) {
        // URL에서 query parameter 제거
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, document.title, url.pathname);
        
        if (accessToken) {
          try {
            console.log('토큰 수신:', {
              hasToken: !!accessToken,
              tokenLength: accessToken.length,
              tokenPrefix: accessToken.substring(0, 20) + '...'
            });
            
            localStorage.setItem('token', accessToken);
            
            // state에서 원래 경로 가져오기
            const originalPath = state || '/';
            
            // 토큰 검증 및 사용자 정보 가져오기 (직접 검증하여 성공 시에만 원래 경로로 이동)
            console.log('토큰 검증 요청 전송');
            const verifyResponse = await fetch('/api/auth/verify', {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              }
            });
            
            console.log('토큰 검증 응답:', {
              status: verifyResponse.status,
              statusText: verifyResponse.statusText,
              ok: verifyResponse.ok
            });
            
            if (verifyResponse.ok) {
              const data = await verifyResponse.json();
              console.log('[FRONTEND] handleIASCallback - 로그인 성공, user 데이터:', data.user);
              setUser(data.user);
              setIsLoggedIn(true);
              
              // 로그인 성공 후 최근 intent 조회
              console.log('[FRONTEND] handleIASCallback - checkRecentIntent 호출');
              checkRecentIntent(data.user);
              
              // 로그인 성공 후 원래 경로로 이동 (메인 페이지가 아닌 경우)
              if (originalPath && originalPath !== '/') {
                navigate(originalPath);
              } else {
                navigate('/');
              }
            } else {
              // 토큰 검증 실패
              const errorData = await verifyResponse.json().catch(() => ({ error: '토큰 검증 실패' }));
              console.error('토큰 검증 실패:', errorData);
              localStorage.removeItem('token');
              
              // 에러가 있으면 해당 에러 메시지 사용, 없으면 기본 메시지
              const errorMessage = error === 'invalid_scope' 
                ? '권한이 부족합니다. 관리자에게 문의하세요.' 
                : error 
                  ? `로그인 오류: ${error}` 
                  : '토큰 검증에 실패했습니다.';
              
              // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
              navigate('/error');
            }
          } catch (error) {
            console.error('IAS 토큰 처리 오류:', error);
            localStorage.removeItem('token');
            
            // 에러가 있으면 해당 에러 메시지 사용
            const errorMessage = error === 'invalid_scope' 
              ? '권한이 부족합니다. 관리자에게 문의하세요.' 
              : '로그인 처리 중 오류가 발생했습니다.';
            
            // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
            navigate('/error');
          }
        } else if (error) {
          // access_token이 없고 에러만 있는 경우
          console.error('IAS 로그인 오류:', error, errorDescription);
          localStorage.removeItem('token');
          
          // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
          navigate('/error');
        }
      }
    };

    handleIASCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const checkLoginStatus = async () => {
    try {
      // 먼저 query parameter 확인 (토큰이 있는 경우 handleIASCallback이 처리하도록 대기)
      const searchParams = new URLSearchParams(window.location.search);
      const accessToken = searchParams.get('access_token');
      const error = searchParams.get('error');
      
      // 토큰이 URL에 있으면 handleIASCallback이 처리하도록 대기 (리다이렉트 방지)
      if (accessToken) {
        console.log('URL에 토큰이 있습니다. handleIASCallback이 처리하도록 대기합니다.');
        return; // handleIASCallback이 처리할 때까지 대기
      }
      
      if (error) {
        console.error('IAS 로그인 오류 감지:', error, searchParams.get('error_description'));
        localStorage.removeItem('token');
        // URL에서 query parameter 제거
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, document.title, url.pathname);
        setIsLoggedIn(false);
        setUser(null);
          // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
          navigate('/error');
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        setUser(null);
        
        // IAS가 활성화되어 있는지 확인
        try {
          const configResponse = await fetch('/api/auth/config');
          if (configResponse.ok) {
            const config = await configResponse.json();
            if (config.iasEnabled) {
              // IAS 로그인 URL 가져오기 (state에 원래 경로 저장)
              const currentPath = window.location.pathname + window.location.search;
              const iasUrlResponse = await fetch(`/api/auth/ias-login-url?state=${encodeURIComponent(currentPath)}`);
              
              if (iasUrlResponse.ok) {
                const iasData = await iasUrlResponse.json();
                if (iasData.loginUrl) {
                  // IAS 로그인 페이지로 직접 리다이렉트
                  window.location.href = iasData.loginUrl;
                  return;
                }
              }
            }
          }
        } catch (configError) {
          console.warn('IAS 설정 확인 중 오류:', configError);
          if (isLocalHost) {
            setUser({
              userid: 'local-admin',
              fullName: 'Local Admin',
              email: '',
              isAdmin: true
            });
            setIsLoggedIn(true);
            return;
          }
        }
        
        // IAS가 비활성화되었거나 설정을 가져올 수 없는 경우 에러 페이지로 리다이렉트
        // /login 페이지는 현재 비활성화됨
        navigate('/error');
        return;
      }

      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[FRONTEND] checkLoginStatus - 로그인 성공, user 데이터:', data.user);
        setUser(data.user);
        setIsLoggedIn(true);
        
        // 로그인 성공 후 최근 intent 조회
        console.log('[FRONTEND] checkLoginStatus - checkRecentIntent 호출');
        checkRecentIntent(data.user);
      } else {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        setUser(null);
        
        // 토큰 검증 실패 시에도 IAS가 활성화되어 있으면 IAS로 리다이렉트
        try {
          const configResponse = await fetch('/api/auth/config');
          if (configResponse.ok) {
            const config = await configResponse.json();
            if (config.iasEnabled) {
              const currentPath = window.location.pathname + window.location.search;
              const iasUrlResponse = await fetch(`/api/auth/ias-login-url?state=${encodeURIComponent(currentPath)}`);
              
              if (iasUrlResponse.ok) {
                const iasData = await iasUrlResponse.json();
                if (iasData.loginUrl) {
                  window.location.href = iasData.loginUrl;
                  return;
                }
              }
            }
          }
        } catch (configError) {
          console.warn('IAS 설정 확인 중 오류:', configError);
        }
        
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
      }
    } catch (error) {
      console.error('로그인 상태 확인 오류:', error);
      localStorage.removeItem('token');
      setIsLoggedIn(false);
      setUser(null);
      if (isLocalHost) {
        setUser({
          userid: 'local-admin',
          fullName: 'Local Admin',
          email: '',
          isAdmin: true
        });
        setIsLoggedIn(true);
        return;
      }
      
      // 에러 발생 시에도 IAS가 활성화되어 있으면 IAS로 리다이렉트
      try {
        const configResponse = await fetch('/api/auth/config');
        if (configResponse.ok) {
          const config = await configResponse.json();
          if (config.iasEnabled) {
            const currentPath = window.location.pathname + window.location.search;
            const iasUrlResponse = await fetch(`/api/auth/ias-login-url?state=${encodeURIComponent(currentPath)}`);
            
            if (iasUrlResponse.ok) {
              const iasData = await iasUrlResponse.json();
              if (iasData.loginUrl) {
                window.location.href = iasData.loginUrl;
                return;
              }
            }
          }
        }
      } catch (configError) {
        console.warn('IAS 설정 확인 중 오류:', configError);
      }
      
      // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
      navigate('/error');
    }
  };

  const handleLogin = () => {
    // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
    navigate('/error');
  };

  const handleLogout = async () => {
    // 먼저 상태 정리 (리다이렉트 전에)
    setIsLoggedIn(false);
    setUser(null);
    
    try {
      // 로그아웃 요청 (실패해도 계속 진행)
      try {
        const response = await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        const data = await response.json();
        
        // 모든 localStorage 항목 제거
        localStorage.clear();
        
        // 모든 sessionStorage 항목 제거
        sessionStorage.clear();
        
        // 모든 쿠키 제거
        document.cookie.split(";").forEach((c) => {
          const eqPos = c.indexOf("=");
          const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
          // 쿠키 제거 (도메인과 경로를 고려하여)
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
        });
        
        // IAS 로그아웃 URL이 있으면 그곳으로 리다이렉트
        // window.location.replace를 사용하여 뒤로가기 방지
        if (data.logoutUrl) {
          window.location.replace(data.logoutUrl);
          return; // 리다이렉트 후 실행 중단
        }
      } catch (fetchError) {
        console.error('로그아웃 요청 오류:', fetchError);
        // 요청 실패해도 계속 진행
      }
      
      // 모든 localStorage 항목 제거 (요청 실패 시에도)
      localStorage.clear();
      sessionStorage.clear();
      
      // 모든 쿠키 제거
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${window.location.hostname}`;
      });
      
      // /login 페이지는 현재 비활성화됨 - 에러 페이지로 리다이렉트 (뒤로가기 방지)
      window.location.replace('/error');
    } catch (error) {
      console.error('로그아웃 오류:', error);
      // 에러가 발생해도 로컬 스토리지와 상태는 정리
      localStorage.clear();
      sessionStorage.clear();
      // /login 페이지는 현재 비활성화됨 - 에러 페이지로 강제 리다이렉트
      window.location.replace('/error');
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleNewChat = (sessionId: string) => {
    setSelectedSessionId(sessionId);
  };

  const handleSessionDelete = (sessionId: string) => {
    // 삭제된 세션이 현재 선택된 세션이면 새 채팅 상태로 리셋
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(null);
    }
  };


  // 로그인되지 않은 경우 로딩 표시
  if (!isLoggedIn) {
    return (
      <div className="app">
        <div className="fullpage-center">
          로그인 확인 중...
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        onTitleClick={() => window.location.href = '/'}
      />
      
      <main className="app-main">
        <div className="app-layout">
          <div className="left-panes">
            <RequestStatusPane />
            <HistoryPane 
              onSessionSelect={handleSessionSelect} 
              onNewChat={handleNewChat}
              onSessionDelete={handleSessionDelete}
            />
          </div>
          <ChatPane selectedSessionId={selectedSessionId} />
          <QuickMenuPane 
            isOpen={isQuickMenuOpen}
            onToggle={() => setIsQuickMenuOpen(!isQuickMenuOpen)}
          />
        </div>
      </main>
      <AppBottom />
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/error" element={<ErrorPage />} />
        <Route path="/" element={<RouteGuard><AppContent /></RouteGuard>} />
        <Route path="/rag-document-management" element={<RouteGuard><RAGDocumentManagement /></RouteGuard>} />
        <Route path="/ear-request-registration" element={<RouteGuard><EARRequestRegistration /></RouteGuard>} />
        <Route path="/ear-request-list" element={<RouteGuard><EARRequestList /></RouteGuard>} />
        <Route path="/esm-request-registration" element={<RouteGuard><ESMRequestRegistration /></RouteGuard>} />
        <Route path="/process-visualization" element={<RouteGuard><ProcessVisualization /></RouteGuard>} />
        <Route path="/improvement-request-registration" element={<RouteGuard><ImprovementRequestRegistration /></RouteGuard>} />
        <Route path="/improvement-request" element={<RouteGuard><ImprovementRequestList /></RouteGuard>} />
        <Route path="/rag-quality-improvement-list" element={<RouteGuard><RAGQualityImprovementRequestList /></RouteGuard>} />
        <Route path="/improvement-request-admin" element={<RouteGuard><ImprovementRequestAdmin /></RouteGuard>} />
        {/* /login 페이지는 현재 사용하지 않음 (IAS 연동이 안 될 때 사용하려고 했었으나 현재는 비활성화) */}
        {/* 나중에 다시 활성화할 수 있도록 주석 처리 */}
        {/* <Route path="/login" element={<LoginPage />} /> */}
        <Route path="/login-history" element={<RouteGuard><LoginHistoryPage /></RouteGuard>} />
        <Route path="/user-management" element={<RouteGuard><UserManagementPage /></RouteGuard>} />
        <Route path="/chat-intent-management" element={<RouteGuard><ChatIntentManagementPage /></RouteGuard>} />
        <Route path="/interface-automation" element={<RouteGuard><InterfaceAutomation /></RouteGuard>} />
        <Route path="/menu-management" element={<RouteGuard><MenuManagementPage /></RouteGuard>} />
        <Route path="/group-menu-mapping" element={<RouteGuard><GroupMenuMappingPage /></RouteGuard>} />
        <Route path="/system-improvement-new" element={<RouteGuard><SystemImprovementRequest /></RouteGuard>} />
        <Route path="/system-improvement-list" element={<RouteGuard><SystemImprovementList /></RouteGuard>} />
        <Route path="/system-improvement-admin" element={<RouteGuard><SystemImprovementAdmin /></RouteGuard>} />
        <Route path="/input-security-management" element={<RouteGuard><InputSecurityManagementPage /></RouteGuard>} />
        <Route path="/output-security-management" element={<RouteGuard><OutputSecurityManagementPage /></RouteGuard>} />
        <Route path="/chat-history" element={<RouteGuard><ChatHistoryPage /></RouteGuard>} />
        <Route path="/privacy-policy-management" element={<RouteGuard><PrivacyPolicyManagementPage /></RouteGuard>} />
        <Route path="/prompt-management" element={<RouteGuard><PromptManagementPage /></RouteGuard>} />
        <Route path="/rag-agent-management" element={<RouteGuard><RAGAgentManagementPage /></RouteGuard>} />
        <Route path="/destination-test" element={<RouteGuard><DestinationTestPage /></RouteGuard>} />
        <Route path="/agent-dashboard" element={<RouteGuard><AgentDashboardPage /></RouteGuard>} />
        <Route path="/agent-management" element={<RouteGuard><AgentListPage /></RouteGuard>} />
        <Route path="/agent-management/new" element={<RouteGuard><AgentFormPage /></RouteGuard>} />
        <Route path="/agent-management/:id" element={<RouteGuard><AgentDetailPage /></RouteGuard>} />
        <Route path="/agent-management/:id/edit" element={<RouteGuard><AgentFormPage /></RouteGuard>} />
        <Route path="/agent-monitoring" element={<RouteGuard><AgentMonitoringPage /></RouteGuard>} />
        <Route path="/main-prototype1" element={<RouteGuard><MainPrototype1 /></RouteGuard>} />
        <Route path="/main-prototype2" element={<RouteGuard><MainPrototype2 /></RouteGuard>} />
        <Route path="/main-prototype3" element={<RouteGuard><MainPrototype3 /></RouteGuard>} />
        <Route path="/main-prototype4" element={<RouteGuard><MainPrototype4 /></RouteGuard>} />
        <Route path="/main-prototype5" element={<RouteGuard><MainPrototype5 /></RouteGuard>} />
        <Route path="/main-prototype6" element={<RouteGuard><MainPrototype6 /></RouteGuard>} />
      </Routes>
    </Router>
  );
}

export default App;
