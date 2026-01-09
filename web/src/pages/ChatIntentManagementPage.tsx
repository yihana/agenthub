import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Search,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface IntentPattern {
  id: number;
  pattern_type: string;
  pattern_value: string;
  response_message: string;
  intent_category: string | null;
  is_active: boolean;
  priority: number;
  display_type?: string;
  company_code?: string;
  created_at: string;
  updated_at: string;
  options?: IntentOption[];
}

interface IntentOption {
  id: number;
  option_title: string;
  option_description: string | null;
  action_type: string;
  action_data: any;
  icon_name: string | null;
  display_order: number;
}

const ChatIntentManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [patterns, setPatterns] = useState<IntentPattern[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showPatternModal, setShowPatternModal] = useState(false);
  const [showOptionModal, setShowOptionModal] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<IntentPattern | null>(null);
  const [expandedPatterns, setExpandedPatterns] = useState<Set<number>>(new Set());
  
  // 폼 데이터
  const [patternForm, setPatternForm] = useState({
    pattern_type: 'keyword',
    pattern_value: '',
    response_message: '',
    intent_category: '',
    is_active: true,
    priority: 0,
    display_type: 'inline',
    company_code: 'SKN'
  });
  
  // 고객사 구분코드 목록
  const companyCodes = [
    { value: 'SKN', label: 'SK Networks' },
    { value: 'SKT', label: 'SK Telecom' },
    { value: 'SKI', label: 'SK Innovation' },
    { value: 'SKAX', label: 'SKAX' }
  ];
  
  const [optionForm, setOptionForm] = useState<{
    id?: number;
    option_title: string;
    option_description: string;
    action_type: string;
    action_data: any;
    icon_name: string;
    display_order: number;
  }>({
    option_title: '',
    option_description: '',
    action_type: 'ear_request',
    action_data: { template_id: '', keyword_id: '' },
    icon_name: 'FileText',
    display_order: 0
  });
  
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      loadPatterns();
    }
  }, [isLoggedIn]);

  const loadPatterns = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat-intent/patterns', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('패턴 목록을 불러오는데 실패했습니다.');
      
      const data = await response.json();
      setPatterns(data.patterns || []);
    } catch (err: any) {
      setError(err.message || '패턴 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatternDetail = async (patternId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat-intent/patterns/${patternId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('패턴 상세를 불러오는데 실패했습니다.');
      
      const data = await response.json();
      const updatedPatterns = patterns.map(p => 
        p.id === patternId ? data.pattern : p
      );
      setPatterns(updatedPatterns);
    } catch (err: any) {
      setError(err.message || '패턴 상세를 불러오는데 실패했습니다.');
    }
  };

  const handleToggleExpand = (patternId: number) => {
    const newExpanded = new Set(expandedPatterns);
    if (newExpanded.has(patternId)) {
      newExpanded.delete(patternId);
    } else {
      newExpanded.add(patternId);
      loadPatternDetail(patternId);
    }
    setExpandedPatterns(newExpanded);
  };

  const handleCreatePattern = () => {
    setSelectedPattern(null);
    setPatternForm({
      pattern_type: 'keyword',
      pattern_value: '',
      response_message: '',
      intent_category: '',
      is_active: true,
      priority: 0,
      display_type: 'inline',
      company_code: 'SKN'
    });
    setShowPatternModal(true);
  };

  const handleEditPattern = (pattern: IntentPattern) => {
    setSelectedPattern(pattern);
    setPatternForm({
      pattern_type: pattern.pattern_type,
      pattern_value: pattern.pattern_value,
      response_message: pattern.response_message,
      intent_category: pattern.intent_category || '',
      is_active: pattern.is_active,
      priority: pattern.priority,
      display_type: pattern.display_type || 'inline',
      company_code: pattern.company_code || 'SKN'
    });
    setShowPatternModal(true);
  };

  const handleSavePattern = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = selectedPattern 
        ? `/api/chat-intent/patterns/${selectedPattern.id}`
        : '/api/chat-intent/patterns';
      const method = selectedPattern ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(patternForm)
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
    if (!confirm('이 패턴을 삭제하시겠습니까? 관련된 모든 선택지도 함께 삭제됩니다.')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat-intent/patterns/${patternId}`, {
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

  const handleCreateOption = (pattern: IntentPattern) => {
    setSelectedPattern(pattern);
    setOptionForm({
      option_title: '',
      option_description: '',
      action_type: 'ear_request',
      action_data: { template_id: '', keyword_id: '' },
      icon_name: 'FileText',
      display_order: (pattern.options?.length || 0)
    });
    setShowOptionModal(true);
  };

  const handleEditOption = (pattern: IntentPattern, option: IntentOption) => {
    setSelectedPattern(pattern);
    setOptionForm({
      id: option.id,
      option_title: option.option_title,
      option_description: option.option_description || '',
      action_type: option.action_type,
      action_data: option.action_data || { template_id: '', keyword_id: '' },
      icon_name: option.icon_name || 'FileText',
      display_order: option.display_order
    });
    setShowOptionModal(true);
  };

  const handleSaveOption = async () => {
    if (!selectedPattern) return;
    
    try {
      const token = localStorage.getItem('token');
      const url = optionForm.id 
        ? `/api/chat-intent/options/${optionForm.id}`
        : '/api/chat-intent/options';
      const method = optionForm.id ? 'PUT' : 'POST';
      
      const body: any = {
        intent_pattern_id: selectedPattern.id,
        option_title: optionForm.option_title,
        option_description: optionForm.option_description,
        action_type: optionForm.action_type,
        action_data: optionForm.action_data,
        icon_name: optionForm.icon_name,
        display_order: optionForm.display_order
      };
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      
      if (!response.ok) throw new Error('선택지 저장에 실패했습니다.');
      
      setSuccess('선택지가 저장되었습니다.');
      setShowOptionModal(false);
      loadPatternDetail(selectedPattern.id);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '선택지 저장에 실패했습니다.');
    }
  };

  const handleDeleteOption = async (optionId: number) => {
    if (!confirm('이 선택지를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/chat-intent/options/${optionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('선택지 삭제에 실패했습니다.');
      
      setSuccess('선택지가 삭제되었습니다.');
      if (selectedPattern) {
        loadPatternDetail(selectedPattern.id);
      }
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '선택지 삭제에 실패했습니다.');
    }
  };

  const filteredPatterns = patterns.filter(p => 
    !searchTerm || 
    p.pattern_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.response_message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.intent_category && p.intent_category.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>채팅 의도 패턴 관리</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }} />
              <input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem 0.5rem 2.5rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  width: '250px'
                }}
              />
            </div>
            <button
              onClick={loadPatterns}
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
                fontWeight: 500
              }}
            >
              <Plus size={16} />
              패턴 추가
            </button>
          </div>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {filteredPatterns.map((pattern) => (
              <div
                key={pattern.id}
                style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1rem',
                  background: 'white'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <button
                    onClick={() => handleToggleExpand(pattern.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '0.25rem'
                    }}
                  >
                    {expandedPatterns.has(pattern.id) ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </button>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600 }}>{pattern.intent_category || '미분류'}</span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: '#e0e7ff',
                        color: '#4338ca',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}>
                        {pattern.company_code || 'SKN'}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: pattern.pattern_type === 'keyword' ? '#dbeafe' : '#fef3c7',
                        color: pattern.pattern_type === 'keyword' ? '#1e40af' : '#92400e',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {pattern.pattern_type === 'keyword' ? '키워드' : '정규식'}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: pattern.is_active ? '#d1fae5' : '#fee2e2',
                        color: pattern.is_active ? '#059669' : '#dc2626',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {pattern.is_active ? '활성' : '비활성'}
                      </span>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: (pattern.display_type || 'inline') === 'inline' ? '#dbeafe' : '#fef3c7',
                        color: (pattern.display_type || 'inline') === 'inline' ? '#1e40af' : '#92400e',
                        borderRadius: '4px',
                        fontSize: '0.75rem'
                      }}>
                        {(pattern.display_type || 'inline') === 'inline' ? '채팅창 내' : '팝업'}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        우선순위: {pattern.priority}
                      </span>
                    </div>
                    <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: '#6b7280' }}>
                      패턴: {pattern.pattern_value}
                    </div>
                    <div style={{ marginTop: '0.25rem', fontSize: '0.9rem', color: '#374151' }}>
                      응답: {pattern.response_message}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleEditPattern(pattern)}
                      style={{
                        padding: '0.5rem',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDeletePattern(pattern.id)}
                      style={{
                        padding: '0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        color: '#dc2626'
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {expandedPatterns.has(pattern.id) && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e5e7eb' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>선택지</h3>
                      <button
                        onClick={() => handleCreateOption(pattern)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          fontSize: '0.875rem'
                        }}
                      >
                        <Plus size={14} />
                        선택지 추가
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {(pattern.options || []).map((option) => (
                        <div
                          key={option.id}
                          style={{
                            padding: '0.75rem',
                            background: '#f9fafb',
                            borderRadius: '6px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{option.option_title}</div>
                            {option.option_description && (
                              <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                {option.option_description}
                              </div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                              액션: {option.action_type} | 순서: {option.display_order}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleEditOption(pattern, option)}
                              style={{
                                padding: '0.5rem',
                                background: '#f3f4f6',
                                border: '1px solid #e5e7eb',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteOption(option.id)}
                              style={{
                                padding: '0.5rem',
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                color: '#dc2626'
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!pattern.options || pattern.options.length === 0) && (
                        <div style={{ padding: '1rem', textAlign: 'center', color: '#9ca3af' }}>
                          선택지가 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {filteredPatterns.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                패턴이 없습니다.
              </div>
            )}
          </div>
        )}
      </div>

      {/* 패턴 모달 */}
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
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {selectedPattern ? '패턴 수정' : '패턴 추가'}
              </h2>
              <button
                onClick={() => setShowPatternModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>고객사 구분코드</label>
                <select
                  value={patternForm.company_code}
                  onChange={(e) => setPatternForm({ ...patternForm, company_code: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  {companyCodes.map((code) => (
                    <option key={code.value} value={code.value}>
                      {code.value} - {code.label}
                    </option>
                  ))}
                </select>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  이 패턴이 적용될 고객사를 선택합니다.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>패턴 타입</label>
                <select
                  value={patternForm.pattern_type}
                  onChange={(e) => setPatternForm({ ...patternForm, pattern_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  <option value="keyword">키워드</option>
                  <option value="regex">정규식</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  패턴 값 {patternForm.pattern_type === 'keyword' && '(쉼표로 구분)'}
                </label>
                <textarea
                  value={patternForm.pattern_value}
                  onChange={(e) => setPatternForm({ ...patternForm, pattern_value: e.target.value })}
                  placeholder={patternForm.pattern_type === 'keyword' ? '예: SAP 로그인,로그인 안돼,계정 잠금' : '예: /로그인.*안돼/i'}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    minHeight: '80px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>응답 메시지</label>
                <textarea
                  value={patternForm.response_message}
                  onChange={(e) => setPatternForm({ ...patternForm, response_message: e.target.value })}
                  placeholder="예: 계정이 잠겼을 수 있습니다. 계정 잠금 해제 요청을 진행하시겠습니까?"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    minHeight: '100px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>의도 카테고리</label>
                <input
                  type="text"
                  value={patternForm.intent_category}
                  onChange={(e) => setPatternForm({ ...patternForm, intent_category: e.target.value })}
                  placeholder="예: account_lock"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>요청선택지 표시 방식</label>
                <select
                  value={patternForm.display_type}
                  onChange={(e) => setPatternForm({ ...patternForm, display_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  <option value="inline">채팅창 내 띄우기</option>
                  <option value="modal">팝업으로 띄우기</option>
                </select>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  요청선택지를 채팅창 내에 표시할지, 팝업으로 표시할지 선택합니다. 기본값은 "채팅창 내 띄우기"입니다.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>우선순위</label>
                  <input
                    type="number"
                    value={patternForm.priority}
                    onChange={(e) => setPatternForm({ ...patternForm, priority: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', marginTop: '1.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={patternForm.is_active}
                      onChange={(e) => setPatternForm({ ...patternForm, is_active: e.target.checked })}
                    />
                    <span>활성화</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowPatternModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
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
                    borderRadius: '6px',
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

      {/* 선택지 모달 */}
      {showOptionModal && selectedPattern && (
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
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '600px',
            width: '90%',
            maxHeight: '80vh',
            overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {optionForm.id ? '선택지 수정' : '선택지 추가'}
              </h2>
              <button
                onClick={() => setShowOptionModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.5rem'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>선택지 제목</label>
                <input
                  type="text"
                  value={optionForm.option_title}
                  onChange={(e) => setOptionForm({ ...optionForm, option_title: e.target.value })}
                  placeholder="예: 계정 잠금 해제 요청"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>선택지 설명</label>
                <textarea
                  value={optionForm.option_description}
                  onChange={(e) => setOptionForm({ ...optionForm, option_description: e.target.value })}
                  placeholder="예: SAP 계정 잠금 해제를 위한 EAR 요청을 등록합니다"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    minHeight: '80px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>액션 타입</label>
                <select
                  value={optionForm.action_type}
                  onChange={(e) => setOptionForm({ ...optionForm, action_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px'
                  }}
                >
                  {/* 임시 주석처리
                  <option value="ear_request">EAR 요청</option> 
                  */}
                  <option value="esm_request">ESM 요청등록</option>
                  <option value="navigate">페이지 이동</option>
                </select>
              </div>

              {optionForm.action_type === 'ear_request' && (
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>템플릿 ID</label>
                    <input
                      type="number"
                      value={optionForm.action_data.template_id || ''}
                      onChange={(e) => setOptionForm({
                        ...optionForm,
                        action_data: { ...optionForm.action_data, template_id: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>키워드 ID</label>
                    <input
                      type="number"
                      value={optionForm.action_data.keyword_id || ''}
                      onChange={(e) => setOptionForm({
                        ...optionForm,
                        action_data: { ...optionForm.action_data, keyword_id: e.target.value }
                      })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                </div>
              )}

              {optionForm.action_type === 'navigate' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>경로</label>
                  <input
                    type="text"
                    value={optionForm.action_data.route || ''}
                    onChange={(e) => setOptionForm({
                      ...optionForm,
                      action_data: { route: e.target.value }
                    })}
                    placeholder="예: /account/status"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>아이콘 이름</label>
                  <select
                    value={optionForm.icon_name}
                    onChange={(e) => setOptionForm({ ...optionForm, icon_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  >
                    <option value="Lock">Lock</option>
                    <option value="Shield">Shield</option>
                    <option value="User">User</option>
                    <option value="FileText">FileText</option>
                    <option value="AlertCircle">AlertCircle</option>
                    <option value="Settings">Settings</option>
                    <option value="HelpCircle">HelpCircle</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>표시 순서</label>
                  <input
                    type="number"
                    value={optionForm.display_order}
                    onChange={(e) => setOptionForm({ ...optionForm, display_order: parseInt(e.target.value) || 0 })}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowOptionModal(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSaveOption}
                  style={{
                    padding: '0.5rem 1rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
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

export default ChatIntentManagementPage;

