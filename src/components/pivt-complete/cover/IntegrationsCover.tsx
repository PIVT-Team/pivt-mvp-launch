import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Plug, Search, Settings, RefreshCw, ArrowRight, Loader2, X,
  Unplug, Key, Link2, Zap, Clock, Rocket,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { INTEGRATIONS as CONFIG_INTEGRATIONS, STATUS_CONFIG, type Integration as ConfigIntegration, type IntegrationStatus } from '@/config/integrations';

interface Integration extends ConfigIntegration {
  details?: string;
  lastSync?: string;
  errorMessage?: string;
  demo?: boolean;
}

function initIntegrations(): Integration[] {
  return CONFIG_INTEGRATIONS.map(i => {
    if (i.status === 'connected') {
      const extras: Record<string, Partial<Integration>> = {
        docusign: { details: 'OAuth 2.0 — 12 envelopes sent this month', lastSync: '5 min ago', demo: true },
        datasite: { details: 'VDR linked — 3 active deal rooms, 1,284 files indexed', lastSync: '12 min ago', demo: true },
        plaid: { details: '28 accounts verified', lastSync: '1 hr ago', demo: true },
        aws: { details: '2.4 TB stored across 3 buckets', lastSync: '30 sec ago', demo: true },
      };
      return { ...i, ...(extras[i.id] || { demo: true, lastSync: 'Just now' }) };
    }
    if (i.id === 'imanage') return { ...i, details: 'Awaiting workspace admin approval' };
    if (i.id === 'complyadvantage') return { ...i, details: 'Awaiting API key approval' };
    return { ...i };
  });
}

const CATEGORIES = ['All', 'VDR', 'Legal DMS', 'Legal', 'Banking', 'Compliance', 'Payments', 'Data', 'Storage', 'CRM', 'Cap Table'];

function StatusBadge({ status, demo }: { status: IntegrationStatus; demo?: boolean }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant="outline" className={`text-[9px] ${cfg.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
        status === 'connected' ? 'bg-validated' : status === 'pending' ? 'bg-amber-400' : status === 'available' ? 'bg-accent' : 'bg-muted-foreground'
      }`} />
      {cfg.label}{demo && status === 'connected' ? ' (Demo)' : ''}
    </Badge>
  );
}

function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

const SECTION_ORDER: { status: IntegrationStatus; title: string; icon: React.ElementType }[] = [
  { status: 'connected', title: 'Active Connections', icon: Zap },
  { status: 'pending', title: 'Pending Setup', icon: Clock },
  { status: 'available', title: 'Available to Connect', icon: Link2 },
  { status: 'coming-soon', title: 'Coming Soon', icon: Rocket },
];

export const IntegrationsCover: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [integrations, setIntegrations] = useState<Integration[]>(initIntegrations);
  const { toast } = useToast();

  const [connectModal, setConnectModal] = useState<Integration | null>(null);
  const [disconnectModal, setDisconnectModal] = useState<Integration | null>(null);
  const [configureModal, setConfigureModal] = useState<Integration | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);

  const updateStatus = useCallback((id: string, patch: Partial<Integration>) => {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
  }, []);

  const handleConnect = useCallback((integ: Integration) => {
    setConnecting(true);
    setTimeout(() => {
      updateStatus(integ.id, { status: 'connected', demo: true, details: 'Demo mode — simulated connection', lastSync: 'Just now', errorMessage: undefined });
      setConnecting(false);
      setConnectModal(null);
      toast({ title: `${integ.name} successfully connected.`, description: 'Running in demo mode.' });
    }, 2500);
  }, [updateStatus, toast]);

  const handleDisconnect = useCallback((integ: Integration) => {
    updateStatus(integ.id, { status: 'available' as IntegrationStatus, demo: false, details: undefined, lastSync: undefined, errorMessage: undefined });
    setDisconnectModal(null);
    toast({ title: `${integ.name} disconnected.` });
  }, [updateStatus, toast]);

  const handleSync = useCallback((integ: Integration) => {
    setSyncing(integ.id);
    setTimeout(() => { updateStatus(integ.id, { lastSync: 'Just now' }); setSyncing(null); toast({ title: `${integ.name} synced.` }); }, 1500);
  }, [updateStatus, toast]);

  const handleCheckStatus = useCallback((integ: Integration) => {
    toast({ title: integ.name, description: "Still awaiting approval. We'll notify you when ready." });
  }, [toast]);

  const counts = useMemo(() => ({
    connected: integrations.filter(i => i.status === 'connected').length,
    available: integrations.filter(i => i.status === 'available').length,
    pending: integrations.filter(i => i.status === 'pending').length,
    'coming-soon': integrations.filter(i => i.status === 'coming-soon').length,
  }), [integrations]);

  const filtered = integrations
    .filter(i => filter === 'All' || i.category === filter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));

  const renderCard = (integ: Integration) => {
    const isConnected = integ.status === 'connected';
    const isPending = integ.status === 'pending';
    const isAvailable = integ.status === 'available';
    const isComingSoon = integ.status === 'coming-soon';

    return (
      <motion.div key={integ.id} {...fadeInUp}
        className={`pivt-card p-5 transition-colors ${isConnected ? 'border-validated/15' : isPending ? 'border-amber-400/15' : ''} ${isComingSoon ? 'opacity-60' : ''}`}>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg shrink-0 ${isConnected ? 'bg-validated/10' : isPending ? 'bg-amber-400/10' : 'bg-muted/50'}`}>
              <integ.icon className={`w-5 h-5 ${isConnected ? 'text-validated' : isPending ? 'text-amber-400' : 'text-accent'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm truncate">{integ.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{integ.description}</p>
              {integ.details && <p className="text-xs text-foreground/70 mt-1">{integ.details}</p>}
              {integ.lastSync && <p className="text-[10px] text-muted-foreground mt-1">Last sync: {integ.lastSync}</p>}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
            <StatusBadge status={integ.status} demo={integ.demo} />
            <div className="flex items-center gap-1.5">
              {isConnected && (
                <>
                  <button onClick={() => handleSync(integ)} className="text-xs p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-muted transition-colors" title="Sync">
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing === integ.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => setConfigureModal(integ)} className="text-xs p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-muted transition-colors" title="Configure">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setDisconnectModal(integ)} className="text-xs p-1.5 rounded-md bg-muted/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" title="Disconnect">
                    <Unplug className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              {isPending && (
                <button onClick={() => handleCheckStatus(integ)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors font-medium">
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

  return (
    <>
      <motion.div {...staggerChildren} className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect PIVT with your existing deal infrastructure</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {SECTION_ORDER.map(s => (
            <motion.div key={s.status} {...fadeInUp} className="pivt-card p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted/50"><s.icon className="w-4 h-4 text-accent" /></div>
              <div>
                <p className="text-xl font-semibold">{counts[s.status]}</p>
                <p className="text-xs text-muted-foreground">{s.title}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Search + Category Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search integrations..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-accent/50" />
          </div>
          <div className="flex gap-1 flex-wrap">
            {CATEGORIES.filter(cat => cat === 'All' || integrations.some(i => i.category === cat)).map(cat => (
              <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Sections */}
        {SECTION_ORDER.map(s => {
          const items = filtered.filter(i => i.status === s.status);
          if (!items.length) return null;
          return (
            <div key={s.status} className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">{s.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{items.map(renderCard)}</div>
            </div>
          );
        })}
      </motion.div>

      {/* Connect Modal */}
      <Modal open={!!connectModal} onClose={() => !connecting && setConnectModal(null)}>
        {connectModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Connect {connectModal.name}</h2>
              <button onClick={() => !connecting && setConnectModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
              <connectModal.icon className="w-6 h-6 text-accent" />
              <div>
                <p className="text-sm font-medium">{connectModal.name}</p>
                <p className="text-xs text-muted-foreground">{connectModal.description}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">This will simulate a connection to {connectModal.name} in demo mode. No live API calls will be made.</p>
            <div className="flex gap-3 justify-end">
              <button disabled={connecting} onClick={() => setConnectModal(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50">Cancel</button>
              <button disabled={connecting} onClick={() => handleConnect(connectModal)} className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-medium disabled:opacity-70">
                {connecting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Connecting...</> : <><Link2 className="w-3.5 h-3.5" />Connect (Demo Mode)</>}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Disconnect Modal */}
      <Modal open={!!disconnectModal} onClose={() => setDisconnectModal(null)}>
        {disconnectModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Disconnect {disconnectModal.name}</h2>
              <button onClick={() => setDisconnectModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-muted-foreground">Are you sure you want to disconnect <span className="font-medium text-foreground">{disconnectModal.name}</span>?</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDisconnectModal(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={() => handleDisconnect(disconnectModal)} className="px-4 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors font-medium">Disconnect</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Configure Modal */}
      <Modal open={!!configureModal} onClose={() => setConfigureModal(null)}>
        {configureModal && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Configure {configureModal.name}</h2>
              <button onClick={() => setConfigureModal(null)} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">API Key</label>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <input type="password" defaultValue="sk_demo_xxxxxxxxxxxx" className="flex-1 px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:border-accent/50" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Webhook URL</label>
                <input type="url" defaultValue="https://pivt.app/webhooks/demo" className="w-full px-3 py-2 rounded-lg border border-border bg-transparent text-sm focus:outline-none focus:border-accent/50" />
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfigureModal(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted/50 transition-colors">Cancel</button>
              <button onClick={() => { setConfigureModal(null); toast({ title: `${configureModal.name} configuration saved.` }); }} className="px-4 py-2 text-sm rounded-lg bg-accent text-accent-foreground hover:bg-accent/90 transition-colors font-medium">Save Configuration</button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
