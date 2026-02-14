import {
  LayoutDashboard, Briefcase, FileCheck, Send, Sparkles, Calculator,
  Shield, History, Bot, Droplets, BarChart3, MessageSquare,
  Building2, TrendingUp, Upload, AlertTriangle,
  Users, CreditCard, Settings, Plug, Lock, Database,
  PieChart, Phone, Wallet, FolderCog, Play, FileSearch, Landmark,
  Atom, UserCheck, Gauge, UserPlus, Table2, Zap,
  type LucideIcon,
} from 'lucide-react';

export type AppMode = 'manda' | 'credit' | 'treasury' | 'admin';

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
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
        { label: 'Command Center', icon: LayoutDashboard, path: 'command' },
        { label: 'Glass Cockpit', icon: Gauge, path: 'cockpit' },
        { label: 'Active Deals', icon: Briefcase, path: 'deals' },
        { label: 'Deal Workspace', icon: FolderCog, path: 'workspace' },
        { label: 'Demo Experience', icon: Play, path: 'demo' },
        { label: 'KYC / KYB', icon: UserCheck, path: 'verification' },
        { label: 'Stakeholders', icon: Users, path: 'stakeholders' },
        { label: 'Documents', icon: FileCheck, path: 'documents' },
        { label: 'Ingestion', icon: FileSearch, path: 'ingestion' },
        { label: 'Waterfall', icon: Calculator, path: 'waterfall' },
        { label: 'Cap Table', icon: Table2, path: 'cap-table' },
        { label: 'Escrow', icon: Shield, path: 'escrow' },
        { label: 'Closing Center', icon: Landmark, path: 'closing' },
      ],
    },
    {
      category: 'Approvals',
      items: [
        { label: 'Approvals', icon: Send, path: 'approvals', badge: '5' },
        { label: 'Payments', icon: CreditCard, path: 'payments' },
      ],
    },
    {
      category: 'Communication',
      items: [
        { label: 'Messages', icon: MessageSquare, path: 'messages' },
        { label: 'Notifications', icon: Phone, path: 'notifications', badge: '3' },
      ],
    },
    {
      category: 'Reports',
      items: [
        { label: 'Audit', icon: History, path: 'audit' },
        { label: 'Reports', icon: BarChart3, path: 'reports' },
      ],
    },
    {
      category: 'Advanced Tools',
      items: [
        { label: 'Newton AI', icon: Atom, path: 'newton' },
        { label: 'Autonomy', icon: Zap, path: 'autonomy' },
      ],
    },
    {
      category: 'Portals',
      items: [
        { label: 'Recipient Portal', icon: Wallet, path: 'recipient' },
        { label: 'LP Portal', icon: Building2, path: 'lp-portal' },
      ],
    },
    {
      category: 'Onboarding',
      items: [
        { label: 'Onboarding', icon: UserPlus, path: 'onboarding' },
      ],
    },
    {
      category: 'MCP Agents',
      items: [
        { label: 'MCP Agents', icon: Bot, path: 'mcp' },
      ],
    },
    {
      category: 'Settings',
      items: [
        { label: 'Integrations', icon: Plug, path: 'integrations' },
        { label: 'Settings', icon: Settings, path: 'settings' },
      ],
    },
  ],
  credit: [
    {
      category: 'Main',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: 'command' },
        { label: 'Facilities', icon: Building2, path: 'deals' },
        { label: 'Covenant Monitoring', icon: AlertTriangle, path: 'waterfall' },
        { label: 'Analytics', icon: TrendingUp, path: 'reports' },
        { label: 'Import Data', icon: Upload, path: 'documents' },
      ],
    },
  ],
  treasury: [
    {
      category: 'Main',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: 'command' },
        { label: 'Fund Overview', icon: PieChart, path: 'deals' },
        { label: 'LP Portal', icon: Users, path: 'stakeholders' },
        { label: 'Analytics', icon: TrendingUp, path: 'reports' },
        { label: 'Import Data', icon: Upload, path: 'documents' },
      ],
    },
  ],
  admin: [
    {
      category: 'Main',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, path: 'command' },
        { label: 'Verification Queue', icon: Shield, path: 'admin-verification' },
        { label: 'Integrations', icon: Plug, path: 'integrations' },
        { label: 'API Keys', icon: Lock, path: 'escrow' },
        { label: 'Logs', icon: History, path: 'audit' },
        { label: 'Settings', icon: Settings, path: 'reports' },
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
