import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearChatStorage } from '../utils/clearChatStorage';

interface User {
  id?: number;
  userid: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
  samlGroups?: string[];
}

interface AuthConfig {
  useXSUAA: boolean;
  iasEnabled: boolean;
  loginUrl: string | null;
  localOnly?: boolean;
}

export const useAuth = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authConfig, setAuthConfig] = useState<AuthConfig | null>(null);
  const navigate = useNavigate();
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

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

      let config: AuthConfig | null = authConfig;
      if (!config) {
        try {
          const configResponse = await fetch('/api/auth/config');
          if (configResponse.ok) {
            config = await configResponse.json();
            setAuthConfig(config);
          }
        } catch (configError) {
          console.warn('인증 설정 확인 중 오류:', configError);
          if (isLocalHost) {
            setUser({
              userid: 'local-admin',
              fullName: 'Local Admin',
              email: '',
              isAdmin: true
            });
            setIsLoggedIn(true);
            if (window.location.pathname === '/error' || window.location.pathname === '/login') {
              navigate('/');
            }
            return;
          }
        }
      }

      if (config?.localOnly) {
        setUser({
          userid: 'local-admin',
          fullName: 'Local Admin',
          email: '',
          isAdmin: true
        });
        setIsLoggedIn(true);
        if (window.location.pathname === '/error' || window.location.pathname === '/login') {
          navigate('/');
        }
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setIsLoggedIn(false);
        setUser(null);
        
        // IAS가 활성화되어 있는지 확인
        try {
          if (config?.iasEnabled) {
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
        } catch (configError) {
          console.warn('IAS 설정 확인 중 오류:', configError);
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
        console.log('🔍 /api/auth/verify 응답:', {
          user: data.user,
          isAdmin: data.user?.isAdmin,
          source: data.source
        });
        setUser(data.user);
        setIsLoggedIn(true);
      } else {
        localStorage.removeItem('token');
        setIsLoggedIn(false);
        setUser(null);
        
        // 토큰 검증 실패 시에도 IAS가 활성화되어 있으면 IAS로 리다이렉트
        try {
          if (config?.iasEnabled) {
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
      
      // 에러 발생 시에도 IAS가 활성화되어 있으면 IAS로 리다이렉트
      try {
        if (config?.iasEnabled) {
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
      } catch (configError) {
        console.warn('IAS 설정 확인 중 오류:', configError);
      }
      
      // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
      navigate('/error');
    }
  };

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
            localStorage.setItem('token', accessToken);
            
            // state에서 원래 경로 가져오기
            const originalPath = state || '/';
            
            // 토큰 검증 및 사용자 정보 가져오기 (직접 검증하여 성공 시에만 원래 경로로 이동)
            const verifyResponse = await fetch('/api/auth/verify', {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (verifyResponse.ok) {
              const data = await verifyResponse.json();
              console.log('🔍 IAS 콜백 /api/auth/verify 응답:', {
                user: data.user,
                isAdmin: data.user?.isAdmin,
                source: data.source
              });
              setUser(data.user);
              setIsLoggedIn(true);
              
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
            
            // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
            navigate('/error');
          }
        } else if (error) {
          // access_token이 없고 에러만 있는 경우
          console.error('IAS 로그인 오류:', error, errorDescription);
          localStorage.removeItem('token');
          
          // 에러 메시지 표시를 위해 로그인 페이지로 이동
          let errorMessage = `로그인 오류: ${error}`;
          if (error === 'invalid_scope') {
            errorMessage = `스코프 권한 오류: Role Collection이 설정되지 않았거나 애플리케이션에 연결되지 않았습니다.\n\n확인 사항:\n1. BTP Cockpit에서 Role Collection이 애플리케이션에 연결되어 있는지 확인\n2. 사용자에게 Role Collection이 할당되어 있는지 확인\n3. XSUAA 서비스 인스턴스가 올바르게 업데이트되었는지 확인`;
          }
          
          // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
          navigate('/error');
        }
      }
    };

    handleIASCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadAuthConfig = async () => {
    try {
      const response = await fetch('/api/auth/config');
      if (response.ok) {
        const config = await response.json();
        setAuthConfig(config);
      }
    } catch (error) {
      console.error('인증 설정 로드 오류:', error);
    }
  };

  const handleIASLogin = async () => {
    try {
      const response = await fetch('/api/auth/ias-login-url');
      if (response.ok) {
        const data = await response.json();
        if (data.loginUrl) {
          // IAS 로그인 페이지로 리다이렉트
          window.location.href = data.loginUrl;
        }
      } else {
        console.error('IAS 로그인 URL 가져오기 실패');
      }
    } catch (error) {
      console.error('IAS 로그인 오류:', error);
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

  useEffect(() => {
    loadAuthConfig();
    checkLoginStatus();
    // 기존 localStorage의 채팅 데이터 정리 (DB와 동기화를 위해)
    clearChatStorage();
  }, []);

  return {
    isLoggedIn,
    user,
    authConfig,
    handleLogin,
    handleIASLogin,
    handleLogout,
    checkLoginStatus
  };
};
