export type WidgetSize = 'small' | 'medium' | 'large';
export type WidgetType = 'list' | 'chart' | 'status' | 'activity' | 'insight' | 'timeline';

export interface DashboardWidgetConfig {
  id: string;
  title: string;
  description: string;
  type: WidgetType;
  size: WidgetSize;
  enabled: boolean;
  category: 'overview' | 'agents' | 'operations' | 'impact';
}

export const WIDGET_STORAGE_KEY = 'portal-dashboard-widgets';

export const defaultWidgets: DashboardWidgetConfig[] = [
  {
    id: 'agent-health',
    title: '에이전트 헬스 체크',
    description: '핵심 에이전트의 상태 요약과 주의 항목을 확인합니다.',
    type: 'status',
    size: 'medium',
    enabled: true,
    category: 'agents'
  },
  {
    id: 'daily-activity',
    title: '일간 처리 현황',
    description: '전일 대비 요청 처리 흐름을 확인합니다.',
    type: 'chart',
    size: 'large',
    enabled: true,
    category: 'operations'
  },
  {
    id: 'recent-agents',
    title: '최근 업데이트된 에이전트',
    description: '최근 변경 또는 배포된 에이전트 목록입니다.',
    type: 'list',
    size: 'medium',
    enabled: true,
    category: 'agents'
  },
  {
    id: 'impact-summary',
    title: '효과 요약',
    description: '업무 시간 절감 및 품질 개선 지표를 요약합니다.',
    type: 'insight',
    size: 'small',
    enabled: true,
    category: 'impact'
  },
  {
    id: 'ops-timeline',
    title: '운영 타임라인',
    description: '예정된 점검과 일정 알림을 확인합니다.',
    type: 'timeline',
    size: 'medium',
    enabled: true,
    category: 'operations'
  },
  {
    id: 'alert-stream',
    title: '알림 스트림',
    description: '에이전트 관련 알림을 우선순위별로 표시합니다.',
    type: 'activity',
    size: 'small',
    enabled: true,
    category: 'overview'
  }
];


export type { DashboardWidgetConfig as default };
