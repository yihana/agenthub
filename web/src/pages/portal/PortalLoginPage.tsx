import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePortalAuth } from '../../hooks/usePortalAuth';
import '../LoginPage.css';

const PortalLoginPage: React.FC = () => {
  const { login, isLoggedIn } = usePortalAuth();
  const navigate = useNavigate();
  const [userid, setUserid] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn) {
      navigate('/portal-dashboard');
    }
  }, [isLoggedIn, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(userid, password);
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-icon">
            <Lock size={24} />
          </div>
          <h1>Agent Portal 로그인</h1>
          <p>회사/역할 기반 포털 권한으로 접속합니다.</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="portal-userid">사용자 ID</label>
            <div className="input-wrapper">
              <User size={18} />
              <input
                id="portal-userid"
                type="text"
                value={userid}
                onChange={(event) => setUserid(event.target.value)}
                placeholder="portal-admin"
              />
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="portal-password">비밀번호</label>
            <div className="input-wrapper">
              <Lock size={18} />
              <input
                id="portal-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <button className="btn-login" type="submit" disabled={isLoading}>
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PortalLoginPage;
