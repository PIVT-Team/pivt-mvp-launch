import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Plug, CheckCircle2, ExternalLink, Settings, Search,
  Edit, Shield, Key, Bell, Globe, Users, Lock, CreditCard,
  Zap, Database, FileText, ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'available' | 'coming-soon';
  icon: React.ElementType;
  category: string;
  details?: string;
  lastSync?: string;
}

const INTEGRATIONS: Integration[] = [
  { id: 'docusign', name: 'DocuSign', description: 'E-signature for deal documents', status: 'connected', icon: Edit, category: 'Legal', details: 'OAuth 2.0 — 12 envelopes sent this month', lastSync: '5 min ago' },
  { id: 'plaid', name: 'Plaid', description: 'Bank account verification & ACH', status: 'connected', icon: Shield, category: 'Banking', details: '28 accounts verified', lastSync: '1 hr ago' },
  { id: 'slack', name: 'Slack', description: 'Team notifications & deal alerts', status: 'connected', icon: Bell, category: 'Communication', details: '#pivt-deals, #pivt-alerts channels active', lastSync: '2 min ago' },
  { id: 'aws', name: 'AWS S3', description: 'Encrypted document storage', status: 'connected', icon: Lock, category: 'Storage', details: '2.4 TB stored across 3 buckets', lastSync: '30 sec ago' },
  { id: 'stripe', name: 'Stripe', description: 'Payment processing & payouts', status: 'available', icon: CreditCard, category: 'Payments' },
  { id: 'bloomberg', name: 'Bloomberg Terminal', description: 'Real-time market data & analytics', status: 'available', icon: Globe, category: 'Data' },
  { id: 'salesforce', name: 'Salesforce', description: 'CRM deal pipeline sync', status: 'available', icon: Globe, category: 'CRM' },
  { id: 'carta', name: 'Carta', description: 'Cap table management sync', status: 'coming-soon', icon: Users, category: 'Cap Table' },
  { id: 'iron-clad', name: 'Ironclad', description: 'Contract lifecycle management', status: 'coming-soon', icon: FileText, category: 'Legal' },
  { id: 'datasite', name: 'Datasite (Merrill)', description: 'Virtual data room integration', status: 'available', icon: Database, category: 'Data Room' },
  { id: 'allvue', name: 'Allvue Systems', description: 'Fund administration & reporting', status: 'coming-soon', icon: Zap, category: 'Fund Admin' },
];

const categories = ['All', ...Array.from(new Set(INTEGRATIONS.map(i => i.category)))];

export const IntegrationsCover: React.FC = () => {
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');

  const connectedCount = INTEGRATIONS.filter(i => i.status === 'connected').length;
  const filtered = INTEGRATIONS
    .filter(i => filter === 'All' || i.category === filter)
    .filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Integrations</h1>
          <p className="text-muted-foreground mt-1">Connect PIVT with your existing deal infrastructure</p>
        </div>
        <Badge variant="outline" className="border-validated/50 text-validated">
          <Plug className="w-3 h-3 mr-1" /> {connectedCount} Connected
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Connected', value: connectedCount, color: 'text-validated' },
          { label: 'Available', value: INTEGRATIONS.filter(i => i.status === 'available').length, color: 'text-accent' },
          { label: 'Coming Soon', value: INTEGRATIONS.filter(i => i.status === 'coming-soon').length, color: 'text-muted-foreground' },
        ].map(s => (
          <motion.div key={s.label} {...fadeInUp} className="pivt-card p-4 text-center">
            <p className={`pivt-stat text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Search + Filter */}
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
          {categories.map(cat => (
            <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === cat ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Connected */}
      {filtered.some(i => i.status === 'connected') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Connections</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'connected').map(integ => (
              <motion.div key={integ.id} {...fadeInUp} className="pivt-card p-5 border-validated/20">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-validated/10">
                    <integ.icon className="w-5 h-5 text-validated" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{integ.name}</h4>
                      <Badge variant="outline" className="text-[9px] border-validated/50 text-validated">connected</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{integ.description}</p>
                    {integ.details && <p className="text-xs text-foreground/70 mt-1">{integ.details}</p>}
                    {integ.lastSync && <p className="text-[10px] text-muted-foreground mt-1">Last sync: {integ.lastSync}</p>}
                  </div>
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                    <Settings className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Available */}
      {filtered.some(i => i.status === 'available') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Available to Connect</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'available').map(integ => (
              <motion.div key={integ.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <integ.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{integ.name}</h4>
                      <Badge variant="outline" className="text-[9px] border-accent/50 text-accent">available</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{integ.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{integ.category}</p>
                  </div>
                  <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors font-medium">
                    Connect <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Coming Soon */}
      {filtered.some(i => i.status === 'coming-soon') && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Coming Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.filter(i => i.status === 'coming-soon').map(integ => (
              <motion.div key={integ.id} {...fadeInUp} className="pivt-card p-5 opacity-60">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <integ.icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-sm">{integ.name}</h4>
                    <p className="text-xs text-muted-foreground">{integ.description}</p>
                  </div>
                  <Badge variant="outline" className="text-[9px] border-muted-foreground/50 text-muted-foreground">Coming Soon</Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};
