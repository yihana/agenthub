import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Flag,
  LayoutGrid,
  ListChecks,
  Settings
} from 'lucide-react';
import '../../styles/portal-dashboard.css';
import { companyOptions, roleLabels, usePortalRole } from '../../hooks/usePortalRole';

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
  { to: '/portal-settings', label: '화면 구성', icon: Settings, systemOnly: true }
];

const PortalDashboardLayout: React.FC<PortalDashboardLayoutProps> = ({
  title,
  subtitle,
  actions,
  children
}) => {
  const { role, company, updateRole, updateCompany } = usePortalRole();
  const filteredNavItems = navItems.filter((item) => !item.systemOnly || role === 'system_admin');
  return (
    <div className="ear-shell">
      <aside className="ear-sidebar">
        <div className="ear-sidebar__brand">
          <span className="ear-badge">Agent Portal</span>
          <strong>Agent 관리 시스템</strong>
          <p>사용자화 가능한 운영 허브</p>
        </div>
        <nav className="ear-nav">
          {filteredNavItems.map((item) => {
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
            <strong>{roleLabels[role]}</strong>
          </div>
          <label className="ear-select">
            <span className="ear-muted">회사</span>
            <select
              value={company}
              onChange={(event) => updateCompany(event.target.value as typeof company)}
            >
              {companyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="ear-select">
            <span className="ear-muted">권한 선택</span>
            <select
              value={role}
              onChange={(event) => updateRole(event.target.value as typeof role)}
            >
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
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
