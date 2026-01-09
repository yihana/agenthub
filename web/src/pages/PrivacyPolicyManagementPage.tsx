import React, { useState, useEffect, useRef } from 'react';
import { Upload, Eye, CheckCircle, X, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';

interface PrivacyPolicy {
  id: number;
  version: string;
  file_name: string;
  is_current: boolean;
  created_at: string;
  created_by: string;
}

const PrivacyPolicyManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [policies, setPolicies] = useState<PrivacyPolicy[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewPolicyId, setPreviewPolicyId] = useState<number | undefined>(undefined);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // 초기 로딩 상태 해제 (약간의 지연을 두어 useAuth가 완료되도록)
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isLoggedIn && !initialLoading) {
      loadPolicies();
    }
  }, [isLoggedIn, initialLoading]);

  const loadPolicies = async () => {
    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/privacy-policy/list', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // data.data가 배열인지 확인
        const policiesData = Array.isArray(data.data) ? data.data : (data.data?.rows || []);
        setPolicies(policiesData);
      } else {
        const errorData = await response.json();
        setError(errorData.error || '개인정보 처리방침 목록을 불러올 수 없습니다.');
      }
    } catch (err: any) {
      console.error('개인정보 처리방침 목록 로드 오류:', err);
      setError('개인정보 처리방침 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/html' && !file.name.endsWith('.html')) {
      setError('HTML 파일만 업로드 가능합니다.');
      return;
    }

    setUploading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/privacy-policy/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess('개인정보 처리방침이 성공적으로 업로드되었습니다.');
        await loadPolicies();
        
        // 파일 입력 초기화
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || '개인정보 처리방침 업로드에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('개인정보 처리방침 업로드 오류:', err);
      setError('개인정보 처리방침 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleSetCurrent = async (id: number) => {
    if (!confirm('이 버전을 현재 활성 버전으로 설정하시겠습니까?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/privacy-policy/${id}/set-current`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setSuccess('현재 활성 버전이 변경되었습니다.');
        await loadPolicies();
      } else {
        const errorData = await response.json();
        setError(errorData.error || '현재 버전 설정에 실패했습니다.');
      }
    } catch (err: any) {
      console.error('현재 버전 설정 오류:', err);
      setError('현재 버전 설정 중 오류가 발생했습니다.');
    }
  };

  const handlePreview = (id: number) => {
    setPreviewPolicyId(id);
    setShowPreviewModal(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // 초기 로딩 중
  if (initialLoading) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="개인정보 처리방침 관리"
          onTitleClick={() => navigate('/')}
        />
        <main className="app-main">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner" />
            <p>로딩 중...</p>
          </div>
        </main>
        <AppBottom />
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="app">
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          pageTitle="개인정보 처리방침 관리"
          onTitleClick={() => navigate('/')}
        />
        <main className="app-main">
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>로그인이 필요합니다.</p>
          </div>
        </main>
        <AppBottom />
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
        pageTitle="개인정보 처리방침 관리"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div style={{ width: '90%', margin: '0 auto', maxWidth: '1200px' }}>
          <h1 style={{ marginBottom: '2rem' }}>개인정보 처리방침 관리</h1>

          {/* 메시지 표시 */}
          {error && (
            <div className="error-message" style={{ 
              padding: '1rem', 
              marginBottom: '1rem', 
              backgroundColor: '#fee', 
              color: '#c33',
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}
          
          {success && (
            <div className="success-message" style={{ 
              padding: '1rem', 
              marginBottom: '1rem', 
              backgroundColor: '#efe', 
              color: '#3c3',
              borderRadius: '4px'
            }}>
              {success}
            </div>
          )}

          {/* 파일 업로드 섹션 */}
          <div style={{ 
            marginBottom: '2rem', 
            padding: '1.5rem', 
            border: '2px dashed #ddd', 
            borderRadius: '8px',
            backgroundColor: '#f9f9f9'
          }}>
            <h2 style={{ marginBottom: '1rem' }}>새 개인정보 처리방침 업로드</h2>
            <p style={{ marginBottom: '1rem', color: '#666' }}>
              HTML 형식의 개인정보 처리방침 파일을 업로드하세요.
              파일명에 버전 정보가 포함되어 있으면 자동으로 추출됩니다 (예: 개인정보처리방침_20251215.html).
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".html"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
                aria-label="개인정보 처리방침 HTML 파일 선택"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: '#0056b3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '1rem'
                }}
              >
                <Upload size={20} />
                {uploading ? '업로드 중...' : '파일 선택'}
              </button>
            </div>
          </div>

          {/* 목록 섹션 */}
          <div>
            <h2 style={{ marginBottom: '1rem' }}>업로드된 개인정보 처리방침</h2>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '2rem' }}>
                <div className="loading-spinner" />
                <p>로딩 중...</p>
              </div>
            ) : policies.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>업로드된 개인정보 처리방침이 없습니다.</p>
              </div>
            ) : (
              <div style={{ 
                border: '1px solid #ddd', 
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f5f5f5' }}>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>버전</th>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>파일명</th>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>업로드일</th>
                      <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '2px solid #ddd' }}>업로드자</th>
                      <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #ddd' }}>상태</th>
                      <th style={{ padding: '1rem', textAlign: 'center', borderBottom: '2px solid #ddd' }}>작업</th>
                    </tr>
                  </thead>
                  <tbody>
                    {policies.map((policy) => (
                      <tr key={policy.id} style={{ borderBottom: '1px solid #eee', backgroundColor: '#f5f5f5' }}>
                        <td style={{ padding: '1rem' }}>{policy.version}</td>
                        <td style={{ padding: '1rem' }}>{policy.file_name}</td>
                        <td style={{ padding: '1rem' }}>{formatDate(policy.created_at)}</td>
                        <td style={{ padding: '1rem' }}>{policy.created_by}</td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {policy.is_current ? (
                            <span style={{ 
                              padding: '0.25rem 0.75rem', 
                              backgroundColor: '#10b981', 
                              color: 'white',
                              borderRadius: '4px',
                              fontSize: '0.875rem'
                            }}>
                              <CheckCircle size={14} style={{ verticalAlign: 'middle', marginRight: '0.25rem' }} />
                              현재 버전
                            </span>
                          ) : (
                            <span style={{ color: '#666' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                            <button
                              onClick={() => handlePreview(policy.id)}
                              style={{
                                padding: '0.5rem',
                                backgroundColor: '#f0f0f0',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              title="미리보기"
                            >
                              <Eye size={16} />
                            </button>
                            {!policy.is_current && (
                              <button
                                onClick={() => handleSetCurrent(policy.id)}
                                style={{
                                  padding: '0.5rem 1rem',
                                  backgroundColor: '#0056b3',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontSize: '0.875rem'
                                }}
                                title="현재 버전으로 설정"
                              >
                                활성화
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
      <AppBottom />
      <PrivacyPolicyModal
        isOpen={showPreviewModal}
        onClose={() => {
          setShowPreviewModal(false);
          setPreviewPolicyId(undefined);
        }}
        policyId={previewPolicyId}
      />
    </div>
  );
};

export default PrivacyPolicyManagementPage;

