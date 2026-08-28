import type { ReactNode } from 'react';

export type TabKey = 'map' | 'reports' | 'activity' | 'moderate' | 'account' | 'settings';

interface NavItem {
  key: TabKey;
  label: string;
  icon: (color: string) => ReactNode;
}

const stroke = (color: string) => ({ stroke: color, strokeWidth: 1.8, fill: 'none' as const });

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'map',
    label: 'Map',
    icon: (c) => (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke(c)}>
        <path d="M9 4l6 2 5-2v14l-5 2-6-2-5 2V6l5-2zm0 0v14m6-12v14" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'reports',
    label: 'My Reports',
    icon: (c) => (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke(c)}>
        <rect x="4" y="3" width="16" height="18" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'activity',
    label: 'Activity',
    icon: (c) => (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke(c)}>
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'moderate',
    label: 'Moderate',
    icon: (c) => (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke(c)}>
        <path d="M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z" strokeLinejoin="round" />
        <path d="M9.5 12l1.8 1.8L15 10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'account',
    label: 'Account',
    icon: (c) => (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke(c)}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: 'Settings',
    icon: (c) => (
      <svg width="21" height="21" viewBox="0 0 24 24" {...stroke(c)}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.2a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.2a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.2a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1H21a2 2 0 110 4h-.2a1.7 1.7 0 00-1.5 1z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];
