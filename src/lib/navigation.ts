import {
  Briefcase, History, Settings, FileBarChart, Plug, Users, Network, Clock, Brain, Home,
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
        { label: 'Home', icon: Home, path: 'home', iconColor: '#64748B' },
        { label: 'Deals', icon: Briefcase, path: 'deals', iconColor: '#5B3DF5' },
        { label: 'Timeline', icon: Clock, path: 'timeline', iconColor: '#F59E0B' },
        { label: 'Reports', icon: FileBarChart, path: 'reports', iconColor: '#22C55E' },
        { label: 'Audit Log', icon: History, path: 'audit', iconColor: '#94A3B8' },
      ],
    },
    {
      category: 'Advanced Tools',
      items: [
        { label: 'Intelligence Map', icon: Network, path: 'intelligence-map', iconColor: '#8B5CF6' },
        { label: 'AI Deal Scan', icon: Brain, path: 'ai', iconColor: '#5E3BEE' },
      ],
    },
    {
      category: 'Settings',
      items: [
        { label: 'Team & Roles', icon: Users, path: 'settings', iconColor: '#94A3B8' },
        { label: 'Integrations', icon: Plug, path: 'integrations', iconColor: '#F59E0B' },
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

// Deal Workspace internal tabs
export type DealWorkspaceTab =
  | 'overview'
  | 'stakeholders'
  | 'kyc-kyb'
  | 'data'
  | 'documents'
  | 'reconciliation'
  | 'approvals'
  | 'payments-escrow'
  | 'audit-log'
  | 'reports'
  | 'activity'
  | 'intelligence-map';

export interface DealWorkspaceTabDef {
  id: DealWorkspaceTab;
  label: string;
}

export const DEAL_WORKSPACE_TABS: DealWorkspaceTabDef[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'kyc-kyb', label: 'KYC / KYB' },
  { id: 'data', label: 'Data' },
  { id: 'documents', label: 'Documents & Ingestion' },
  { id: 'reconciliation', label: 'Reconciliation' },
  { id: 'approvals', label: 'Approvals' },
  { id: 'payments-escrow', label: 'Payments / Escrow' },
  { id: 'audit-log', label: 'Audit Log' },
  { id: 'reports', label: 'Reports' },
  { id: 'activity', label: 'Activity' },
  { id: 'intelligence-map', label: 'Intelligence Map' },
];
