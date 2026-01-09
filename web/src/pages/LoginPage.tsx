import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import './LoginPage.css';

interface LoginFormData {
  userid: string;
  password: string;
}

interface User {
  id: number;
  userid: string;
  fullName: string;
  email: string;
  isAdmin: boolean;
}

const LoginPage: React.FC = () => {
  const [formData, setFormData] = useState<LoginFormData>({
    userid: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authConfig, setAuthConfig] = useState<any>(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  // navigate state 또는 URL 쿼리 파라미터에서 에러 메시지 가져오기
  useEffect(() => {
    // URL 쿼리 파라미터에서 에러 확인
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    
    if (errorParam) {
      // invalid_scope 에러는 무시 (백엔드에서 자동으로 재시도)
      if (errorParam === 'invalid_scope') {
        // URL에서 에러 파라미터 제거
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        return;
      }
      
      // 다른 에러는 표시
      const errorMsg = errorDescription || errorParam;
      setError(`로그인 오류: ${errorMsg}`);
      // URL에서 에러 파라미터 제거
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    } else if (location.state && (location.state as any).error) {
      setError((location.state as any).error);
      // state 초기화하여 뒤로가기 시 다시 표시되지 않도록
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  // 인증 설정 로드
  useEffect(() => {
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
    loadAuthConfig();
  }, []);

  // IAS 콜백 처리 (URL hash에서 토큰 추출)
  useEffect(() => {
    const handleIASCallback = async () => {
      const hash = window.location.hash;
      if (hash) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get('access_token');
        const error = params.get('error');
        
        if (error) {
          setError(`IAS 로그인 오류: ${error}`);
          window.location.hash = '';
          setIsLoading(false);
          return;
        }
        
        if (accessToken) {
          try {
            localStorage.setItem('token', accessToken);
            window.location.hash = '';
            
            // 토큰 검증 및 사용자 정보 가져오기
            const verifyResponse = await fetch('/api/auth/verify', {
              headers: {
                'Authorization': `Bearer ${accessToken}`
              }
            });
            
            if (verifyResponse.ok) {
              const data = await verifyResponse.json();
              setUser(data.user);
              setIsLoggedIn(true);
              navigate('/');
            } else {
              setError('토큰 검증에 실패했습니다.');
              localStorage.removeItem('token');
            }
          } catch (error) {
            console.error('IAS 토큰 처리 오류:', error);
            setError('로그인 처리 중 오류가 발생했습니다.');
            localStorage.removeItem('token');
          } finally {
            setIsLoading(false);
          }
        }
      }
    };

    // URL hash에서 토큰 확인
    if (window.location.hash.includes('access_token') || window.location.hash.includes('error')) {
      handleIASCallback();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 컴포넌트 마운트 시 토큰 확인
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      verifyToken();
    }
  }, []);

  // 로그아웃 후 IAS 리다이렉트 (authConfig가 로드된 후)
  useEffect(() => {
    // authConfig가 로드되고, 토큰이 없고, IAS가 활성화되어 있으면 IAS 로그인 페이지로 리다이렉트
    // (로그아웃 후 /login으로 리다이렉트된 경우)
    if (authConfig && !localStorage.getItem('token') && authConfig.iasEnabled) {
      const redirectToIAS = async () => {
        try {
          const response = await fetch('/api/auth/ias-login-url');
          if (response.ok) {
            const data = await response.json();
            if (data.loginUrl) {
              window.location.href = data.loginUrl;
            }
          }
        } catch (error) {
          console.error('IAS 로그인 URL 가져오기 오류:', error);
        }
      };
      redirectToIAS();
    }
  }, [authConfig]);

  const verifyToken = async () => {
    try {
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsLoggedIn(true);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('토큰 검증 오류:', error);
      localStorage.removeItem('token');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // 입력 시 에러 메시지 초기화
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setUser(data.user);
        setIsLoggedIn(true);
        navigate('/');
      } else {
        setError(data.error || '로그인에 실패했습니다.');
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIASLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/ias-login-url');
      if (response.ok) {
        const data = await response.json();
        if (data.loginUrl) {
          // IAS 로그인 페이지로 리다이렉트
          window.location.href = data.loginUrl;
        } else {
          setError('IAS 로그인 URL을 가져올 수 없습니다.');
          setIsLoading(false);
        }
      } else {
        const data = await response.json();
        setError(data.error || 'IAS 로그인 URL 가져오기에 실패했습니다.');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('IAS 로그인 오류:', error);
      setError('IAS 로그인 중 오류가 발생했습니다.');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    // 먼저 상태 정리 (리다이렉트 전에)
    setUser(null);
    setIsLoggedIn(false);
    setFormData({ userid: '', password: '' });
    
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e as any);
    }
  };

  // 이미 로그인된 경우
  if (isLoggedIn && user) {
    return (
      <div className="login-page">
        <div className="login-container">
          <div className="login-header">
            <h1>EAR Base Version</h1>
            <p>지식기반 어시스턴트</p>
          </div>
          
          <div className="user-info">
            <div className="user-avatar">
              <User size={48} />
            </div>
            <div className="user-details">
              <h2>환영합니다, {user.fullName}님!</h2>
              <p>사용자ID: {user.userid}</p>
              {user.email && <p>이메일: {user.email}</p>}
              {user.isAdmin && <p className="admin-badge">관리자</p>}
            </div>
          </div>

          <div className="login-actions">
            <button 
              onClick={() => navigate('/')} 
              className="btn btn-primary"
            >
              메인으로 이동
            </button>
            <button 
              onClick={handleLogout} 
              className="btn btn-secondary"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">
            <Lock size={48} />
          </div>
          <h1>EAR Base Version</h1>
          <p>지식기반 어시스턴트</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="userid">사용자ID</label>
            <div className="input-group">
              <User size={20} className="input-icon" />
              <input
                type="text"
                id="userid"
                name="userid"
                value={formData.userid}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="사용자ID를 입력하세요"
                required
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호</label>
            <div className="input-group">
              <Lock size={20} className="input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="비밀번호를 입력하세요"
                required
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-login"
            disabled={isLoading || !formData.userid || !formData.password}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* IAS 로그인 버튼 (XSUAA 활성화 시) */}
        {authConfig?.iasEnabled && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
            <div style={{ textAlign: 'center', marginBottom: '15px', color: '#666', fontSize: '14px' }}>
              또는
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleIASLogin}
              disabled={isLoading}
              style={{ width: '100%' }}
            >
              {isLoading ? '연결 중...' : 'SAP IAS 로그인'}
            </button>
          </div>
        )}

        <div className="login-footer">
          {!authConfig?.iasEnabled && (
            <>
              <p>임시 로그인 페이지</p>
              <p>이페이지는 SSO 연동 후 삭제예정</p>
            </>
          )}
          {authConfig?.iasEnabled && (
            <p>SAP IAS를 통한 로그인 또는 사용자ID/비밀번호로 로그인 가능합니다</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
