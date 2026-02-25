import {
  Briefcase, History, Settings, Shield, Users, FileText, Upload,
  Table2, GitBranch, Lock, Building, CheckCircle2, CreditCard,
  MessageSquare, Bell, ClipboardList,
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
    {
      category: 'Deal Elements',
      items: [
        { label: 'KYC / KYB', icon: Shield, path: 'kyc', iconColor: '#F59E0B' },
        { label: 'Stakeholders', icon: Users, path: 'stakeholders', iconColor: '#8B5CF6' },
        { label: 'Documents', icon: FileText, path: 'documents', iconColor: '#3B82F6' },
        { label: 'Ingestion', icon: Upload, path: 'ingestion', iconColor: '#6366F1' },
        { label: 'Cap Table', icon: Table2, path: 'captable', iconColor: '#10B981' },
        { label: 'Waterfall', icon: GitBranch, path: 'waterfall', iconColor: '#14B8A6' },
        { label: 'Escrow', icon: Lock, path: 'escrow', iconColor: '#F97316' },
        { label: 'Closing Center', icon: Building, path: 'closing', iconColor: '#EC4899' },
      ],
    },
    {
      category: 'Approvals',
      items: [
        { label: 'Approvals', icon: CheckCircle2, path: 'approvals', iconColor: '#22C55E' },
        { label: 'Payments', icon: CreditCard, path: 'payments', iconColor: '#A855F7' },
      ],
    },
    {
      category: 'Communication',
      items: [
        { label: 'Messages', icon: MessageSquare, path: 'messages', iconColor: '#3B82F6' },
        { label: 'Notifications', icon: Bell, path: 'notifications', iconColor: '#EF4444' },
      ],
    },
    {
      category: 'Reports',
      items: [
        { label: 'Audit', icon: History, path: 'audit-reports', iconColor: '#94A3B8' },
        { label: 'Reports', icon: ClipboardList, path: 'reports', iconColor: '#6366F1' },
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
