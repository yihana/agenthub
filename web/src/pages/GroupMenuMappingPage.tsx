import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Save, 
  X,
  RefreshCw,
  CheckSquare,
  Square
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useMenus, MenuItem } from '../hooks/useMenus';
import AppHeader from '../components/AppHeader';
import { apiCall } from '../utils/api';

interface GroupMenuMapping {
  id: number;
  group_name: string;
  menu_id: number;
  is_active: boolean;
  menu_code?: string;
  menu_label?: string;
  menu_path?: string;
}

const ALLOWED_GROUPS = ['EAR-ADMIN', 'EAR-USER', 'EAR-5TIER'];

const GroupMenuMappingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, handleLogin, handleLogout, isLoggedIn } = useAuth();
  const { flatMenus, loading: menusLoading } = useMenus();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('EAR-ADMIN');
  const [mappings, setMappings] = useState<GroupMenuMapping[]>([]);
  const [selectedMenuIds, setSelectedMenuIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isLoggedIn) {
      loadMappings();
    }
  }, [isLoggedIn, selectedGroup]);

  useEffect(() => {
    // 선택된 그룹의 매핑된 메뉴 ID를 selectedMenuIds에 설정
    const mappedMenuIds = new Set(
      mappings
        .filter(m => m.group_name === selectedGroup && m.is_active)
        .map(m => m.menu_id)
    );
    setSelectedMenuIds(mappedMenuIds);
  }, [mappings, selectedGroup]);

  const loadMappings = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/group-menu-mappings?group_name=${selectedGroup}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('매핑 정보를 불러오는데 실패했습니다.');
      
      const data = await response.json();
      if (data.success) {
        setMappings(data.mappings || []);
      }
    } catch (err: any) {
      setError(err.message || '매핑 정보를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMenuToggle = (menuId: number) => {
    const newSelected = new Set(selectedMenuIds);
    if (newSelected.has(menuId)) {
      newSelected.delete(menuId);
    } else {
      newSelected.add(menuId);
    }
    setSelectedMenuIds(newSelected);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const menuIdsArray = Array.from(selectedMenuIds);
      
      const response = await fetch('/api/group-menu-mappings/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          group_name: selectedGroup,
          menu_ids: menuIdsArray
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '저장에 실패했습니다.');
      }
      
      setSuccess('저장되었습니다.');
      loadMappings();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || '저장에 실패했습니다.');
      setTimeout(() => setError(''), 5000);
    }
  };

  const renderMenuTree = (parentId: number | null = null, level: number = 0): JSX.Element[] => {
    const filteredMenus = flatMenus
      .filter(menu => menu.parent_id === parentId)
      .sort((a, b) => a.display_order - b.display_order);

    return filteredMenus.map(menu => {
      const hasChildren = flatMenus.some(m => m.parent_id === menu.id);
      const isSelected = selectedMenuIds.has(menu.id);

      return (
        <React.Fragment key={menu.id}>
          <div 
            className="menu-mapping-item"
            style={{ paddingLeft: `${level * 20 + 10}px` }}
          >
            <label className="menu-mapping-checkbox">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => handleMenuToggle(menu.id)}
              />
              <span className="menu-mapping-label">
                {menu.label}
              </span>
            </label>
            <span className="menu-mapping-code">{menu.menu_code}</span>
            {menu.path && <span className="menu-mapping-path">{menu.path}</span>}
          </div>
          {hasChildren && (
            <div className="menu-mapping-children">
              {renderMenuTree(menu.id, level + 1)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  if (!isLoggedIn) {
    return <div>로그인이 필요합니다.</div>;
  }

  // 허용된 그룹 체크 (EAR-ADMIN, EAR-USER, EAR-5TIER)
  const userGroups = user?.samlGroups || [];
  const hasAllowedGroup = ALLOWED_GROUPS.some(group => userGroups.includes(group));
  
  console.log('🔍 GroupMenuMappingPage 권한 체크:', {
    user: user,
    samlGroups: user?.samlGroups,
    hasAllowedGroup: hasAllowedGroup,
    isAdmin: user?.isAdmin
  });
  
  if (!hasAllowedGroup && !user?.isAdmin) {
    return <div>허용된 그룹 권한이 필요합니다. (EAR-ADMIN, EAR-USER, EAR-5TIER)</div>;
  }

  return (
    <div className="group-menu-mapping-page">
      <AppHeader
        user={user}
        onLogout={handleLogout}
        onLogin={handleLogin}
        isLoggedIn={isLoggedIn}
        pageTitle="사용자그룹별 메뉴매핑"
        pageDescription="사용자 그룹별로 접근 가능한 메뉴를 설정합니다"
        onTitleClick={() => navigate('/')}
      />
      
      <div className="page-content">
        <div className="page-header">
          <h2>사용자그룹별 메뉴매핑</h2>
          <div className="header-actions">
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="group-select"
            >
              {ALLOWED_GROUPS.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <button onClick={loadMappings} className="btn-secondary">
              <RefreshCw size={18} />
              새로고침
            </button>
            <button onClick={handleSave} className="btn-primary">
              <Save size={18} />
              저장
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

        <div className="mapping-info">
          <p>
            <strong>{selectedGroup}</strong> 그룹에 속한 사용자가 접근할 수 있는 메뉴를 선택하세요.
          </p>
        </div>

        <div className="menu-mapping-container">
          {menusLoading || isLoading ? (
            <div className="loading">로딩 중...</div>
          ) : flatMenus.length === 0 ? (
            <div className="empty">메뉴가 없습니다.</div>
          ) : (
            <div className="menu-mapping-list">
              {renderMenuTree()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupMenuMappingPage;

