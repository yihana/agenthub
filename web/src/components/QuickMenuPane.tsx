import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMenus, MenuItem } from '../hooks/useMenus';
import { getIcon } from '../utils/iconMapper';
import { Settings, X, ChevronLeft } from 'lucide-react';

interface QuickMenuPaneProps {
  isOpen: boolean;
  onToggle: () => void;
  onMenuClick?: () => void;
}

const QuickMenuPane: React.FC<QuickMenuPaneProps> = ({ isOpen, onToggle, onMenuClick }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flatMenus, loading } = useMenus();

  // path가 있는 메뉴만 필터링하고 정렬 (그룹별 매핑은 서버에서 이미 필터링됨)
  const menuItems = flatMenus
    .filter(item => item.path)
    .sort((a, b) => a.display_order - b.display_order)
    .slice(0, 8); // 최대 8개만 표시

  const handleMenuClick = (path: string) => {
    navigate(path);
    onMenuClick?.();
  };

  // 닫힌 상태일 때 보이는 세로 바 형태의 토글 버튼
  if (!isOpen) {
    return (
      <div className="quick-menu-toggle-bar">
        <button 
          className="quick-menu-toggle-btn"
          onClick={onToggle}
          title="퀵메뉴 열기"
        >
          <ChevronLeft size={24} />
        </button>
      </div>
    );
  }

  // 열린 상태일 때 보이는 전체 메뉴
  return (
    <div className={`quick-menu-pane ${isOpen ? 'open' : 'closed'}`}>
      <div className="quick-menu-header">
        <h3 className="quick-menu-title">
          <Settings size={18} style={{ marginRight: '0.5rem' }} />
          퀵메뉴
        </h3>
        <button 
          className="quick-menu-close-btn"
          onClick={onToggle}
          title="퀵메뉴 닫기"
        >
          <X size={18} />
        </button>
      </div>

      <div className="quick-menu-list">
        {loading ? (
          <div className="quick-menu-loading">메뉴를 불러오는 중...</div>
        ) : (
          menuItems.map((item: MenuItem) => {
            const IconComponent = getIcon(item.icon_name);
            return (
              <div 
                key={item.id}
                className="quick-menu-item"
                onClick={() => handleMenuClick(item.path!)}
              >
                <div className="quick-menu-item-icon">
                  <IconComponent size={16} />
                </div>
                <div className="quick-menu-item-content">
                  <div className="quick-menu-item-title">{item.label}</div>
                  <div className="quick-menu-item-description">{item.description || item.label}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default QuickMenuPane;
