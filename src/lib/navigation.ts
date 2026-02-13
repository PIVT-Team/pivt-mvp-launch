import {
  LayoutDashboard, Briefcase, FileCheck, Send, Sparkles, Calculator,
  Shield, History, Bot, Droplets, BarChart3, MessageSquare,
  Building2, TrendingUp, Upload, AlertTriangle,
  Users, CreditCard, Settings, Plug, Lock, Database,
  PieChart, Phone, Wallet, FolderCog, Play, FileSearch, Landmark,
  type LucideIcon,
} from 'lucide-react';

export type AppMode = 'manda' | 'credit' | 'treasury' | 'admin';

export interface NavigationItem {
  label: string;
  icon: LucideIcon;
  path: string;
  badge?: string;
}

export const navigationByMode: Record<AppMode, NavigationItem[]> = {
  manda: [
    { label: 'Command Center', icon: LayoutDashboard, path: 'command' },
    { label: 'Active Deals', icon: Briefcase, path: 'deals' },
    { label: 'Demo Experience', icon: Play, path: 'demo' },
    { label: 'Waterfall', icon: Calculator, path: 'waterfall' },
    { label: 'Stakeholders', icon: Users, path: 'stakeholders' },
    { label: 'Documents', icon: FileCheck, path: 'documents' },
    { label: 'Ingestion', icon: FileSearch, path: 'ingestion' },
    { label: 'Escrow', icon: Shield, path: 'escrow' },
    { label: 'Closing Center', icon: Landmark, path: 'closing' },
    { label: 'Approvals', icon: Send, path: 'approvals' },
    { label: 'Payments', icon: CreditCard, path: 'payments' },
    { label: 'Audit', icon: History, path: 'audit' },
    { label: 'Reports', icon: BarChart3, path: 'reports' },
  ],
  credit: [
    { label: 'Dashboard', icon: LayoutDashboard, path: 'command' },
    { label: 'Facilities', icon: Building2, path: 'deals' },
    { label: 'Covenant Monitoring', icon: AlertTriangle, path: 'waterfall' },
    { label: 'Analytics', icon: TrendingUp, path: 'reports' },
    { label: 'Import Data', icon: Upload, path: 'documents' },
  ],
  treasury: [
    { label: 'Dashboard', icon: LayoutDashboard, path: 'command' },
    { label: 'Fund Overview', icon: PieChart, path: 'deals' },
    { label: 'LP Portal', icon: Users, path: 'stakeholders' },
    { label: 'Analytics', icon: TrendingUp, path: 'reports' },
    { label: 'Import Data', icon: Upload, path: 'documents' },
  ],
  admin: [
    { label: 'Dashboard', icon: LayoutDashboard, path: 'command' },
    { label: 'Integrations', icon: Plug, path: 'documents' },
    { label: 'API Keys', icon: Lock, path: 'escrow' },
    { label: 'Logs', icon: History, path: 'audit' },
    { label: 'Settings', icon: Settings, path: 'reports' },
  ],
};

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
