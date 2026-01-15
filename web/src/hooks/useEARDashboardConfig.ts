import { useCallback, useMemo, useState } from 'react';
import { DashboardWidgetConfig, defaultWidgets, WIDGET_STORAGE_KEY } from '../data/earDashboardConfig';

const isValidWidget = (value: any): value is DashboardWidgetConfig => {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.type === 'string' &&
    typeof value.size === 'string' &&
    typeof value.enabled === 'boolean'
  );
};

const normalizeWidgets = (widgets: DashboardWidgetConfig[]) => {
  const defaultsById = new Map(defaultWidgets.map((widget) => [widget.id, widget]));

  const normalized = widgets
    .filter(isValidWidget)
    .map((widget) => ({
      ...defaultsById.get(widget.id),
      ...widget
    }))
    .filter((widget): widget is DashboardWidgetConfig => Boolean(widget));

  const missing = defaultWidgets.filter((widget) => !normalized.find((item) => item.id === widget.id));

  return [...normalized, ...missing];
};

const loadWidgets = () => {
  if (typeof window === 'undefined') {
    return defaultWidgets;
  }

  try {
    const stored = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    if (!stored) {
      return defaultWidgets;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return defaultWidgets;
    }
    return normalizeWidgets(parsed);
  } catch {
    return defaultWidgets;
  }
};

export const useEARDashboardConfig = () => {
  const [widgets, setWidgets] = useState<DashboardWidgetConfig[]>(() => loadWidgets());

  const persistWidgets = useCallback((next: DashboardWidgetConfig[]) => {
    setWidgets(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(next));
    }
  }, []);

  const resetWidgets = useCallback(() => {
    persistWidgets(defaultWidgets);
  }, [persistWidgets]);

  const value = useMemo(
    () => ({
      widgets,
      setWidgets: persistWidgets,
      resetWidgets
    }),
    [persistWidgets, resetWidgets, widgets]
  );

  return value;
};
