import {
  Briefcase, History, Settings,
  type LucideIcon,
} from 'lucide-react';

export type AppMode = 'manda' | 'credit' | 'treasury' | 'admin';

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
  iconColor?: string;
}

export interface NavigationGroup {
  category: string;
  items: NavigationItem[];
}

export const groupedNavigationByMode: Record<AppMode, NavigationGroup[]> = {
  manda: [
    {
      category: 'Operations',
      items: [
        { label: 'Deals', icon: Briefcase, path: 'deals', iconColor: '#5B3DF5' },
        { label: 'Audit Log', icon: History, path: 'audit', iconColor: '#94A3B8' },
        { label: 'Settings', icon: Settings, path: 'settings' },
      ],
    },
  ],
  credit: [
    {
      category: 'Main',
      items: [
        { label: 'Deals', icon: Briefcase, path: 'deals' },
        { label: 'Audit Log', icon: History, path: 'audit' },
        { label: 'Settings', icon: Settings, path: 'settings' },
      ],
    },
  ],
  treasury: [
    {
      category: 'Main',
      items: [
        { label: 'Deals', icon: Briefcase, path: 'deals' },
        { label: 'Audit Log', icon: History, path: 'audit' },
        { label: 'Settings', icon: Settings, path: 'settings' },
      ],
    },
  ],
  admin: [
    {
      category: 'Main',
      items: [
        { label: 'Deals', icon: Briefcase, path: 'deals' },
        { label: 'Audit Log', icon: History, path: 'audit' },
        { label: 'Settings', icon: Settings, path: 'settings' },
      ],
    },
  ],
};

// Flat list for backward compat
export const navigationByMode: Record<AppMode, NavigationItem[]> = Object.fromEntries(
  Object.entries(groupedNavigationByMode).map(([mode, groups]) => [
    mode,
    groups.flatMap(g => g.items),
  ])
) as Record<AppMode, NavigationItem[]>;

export const modeConfig: Record<AppMode, { label: string }> = {
  manda: { label: 'M&A' },
  credit: { label: 'Credit' },
  treasury: { label: 'Treasury' },
  admin: { label: 'Admin' },
};

export const modeAccentColors: Record<AppMode, string> = {
  manda: '217 91% 60%',
  credit: '271 91% 65%',
  treasury: '160 84% 39%',
  admin: '215 16% 47%',
};
