import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { Shield, CheckCircle2, Clock, XCircle, AlertTriangle, Send, Upload, Eye, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

type KycFilter = 'all' | 'pending' | 'failed' | 'expiring' | 'completed';

export const KycKybDealTab: React.FC = () => {
  const { stakeholders } = usePIVTStore();
  const [filter, setFilter] = useState<KycFilter>('all');

  const verified = stakeholders.filter(s => s.kycStatus === 'verified').length;
  const pending = stakeholders.filter(s => s.kycStatus === 'pending').length;
  const failed = stakeholders.filter(s => s.kycStatus === 'failed').length;
  const total = stakeholders.length;
  const pct = Math.round((verified / total) * 100);

  // Simulated expiring count
  const expiring = 1;

  const filtered = stakeholders.filter(s => {
    if (filter === 'all') return true;
    if (filter === 'pending') return s.kycStatus === 'pending';
    if (filter === 'failed') return s.kycStatus === 'failed';
    if (filter === 'completed') return s.kycStatus === 'verified';
    if (filter === 'expiring') return s.id === 's3'; // demo: Sequoia expiring
    return true;
  });

  const entityType = (s: typeof stakeholders[0]) =>
    s.role.includes('Fund') || s.role.includes('Capital') || s.role.includes('Trust') || s.role.includes('Global') || s.role.includes('Private')
      ? 'Entity' : 'Individual';

  const missingDocs = (s: typeof stakeholders[0]) => {
    if (s.kycStatus === 'verified') return '—';
    if (s.kycStatus === 'pending') return 'ID Verification';
    return 'All Documents';
  };

  const filters: { key: KycFilter; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: total },
    { key: 'pending', label: 'Pending', count: pending },
    { key: 'failed', label: 'Failed', count: failed },
    { key: 'expiring', label: 'Expiring Soon', count: expiring },
    { key: 'completed', label: 'Completed', count: verified },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-accent" />
          KYC / KYB
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">Compliance verification operations console for this deal.</p>
      </div>

      {/* Progress Overview */}
      <motion.div {...fadeInUp} className="pivt-card p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">KYC Completion</span>
          <span className="font-mono text-sm font-semibold">{pct}%</span>
        </div>
        <Progress value={pct} className="h-2.5 mb-4" />
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Verified', value: verified, icon: CheckCircle2, color: 'text-validated' },
            { label: 'Pending', value: pending, icon: Clock, color: 'text-discrepancy' },
            { label: 'Failed', value: failed, icon: XCircle, color: 'text-blocking' },
            { label: 'Expiring Soon', value: expiring, icon: AlertTriangle, color: 'text-discrepancy' },
          ].map(stat => (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <div>
                <p className="text-lg font-semibold">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        {[
          { label: 'Send KYC Request', icon: Send },
          { label: 'Send Reminder', icon: Clock },
          { label: 'Upload Documents', icon: Upload },
          { label: 'Review Submission', icon: Eye },
        ].map(action => (
          <button
            key={action.label}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 text-sm font-medium hover:bg-muted transition-colors border border-border"
          >
            <action.icon className="w-3.5 h-3.5" />
            {action.label}
          </button>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted/50">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* KYC Worklist Table */}
      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-7 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Stakeholder</span>
            <span>Entity Type</span>
            <span className="text-center">KYC Status</span>
            <span className="text-center">Last Updated</span>
            <span className="text-center">Missing Docs</span>
            <span className="text-center">Action</span>
          </div>
        </div>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">No stakeholders match this filter.</div>
        )}
        {filtered.map((s) => (
          <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
            <div className="grid grid-cols-7 items-center">
              <div className="col-span-2">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <span className="text-sm text-muted-foreground">{entityType(s)}</span>
              <div className="flex justify-center">
                <Badge className={`text-[10px] ${
                  s.kycStatus === 'verified' ? 'bg-validated/10 text-validated' :
                  s.kycStatus === 'pending' ? 'bg-discrepancy/10 text-discrepancy' :
                  'bg-blocking/10 text-blocking'
                }`}>
                  {s.kycStatus === 'verified' ? 'Approved' : s.kycStatus === 'pending' ? 'Pending' : 'Failed'}
                </Badge>
              </div>
              <span className="text-center text-xs text-muted-foreground font-mono">2026-02-20</span>
              <span className="text-center text-xs text-muted-foreground">{missingDocs(s)}</span>
              <div className="flex justify-center gap-2">
                {s.kycStatus === 'pending' && (
                  <button className="text-xs text-accent hover:underline">Review</button>
                )}
                {s.kycStatus === 'failed' && (
                  <button className="text-xs text-blocking hover:underline">Request Docs</button>
                )}
                {s.kycStatus === 'verified' && (
                  <span className="text-xs text-validated">✓ Complete</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
