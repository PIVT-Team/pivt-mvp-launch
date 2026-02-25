import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Plug, Search, Settings, RefreshCw, ArrowRight, AlertTriangle, Loader2, X,
  Edit, Shield, Bell, Lock, CreditCard, Globe, Users, Zap, Database, FileText,
  CheckCircle2, Clock, XCircle, Unplug, Key, Link2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

type IntegrationStatus = 'connected' | 'available' | 'pending' | 'error' | 'disconnected' | 'coming-soon';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  icon: React.ElementType;
  category: string;
  details?: string;
  lastSync?: string;
  errorMessage?: string;
  demo?: boolean;
}

const INITIAL_INTEGRATIONS: Integration[] = [
  { id: 'docusign', name: 'DocuSign', description: 'E-signature for deal documents', status: 'connected', icon: Edit, category: 'Documents', details: 'OAuth 2.0 — 12 envelopes sent this month', lastSync: '5 min ago', demo: true },
  { id: 'plaid', name: 'Plaid', description: 'Bank account verification & ACH', status: 'connected', icon: Shield, category: 'Banking', details: '28 accounts verified', lastSync: '1 hr ago', demo: true },
  { id: 'slack', name: 'Slack', description: 'Team notifications & deal alerts', status: 'connected', icon: Bell, category: 'Communication', details: '#pivt-deals, #pivt-alerts channels active', lastSync: '2 min ago', demo: true },
  { id: 'aws', name: 'AWS S3', description: 'Encrypted document storage', status: 'connected', icon: Lock, category: 'Documents', details: '2.4 TB stored across 3 buckets', lastSync: '30 sec ago', demo: true },
  { id: 'middesk', name: 'Middesk', description: 'Business identity verification', status: 'error', icon: Shield, category: 'Compliance', details: 'API rate limit exceeded', errorMessage: 'Rate limit exceeded — retry in 15 minutes', lastSync: '45 min ago', demo: true },
  { id: 'complyadvantage', name: 'ComplyAdvantage', description: 'AML & sanctions screening', status: 'pending', icon: Shield, category: 'Compliance', details: 'Awaiting API key approval', demo: true },
  { id: 'stripe', name: 'Stripe', description: 'Payment processing & payouts', status: 'available', icon: CreditCard, category: 'Banking' },
  { id: 'bloomberg', name: 'Bloomberg Terminal', description: 'Real-time market data & analytics', status: 'available', icon: Globe, category: 'Data' },
  { id: 'salesforce', name: 'Salesforce', description: 'CRM deal pipeline sync', status: 'available', icon: Globe, category: 'Communication' },
  { id: 'carta', name: 'Carta', description: 'Cap table management sync', status: 'coming-soon', icon: Users, category: 'Data' },
  { id: 'iron-clad', name: 'Ironclad', description: 'Contract lifecycle management', status: 'coming-soon', icon: FileText, category: 'Documents' },
  { id: 'datasite', name: 'Datasite (Merrill)', description: 'Virtual data room integration', status: 'available', icon: Database, category: 'Documents' },
  { id: 'allvue', name: 'Allvue Systems', description: 'Fund administration & reporting', status: 'coming-soon', icon: Zap, category: 'Data' },
];

const CATEGORIES = ['All', 'Banking', 'Documents', 'Communication', 'Compliance', 'Data'];

const statusConfig: Record<IntegrationStatus, { label: string; badgeClass: string; dotClass: string }> = {
  connected:     { label: 'Connected',    badgeClass: 'border-emerald-500/40 text-emerald-400', dotClass: 'bg-emerald-400' },
  pending:       { label: 'Pending',      badgeClass: 'border-yellow-500/40 text-yellow-400',  dotClass: 'bg-yellow-400' },
  error:         { label: 'Error',        badgeClass: 'border-red-500/40 text-red-400',        dotClass: 'bg-red-400' },
  available:     { label: 'Available',    badgeClass: 'border-accent/40 text-accent',           dotClass: 'bg-accent' },
  disconnected:  { label: 'Disconnected', badgeClass: 'border-muted-foreground/40 text-muted-foreground', dotClass: 'bg-muted-foreground' },
  'coming-soon': { label: 'Coming Soon',  badgeClass: 'border-muted-foreground/40 text-muted-foreground', dotClass: 'bg-muted-foreground' },
};

function StatusBadge({ status, demo }: { status: IntegrationStatus; demo?: boolean }) {
  const cfg = statusConfig[status];
  return (
    <Badge variant="outline" className={`text-[9px] ${cfg.badgeClass}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dotClass} mr-1`} />
      {cfg.label}{demo && status === 'connected' ? ' (Demo)' : ''}
    </Badge>
  );
}

/* ── Modal backdrop ── */
function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl"
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export const IntegrationsCover: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [integrations, setIntegrations] = useState<Integration[]>(INITIAL_INTEGRATIONS);
  const { toast } = useToast();

  // Modal states
  const [connectModal, setConnectModal] = useState<Integration | null>(null);
  const [disconnectModal, setDisconnectModal] = useState<Integration | null>(null);
  const [configureModal, setConfigureModal] = useState<Integration | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const updateStatus = useCallback((id: string, patch: Partial<Integration>) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  // Connect flow
  const handleConnect = useCallback((integ: Integration) => {
    setConnecting(true);
    setTimeout(() => {
      updateStatus(integ.id, {
        status: 'connected',
        demo: true,
        details: 'Demo mode — simulated connection',
        lastSync: 'Just now',
        errorMessage: undefined,
      });
      setConnecting(false);
      setConnectModal(null);
      toast({ title: `${integ.name} successfully connected.`, description: 'Running in demo mode.' });
    }, 2500);
  }, [updateStatus, toast]);

  // Disconnect flow
  const handleDisconnect = useCallback((integ: Integration) => {
    updateStatus(integ.id, {
      status: 'disconnected',
      demo: false,
      details: undefined,
      lastSync: undefined,
      errorMessage: undefined,
    });
    setDisconnectModal(null);
    toast({ title: `${integ.name} disconnected.`, description: 'Integration has been removed.' });
  }, [updateStatus, toast]);

  // Fix issue (reconnect)
  const handleFixIssue = useCallback((integ: Integration) => {
    setConnectModal(integ);
  }, []);

  // Check status (for pending)
  const handleCheckStatus = useCallback((integ: Integration) => {
    toast({ title: `${integ.name}`, description: 'Still awaiting approval. We\'ll notify you when ready.' });
  }, [toast]);

  // Sync
  const handleSync = useCallback((integ: Integration) => {
    setSyncing(integ.id);
    setTimeout(() => {
      updateStatus(integ.id, { lastSync: 'Just now' });
      setSyncing(null);
      toast({ title: `${integ.name} synced.` });
    }, 1500);
  }, [updateStatus, toast]);

  const counts = {
    connected: integrations.filter(i => i.status === 'connected').length,
    available: integrations.filter(i => i.status === 'available' || i.status === 'disconnected').length,
    pending: integrations.filter(i => i.status === 'pending').length,
    errors: integrations.filter(i => i.status === 'error').length,
  };

  const filtered = integrations
    .filter(i => filter === 'All' || i.category === filter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));

  const renderCard = (integ: Integration) => {
    const isError = integ.status === 'error';
    const isPending = integ.status === 'pending';
    const isAvailable = integ.status === 'available' || integ.status === 'disconnected';
    const isComingSoon = integ.status === 'coming-soon';
    const isConnected = integ.status === 'connected';

    return (
      <motion.div
        key={integ.id}
        {...fadeInUp}
        className={`pivt-card p-5 transition-colors ${
          isError ? 'border-red-500/20' : isConnected ? 'border-emerald-500/15' : isPending ? 'border-yellow-500/15' : ''
        } ${isComingSoon ? 'opacity-60' : ''}`}
      >
        <div className="flex flex-col gap-3">
          {/* Top row: icon + info */}
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg shrink-0 ${
              isConnected ? 'bg-emerald-500/10' : isError ? 'bg-red-500/10' : isPending ? 'bg-yellow-500/10' : 'bg-muted/50'
            }`}>
              <integ.icon className={`w-5 h-5 ${
                isConnected ? 'text-emerald-400' : isError ? 'text-red-400' : isPending ? 'text-yellow-400' : 'text-accent'
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{integ.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{integ.description}</p>
              {integ.details && <p className="text-xs text-foreground/70 mt-1">{integ.details}</p>}
              {integ.lastSync && <p className="text-[10px] text-muted-foreground mt-1">Last sync: {integ.lastSync}</p>}
              {isError && integ.errorMessage && (
                <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" /> {integ.errorMessage}
                </p>
              )}
            </div>
          </div>

          {/* Bottom row: badge + actions */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <StatusBadge status={integ.status} demo={integ.demo} />
            <div className="flex items-center gap-1.5">
              {isConnected && (
                <>
                  <button
                    onClick={() => handleSync(integ)}
                    className="text-xs p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
                    title="Sync"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing === integ.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setConfigureModal(integ)}
                    className="text-xs p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-muted transition-colors"
                    title="Configure"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setDisconnectModal(integ)}
                    className="text-xs p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-red-500/10 hover:text-red-400 transition-colors"
                    title="Disconnect"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {isError && (
                <button onClick={() => handleFixIssue(integ)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium">
                  Fix Issue
                </button>
              )}
              {isPending && (
                <button onClick={() => handleCheckStatus(integ)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors font-medium">
                  Check Status
                </button>
              )}
              {isAvailable && (
                <button onClick={() => setConnectModal(integ)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                  Connect <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const groupOrder: { key: IntegrationStatus | 'available'; title: string; titleClass: string; filter: (i: Integration) => boolean }[] = [
    { key: 'error', title: 'Requires Attention', titleClass: 'text-red-400', filter: i => i.status === 'error' },
    { key: 'connected', title: 'Active Connections', titleClass: 'text-muted-foreground', filter: i => i.status === 'connected' },
    { key: 'pending', title: 'Pending', titleClass: 'text-yellow-400', filter: i => i.status === 'pending' },
    { key: 'available', title: 'Available to Connect', titleClass: 'text-muted-foreground', filter: i => i.status === 'available' || i.status === 'disconnected' },
    { key: 'coming-soon', title: 'Coming Soon', titleClass: 'text-muted-foreground', filter: i => i.status === 'coming-soon' },
  ];

  return (
    <>
      <motion.div {...staggerChildren} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
            <p className="text-muted-foreground mt-1">Connect PIVT with your existing deal infrastructure</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          {([
            { label: 'Connected', value: counts.connected, color: 'text-emerald-400' },
            { label: 'Available', value: counts.available, color: 'text-accent' },
            { label: 'Pending', value: counts.pending, color: 'text-yellow-400' },
            { label: 'Errors', value: counts.errors, color: 'text-red-400' },
          ] as const).map(s => (
            <motion.div key={s.label} {...fadeInUp} className="pivt-card p-4 text-center">
              <p className={`pivt-stat text-2xl font-semibold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Search + Category Filters */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
            />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        {groupOrder.map(group => {
          const items = filtered.filter(group.filter);
          if (items.length === 0) return null;
          return (
            <div key={group.key} className="space-y-3">
              <h3 className={`text-sm font-medium uppercase tracking-wider ${group.titleClass}`}>{group.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(renderCard)}
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* ── Connect Modal ── */}
      <Modal open={!!connectModal} onClose={() => !connecting && setConnectModal(null)}>
        {connectModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Connect {connectModal.name}</h2>
              <button onClick={() => !connecting && setConnectModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <connectModal.icon className="w-6 h-6 text-accent" />
              <div>
                <p className="text-sm font-medium">{connectModal.name}</p>
                <p className="text-xs text-muted-foreground">{connectModal.description}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              This will simulate a connection to {connectModal.name} in demo mode. No live API calls will be made.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                disabled={connecting}
                onClick={() => setConnectModal(null)}
                className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={connecting}
                onClick={() => handleConnect(connectModal)}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-medium disabled:opacity-70"
              >
                {connecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    Connect (Demo Mode)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Disconnect Modal ── */}
      <Modal open={!!disconnectModal} onClose={() => setDisconnectModal(null)}>
        {disconnectModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Disconnect {disconnectModal.name}</h2>
              <button onClick={() => setDisconnectModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to disconnect <span className="font-medium text-foreground">{disconnectModal.name}</span>? This will remove the integration and stop all syncing.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDisconnectModal(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDisconnect(disconnectModal)} className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium">
                Disconnect
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Configure Modal ── */}
      <Modal open={!!configureModal} onClose={() => setConfigureModal(null)}>
        {configureModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Configure {configureModal.name}</h2>
              <button onClick={() => setConfigureModal(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <input
                    type="password"
                    defaultValue="sk_demo_xxxxxxxxxxxx"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL</label>
                <input
                  type="url"
                  defaultValue="https://pivt.app/webhooks/demo"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/50"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfigureModal(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfigureModal(null);
                  toast({ title: `${configureModal.name} configuration saved.` });
                }}
                className="px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-medium"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
