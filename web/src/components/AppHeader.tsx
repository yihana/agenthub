import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMenus, PrimaryMenu } from '../hooks/useMenus';

interface AppHeaderProps {
  user?: {
    id?: number;
    userid: string;
    fullName: string;
    email: string;
    isAdmin: boolean;
  } | null;
  onLogout: () => void;
  onLogin: () => void;
  isLoggedIn: boolean;
  // 페이지별 헤더 정보 (선택사항)
  pageTitle?: string;
  pageDescription?: string;
  onTitleClick?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({ 
  user, 
  onLogout, 
  onLogin, 
  isLoggedIn,
  pageTitle,
  pageDescription,
  onTitleClick
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const navigate = useNavigate();
  const { menus: primaryMenus, loading } = useMenus();

  const handleMenuClick = (path: string) => {
    navigate(path);
  };

  const handleMenuHover = (menuId: string) => {
    setActiveMenu(menuId);
  };

  const handleMenuLeave = () => {
    setActiveMenu(null);
  };
  return (
    <header className="app-header">
      <div className="header-left">
        <h1 onClick={onTitleClick} className="clickable-title">ERP 요청관리 시스템</h1>
        <p>EAR (ERP AI Powered Request System){pageTitle && ` - ${pageTitle}`}</p>
        {pageDescription && (
          <p className="page-description">{pageDescription}</p>
        )}
      </div>
      
      {/* 1차 메뉴 */}
      {isLoggedIn && !loading && (
        <div className="header-menu">
          {primaryMenus.map((menu) => (
            <div 
              key={menu.id}
              className="menu-item"
              onMouseEnter={() => handleMenuHover(menu.id)}
              onMouseLeave={handleMenuLeave}
            >
              <span className="menu-label">
                {menu.label}
                <ChevronDown size={14} />
              </span>
              {activeMenu === menu.id && (
                <div className="submenu">
                  {menu.items
                    .map((item) => (
                      <div 
                        key={item.id}
                        className="submenu-item"
                        onClick={() => handleMenuClick(item.path || '#')}
                      >
                        {item.label}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <div className="header-right">
        {isLoggedIn && user ? (
          <div className="user-info">
            <span className="user-name">{user.fullName || user.userid}</span>
            <span className="user-id">({user.userid})</span>
            <button onClick={onLogout} className="logout-btn">
              로그아웃
            </button>
          </div>
        ) : (
          <button onClick={onLogin} className="login-btn">
            로그인
          </button>
        )}
      </div>
    </header>
  );
};

export default AppHeader;
