import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save,
  X,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';

interface Prompt {
  id: number;
  prompt_type: string;
  company_code: string;
  reference_content: string | null;
  prompt: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface PromptFormData {
  prompt_type: string;
  reference_content: string;
  prompt: string;
  is_active: boolean;
}

const PromptManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showModal, setShowModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  
  // 폼 데이터
  const [formData, setFormData] = useState<PromptFormData>({
    prompt_type: 'ESM_REQUEST',
    reference_content: '',
    prompt: '',
    is_active: true
  });
  
  // 프롬프트 분류 목록
  const promptTypes = [
    { value: 'ESM_REQUEST', label: 'ESM 요청등록 프롬프트' },
    { value: 'HR_PROMPT', label: '인사 프롬프트' },
    { value: 'FI_PROMPT', label: '재무 프롬프트' },
    { value: 'SD_PROMPT', label: '영업/판매 프롬프트' },
    { value: 'TD_MM_PROMPT', label: '구매/자재 프롬프트' },
    { value: 'CO_PROMPT', label: '관리 회계 프롬프트' },
    { value: 'BC_PROMPT', label: '시스템 관리 프롬프트' }
  ];
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('');

  useEffect(() => {
    if (isLoggedIn) {
      loadPrompts();
    }
  }, [isLoggedIn, filterType]);

  const loadPrompts = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterType) {
        params.append('prompt_type', filterType);
      }
      params.append('include_inactive', 'true');
      
      const response = await fetch(`/api/prompt-management?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('프롬프트 목록을 불러오는데 실패했습니다.');
      
      const data = await response.json();
      setPrompts(data.prompts || []);
    } catch (err: any) {
      setError(err.message || '프롬프트 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingPrompt(null);
    setFormData({
      prompt_type: 'ESM_REQUEST',
      reference_content: '',
      prompt: '',
      is_active: true
    });
    setShowModal(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      prompt_type: prompt.prompt_type,
      reference_content: prompt.reference_content || '',
      prompt: prompt.prompt,
      is_active: prompt.is_active
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.prompt_type || !formData.prompt.trim()) {
      setError('프롬프트 분류와 프롬프트 내용은 필수입니다.');
      return;
    }
    
    try {
      setError('');
      const token = localStorage.getItem('token');
      const url = editingPrompt 
        ? `/api/prompt-management/${editingPrompt.id}`
        : '/api/prompt-management';
      const method = editingPrompt ? 'PUT' : 'POST';
      
      const body = {
        prompt_type: formData.prompt_type,
        reference_content: formData.reference_content || null,
        prompt: formData.prompt,
        is_active: formData.is_active
      };
      
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
        throw new Error(errorData.error || '프롬프트 저장에 실패했습니다.');
      }
      
      setSuccess(editingPrompt ? '프롬프트가 수정되었습니다.' : '프롬프트가 생성되었습니다.');
      setShowModal(false);
      loadPrompts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '프롬프트 저장에 실패했습니다.');
    }
  };

  const handleDelete = async (promptId: number) => {
    if (!confirm('이 프롬프트를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/prompt-management/${promptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('프롬프트 삭제에 실패했습니다.');
      
      setSuccess('프롬프트가 삭제되었습니다.');
      loadPrompts();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '프롬프트 삭제에 실패했습니다.');
    }
  };

  const filteredPrompts = prompts.filter(p => {
    const matchesSearch = !searchTerm || 
      p.prompt_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.reference_content && p.reference_content.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

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
      
      <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>프롬프트 관리</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={{
                padding: '0.5rem 1rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.9rem'
              }}
            >
              <option value="">전체 분류</option>
              {promptTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
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
              onClick={loadPrompts}
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
              onClick={handleCreate}
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
              새 프롬프트
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            padding: '1rem',
            background: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#991b1b',
            marginBottom: '1rem'
          }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{
            padding: '1rem',
            background: '#d1fae5',
            border: '1px solid #a7f3d0',
            borderRadius: '8px',
            color: '#065f46',
            marginBottom: '1rem'
          }}>
            {success}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '3rem' }}>
            <p>로딩 중...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
            <p>프롬프트가 없습니다.</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gap: '1rem'
          }}>
            {filteredPrompts.map(prompt => (
              <div
                key={prompt.id}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '1.5rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.25rem 0.75rem',
                        background: '#eff6ff',
                        color: '#1e40af',
                        borderRadius: '6px',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}>
                        {promptTypes.find(t => t.value === prompt.prompt_type)?.label || prompt.prompt_type}
                      </span>
                      {prompt.is_active ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#059669', fontSize: '0.875rem' }}>
                          <CheckCircle size={14} />
                          사용중
                        </span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#dc2626', fontSize: '0.875rem' }}>
                          <XCircle size={14} />
                          비활성
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                      회사: {prompt.company_code} | 생성자: {prompt.created_by || 'N/A'} | 
                      생성일: {new Date(prompt.created_at).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleEdit(prompt)}
                      style={{
                        padding: '0.5rem',
                        background: '#f3f4f6',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="수정"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      style={{
                        padding: '0.5rem',
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="삭제"
                    >
                      <Trash2 size={16} color="#dc2626" />
                    </button>
                  </div>
                </div>
                
                {prompt.reference_content && (
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>
                      참고 내용:
                    </div>
                    <div style={{
                      padding: '0.75rem',
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      color: '#6b7280',
                      maxHeight: '150px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {prompt.reference_content}
                    </div>
                  </div>
                )}
                
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#374151' }}>
                    프롬프트:
                  </div>
                  <div style={{
                    padding: '0.75rem',
                    background: '#f9fafb',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    color: '#374151',
                    maxHeight: '200px',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {prompt.prompt}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 모달 */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {editingPrompt ? '프롬프트 수정' : '새 프롬프트'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  프롬프트 분류 *
                </label>
                <select
                  value={formData.prompt_type}
                  onChange={(e) => setFormData({ ...formData, prompt_type: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem'
                  }}
                >
                  {promptTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  참고 내용 (선택)
                </label>
                <textarea
                  value={formData.reference_content}
                  onChange={(e) => setFormData({ ...formData, reference_content: e.target.value })}
                  placeholder="ESM_CODE_INFO 같은 참고 내용을 입력하세요 (Markdown 형식 가능)"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    minHeight: '150px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 500 }}>
                  프롬프트 *
                </label>
                <textarea
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  placeholder="프롬프트 내용을 입력하세요. {title}과 {content} 같은 변수를 사용할 수 있습니다."
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    minHeight: '200px',
                    fontFamily: 'monospace',
                    resize: 'vertical'
                  }}
                  required
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <label htmlFor="is_active" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                  사용 여부
                </label>
              </div>

              {error && (
                <div style={{
                  padding: '0.75rem',
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#991b1b',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <Save size={16} />
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

export default PromptManagementPage;

