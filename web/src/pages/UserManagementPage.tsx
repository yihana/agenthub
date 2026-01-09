import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Unlock,
  Key,
  User,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import './UserManagementPage.css';
import { useAuth } from '../hooks/useAuth';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';

interface User {
  id: number;
  userid: string;
  email: string;
  full_name: string;
  department: string;
  position: string;
  phone: string;
  employee_id: string;
  is_active: boolean;
  is_admin: boolean;
  failed_login_attempts: number;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface UserFormData {
  userid: string;
  password: string;
  email: string;
  fullName: string;
  department: string;
  position: string;
  phone: string;
  employeeId: string;
  isActive: boolean;
  isAdmin: boolean;
}

const UserManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // 폼 데이터
  const [formData, setFormData] = useState<UserFormData>({
    userid: '',
    password: '',
    email: '',
    fullName: '',
    department: '',
    position: '',
    phone: '',
    employeeId: '',
    isActive: true,
    isAdmin: false
  });
  
  const [newPassword, setNewPassword] = useState('');
  
  // 필터 및 페이지네이션
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    search: ''
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });

  // 컴포넌트 마운트 시 데이터 로드
  useEffect(() => {
    loadUsers();
  }, [filters]);

  const loadUsers = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
        return;
      }

      const queryParams = new URLSearchParams({
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`/api/users?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.users);
        setPagination(data.pagination);
      } else if (response.status === 401) {
        // /login 페이지는 현재 비활성화됨 - 에러 페이지로 이동
        navigate('/error');
      } else if (response.status === 403) {
        setError('관리자 권한이 필요합니다.');
      } else {
        const errorData = await response.json();
        setError(errorData.error || '사용자 목록을 불러오는데 실패했습니다.');
      }
    } catch (error) {
      console.error('사용자 목록 로드 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('사용자가 생성되었습니다.');
        setShowCreateModal(false);
        resetForm();
        loadUsers();
      } else {
        setError(data.error || '사용자 생성에 실패했습니다.');
      }
    } catch (error) {
      console.error('사용자 생성 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${selectedUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: formData.email,
          fullName: formData.fullName,
          department: formData.department,
          position: formData.position,
          phone: formData.phone,
          employeeId: formData.employeeId,
          isActive: formData.isActive,
          isAdmin: formData.isAdmin
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('사용자 정보가 수정되었습니다.');
        setShowEditModal(false);
        setSelectedUser(null);
        resetForm();
        loadUsers();
      } else {
        setError(data.error || '사용자 수정에 실패했습니다.');
      }
    } catch (error) {
      console.error('사용자 수정 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${selectedUser.id}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newPassword })
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('비밀번호가 초기화되었습니다.');
        setShowPasswordModal(false);
        setSelectedUser(null);
        setNewPassword('');
      } else {
        setError(data.error || '비밀번호 초기화에 실패했습니다.');
      }
    } catch (error) {
      console.error('비밀번호 초기화 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!confirm(`정말로 사용자 "${user.userid}"을(를) 삭제하시겠습니까?`)) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('사용자가 삭제되었습니다.');
        loadUsers();
      } else {
        setError(data.error || '사용자 삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('사용자 삭제 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlockUser = async (user: User) => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${user.id}/unlock`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('계정 잠금이 해제되었습니다.');
        loadUsers();
      } else {
        setError(data.error || '계정 잠금 해제에 실패했습니다.');
      }
    } catch (error) {
      console.error('계정 잠금 해제 오류:', error);
      setError('서버 연결에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      userid: '',
      password: '',
      email: '',
      fullName: '',
      department: '',
      position: '',
      phone: '',
      employeeId: '',
      isActive: true,
      isAdmin: false
    });
  };

  const openEditModal = (user: User) => {
    setSelectedUser(user);
    setFormData({
      userid: user.userid,
      password: '',
      email: user.email || '',
      fullName: user.full_name || '',
      department: user.department || '',
      position: user.position || '',
      phone: user.phone || '',
      employeeId: user.employee_id || '',
      isActive: user.is_active,
      isAdmin: user.is_admin
    });
    setShowEditModal(true);
  };

  const openPasswordModal = (user: User) => {
    setSelectedUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const formatDateTime = (dateTime: string | null) => {
    if (!dateTime) return '-';
    return new Date(dateTime).toLocaleString('ko-KR');
  };

  return (
    <div className="app">
      <AppHeader 
        user={user} 
        onLogout={handleLogout} 
        onLogin={handleLogin} 
        isLoggedIn={isLoggedIn}
        pageTitle="사용자 관리"
        onTitleClick={() => navigate('/')}
      />
      <main className="app-main">
        <div className="user-management-container" style={{ width: '90%', margin: '0 auto' }}>
      <div className="search-section">
        <div className="search-group">
          <div className="input-group">
            <Search size={16} className="input-icon" />
            <input
              type="text"
              placeholder="사용자ID, 이름, 이메일로 검색"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, page: 1 }))}
            />
          </div>
          <div className="search-actions">
            <button 
              onClick={loadUsers} 
              className="btn btn-secondary btn-icon"
              disabled={isLoading}
              title="새로고침"
            >
              <RefreshCw size={20} className={isLoading ? 'spinning' : ''} />
            </button>
            <button 
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="btn btn-primary"
            >
              <Plus size={16} />
              사용자 추가
            </button>
          </div>
        </div>
      </div>

      {/* 메시지 */}
      {error && (
        <div className="error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="success-message">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* 사용자 목록 테이블 */}
      <div className="table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>사용자명</th>
              <th>이름</th>
              <th>이메일</th>
              <th>부서/직급</th>
              <th>상태</th>
              <th>마지막 로그인</th>
              <th>생성일</th>
              <th>작업</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={8} className="loading-cell">
                  <RefreshCw size={20} className="spinning" />
                  로딩 중...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="empty-cell">
                  사용자가 없습니다.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-info">
                      <User size={16} />
                      <div>
                        <div className="username">{user.userid}</div>
                        {user.is_admin && <span className="admin-badge">관리자</span>}
                      </div>
                    </div>
                  </td>
                  <td>{user.full_name || '-'}</td>
                  <td>
                    {user.email ? (
                      <div className="email-info">
                        <Mail size={14} />
                        <span>{user.email}</span>
                      </div>
                    ) : '-'}
                  </td>
                  <td>
                    {user.department && user.position 
                      ? `${user.department} / ${user.position}`
                      : user.department || user.position || '-'
                    }
                  </td>
                  <td>
                    <div className="status-info">
                      <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                        {user.is_active ? '활성' : '비활성'}
                      </span>
                      {user.failed_login_attempts > 0 && (
                        <span className="lock-badge">
                          {user.failed_login_attempts}회 실패
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{formatDateTime(user.last_login)}</td>
                  <td>{formatDateTime(user.created_at)}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        onClick={() => openEditModal(user)}
                        className="btn btn-sm btn-secondary"
                        title="수정"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => openPasswordModal(user)}
                        className="btn btn-sm btn-secondary"
                        title="비밀번호 초기화"
                      >
                        <Key size={14} />
                      </button>
                      {user.failed_login_attempts >= 5 && (
                        <button
                          onClick={() => handleUnlockUser(user)}
                          className="btn btn-sm btn-secondary"
                          title="계정 잠금 해제"
                        >
                          <Unlock size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteUser(user)}
                        className="btn btn-sm btn-danger"
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1 || isLoading}
            className="btn btn-secondary"
          >
            이전
          </button>
          
          <div className="pagination-info">
            {pagination.page} / {pagination.totalPages} 페이지
            ({pagination.total}개 항목)
          </div>
          
          <button
            onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages || isLoading}
            className="btn btn-secondary"
          >
            다음
          </button>
        </div>
      )}

      {/* 사용자 생성 모달 */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>사용자 추가</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-sm btn-secondary"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="create-userid">사용자ID *</label>
                  <input
                    id="create-userid"
                    type="text"
                    value={formData.userid}
                    onChange={(e) => setFormData(prev => ({ ...prev, userid: e.target.value }))}
                    placeholder="사용자ID를 입력하세요"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-password">비밀번호 *</label>
                  <input
                    id="create-password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    placeholder="비밀번호를 입력하세요"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-fullname">이름</label>
                  <input
                    id="create-fullname"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-email">이메일</label>
                  <input
                    id="create-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="이메일을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-department">부서</label>
                  <input
                    id="create-department"
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="부서를 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-position">직급</label>
                  <input
                    id="create-position"
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="직급을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-phone">전화번호</label>
                  <input
                    id="create-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="전화번호를 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="create-employeeid">사원번호</label>
                  <input
                    id="create-employeeid"
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                    placeholder="사원번호를 입력하세요"
                  />
                </div>
              </div>
              <div className="form-checkboxes">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  활성 사용자
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isAdmin}
                    onChange={(e) => setFormData(prev => ({ ...prev, isAdmin: e.target.checked }))}
                  />
                  관리자 권한
                </label>
              </div>
            </form>
            <div className="modal-footer">
              <button
                onClick={() => setShowCreateModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleCreateUser}
                disabled={isLoading || !formData.userid || !formData.password}
                className="btn btn-primary"
              >
                {isLoading ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 사용자 수정 모달 */}
      {showEditModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>사용자 수정</h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="btn btn-sm btn-secondary"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleEditUser} className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="edit-userid">사용자ID</label>
                  <input
                    id="edit-userid"
                    type="text"
                    value={formData.userid}
                    disabled
                    className="disabled"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-fullname">이름</label>
                  <input
                    id="edit-fullname"
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    placeholder="이름을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-email">이메일</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="이메일을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-department">부서</label>
                  <input
                    id="edit-department"
                    type="text"
                    value={formData.department}
                    onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    placeholder="부서를 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-position">직급</label>
                  <input
                    id="edit-position"
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="직급을 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-phone">전화번호</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="전화번호를 입력하세요"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-employeeid">사원번호</label>
                  <input
                    id="edit-employeeid"
                    type="text"
                    value={formData.employeeId}
                    onChange={(e) => setFormData(prev => ({ ...prev, employeeId: e.target.value }))}
                    placeholder="사원번호를 입력하세요"
                  />
                </div>
              </div>
              <div className="form-checkboxes">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  활성 사용자
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.isAdmin}
                    onChange={(e) => setFormData(prev => ({ ...prev, isAdmin: e.target.checked }))}
                  />
                  관리자 권한
                </label>
              </div>
            </form>
            <div className="modal-footer">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleEditUser}
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading ? '수정 중...' : '수정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비밀번호 초기화 모달 */}
      {showPasswordModal && selectedUser && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>비밀번호 초기화</h2>
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btn btn-sm btn-secondary"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>사용자 <strong>{selectedUser.userid}</strong>의 비밀번호를 초기화합니다.</p>
              <div className="form-group">
                <label htmlFor="new-password">새 비밀번호 *</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="새 비밀번호를 입력하세요"
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="btn btn-secondary"
              >
                취소
              </button>
              <button
                onClick={handleResetPassword}
                disabled={isLoading || !newPassword}
                className="btn btn-primary"
              >
                {isLoading ? '초기화 중...' : '초기화'}
              </button>
            </div>
          </div>
        </div>
        )}
        </div>
      </main>
      <AppBottom />
    </div>
  );
};

export default UserManagementPage;
