import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren, springConfig } from '@/lib/animations';
import {
  Settings, Users, Plug, Shield, Bot, Sliders, CheckCircle2,
  Plus, Trash2, Edit, Globe, Key, Bell, Lock, ToggleLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type SettingsTab = 'team' | 'integrations' | 'autonomy';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'deal-admin' | 'counsel' | 'viewer';
  status: 'active' | 'invited';
  lastActive?: string;
}

const TEAM: TeamMember[] = [
  { id: 't1', name: 'Alexandra Reed', email: 'areed@pivt.io', role: 'admin', status: 'active', lastActive: '2 min ago' },
  { id: 't2', name: 'James Morrison', email: 'jmorrison@pivt.io', role: 'deal-admin', status: 'active', lastActive: '1 hr ago' },
  { id: 't3', name: 'Sarah Chen', email: 'schen@datastream.io', role: 'counsel', status: 'active', lastActive: '3 hr ago' },
  { id: 't4', name: 'David Park', email: 'dpark@apexcap.com', role: 'counsel', status: 'active', lastActive: '1 day ago' },
  { id: 't5', name: 'Emily Watson', email: 'ewatson@pivt.io', role: 'viewer', status: 'invited' },
];

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'available' | 'coming-soon';
  icon: React.ElementType;
  category: string;
}

const INTEGRATIONS: Integration[] = [
  { id: 'docusign', name: 'DocuSign', description: 'E-signature for deal documents', status: 'connected', icon: Edit, category: 'Legal' },
  { id: 'plaid', name: 'Plaid', description: 'Bank account verification', status: 'connected', icon: Shield, category: 'Banking' },
  { id: 'stripe', name: 'Stripe', description: 'Payment processing', status: 'available', icon: Key, category: 'Payments' },
  { id: 'slack', name: 'Slack', description: 'Team notifications', status: 'connected', icon: Bell, category: 'Communication' },
  { id: 'bloomberg', name: 'Bloomberg Terminal', description: 'Market data and analytics', status: 'available', icon: Globe, category: 'Data' },
  { id: 'carta', name: 'Carta', description: 'Cap table management sync', status: 'coming-soon', icon: Users, category: 'Cap Table' },
  { id: 'salesforce', name: 'Salesforce', description: 'CRM integration', status: 'available', icon: Globe, category: 'CRM' },
  { id: 'aws', name: 'AWS S3', description: 'Document storage', status: 'connected', icon: Lock, category: 'Storage' },
];

interface AutonomySetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  level: 'full' | 'supervised' | 'manual';
}

const AUTONOMY_DEFAULTS: AutonomySetting[] = [
  { id: 'auto-kyc', label: 'Auto-approve KYC', description: 'Automatically approve KYC when all documents are verified', enabled: true, level: 'full' },
  { id: 'auto-match', label: 'Auto-match invoices', description: 'Match incoming invoices to budget line items', enabled: true, level: 'full' },
  { id: 'auto-escalate', label: 'Auto-escalate approvals', description: 'Escalate if approval takes > 2 hours', enabled: false, level: 'supervised' },
  { id: 'auto-notify', label: 'Smart notifications', description: 'AI-prioritized notification delivery', enabled: true, level: 'full' },
];

const roleColors: Record<string, string> = {
  admin: 'border-accent/50 text-accent',
  'deal-admin': 'border-validated/50 text-validated',
  counsel: 'border-blue-400/50 text-blue-400',
  viewer: 'border-muted-foreground/50 text-muted-foreground',
};

export const SettingsCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('team');
  const [autonomy, setAutonomy] = useState(AUTONOMY_DEFAULTS);

  const toggleAutonomy = (id: string) => {
    setAutonomy(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Team management, integrations, and AI autonomy controls</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {([
          { id: 'team' as SettingsTab, label: 'Team & Roles', icon: Users },
          { id: 'integrations' as SettingsTab, label: 'Integrations', icon: Plug },
          { id: 'autonomy' as SettingsTab, label: 'Autonomy', icon: Bot },
        ]).map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors ${activeTab === tab.id ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Team & Roles */}
        {activeTab === 'team' && (
          <motion.div key="team" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium">Team Members ({TEAM.length})</h3>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">
                <Plus className="w-4 h-4" /> Invite Member
              </button>
            </div>
            <div className="pivt-card overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span className="col-span-2">Member</span>
                <span>Role</span>
                <span>Status</span>
                <span className="text-right">Last Active</span>
              </div>
              {TEAM.map(member => (
                <div key={member.id} className="p-4 border-b border-border last:border-0 grid grid-cols-5 items-center hover:bg-muted/20 transition-colors">
                  <div className="col-span-2">
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] w-fit ${roleColors[member.role]}`}>{member.role}</Badge>
                  <Badge variant="outline" className={`text-[10px] w-fit ${member.status === 'active' ? 'border-validated/50 text-validated' : 'border-discrepancy/50 text-discrepancy'}`}>{member.status}</Badge>
                  <span className="text-xs text-muted-foreground text-right">{member.lastActive || '—'}</span>
                </div>
              ))}
            </div>

            {/* Role Permissions */}
            <motion.div {...fadeInUp} className="pivt-card p-5">
              <h3 className="font-medium mb-4">Role Permissions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium">Permission</th>
                      {['Admin', 'Deal Admin', 'Counsel', 'Viewer'].map(role => (
                        <th key={role} className="text-center py-2 text-xs text-muted-foreground font-medium">{role}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {['Create Deals', 'Edit Waterfall', 'Approve Payouts', 'View Documents', 'Manage Team', 'Configure Settings'].map(perm => (
                      <tr key={perm} className="border-b border-border last:border-0">
                        <td className="py-2 text-sm">{perm}</td>
                        {[true, perm !== 'Manage Team' && perm !== 'Configure Settings', perm === 'View Documents' || perm === 'Approve Payouts', perm === 'View Documents'].map((allowed, i) => (
                          <td key={i} className="text-center py-2">
                            {allowed ? <CheckCircle2 className="w-4 h-4 text-validated mx-auto" /> : <span className="text-muted-foreground">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Integrations */}
        {activeTab === 'integrations' && (
          <motion.div key="integrations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INTEGRATIONS.map(integ => (
                <motion.div key={integ.id} {...fadeInUp} className="pivt-card p-5">
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <integ.icon className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm">{integ.name}</h4>
                        <Badge variant="outline" className={`text-[9px] ${integ.status === 'connected' ? 'border-validated/50 text-validated' : integ.status === 'coming-soon' ? 'border-muted-foreground/50 text-muted-foreground' : 'border-accent/50 text-accent'}`}>
                          {integ.status === 'coming-soon' ? 'Coming Soon' : integ.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{integ.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{integ.category}</p>
                    </div>
                    {integ.status === 'available' && (
                      <button className="text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">Connect</button>
                    )}
                    {integ.status === 'connected' && (
                      <button className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">Configure</button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Autonomy */}
        {activeTab === 'autonomy' && (
          <motion.div key="autonomy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Autonomy Settings</h3>
              <p className="text-sm text-muted-foreground mt-1">Configure AI agent behavior</p>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={springConfig.standard}
              className="pivt-card overflow-hidden"
            >
              {autonomy.map((setting, index) => (
                <motion.div
                  key={setting.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ ...springConfig.standard, delay: index * 0.03 }}
                  className="p-5 flex items-center justify-between border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                      <Sliders className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{setting.label}</p>
                      <p className="text-xs text-muted-foreground">{setting.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleAutonomy(setting.id)}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      setting.enabled ? 'bg-validated' : 'bg-muted'
                    }`}
                  >
                    <motion.div
                      initial={false}
                      animate={{ x: setting.enabled ? 20 : 2 }}
                      transition={springConfig.standard}
                      className="absolute top-1 w-5 h-5 rounded-full bg-white shadow"
                    />
                  </button>
                </motion.div>
              ))}
            </motion.div>

            {/* Autonomy Level */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springConfig.standard, delay: 0.2 }}
              className="pivt-card p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-accent" />
                <h3 className="text-sm font-medium text-foreground">Autonomy Level</h3>
              </div>
              <div className="flex items-center gap-4">
                {['Conservative', 'Balanced', 'Aggressive'].map((level, i) => (
                  <button
                    key={level}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                      i === 1
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Balanced: Agents prepare and stage work, but require human approval for payments over $1M.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
