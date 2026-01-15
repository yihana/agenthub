import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Flag,
  LayoutGrid,
  ListChecks,
  Settings
} from 'lucide-react';
import '../../styles/ear-dashboard.css';

interface EARDashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const navItems = [
  { to: '/ear-dashboard', label: '대시보드', icon: LayoutGrid },
  { to: '/ear-agents', label: '에이전트 목록', icon: ListChecks },
  { to: '/ear-usage', label: '사용 현황/효과', icon: BarChart3 },
  { to: '/ear-roadmap', label: '로드맵', icon: Flag },
  { to: '/ear-settings', label: '화면 구성', icon: Settings }
];

const EARDashboardLayout: React.FC<EARDashboardLayoutProps> = ({
  title,
  subtitle,
  actions,
  children
}) => {
  return (
    <div className="ear-shell">
      <aside className="ear-sidebar">
        <div className="ear-sidebar__brand">
          <span className="ear-badge">EAR Agent</span>
          <strong>관리 대시보드</strong>
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

export default EARDashboardLayout;
