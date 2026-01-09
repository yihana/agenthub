import React from 'react';
import { useMenus, MenuItem } from '../hooks/useMenus';
import { getIcon } from '../utils/iconMapper';

interface MenuPaneProps {
  onMenuClick?: (menuItem: string) => void;
  user?: {
    id: number;
    userid: string;
    fullName: string;
    email: string;
    isAdmin: boolean;
  } | null;
}

const MenuPane: React.FC<MenuPaneProps> = ({ onMenuClick, user }) => {
  const { flatMenus, loading } = useMenus();

  // 메뉴 정렬 (그룹별 매핑은 서버에서 이미 필터링됨)
  const filteredMenuItems = flatMenus
    .sort((a, b) => a.display_order - b.display_order);

  const handleMenuClick = (menuId: string, path?: string | null) => {
    if (path) {
      // path가 있으면 직접 이동
      window.location.href = path;
    } else {
      onMenuClick?.(menuId);
    }
  };

  return (
    <div className="menu-pane">
      <div className="menu-header">
        <h3 className="menu-title">메뉴</h3>
      </div>

      <div className="menu-list">
        {loading ? (
          <div className="menu-loading">메뉴를 불러오는 중...</div>
        ) : (
          filteredMenuItems.map((item: MenuItem) => {
            const IconComponent = getIcon(item.icon_name);
            return (
              <div
                key={item.id}
                className="menu-item"
                onClick={() => handleMenuClick(item.menu_code, item.path)}
                title={item.description || item.label}
              >
                <div className="menu-item-icon">
                  <IconComponent size={18} />
                </div>
                <div className="menu-item-content">
                  <div className="menu-item-title">{item.label}</div>
                  <div className="menu-item-description">{item.description || item.label}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MenuPane;
