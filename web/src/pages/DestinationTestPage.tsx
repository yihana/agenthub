import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Loader2, Send } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PageLayout from '../components/PageLayout';
import './DestinationTestPage.css';

interface TestResult {
  success: boolean;
  data?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
  };
  error?: string;
  details?: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: any;
  };
}

interface DestinationConfig {
  destinationName: string;  // Destination 이름 (BTP에서 등록한 이름)
  url: string;              // 직접 URL 입력 (destinationName이 없을 때 사용)
  method: string;
  path: string;
  authType: 'none' | 'basic' | 'oauth2';
  basicAuth: {
    username: string;
    password: string;
  };
  oauth2: {
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
  };
  useDestination: boolean;  // Destination 서비스 사용 여부
}

const DestinationTestPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [config, setConfig] = useState<DestinationConfig>({
    destinationName: '',
    url: '',
    method: 'get',
    path: '',  // Destination 사용 시 기본값을 빈 문자열로
    authType: 'none',
    basicAuth: {
      username: '',
      password: ''
    },
    oauth2: {
      tokenUrl: '',
      clientId: '',
      clientSecret: ''
    },
    useDestination: true  // 기본값: Destination 서비스 사용
  });

  const testDestination = async () => {
    if (config.useDestination && !config.destinationName) {
      alert('Destination 이름을 입력해주세요.');
      return;
    }
    if (!config.useDestination && !config.url) {
      alert('URL을 입력해주세요.');
      return;
    }

    setLoading(true);
    setResult(null);
    setShowModal(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/error');
        return;
      }

      const requestBody: any = {
        method: config.method,
        path: config.path
      };

      if (config.useDestination) {
        requestBody.destinationName = config.destinationName;
      } else {
        requestBody.url = config.url;
        requestBody.authType = config.authType;
        
        if (config.authType === 'basic') {
          requestBody.basicAuth = {
            username: config.basicAuth.username,
            password: config.basicAuth.password
          };
        } else if (config.authType === 'oauth2') {
          requestBody.oauth2 = {
            tokenUrl: config.oauth2.tokenUrl,
            clientId: config.oauth2.clientId,
            clientSecret: config.oauth2.clientSecret
          };
        }
      }

      const response = await fetch('/api/destination-test/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      
      if (data.success) {
        setResult({
          success: true,
          data: data.data
        });
      } else {
        setResult({
          success: false,
          error: data.error,
          details: data.details
        });
      }
      
      setShowModal(true);
    } catch (error: any) {
      console.error('Destination 테스트 오류:', error);
      setResult({
        success: false,
        error: error.message || '서버 연결에 실패했습니다.'
      });
      setShowModal(true);
    } finally {
      setLoading(false);
    }
  };

  const formatHeaders = (headers: Record<string, string> | undefined) => {
    if (!headers) return null;
    return Object.entries(headers).map(([key, value]) => (
      <div key={key} className="header-item">
        <strong>{key}:</strong> <span>{value}</span>
      </div>
    ));
  };

  const formatData = (data: any) => {
    if (!data) return 'N/A';
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return data;
      }
    }
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  return (
    <PageLayout
      user={user ? {
        id: user.id || 0,
        userid: user.userid || '',
        fullName: user.fullName || '',
        email: user.email || '',
        isAdmin: user.isAdmin || false
      } : null}
      onLogin={handleLogin}
      onLogout={handleLogout}
      isLoggedIn={isLoggedIn}
    >
      <div className="destination-test-page">
        <div className="page-header">
          <h1>연동테스트</h1>
          <p>외부 시스템 연동을 테스트합니다. Destination 정보를 입력하고 테스트하세요.</p>
        </div>

        <div className="destination-form-container">
          <div className="form-section">
            <h3>연결 방식</h3>
            <div className="form-group">
              <label>
                <input
                  type="radio"
                  checked={config.useDestination}
                  onChange={() => setConfig({ ...config, useDestination: true })}
                  disabled={loading}
                  style={{ marginRight: '0.5rem' }}
                />
                SAP BTP Destination 서비스 사용
              </label>
              <label style={{ marginLeft: '1rem' }}>
                <input
                  type="radio"
                  checked={!config.useDestination}
                  onChange={() => setConfig({ ...config, useDestination: false })}
                  disabled={loading}
                  style={{ marginRight: '0.5rem' }}
                />
                직접 URL 입력
              </label>
            </div>

            {config.useDestination ? (
              <div className="form-group">
                <label htmlFor="destination-name-input">Destination 이름 *</label>
                <input
                  id="destination-name-input"
                  type="text"
                  value={config.destinationName}
                  onChange={(e) => setConfig({ ...config, destinationName: e.target.value })}
                  placeholder="NAVER 또는 ADXP_PRIVATE_API"
                  disabled={loading}
                  style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
                <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                  SAP BTP Subaccount에서 등록한 Destination 이름을 입력하세요.
                </small>
              </div>
            ) : (
              <div className="form-group">
                <label htmlFor="url-input">URL *</label>
                <input
                  id="url-input"
                  type="text"
                  value={config.url}
                  onChange={(e) => setConfig({ ...config, url: e.target.value })}
                  placeholder="https://api.example.com"
                  disabled={loading}
                  style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                />
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>HTTP Method</label>
                <select
                  value={config.method}
                  onChange={(e) => setConfig({ ...config, method: e.target.value })}
                  disabled={loading}
                  title="HTTP Method 선택"
                >
                  <option value="get">GET</option>
                  <option value="post">POST</option>
                  <option value="put">PUT</option>
                  <option value="delete">DELETE</option>
                  <option value="patch">PATCH</option>
                </select>
              </div>
              {config.useDestination ? (
                <div className="form-group">
                  <label htmlFor="path-input">Path (선택사항)</label>
                  <input
                    id="path-input"
                    type="text"
                    value={config.path}
                    onChange={(e) => setConfig({ ...config, path: e.target.value })}
                    placeholder="비워두면 Destination URL 그대로 사용"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                  <small style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
                    Destination URL에 추가 경로가 필요한 경우에만 입력하세요.
                  </small>
                </div>
              ) : (
                <div className="form-group">
                  <label htmlFor="path-input">Path</label>
                  <input
                    id="path-input"
                    type="text"
                    value={config.path}
                    onChange={(e) => setConfig({ ...config, path: e.target.value })}
                    placeholder="/api/v1/endpoint"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              )}
            </div>
          </div>

          {!config.useDestination && (
            <div className="form-section">
              <h3>인증 설정</h3>
              <div className="form-group">
                <label>인증 타입</label>
                <select
                  value={config.authType}
                  onChange={(e) => setConfig({ ...config, authType: e.target.value as 'none' | 'basic' | 'oauth2' })}
                  disabled={loading}
                  title="인증 타입 선택"
                >
                  <option value="none">인증 없음</option>
                  <option value="basic">Basic Authentication</option>
                  <option value="oauth2">OAuth2 Client Credentials</option>
                </select>
              </div>

              {config.authType === 'basic' && (
              <div className="auth-config">
                <div className="form-group">
                  <label htmlFor="basic-username">Username</label>
                  <input
                    id="basic-username"
                    type="text"
                    value={config.basicAuth.username}
                    onChange={(e) => setConfig({
                      ...config,
                      basicAuth: { ...config.basicAuth, username: e.target.value }
                    })}
                    placeholder="사용자명"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="basic-password">Password</label>
                  <input
                    id="basic-password"
                    type="password"
                    value={config.basicAuth.password}
                    onChange={(e) => setConfig({
                      ...config,
                      basicAuth: { ...config.basicAuth, password: e.target.value }
                    })}
                    placeholder="비밀번호"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>
            )}

            {config.authType === 'oauth2' && (
              <div className="auth-config">
                <div className="form-group">
                  <label htmlFor="oauth-token-url">Token URL</label>
                  <input
                    id="oauth-token-url"
                    type="text"
                    value={config.oauth2.tokenUrl}
                    onChange={(e) => setConfig({
                      ...config,
                      oauth2: { ...config.oauth2, tokenUrl: e.target.value }
                    })}
                    placeholder="https://oauth.example.com/token"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="oauth-client-id">Client ID</label>
                  <input
                    id="oauth-client-id"
                    type="text"
                    value={config.oauth2.clientId}
                    onChange={(e) => setConfig({
                      ...config,
                      oauth2: { ...config.oauth2, clientId: e.target.value }
                    })}
                    placeholder="클라이언트 ID"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="oauth-client-secret">Client Secret</label>
                  <input
                    id="oauth-client-secret"
                    type="password"
                    value={config.oauth2.clientSecret}
                    onChange={(e) => setConfig({
                      ...config,
                      oauth2: { ...config.oauth2, clientSecret: e.target.value }
                    })}
                    placeholder="클라이언트 시크릿"
                    disabled={loading}
                    style={{ display: 'block', width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '6px' }}
                  />
                </div>
              </div>
              )}
            </div>
          )}

          <div className="form-actions">
            <button
              className={`test-button ${loading ? 'loading' : ''}`}
              onClick={testDestination}
              disabled={loading || (config.useDestination ? !config.destinationName : !config.url)}
            >
              {loading ? (
                <>
                  <Loader2 className="spinner" size={20} />
                  <span>연결 중...</span>
                </>
              ) : (
                <>
                  <Send size={20} />
                  <span>연동 테스트</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 결과 모달 */}
        {showModal && result && (
          <div className="result-modal-overlay" onClick={() => setShowModal(false)}>
            <div className="result-modal" onClick={(e) => e.stopPropagation()}>
              <div className="result-modal-header">
                <h2>
                  {result.success ? '연동 테스트 성공' : '연동 테스트 실패'}
                </h2>
                <button
                  className="close-button"
                  onClick={() => setShowModal(false)}
                  title="닫기"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="result-modal-content">
                {result.success && result.data ? (
                  <>
                    <div className="result-section">
                      <h3>HTTP Response</h3>
                      <div className="result-item">
                        <strong>Status:</strong> {result.data.status} {result.data.statusText}
                      </div>
                      <div className="result-item">
                        <strong>Response Data:</strong>
                        <pre className="code-block">{formatData(result.data.data)}</pre>
                      </div>
                    </div>

                    <div className="result-section">
                      <h3>Response Headers</h3>
                      <div className="headers-container">
                        {formatHeaders(result.data.headers)}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="result-section">
                      <h3>에러 정보</h3>
                      <div className="result-item error">
                        <strong>Error:</strong> {result.error || '알 수 없는 오류'}
                      </div>
                    </div>

                    {result.details && (
                      <>
                        <div className="result-section">
                          <h3>HTTP Response</h3>
                          <div className="result-item">
                            <strong>Status:</strong> {result.details.status} {result.details.statusText}
                          </div>
                          <div className="result-item">
                            <strong>Response Data:</strong>
                            <pre className="code-block">{formatData(result.details.data)}</pre>
                          </div>
                        </div>

                        <div className="result-section">
                          <h3>Response Headers</h3>
                          <div className="headers-container">
                            {formatHeaders(result.details.headers)}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div className="result-modal-footer">
                <button
                  className="close-modal-button"
                  onClick={() => setShowModal(false)}
                >
                  닫기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
};

export default DestinationTestPage;

