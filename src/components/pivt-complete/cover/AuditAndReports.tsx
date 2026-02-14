import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import {
  History, FileText, BarChart3, Download, Filter, Search,
  Clock, User, Shield, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const AUDIT_EVENTS = [
  { time: '2 min ago', user: 'Alexandra Reed', action: 'Approved payout for Sarah Chen — $840M wire transfer', type: 'approval', severity: 'high' },
  { time: '8 min ago', user: 'System (Newton AI)', action: 'Waterfall Schedule v3 auto-validated — 0 discrepancies', type: 'validation', severity: 'info' },
  { time: '15 min ago', user: 'James Morrison', action: 'Uploaded Escrow Agreement amendment (v2)', type: 'document', severity: 'medium' },
  { time: '32 min ago', user: 'System (KYC Agent)', action: 'KYC verification failed for GIC Private Limited — OFAC flag', type: 'alert', severity: 'critical' },
  { time: '1 hr ago', user: 'David Park', action: 'Submitted buyer-side approval for Project ATLAS', type: 'approval', severity: 'high' },
  { time: '2 hr ago', user: 'Sarah Chen', action: 'Updated wire instructions — JPMorgan Chase routing', type: 'banking', severity: 'medium' },
  { time: '3 hr ago', user: 'System', action: 'Created new deal: Project CIPHER ($4.5B)', type: 'deal', severity: 'info' },
  { time: '5 hr ago', user: 'Emily Watson', action: 'Exported compliance report — Q4 2025', type: 'report', severity: 'info' },
  { time: '8 hr ago', user: 'System (Payment Gateway)', action: 'Executed wire: $224M to Tiger Global Management', type: 'payment', severity: 'high' },
  { time: '1 day ago', user: 'System (Escrow Agent)', action: 'Escrow funded: $280M deposited to JPMorgan escrow account', type: 'escrow', severity: 'high' },
  { time: '1 day ago', user: 'Alexandra Reed', action: 'Invited Emily Watson as viewer', type: 'team', severity: 'info' },
  { time: '2 days ago', user: 'System (Discrepancy Agent)', action: 'Detected ownership % mismatch: Tiger Global 8.0% vs 7.8%', type: 'alert', severity: 'medium' },
];

const severityColors: Record<string, string> = {
  critical: 'border-blocking/50 text-blocking bg-blocking/5',
  high: 'border-accent/50 text-accent bg-accent/5',
  medium: 'border-discrepancy/50 text-discrepancy bg-discrepancy/5',
  info: 'border-muted-foreground/50 text-muted-foreground bg-muted/30',
};

const typeIcons: Record<string, React.ElementType> = {
  approval: CheckCircle2, validation: Shield, document: FileText, alert: AlertTriangle,
  deal: BarChart3, banking: History, payment: History, escrow: History, report: FileText, team: User,
};

export const AuditCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = AUDIT_EVENTS
    .filter(e => filter === 'all' || e.type === filter || e.severity === filter)
    .filter(e => search === '' || e.action.toLowerCase().includes(search.toLowerCase()) || e.user.toLowerCase().includes(search.toLowerCase()));

  const types = ['all', ...new Set(AUDIT_EVENTS.map(e => e.type))];

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Trail</h1>
          <p className="text-muted-foreground mt-1">Complete immutable log of all deal actions and system events</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
          <Download className="w-4 h-4" /> Export Log
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search audit log..." className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent/50" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${filter === t ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Event List */}
      <div className="pivt-card divide-y divide-border">
        {filtered.map((evt, i) => {
          const Icon = typeIcons[evt.type] || History;
          return (
            <motion.div key={i} {...fadeInUp} className="p-4 flex items-start gap-4 hover:bg-muted/20 transition-colors">
              <div className={`p-1.5 rounded-lg ${severityColors[evt.severity]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{evt.action}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-medium">{evt.user}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[9px] ${severityColors[evt.severity]}`}>{evt.severity}</Badge>
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{evt.time}</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export const ReportsCover: React.FC = () => {
  const deal = useSelectedDeal();
  const reports = [
    { name: 'Deal Summary Report', desc: 'Comprehensive overview of deal terms, parties, and status', type: 'PDF', updated: '2026-02-14' },
    { name: 'Waterfall Distribution Report', desc: 'Detailed tier-by-tier breakdown with recipient allocations', type: 'PDF', updated: '2026-02-13' },
    { name: 'Compliance & KYC Report', desc: 'KYC/KYB status for all stakeholders with OFAC screening results', type: 'PDF', updated: '2026-02-12' },
    { name: 'Audit Trail Export', desc: 'Complete chronological log of all deal events and actions', type: 'CSV', updated: '2026-02-14' },
    { name: 'Escrow Statement', desc: 'Escrow funding, releases, and holdback schedule', type: 'PDF', updated: '2026-02-10' },
    { name: 'Payment Reconciliation', desc: 'Wire transfer execution details with bank confirmations', type: 'XLSX', updated: '2026-02-14' },
    { name: 'Risk Assessment Report', desc: 'Cross-deal risk analysis with scoring methodology', type: 'PDF', updated: '2026-02-11' },
    { name: 'Board Package', desc: 'Executive summary formatted for board presentation', type: 'PPTX', updated: '2026-02-13' },
  ];

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Generate and download deal reports for {deal.codeName}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(report => (
          <motion.div key={report.name} {...fadeInUp} className="pivt-card p-5 hover:shadow-md hover:border-accent/20 transition-all cursor-pointer group">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-muted/50">
                <FileText className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm group-hover:text-accent transition-colors">{report.name}</h4>
                  <Badge variant="outline" className="text-[9px] border-muted-foreground/50 text-muted-foreground">{report.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{report.desc}</p>
                <p className="text-[10px] text-muted-foreground mt-1">Updated: {report.updated}</p>
              </div>
              <Download className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
