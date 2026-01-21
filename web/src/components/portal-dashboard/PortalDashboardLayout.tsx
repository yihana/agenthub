import React, { useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Flag,
  LayoutGrid,
  ListChecks,
  Settings
} from 'lucide-react';
import '../../styles/portal-dashboard.css';
import { usePortalAuth } from '../../hooks/usePortalAuth';

interface PortalDashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const navItems = [
  { to: '/portal-dashboard', label: '대시보드', icon: LayoutGrid },
  { to: '/portal-agents', label: '에이전트 목록', icon: ListChecks },
  { to: '/portal-usage', label: '사용 현황/효과', icon: BarChart3 },
  { to: '/portal-roadmap', label: '로드맵', icon: Flag },
  { to: '/portal-settings', label: '화면 구성', icon: Settings }
];

const PortalDashboardLayout: React.FC<PortalDashboardLayoutProps> = ({
  title,
  subtitle,
  actions,
  children
}) => {
  const { user, isLoggedIn, isLoading, logout } = usePortalAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isLoggedIn) {
      navigate('/portal-login', { state: { from: location.pathname } });
    }
  }, [isLoading, isLoggedIn, location.pathname, navigate]);

  if (isLoading) {
    return null;
  }

  if (!isLoggedIn) {
    return null;
  }

  const displayRole = user?.roles?.includes('admin') ? '관리자' : '사용자';
  return (
    <div className="ear-shell">
      <aside className="ear-sidebar">
        <div className="ear-sidebar__brand">
          <span className="ear-badge">Agent Portal</span>
          <strong>Agent 관리 시스템</strong>
          <p>사용자화 가능한 운영 허브</p>
        </div>
        <nav className="ear-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `ear-nav__item${isActive ? ' ear-nav__item--active' : ''}`
                }
              >
                <Icon size={16} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="ear-sidebar__footer">
          <div>
            <span className="ear-muted">버전</span>
            <strong>Mockup v1.0</strong>
          </div>
          <div className="ear-role">
            <span className="ear-muted">권한</span>
            <strong>{displayRole}</strong>
            <span className="ear-muted">{user?.companyCode ?? 'SKN'}</span>
          </div>
          <button type="button" className="ear-ghost" onClick={logout}>
            로그아웃
          </button>
          <button type="button" className="ear-ghost">공유 링크</button>
        </div>
      </aside>
      <div className="ear-main">
        <header className="ear-header">
          <div>
            <h1>{title}</h1>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="ear-header__actions">{actions}</div>}
        </header>
        <div className="ear-content">{children}</div>
      </div>
    </div>
  );
};

export default PortalDashboardLayout;
