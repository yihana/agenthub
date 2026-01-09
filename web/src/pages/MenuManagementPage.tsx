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
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMenus, MenuItem } from '../hooks/useMenus';
import AppHeader from '../components/AppHeader';
import AppBottom from '../components/AppBottom';
import { apiCall } from '../utils/api';

interface MenuFormData {
  parent_id: number | null;
  menu_code: string;
  label: string;
  path: string;
  icon_name: string;
  description: string;
  display_order: number;
  is_active: boolean;
}

const MenuManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { menus: hierarchicalMenus, flatMenus, loading: menusLoading } = useMenus();
  const [allMenus, setAllMenus] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // 모달 상태
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<number>>(new Set());
  
  // 폼 데이터
  const [formData, setFormData] = useState<MenuFormData>({
    parent_id: null,
    menu_code: '',
    label: '',
    path: '',
    icon_name: 'FileText',
    description: '',
    display_order: 0,
    is_active: true,
  });
  
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      loadAllMenus();
    }
  }, [isLoggedIn, flatMenus]);

  // 모든 메뉴를 기본적으로 열린 상태로 설정
  useEffect(() => {
    if (allMenus.length > 0) {
      const allMenuIds = new Set(allMenus.map(menu => menu.id));
      setExpandedMenus(allMenuIds);
    }
  }, [allMenus]);

  const loadAllMenus = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/menus?includeInactive=true', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('메뉴를 불러오는데 실패했습니다.');
      
      const data = await response.json();
      if (data.success) {
        setAllMenus(data.flatMenus || []);
      }
    } catch (err: any) {
      setError(err.message || '메뉴를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleExpand = (menuId: number) => {
    const newExpanded = new Set(expandedMenus);
    if (newExpanded.has(menuId)) {
      newExpanded.delete(menuId);
    } else {
      newExpanded.add(menuId);
    }
    setExpandedMenus(newExpanded);
  };

  const handleCreateMenu = () => {
    setSelectedMenu(null);
    setFormData({
      parent_id: null,
      menu_code: '',
      label: '',
      path: '',
      icon_name: 'FileText',
      description: '',
      display_order: 0,
      is_active: true,
    });
    setShowMenuModal(true);
  };

  const handleEditMenu = (menu: MenuItem) => {
    setSelectedMenu(menu);
    setFormData({
      parent_id: menu.parent_id || null,
      menu_code: menu.menu_code,
      label: menu.label,
      path: menu.path || '',
      icon_name: menu.icon_name || 'FileText',
      description: menu.description || '',
      display_order: menu.display_order,
      is_active: menu.is_active,
    });
    setShowMenuModal(true);
  };

  const handleSaveMenu = async () => {
    try {
      if (!formData.menu_code || !formData.label) {
        setError('메뉴 코드와 라벨은 필수입니다.');
        return;
      }

      const token = localStorage.getItem('token');
      const url = selectedMenu 
        ? `/api/menus/${selectedMenu.id}`
        : '/api/menus';
      const method = selectedMenu ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '메뉴 저장에 실패했습니다.');
      }
      
      setSuccess('메뉴가 저장되었습니다.');
      setShowMenuModal(false);
      loadAllMenus();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '메뉴 저장에 실패했습니다.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleDeleteMenu = async (menuId: number) => {
    if (!confirm('정말 이 메뉴를 삭제하시겠습니까? 하위 메뉴도 함께 삭제됩니다.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/menus/${menuId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('메뉴 삭제에 실패했습니다.');
      
      setSuccess('메뉴가 삭제되었습니다.');
      loadAllMenus();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '메뉴 삭제에 실패했습니다.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const handleMoveOrder = async (menu: MenuItem, direction: 'up' | 'down') => {
    try {
      const siblings = allMenus.filter(m => m.parent_id === menu.parent_id);
      const currentIndex = siblings.findIndex(m => m.id === menu.id);
      
      if (direction === 'up' && currentIndex === 0) return;
      if (direction === 'down' && currentIndex === siblings.length - 1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      const targetMenu = siblings[targetIndex];
      
      // 순서 교환
      const newOrder = menu.display_order;
      const targetOrder = targetMenu.display_order;
      
      const token = localStorage.getItem('token');
      
      // 두 메뉴의 순서를 교환
      await Promise.all([
        fetch(`/api/menus/${menu.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ...menu, display_order: targetOrder })
        }),
        fetch(`/api/menus/${targetMenu.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ ...targetMenu, display_order: newOrder })
        })
      ]);
      
      loadAllMenus();
    } catch (err: any) {
      setError(err.message || '순서 변경에 실패했습니다.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const renderMenuTree = (parentId: number | null = null, level: number = 0): JSX.Element[] => {
    const filteredMenus = allMenus
      .filter(menu => menu.parent_id === parentId)
      .filter(menu => 
        !searchTerm || 
        menu.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        menu.menu_code.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.display_order - b.display_order);

    return filteredMenus.map(menu => {
      const hasChildren = allMenus.some(m => m.parent_id === menu.id);
      const isExpanded = expandedMenus.has(menu.id);

      return (
        <React.Fragment key={menu.id}>
          <tr className={!menu.is_active ? 'inactive-menu' : ''}>
            <td style={{ paddingLeft: `${level * 20 + 10}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => handleToggleExpand(menu.id)}
                  className="expand-btn"
                >
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
              ) : (
                <span style={{ width: '16px', display: 'inline-block' }}></span>
              )}
              <span style={{ marginLeft: '8px' }}>{menu.label}</span>
            </td>
            <td>{menu.menu_code}</td>
            <td>{menu.path || '-'}</td>
            <td>{menu.icon_name || '-'}</td>
            <td>{menu.display_order}</td>
            <td>
              <span className={`badge ${menu.is_active ? 'active' : 'inactive'}`}>
                {menu.is_active ? '활성' : '비활성'}
              </span>
            </td>
            <td>
              <div className="action-buttons">
                <button
                  onClick={() => handleMoveOrder(menu, 'up')}
                  className="icon-btn"
                  title="위로 이동"
                  aria-label="위로 이동"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => handleMoveOrder(menu, 'down')}
                  className="icon-btn"
                  title="아래로 이동"
                  aria-label="아래로 이동"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  onClick={() => handleEditMenu(menu)}
                  className="icon-btn edit"
                  title="수정"
                  aria-label="수정"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => handleDeleteMenu(menu.id)}
                  className="icon-btn delete"
                  title="삭제"
                  aria-label="삭제"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </td>
          </tr>
          {hasChildren && isExpanded && (
            <>
              {renderMenuTree(menu.id, level + 1)}
            </>
          )}
        </React.Fragment>
      );
    });
  };

  const parentMenuOptions = allMenus
    .filter(menu => !menu.parent_id)
    .sort((a, b) => a.display_order - b.display_order);

  // 디버깅: user 정보 로그 출력
  useEffect(() => {
    console.log('🔍 MenuManagementPage - user 정보:', {
      user,
      isLoggedIn,
      isAdmin: user?.isAdmin,
      userid: user?.userid
    });
  }, [user, isLoggedIn]);

  if (!isLoggedIn) {
    return <div>로그인이 필요합니다.</div>;
  }

  if (!user?.isAdmin) {
    // 토큰 정보 확인
    const token = localStorage.getItem('token');
    const tokenPreview = token ? `${token.substring(0, 50)}...` : '토큰 없음';
    
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#dc2626' }}>
          관리자 권한이 필요합니다.
        </div>
        <div style={{ marginTop: '1rem', padding: '1.5rem', background: '#f3f4f6', borderRadius: '8px', fontSize: '0.9rem' }}>
          <strong style={{ display: 'block', marginBottom: '0.5rem' }}>디버깅 정보:</strong>
          <div style={{ marginTop: '0.5rem' }}>
            <strong>사용자 정보:</strong>
            <pre style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'white', borderRadius: '4px', overflow: 'auto' }}>
              {JSON.stringify({ 
                user, 
                isLoggedIn, 
                isAdmin: user?.isAdmin,
                userid: user?.userid,
                email: user?.email
              }, null, 2)}
            </pre>
          </div>
          <div style={{ marginTop: '1rem' }}>
            <strong>토큰 정보:</strong>
            <pre style={{ marginTop: '0.25rem', padding: '0.5rem', background: 'white', borderRadius: '4px', overflow: 'auto', wordBreak: 'break-all' }}>
              {tokenPreview}
            </pre>
          </div>
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#fef3c7', borderRadius: '4px', fontSize: '0.85rem' }}>
            <strong>확인 사항:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>브라우저 개발자 도구 콘솔에서 "🔍 /api/auth/verify 응답" 로그 확인</li>
              <li>서버 로그에서 "✅ 관리자 권한 확인됨" 메시지 확인</li>
              <li>XSUAA 토큰의 samlGroups에 "EAR-ADMIN"이 포함되어 있는지 확인</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-management-page">
      <AppHeader
        user={user}
        onLogout={handleLogout}
        onLogin={handleLogin}
        isLoggedIn={isLoggedIn}
        pageTitle="메뉴 관리"
        pageDescription="시스템 메뉴를 관리합니다"
        onTitleClick={() => navigate('/')}
      />
      
      <div className="page-content">
        <div className="page-header">
          <h2>메뉴 관리</h2>
          <div className="header-actions">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="메뉴 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button onClick={loadAllMenus} className="btn-secondary">
              <RefreshCw size={18} />
              새로고침
            </button>
            <button onClick={handleCreateMenu} className="btn-primary">
              <Plus size={18} />
              메뉴 추가
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            {success}
          </div>
        )}

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>메뉴명</th>
                <th>메뉴 코드</th>
                <th>경로</th>
                <th>아이콘</th>
                <th>순서</th>
                <th>상태</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    로딩 중...
                  </td>
                </tr>
              ) : allMenus.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                    메뉴가 없습니다.
                  </td>
                </tr>
              ) : (
                renderMenuTree()
              )}
            </tbody>
          </table>
        </div>

        {/* 메뉴 편집 모달 */}
        {showMenuModal && (
          <div className="modal-overlay" onClick={() => setShowMenuModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{selectedMenu ? '메뉴 수정' : '메뉴 추가'}</h3>
                <button onClick={() => setShowMenuModal(false)} className="close-btn">
                  <X size={20} />
                </button>
              </div>
              
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="parent-menu-select">상위 메뉴</label>
                  <select
                    id="parent-menu-select"
                    value={formData.parent_id || ''}
                    onChange={(e) => setFormData({ ...formData, parent_id: e.target.value ? parseInt(e.target.value) : null })}
                    aria-label="상위 메뉴 선택"
                  >
                    <option value="">없음 (1차 메뉴)</option>
                    {parentMenuOptions.map(menu => (
                      <option key={menu.id} value={menu.id}>{menu.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>메뉴 코드 *</label>
                  <input
                    type="text"
                    value={formData.menu_code}
                    onChange={(e) => setFormData({ ...formData, menu_code: e.target.value })}
                    placeholder="예: ear-registration"
                  />
                </div>

                <div className="form-group">
                  <label>메뉴명 *</label>
                  <input
                    type="text"
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="예: EAR 요청등록"
                  />
                </div>

                <div className="form-group">
                  <label>경로</label>
                  <input
                    type="text"
                    value={formData.path}
                    onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                    placeholder="예: /ear-request-registration"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="icon-select">아이콘</label>
                  <select
                    id="icon-select"
                    value={formData.icon_name}
                    onChange={(e) => setFormData({ ...formData, icon_name: e.target.value })}
                    aria-label="아이콘 선택"
                  >
                    <option value="FileText">FileText</option>
                    <option value="List">List</option>
                    <option value="Database">Database</option>
                    <option value="GitBranch">GitBranch</option>
                    <option value="MessageSquare">MessageSquare</option>
                    <option value="Settings">Settings</option>
                    <option value="Users">Users</option>
                    <option value="History">History</option>
                    <option value="Zap">Zap</option>
                    <option value="AlertTriangle">AlertTriangle</option>
                    <option value="ClipboardList">ClipboardList</option>
                    <option value="Menu">Menu</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>설명</label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="메뉴 설명"
                  />
                </div>

                <div className="form-group">
                  <label>표시 순서</label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      aria-label="활성화"
                    />
                    활성화
                  </label>
                </div>

              </div>
              
              <div className="modal-footer">
                <button onClick={() => setShowMenuModal(false)} className="btn-secondary">
                  취소
                </button>
                <button onClick={handleSaveMenu} className="btn-primary">
                  <Save size={18} />
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <AppBottom />
    </div>
  );
};

export default MenuManagementPage;

