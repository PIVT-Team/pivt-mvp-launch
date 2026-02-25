import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Plug, Search, Settings, RefreshCw, ArrowRight, AlertTriangle,
  Edit, Shield, Bell, Lock, CreditCard, Globe, Users, Zap, Database, FileText,
  CheckCircle2, Clock, XCircle, Unplug,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type IntegrationStatus = 'connected' | 'available' | 'pending' | 'error' | 'coming-soon';

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

const INTEGRATIONS: Integration[] = [
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

const statusConfig: Record<IntegrationStatus, { label: string; badgeClass: string; dotClass: string; icon: React.ElementType }> = {
  connected:    { label: 'Connected',    badgeClass: 'border-emerald-500/40 text-emerald-400', dotClass: 'bg-emerald-400', icon: CheckCircle2 },
  pending:      { label: 'Pending',      badgeClass: 'border-yellow-500/40 text-yellow-400',  dotClass: 'bg-yellow-400',  icon: Clock },
  error:        { label: 'Error',        badgeClass: 'border-red-500/40 text-red-400',        dotClass: 'bg-red-400',     icon: XCircle },
  available:    { label: 'Available',    badgeClass: 'border-accent/40 text-accent',           dotClass: 'bg-accent',      icon: Plug },
  'coming-soon':{ label: 'Coming Soon',  badgeClass: 'border-muted-foreground/40 text-muted-foreground', dotClass: 'bg-muted-foreground', icon: Unplug },
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

export const IntegrationsCover: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const counts = {
    connected: INTEGRATIONS.filter(i => i.status === 'connected').length,
    available: INTEGRATIONS.filter(i => i.status === 'available').length,
    pending: INTEGRATIONS.filter(i => i.status === 'pending').length,
    errors: INTEGRATIONS.filter(i => i.status === 'error').length,
  };

  const filtered = INTEGRATIONS
    .filter(i => filter === 'All' || i.category === filter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));

  const renderCard = (integ: Integration) => {
    const cfg = statusConfig[integ.status];
    const isError = integ.status === 'error';
    const isPending = integ.status === 'pending';
    const isAvailable = integ.status === 'available';
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
        <div className="flex items-start gap-4">
          <div className={`p-2 rounded-lg ${
            isConnected ? 'bg-emerald-500/10' : isError ? 'bg-red-500/10' : isPending ? 'bg-yellow-500/10' : 'bg-muted/50'
          }`}>
            <integ.icon className={`w-5 h-5 ${
              isConnected ? 'text-emerald-400' : isError ? 'text-red-400' : isPending ? 'text-yellow-400' : 'text-accent'
            }`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{integ.name}</h4>
              <StatusBadge status={integ.status} demo={integ.demo} />
            </div>
            <p className="text-xs text-muted-foreground">{integ.description}</p>
            {integ.details && <p className="text-xs text-foreground/70 mt-1">{integ.details}</p>}
            {integ.lastSync && <p className="text-[10px] text-muted-foreground mt-1">Last sync: {integ.lastSync}</p>}
            {isError && integ.errorMessage && (
              <p className="text-[11px] text-red-400 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {integ.errorMessage}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {isConnected && (
              <>
                <button className="text-xs px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted transition-colors" title="Sync">
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button className="text-xs px-2.5 py-1.5 rounded-lg bg-muted/60 text-muted-foreground hover:bg-muted transition-colors" title="Configure">
                  <Settings className="w-3 h-3" />
                </button>
              </>
            )}
            {isError && (
              <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors font-medium">
                Fix Issue
              </button>
            )}
            {isPending && (
              <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors font-medium">
                Check Status
              </button>
            )}
            {isAvailable && (
              <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                Connect <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
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

      {/* Error section first */}
      {filtered.some(i => i.status === 'error') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-red-400 uppercase tracking-wider">Requires Attention</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'error').map(renderCard)}
          </div>
        </div>
      )}

      {/* Connected */}
      {filtered.some(i => i.status === 'connected') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Connections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'connected').map(renderCard)}
          </div>
        </div>
      )}

      {/* Pending */}
      {filtered.some(i => i.status === 'pending') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-yellow-400 uppercase tracking-wider">Pending</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'pending').map(renderCard)}
          </div>
        </div>
      )}

      {/* Available */}
      {filtered.some(i => i.status === 'available') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Available to Connect</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'available').map(renderCard)}
          </div>
        </div>
      )}

      {/* Coming Soon */}
      {filtered.some(i => i.status === 'coming-soon') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Coming Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'coming-soon').map(renderCard)}
          </div>
        </div>
      )}
    </motion.div>
  );
};
