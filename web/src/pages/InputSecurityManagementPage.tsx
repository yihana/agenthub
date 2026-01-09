import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  X,
  Shield,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface SecuritySetting {
  id: number;
  setting_type: string;
  setting_key: string;
  setting_name: string;
  is_enabled: boolean;
  pattern: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfanityPattern {
  id: number;
  pattern: string;
  description: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const InputSecurityManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [settings, setSettings] = useState<SecuritySetting[]>([]);
  const [profanityPatterns, setProfanityPatterns] = useState<ProfanityPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showPersonalInfoModal, setShowPersonalInfoModal] = useState(false);
  const [showProfanityModal, setShowProfanityModal] = useState(false);
  const [selectedPersonalInfoSetting, setSelectedPersonalInfoSetting] = useState<SecuritySetting | null>(null);
  const [selectedProfanityPattern, setSelectedProfanityPattern] = useState<ProfanityPattern | null>(null);
  
  // 폼 데이터
  const [personalInfoForm, setPersonalInfoForm] = useState({
    setting_key: '',
    setting_name: '',
    pattern: ''
  });
  
  const [profanityForm, setProfanityForm] = useState({
    pattern: '',
    description: ''
  });

  useEffect(() => {
    if (isLoggedIn) {
      loadSettings();
      loadProfanityPatterns();
    }
  }, [isLoggedIn]);

  const loadSettings = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/input-security/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('설정 목록을 불러오는데 실패했습니다.');
      
      const data = await response.json();
      setSettings(data.settings || []);
    } catch (err: any) {
      setError(err.message || '설정 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadProfanityPatterns = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/input-security/profanity-patterns', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('욕설 패턴 목록을 불러오는데 실패했습니다.');
      
      const data = await response.json();
      setProfanityPatterns(data.patterns || []);
    } catch (err: any) {
      setError(err.message || '욕설 패턴 목록을 불러오는데 실패했습니다.');
    }
  };

  const handleToggleSetting = async (settingId: number, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const setting = settings.find(s => s.id === settingId);
      if (!setting) return;
      
      const response = await fetch(`/api/input-security/settings/${settingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          is_enabled: !currentValue,
          setting_name: setting.setting_name,
          pattern: setting.pattern
        })
      });
      
      if (!response.ok) throw new Error('설정 업데이트에 실패했습니다.');
      
      setSuccess('설정이 업데이트되었습니다.');
      loadSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '설정 업데이트에 실패했습니다.');
    }
  };

  const handleCreatePersonalInfo = () => {
    setSelectedPersonalInfoSetting(null);
    setPersonalInfoForm({
      setting_key: '',
      setting_name: '',
      pattern: ''
    });
    setShowPersonalInfoModal(true);
  };

  const handleEditPersonalInfo = (setting: SecuritySetting) => {
    setSelectedPersonalInfoSetting(setting);
    setPersonalInfoForm({
      setting_key: setting.setting_key,
      setting_name: setting.setting_name,
      pattern: setting.pattern || ''
    });
    setShowPersonalInfoModal(true);
  };

  const handleSavePersonalInfo = async () => {
    if (!personalInfoForm.setting_name || !personalInfoForm.pattern) {
      setError('모든 필드를 입력해주세요.');
      return;
    }
    
    // 수정 모드인 경우 setting_key는 변경 불가
    if (!selectedPersonalInfoSetting && !personalInfoForm.setting_key) {
      setError('설정 키를 입력해주세요.');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      let url: string;
      let method: string;
      let body: any;
      
      if (selectedPersonalInfoSetting) {
        // 수정 모드
        url = `/api/input-security/settings/personal-info/${selectedPersonalInfoSetting.id}`;
        method = 'PUT';
        body = {
          setting_name: personalInfoForm.setting_name,
          pattern: personalInfoForm.pattern
        };
      } else {
        // 추가 모드
        url = '/api/input-security/settings/personal-info';
        method = 'POST';
        body = personalInfoForm;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || (selectedPersonalInfoSetting ? '개인정보 설정 수정에 실패했습니다.' : '개인정보 설정 추가에 실패했습니다.'));
      }
      
      setSuccess(selectedPersonalInfoSetting ? '개인정보 설정이 수정되었습니다.' : '개인정보 설정이 추가되었습니다.');
      setShowPersonalInfoModal(false);
      loadSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || (selectedPersonalInfoSetting ? '개인정보 설정 수정에 실패했습니다.' : '개인정보 설정 추가에 실패했습니다.'));
    }
  };

  const handleDeletePersonalInfo = async (settingId: number, settingKey: string) => {
    if (settingKey === 'ssn') {
      alert('주민등록번호 설정은 삭제할 수 없습니다.');
      return;
    }
    
    if (!confirm('이 개인정보 차단 설정을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/input-security/settings/personal-info/${settingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '개인정보 설정 삭제에 실패했습니다.');
      }
      
      setSuccess('개인정보 설정이 삭제되었습니다.');
      loadSettings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '개인정보 설정 삭제에 실패했습니다.');
    }
  };

  const handleCreateProfanityPattern = () => {
    setSelectedProfanityPattern(null);
    setProfanityForm({
      pattern: '',
      description: ''
    });
    setShowProfanityModal(true);
  };

  const handleEditProfanityPattern = (pattern: ProfanityPattern) => {
    setSelectedProfanityPattern(pattern);
    setProfanityForm({
      pattern: pattern.pattern,
      description: pattern.description || ''
    });
    setShowProfanityModal(true);
  };

  const handleSaveProfanityPattern = async () => {
    if (!profanityForm.pattern) {
      setError('욕설 패턴을 입력해주세요.');
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const url = selectedProfanityPattern
        ? `/api/input-security/profanity-patterns/${selectedProfanityPattern.id}`
        : '/api/input-security/profanity-patterns';
      const method = selectedProfanityPattern ? 'PUT' : 'POST';
      
      const body: any = {
        pattern: profanityForm.pattern,
        description: profanityForm.description || null
      };
      
      if (selectedProfanityPattern) {
        body.is_active = selectedProfanityPattern.is_active;
      }
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error('욕설 패턴 저장에 실패했습니다.');
      
      setSuccess('욕설 패턴이 저장되었습니다.');
      setShowProfanityModal(false);
      loadProfanityPatterns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '욕설 패턴 저장에 실패했습니다.');
    }
  };

  const handleDeleteProfanityPattern = async (patternId: number) => {
    if (!confirm('이 욕설 패턴을 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/input-security/profanity-patterns/${patternId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('욕설 패턴 삭제에 실패했습니다.');
      
      setSuccess('욕설 패턴이 삭제되었습니다.');
      loadProfanityPatterns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '욕설 패턴 삭제에 실패했습니다.');
    }
  };

  const handleToggleProfanityPattern = async (patternId: number, currentValue: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const pattern = profanityPatterns.find(p => p.id === patternId);
      if (!pattern) return;
      
      const response = await fetch(`/api/input-security/profanity-patterns/${patternId}`, {
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
      
      if (!response.ok) throw new Error('욕설 패턴 업데이트에 실패했습니다.');
      
      setSuccess('욕설 패턴이 업데이트되었습니다.');
      loadProfanityPatterns();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '욕설 패턴 업데이트에 실패했습니다.');
    }
  };

  const personalInfoSettings = settings.filter(s => s.setting_type === 'personal_info');
  const profanitySetting = settings.find(s => s.setting_type === 'profanity' && s.setting_key === 'profanity');

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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>입력보안 Layer 관리</h1>
          <button
            onClick={() => { loadSettings(); loadProfanityPatterns(); }}
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
            {/* 개인정보 차단 영역 */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
              background: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={20} color="#3b82f6" />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>개인정보 차단 영역</h2>
                </div>
                <button
                  onClick={handleCreatePersonalInfo}
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
                  개인정보 항목 추가
                </button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {personalInfoSettings.map((setting) => (
                  <div
                    key={setting.id}
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
                    <div>
                      <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{setting.setting_name}</div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        패턴: {setting.pattern || 'N/A'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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
                      {setting.setting_key !== 'ssn' && (
                        <>
                          <button
                            onClick={() => handleEditPersonalInfo(setting)}
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
                            onClick={() => handleDeletePersonalInfo(setting.id, setting.setting_key)}
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
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 욕설 차단 영역 */}
            <div style={{
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '1.5rem',
              background: 'white'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <AlertTriangle size={20} color="#ef4444" />
                <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>욕설 차단</h2>
              </div>
              
              {profanitySetting && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: '#f9fafb', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                    <span style={{ fontWeight: 500 }}>
                      {profanitySetting.setting_name} 차단
                    </span>
                    <button
                      onClick={() => handleToggleSetting(profanitySetting.id, profanitySetting.is_enabled)}
                      style={{
                        position: 'relative',
                        width: '70px',
                        height: '32px',
                        borderRadius: '16px',
                        border: profanitySetting.is_enabled ? 'none' : '1px solid #000',
                        background: profanitySetting.is_enabled ? '#000' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: profanitySetting.is_enabled ? 'flex-start' : 'flex-end',
                        padding: profanitySetting.is_enabled ? '0 8px 0 10px' : '0 10px 0 8px',
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
                        right: profanitySetting.is_enabled ? '4px' : 'auto',
                        left: profanitySetting.is_enabled ? 'auto' : '4px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: profanitySetting.is_enabled ? '#fff' : '#000',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        zIndex: 1
                      }} />
                      <span style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: profanitySetting.is_enabled ? '#fff' : '#000',
                        transition: 'color 0.2s ease',
                        position: 'relative',
                        zIndex: 2,
                        marginLeft: profanitySetting.is_enabled ? '0' : 'auto',
                        marginRight: profanitySetting.is_enabled ? 'auto' : '0'
                      }}>
                        {profanitySetting.is_enabled ? 'ON' : 'OFF'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
              
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>욕설 패턴 목록</h3>
                  <button
                    onClick={handleCreateProfanityPattern}
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
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {profanityPatterns.map((pattern) => (
                    <div
                      key={pattern.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.75rem 1rem',
                        background: pattern.is_active ? '#f9fafb' : '#fee2e2',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{pattern.pattern}</div>
                        {pattern.description && (
                          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{pattern.description}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleToggleProfanityPattern(pattern.id, pattern.is_active)}
                          style={{
                            position: 'relative',
                            width: '60px',
                            height: '28px',
                            borderRadius: '14px',
                            border: pattern.is_active ? 'none' : '1px solid #000',
                            background: pattern.is_active ? '#000' : '#fff',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: pattern.is_active ? 'flex-start' : 'flex-end',
                            padding: pattern.is_active ? '0 6px 0 8px' : '0 8px 0 6px',
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
                            right: pattern.is_active ? '3px' : 'auto',
                            left: pattern.is_active ? 'auto' : '3px',
                            width: '20px',
                            height: '20px',
                            borderRadius: '50%',
                            background: pattern.is_active ? '#fff' : '#000',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                            zIndex: 1
                          }} />
                          <span style={{
                            fontSize: '11px',
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
                          onClick={() => handleEditProfanityPattern(pattern)}
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
                          onClick={() => handleDeleteProfanityPattern(pattern.id)}
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
                  ))}
                  {profanityPatterns.length === 0 && (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>
                      등록된 욕설 패턴이 없습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 개인정보 항목 추가 모달 */}
      {showPersonalInfoModal && (
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
            maxWidth: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {selectedPersonalInfoSetting ? '개인정보 항목 수정' : '개인정보 항목 추가'}
              </h3>
              <button
                onClick={() => setShowPersonalInfoModal(false)}
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>설정 키 (영문)</label>
                <input
                  type="text"
                  value={personalInfoForm.setting_key}
                  onChange={(e) => setPersonalInfoForm({ ...personalInfoForm, setting_key: e.target.value })}
                  placeholder="예: phone, email"
                  disabled={!!selectedPersonalInfoSetting}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px',
                    background: selectedPersonalInfoSetting ? '#f3f4f6' : 'white',
                    color: selectedPersonalInfoSetting ? '#6b7280' : '#000',
                    cursor: selectedPersonalInfoSetting ? 'not-allowed' : 'text'
                  }}
                />
                {selectedPersonalInfoSetting && (
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    설정 키는 수정할 수 없습니다.
                  </div>
                )}
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>설정 이름</label>
                <input
                  type="text"
                  value={personalInfoForm.setting_name}
                  onChange={(e) => setPersonalInfoForm({ ...personalInfoForm, setting_name: e.target.value })}
                  placeholder="예: 전화번호, 이메일"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>정규식 패턴</label>
                <input
                  type="text"
                  value={personalInfoForm.pattern}
                  onChange={(e) => setPersonalInfoForm({ ...personalInfoForm, pattern: e.target.value })}
                  placeholder="예: \\d{3}-\\d{4}-\\d{4}"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px'
                  }}
                />
                <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  정규식 패턴을 입력하세요. 예: 전화번호는 \\d{3}-\\d{4}-\\d{4}
                </div>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowPersonalInfoModal(false)}
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
                onClick={handleSavePersonalInfo}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 욕설 패턴 추가/수정 모달 */}
      {showProfanityModal && (
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
            maxWidth: '500px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {selectedProfanityPattern ? '욕설 패턴 수정' : '욕설 패턴 추가'}
              </h3>
              <button
                onClick={() => setShowProfanityModal(false)}
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>욕설 패턴</label>
                <input
                  type="text"
                  value={profanityForm.pattern}
                  onChange={(e) => setProfanityForm({ ...profanityForm, pattern: e.target.value })}
                  placeholder="차단할 욕설 단어나 문구를 입력하세요"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px'
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>설명 (선택)</label>
                <input
                  type="text"
                  value={profanityForm.description}
                  onChange={(e) => setProfanityForm({ ...profanityForm, description: e.target.value })}
                  placeholder="패턴에 대한 설명을 입력하세요"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowProfanityModal(false)}
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
                onClick={handleSaveProfanityPattern}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InputSecurityManagementPage;

