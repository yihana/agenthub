import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X,
  Shield,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface OutputSecuritySetting {
  id: number;
  setting_type: string;
  setting_key: string;
  setting_name: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

interface OutputSecurityPattern {
  id: number;
  pattern: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const OutputSecurityManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [setting, setSetting] = useState<OutputSecuritySetting | null>(null);
  const [patterns, setPatterns] = useState<OutputSecurityPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<OutputSecurityPattern | null>(null);
  
  // 폼 데이터
  const [patternForm, setPatternForm] = useState({
    pattern: '',
    description: ''
  });

  useEffect(() => {
    if (isLoggedIn) {
      loadSetting();
      loadPatterns();
    }
  }, [isLoggedIn]);

  const loadSetting = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/output-security/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('설정을 불러오는데 실패했습니다.');
      
      const data = await response.json();
      setSetting(data.setting);
    } catch (err: any) {
      setError(err.message || '설정을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatterns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/output-security/patterns', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('패턴 목록을 불러오는데 실패했습니다.');
      
      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (err: any) {
      setError(err.message || '패턴 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleToggleSetting = async (settingId: number, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/output-security/settings/${settingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_enabled: !currentValue,
          setting_name: setting?.setting_name || '출력보안'
        })
      });
      
      if (!response.ok) throw new Error('설정 업데이트에 실패했습니다.');
      
      setSuccess('설정이 업데이트되었습니다.');
      loadSetting();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '설정 업데이트에 실패했습니다.');
    }
  };

  const handleCreatePattern = () => {
    setSelectedPattern(null);
    setPatternForm({
      pattern: '',
      description: ''
    });
    setShowPatternModal(true);
  };

  const handleEditPattern = (pattern: OutputSecurityPattern) => {
    setSelectedPattern(pattern);
    setPatternForm({
      pattern: pattern.pattern,
      description: pattern.description || ''
    });
    setShowPatternModal(true);
  };

  const handleSavePattern = async () => {
    if (!patternForm.pattern) {
      setError('패턴을 입력해주세요.');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = selectedPattern
        ? `/api/output-security/patterns/${selectedPattern.id}`
        : '/api/output-security/patterns';
      const method = selectedPattern ? 'PUT' : 'POST';
      
      const body: any = {
        pattern: patternForm.pattern,
        description: patternForm.description || null
      };
      
      if (selectedPattern) {
        body.is_active = selectedPattern.is_active;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error('패턴 저장에 실패했습니다.');
      
      setSuccess('패턴이 저장되었습니다.');
      setShowPatternModal(false);
      loadPatterns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '패턴 저장에 실패했습니다.');
    }
  };

  const handleDeletePattern = async (patternId: number) => {
    if (!confirm('이 출력보안 패턴을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/output-security/patterns/${patternId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('패턴 삭제에 실패했습니다.');
      
      setSuccess('패턴이 삭제되었습니다.');
      loadPatterns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '패턴 삭제에 실패했습니다.');
    }
  };

  const handleTogglePattern = async (patternId: number, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const pattern = patterns.find(p => p.id === patternId);
      if (!pattern) return;
      
      const response = await fetch(`/api/output-security/patterns/${patternId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          pattern: pattern.pattern,
          description: pattern.description,
          is_active: !currentValue
        })
      });
      
      if (!response.ok) throw new Error('패턴 업데이트에 실패했습니다.');
      
      setSuccess('패턴이 업데이트되었습니다.');
      loadPatterns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '패턴 업데이트에 실패했습니다.');
    }
  };

  if (!isLoggedIn) {
    return (
      <div>
        <AppHeader 
          user={user} 
          onLogout={handleLogout} 
          onLogin={handleLogin} 
          isLoggedIn={isLoggedIn}
          onTitleClick={() => navigate('/')}
        />
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>로그인이 필요합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        onTitleClick={() => navigate('/')}
      />
      
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>출력보안 Layer 관리</h1>
          <button
            onClick={() => { loadSetting(); loadPatterns(); }}
            style={{
              padding: '0.5rem 1rem',
              background: '#f3f4f6',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <RefreshCw size={16} />
            새로고침
          </button>
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            color: '#dc2626',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '1rem',
            background: '#d1fae5',
            color: '#059669',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* 출력보안 설정 영역 */}
            {setting && (
              <div style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '1.5rem',
                background: 'white'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <Shield size={20} color="#3b82f6" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>출력보안 설정</h2>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                  <span style={{ fontWeight: 500 }}>
                    {setting.setting_name} 활성화
                  </span>
                  <button
                    onClick={() => handleToggleSetting(setting.id, setting.is_enabled)}
                    style={{
                      position: 'relative',
                      width: '70px',
                      height: '32px',
                      borderRadius: '16px',
                      border: setting.is_enabled ? 'none' : '1px solid #000',
                      background: setting.is_enabled ? '#000' : '#fff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: setting.is_enabled ? 'flex-start' : 'flex-end',
                      padding: setting.is_enabled ? '0 8px 0 10px' : '0 10px 0 8px',
                      transition: 'all 0.2s ease',
                      outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.8';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    <div style={{
                      position: 'absolute',
                      right: setting.is_enabled ? '4px' : 'auto',
                      left: setting.is_enabled ? 'auto' : '4px',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: setting.is_enabled ? '#fff' : '#000',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      zIndex: 1
                    }} />
                    <span style={{
                      fontSize: '12px',
                      fontWeight: 500,
                      color: setting.is_enabled ? '#fff' : '#000',
                      transition: 'color 0.2s ease',
                      position: 'relative',
                      zIndex: 2,
                      marginLeft: setting.is_enabled ? '0' : 'auto',
                      marginRight: setting.is_enabled ? 'auto' : '0'
                    }}>
                      {setting.is_enabled ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* 출력보안 패턴 영역 */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
              background: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={20} color="#3b82f6" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>출력보안 패턴</h2>
                </div>
                <button
                  onClick={handleCreatePattern}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 500,
                    fontSize: '0.875rem'
                  }}
                >
                  <Plus size={14} />
                  패턴 추가
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {patterns.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    등록된 패턴이 없습니다.
                  </div>
                ) : (
                  patterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '1rem',
                        background: '#f9fafb',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{pattern.pattern}</div>
                        {pattern.description && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            {pattern.description}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleTogglePattern(pattern.id, pattern.is_active)}
                          style={{
                            position: 'relative',
                            width: '70px',
                            height: '32px',
                            borderRadius: '16px',
                            border: pattern.is_active ? 'none' : '1px solid #000',
                            background: pattern.is_active ? '#000' : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: pattern.is_active ? 'flex-start' : 'flex-end',
                            padding: pattern.is_active ? '0 8px 0 10px' : '0 10px 0 8px',
                            transition: 'all 0.2s ease',
                            outline: 'none'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.8';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                          }}
                        >
                          <div style={{
                            position: 'absolute',
                            right: pattern.is_active ? '4px' : 'auto',
                            left: pattern.is_active ? 'auto' : '4px',
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            background: pattern.is_active ? '#fff' : '#000',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            zIndex: 1
                          }} />
                          <span style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: pattern.is_active ? '#fff' : '#000',
                            transition: 'color 0.2s ease',
                            position: 'relative',
                            zIndex: 2,
                            marginLeft: pattern.is_active ? '0' : 'auto',
                            marginRight: pattern.is_active ? 'auto' : '0'
                          }}>
                            {pattern.is_active ? 'ON' : 'OFF'}
                          </span>
                        </button>
                        <button
                          onClick={() => handleEditPattern(pattern)}
                          title="수정"
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#f3f4f6',
                            border: '1px solid #e5e7eb',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => handleDeletePattern(pattern.id)}
                          title="삭제"
                          style={{
                            padding: '0.25rem 0.5rem',
                            background: '#fee2e2',
                            border: '1px solid #fecaca',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 패턴 추가/수정 모달 */}
      {showPatternModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '8px',
            padding: '2rem',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {selectedPattern ? '패턴 수정' : '패턴 추가'}
              </h3>
              <button
                onClick={() => setShowPatternModal(false)}
                title="닫기"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  패턴 <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={patternForm.pattern}
                  onChange={(e) => setPatternForm({ ...patternForm, pattern: e.target.value })}
                  placeholder="정규식 패턴 또는 일반 문자열 입력"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  설명
                </label>
                <textarea
                  value={patternForm.description}
                  onChange={(e) => setPatternForm({ ...patternForm, description: e.target.value })}
                  placeholder="패턴에 대한 설명 (선택사항)"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    fontSize: '0.875rem',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowPatternModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSavePattern}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OutputSecurityManagementPage;

