import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Users, Plug, CheckCircle2,
  Plus, TrendingUp,
  RotateCw, Copy, Trash2, MoreHorizontal,
  Zap, Clock, Rocket, Link2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTeamStore, TeamRole, ROLE_PERMISSIONS } from '@/stores/teamStore';
import { InviteTeamMemberModal } from '../InviteTeamMemberModal';
import { CounterpartyInviteDrawer } from '@/components/counterparty/CounterpartyInviteDrawer';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { INTEGRATIONS, STATUS_CONFIG, type IntegrationStatus } from '@/config/integrations';

type SettingsTab = 'team' | 'integrations' | 'escrow-defaults';

const roleColors: Record<TeamRole, string> = {
  'Admin': 'border-accent/50 text-accent',
  'Deal Manager': 'border-validated/50 text-validated',
  'Finance Ops': 'border-blue-400/50 text-blue-400',
  'Compliance': 'border-amber-400/50 text-amber-400',
  'Legal Counsel (Buyer)': 'border-blue-400/50 text-blue-400',
  'Legal Counsel (Seller)': 'border-purple-400/50 text-purple-400',
  'Viewer': 'border-muted-foreground/50 text-muted-foreground',
};

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const PERMISSION_LABELS = ['Create Deals', 'Edit Waterfall', 'Approve Payouts', 'View Documents', 'Manage Team', 'Configure Settings', 'KYC/KYB', 'Payments/Escrow', 'Reports'];
const PERMISSION_ROLES: TeamRole[] = ['Admin', 'Deal Manager', 'Finance Ops', 'Compliance', 'Viewer'];

const SECTION_ORDER: { status: IntegrationStatus; title: string; icon: React.ElementType }[] = [
  { status: 'connected', title: 'Active Connections', icon: Zap },
  { status: 'pending', title: 'Pending Setup', icon: Clock },
  { status: 'available', title: 'Available to Connect', icon: Link2 },
  { status: 'coming-soon', title: 'Coming Soon', icon: Rocket },
];

const IntegrationsPanel: React.FC = () => {
  const grouped = useMemo(() => {
    const map: Record<IntegrationStatus, typeof INTEGRATIONS> = { connected: [], available: [], pending: [], 'coming-soon': [] };
    INTEGRATIONS.forEach(i => map[i.status].push(i));
    return map;
  }, []);

  return (
    <motion.div key="integrations" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {SECTION_ORDER.map(s => (
          <div key={s.status} className="pivt-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted/50"><s.icon className="w-4 h-4 text-accent" /></div>
            <div>
              <p className="text-xl font-semibold">{grouped[s.status].length}</p>
              <p className="text-xs text-muted-foreground">{s.title}</p>
            </div>
          </div>
        ))}
      </div>
      {SECTION_ORDER.map(s => {
        const items = grouped[s.status];
        if (!items.length) return null;
        return (
          <div key={s.status} className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">{s.title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map(integ => {
                const cfg = STATUS_CONFIG[integ.status];
                return (
                  <motion.div key={integ.id} {...fadeInUp} className="pivt-card p-5">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <integ.icon className="w-5 h-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-sm">{integ.name}</h4>
                          <Badge variant="outline" className={`text-[9px] ${cfg.className}`}>{cfg.label}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{integ.description}</p>
                      </div>
                      {integ.status === 'available' && (
                        <button className="text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium shrink-0">Connect</button>
                      )}
                      {integ.status === 'connected' && (
                        <button className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors shrink-0">Configure</button>
                      )}
                      {integ.status === 'pending' && (
                        <button className="text-xs px-3 py-1.5 rounded-lg bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors font-medium shrink-0">Setup</button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </motion.div>
  );
};

export const SettingsCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('team');
  const [defaultRate, setDefaultRate] = useState('4.25');
  const [defaultPlatformSplit, setDefaultPlatformSplit] = useState('15');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [counterpartyInviteOpen, setCounterpartyInviteOpen] = useState(false);

  const { members, seedDemo, revokeInvite, removeMember, resendInvite } = useTeamStore();

  useEffect(() => { seedDemo(); }, [seedDemo]);

  const activeMembers = members.filter((m) => m.status === 'active');
  const pendingInvites = members.filter((m) => m.status === 'pending');

  const copyInviteLink = (token?: string) => {
    if (!token) return;
    navigator.clipboard.writeText(`${window.location.origin}/invite?token=${token}`);
    toast.success('Invite link copied.');
  };

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Team management, integrations, and escrow configuration</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {([
          { id: 'team' as SettingsTab, label: 'Team & Roles', icon: Users },
          { id: 'integrations' as SettingsTab, label: 'Integrations', icon: Plug },
          { id: 'escrow-defaults' as SettingsTab, label: 'Escrow Defaults', icon: TrendingUp },
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
          <motion.div key="team" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Active Members */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Team Members ({activeMembers.length})</h3>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="pivt-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                >
                  <Plus className="w-4 h-4" /> Invite Member
                </button>
                <button
                  onClick={() => setCounterpartyInviteOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-border bg-background text-foreground hover:bg-muted/40 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Invite Counterparty
                </button>
              </div>
              <div className="pivt-card overflow-hidden">
                <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <span className="col-span-2">Member</span>
                  <span>Role</span>
                  <span>Access</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>
                {activeMembers.map(member => (
                  <div key={member.id} className="p-4 border-b border-border last:border-0 grid grid-cols-6 items-center hover:bg-muted/20 transition-colors">
                    <div className="col-span-2 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] w-fit ${roleColors[member.role] || ''}`}>{member.role}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {member.accessScope === 'company-wide' ? 'All deals' : `${member.dealIds.length} deal(s)`}
                    </span>
                    <Badge variant="outline" className="text-[10px] w-fit border-validated/50 text-validated">Active</Badge>
                    <div className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => toast.info('Role editor coming soon.')}>
                            Edit Role
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => { removeMember(member.id); toast.success(`${member.name} removed.`); }}
                            className="text-destructive"
                          >
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
                {activeMembers.length === 0 && (
                  <p className="p-6 text-center text-sm text-muted-foreground">No active team members yet.</p>
                )}
              </div>
            </div>

            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <div className="space-y-4">
                <h3 className="font-medium">Pending Invites ({pendingInvites.length})</h3>
                <div className="pivt-card overflow-hidden">
                  <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <span className="col-span-2">Email</span>
                    <span>Role</span>
                    <span>Access</span>
                    <span>Invited</span>
                    <span className="text-right">Actions</span>
                  </div>
                  {pendingInvites.map(inv => (
                    <div key={inv.id} className="p-4 border-b border-border last:border-0 grid grid-cols-6 items-center hover:bg-muted/20 transition-colors">
                      <div className="col-span-2 min-w-0">
                        <p className="text-sm font-medium truncate">{inv.email}</p>
                        {inv.name && <p className="text-xs text-muted-foreground truncate">{inv.name}</p>}
                      </div>
                      <Badge variant="outline" className={`text-[10px] w-fit ${roleColors[inv.role] || ''}`}>{inv.role}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {inv.accessScope === 'company-wide' ? 'All deals' : `${inv.dealIds.length} deal(s)`}
                      </span>
                      <span className="text-xs text-muted-foreground">{timeAgo(inv.invitedAt)}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { resendInvite(inv.id); toast.success('Invite resent.'); }}
                          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
                          title="Resend"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => copyInviteLink(inv.inviteToken)}
                          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground"
                          title="Copy invite link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { revokeInvite(inv.id); toast.success('Invite revoked.'); }}
                          className="p-1.5 rounded-md hover:bg-muted/50 transition-colors text-destructive"
                          title="Revoke"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Role Permissions */}
            <motion.div {...fadeInUp} className="pivt-card p-5">
              <h3 className="font-medium mb-4">Role Permissions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 text-xs text-muted-foreground font-medium">Permission</th>
                      {PERMISSION_ROLES.map(role => (
                        <th key={role} className="text-center py-2 text-xs text-muted-foreground font-medium">{role}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSION_LABELS.map(perm => (
                      <tr key={perm} className="border-b border-border last:border-0">
                        <td className="py-2 text-sm">{perm}</td>
                        {PERMISSION_ROLES.map(role => (
                          <td key={role} className="text-center py-2">
                            {ROLE_PERMISSIONS[role]?.includes(perm)
                              ? <CheckCircle2 className="w-4 h-4 text-validated mx-auto" />
                              : <span className="text-muted-foreground">—</span>}
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
          <IntegrationsPanel />
        )}

        {/* Escrow Defaults */}
        {activeTab === 'escrow-defaults' && (
          <motion.div key="escrow-defaults" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="pivt-card p-6 space-y-5">
              <div>
                <h3 className="font-medium mb-1">Default Escrow Interest Configuration</h3>
                <p className="text-xs text-muted-foreground">These defaults auto-populate when creating new escrow accounts.</p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Default Interest Rate (%)</label>
                  <input type="number" step="0.01" value={defaultRate} onChange={e => setDefaultRate(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-accent" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1.5">Default Platform Interest Share (%)</label>
                  <input type="number" step="1" value={defaultPlatformSplit} onChange={e => setDefaultPlatformSplit(e.target.value)}
                    className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-accent" />
                  <p className="text-[10px] text-muted-foreground mt-1">Client receives {100 - Number(defaultPlatformSplit)}%</p>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <button className="px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors">Save Defaults</button>
              </div>
            </div>

            <div className="pivt-card p-5">
              <h3 className="font-medium mb-3">Interest Rate History</h3>
              <div className="space-y-2">
                {[
                  { date: '2026-02-01', rate: '4.25', by: 'Alexandra Reed' },
                  { date: '2026-01-15', rate: '4.00', by: 'System Default' },
                  { date: '2025-12-01', rate: '3.75', by: 'System Default' },
                ].map((entry, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm py-2 border-b border-border last:border-0">
                    <span className="font-mono text-xs text-muted-foreground w-24">{entry.date}</span>
                    <span className="font-mono font-semibold">{entry.rate}%</span>
                    <span className="text-xs text-muted-foreground ml-auto">Set by {entry.by}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <InviteTeamMemberModal open={inviteOpen} onOpenChange={setInviteOpen} />
      <CounterpartyInviteDrawer open={counterpartyInviteOpen} onOpenChange={setCounterpartyInviteOpen} dealId="atlas" dealName="Project ATLAS" />
    </motion.div>
  );
};
