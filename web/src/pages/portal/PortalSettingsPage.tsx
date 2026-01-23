import React, { useMemo, useState } from 'react';
import PortalDashboardLayout from '../../components/portal-dashboard/PortalDashboardLayout';
import WidgetCard from '../../components/portal-dashboard/WidgetCard';
import TagPill from '../../components/portal-dashboard/TagPill';
import {
  DashboardWidgetConfig,
  WidgetSize,
  WidgetType
} from '../../data/portalDashboardConfig';
import { usePortalDashboardConfig } from '../../hooks/usePortalDashboardConfig';
import { roleLabels, usePortalRole } from '../../hooks/usePortalRole';


const sizeLabels: Record<WidgetSize, string> = {
  small: '작게',
  medium: '보통',
  large: '크게'
};

const typeLabels: Record<WidgetType, string> = {
  list: '리스트',
  chart: '차트',
  status: '상태',
  activity: '알림',
  insight: '인사이트',
  timeline: '타임라인'
};

const PortalSettingsPage: React.FC = () => {
  const { widgets, setWidgets, resetWidgets } = usePortalDashboardConfig();
  const { role } = usePortalRole();
  const [query, setQuery] = useState('');
  const filteredWidgets = useMemo(() => {
    return widgets.filter((widget) =>
      widget.title.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, widgets]);

  const toggleWidget = (widget: DashboardWidgetConfig) => {
    const updated = widgets.map((item) =>
      item.id === widget.id ? { ...item, enabled: !item.enabled } : item
    );
    setWidgets(updated);
  };

  const updateSize = (widget: DashboardWidgetConfig, size: WidgetSize) => {
    const updated = widgets.map((item) =>
      item.id === widget.id ? { ...item, size } : item
    );
    setWidgets(updated);
  };

  return (
    <PortalDashboardLayout
      title="화면 구성"
      subtitle="대시보드 위젯을 사용자화해서 저장합니다."
      actions={
        <>
          <button
            className="ear-secondary"
            onClick={resetWidgets}
            disabled={role !== 'system_admin'}
          >
            기본값 복원
          </button>
          <button className="ear-primary" disabled={role !== 'system_admin'}>저장</button>
        </>
      }
    >
      <section className="ear-settings">
        {role !== 'system_admin' && (
          <WidgetCard
            title="접근 제한"
            description={`현재 권한(${roleLabels[role]})은 화면 구성을 변경할 수 없습니다.`}
          >
            <p className="ear-muted">
              시스템 관리자 권한만 위젯 구성과 레이아웃을 편집할 수 있습니다.
            </p>
          </WidgetCard>
        )}
        <WidgetCard title="위젯 탐색" description="표시 여부와 크기를 선택할 수 있습니다.">
          <div className="ear-settings__search">
            <input
              type="text"
              placeholder="위젯 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={role !== 'system_admin'}
            />
            <TagPill label={`${widgets.filter((widget) => widget.enabled).length}개 활성`} tone="info" />
          </div>
          <div className="ear-settings__list">
            {filteredWidgets.map((widget) => (
              <div key={widget.id} className="ear-settings__item">
                <div>
                  <strong>{widget.title}</strong>
                  <p>{widget.description}</p>
                  <div className="ear-settings__meta">
                    <span>{typeLabels[widget.type]}</span>
                    <span>카테고리: {widget.category}</span>
                  </div>
                </div>
                <div className="ear-settings__controls">
                  <button
                    type="button"
                    className={widget.enabled ? 'ear-primary' : 'ear-secondary'}
                    onClick={() => toggleWidget(widget)}
                    disabled={role !== 'system_admin'}
                  >
                    {widget.enabled ? '표시 중' : '숨김'}
                  </button>
                  <div className="ear-settings__sizes">
                    {(Object.keys(sizeLabels) as WidgetSize[]).map((size) => (
                      <button
                        key={size}
                        type="button"
                        className={widget.size === size ? 'ear-pill ear-pill--info' : 'ear-pill'}
                        onClick={() => updateSize(widget, size)}
                        disabled={role !== 'system_admin'}
                      >
                        {sizeLabels[size]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </WidgetCard>
        <WidgetCard title="레이아웃 미리보기" description="활성 위젯이 어떻게 배치되는지 확인합니다.">
          <div className="ear-preview">
            {widgets.filter((widget) => widget.enabled).map((widget) => (
              <div key={widget.id} className={`ear-preview__item ear-preview__item--${widget.size}`}>
                <span>{widget.title}</span>
                <small>{sizeLabels[widget.size]}</small>
              </div>
            ))}
          </div>
        </WidgetCard>
      </section>
    </PortalDashboardLayout>
  );
};

export default PortalSettingsPage;
