import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { useSelectedDeal } from '@/stores/pivtStore';
import { useAuditStore, AuditEvent } from '@/stores/auditStore';
import { ExportAuditLogModal } from '../ExportAuditLogModal';
import {
  History, FileText, BarChart3, Download, Search,
  User, Shield, AlertTriangle, CheckCircle2, X,
  CreditCard, Users, GitCompare, Settings2, Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

const severityColors: Record<string, string> = {
  error: 'border-blocking/50 text-blocking bg-blocking/5',
  warning: 'border-discrepancy/50 text-discrepancy bg-discrepancy/5',
  info: 'border-muted-foreground/50 text-muted-foreground bg-muted/30',
};

const objectIcons: Record<string, React.ElementType> = {
  Deal: BarChart3, Stakeholder: Users, Document: FileText, Payment: CreditCard,
  Approval: CheckCircle2, Integration: Settings2, Escrow: Lock, KYC: Shield,
  Team: Users, Report: FileText, Waterfall: BarChart3,
};

const categoryFilters = [
  { id: 'all', label: 'All' },
  { id: 'user', label: 'User Actions' },
  { id: 'system', label: 'System' },
  { id: 'financial', label: 'Financial' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'approval', label: 'Approvals' },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const AuditCover: React.FC = () => {
  const { events, seedDemo } = useAuditStore();
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<AuditEvent | null>(null);

  useEffect(() => { seedDemo(); }, [seedDemo]);

  const filtered = useMemo(() =>
    events
      .filter((e) => filter === 'all' || e.category === filter)
      .filter((e) =>
        search === '' ||
        e.summary.toLowerCase().includes(search.toLowerCase()) ||
        e.actor_display_name.toLowerCase().includes(search.toLowerCase()) ||
        e.action.toLowerCase().includes(search.toLowerCase())
      ),
    [events, filter, search]
  );

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Audit Trail</h1>
          <p className="text-muted-foreground mt-1">Complete immutable log of all deal actions and system events</p>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="pivt-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
        >
          <Download className="w-4 h-4" /> Export Log
        </button>
      </div>

      {/* Immutability banner */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent/5 border border-accent/20 text-xs text-accent">
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>Append-only audit log. Events cannot be modified or deleted.</span>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit log..."
            className="w-full bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent/50"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categoryFilters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${filter === f.id ? 'bg-accent/10 text-accent font-medium' : 'text-muted-foreground hover:bg-muted/50'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event count */}
      <p className="text-xs text-muted-foreground">{filtered.length} events</p>

      {/* Event List */}
      <div className="pivt-card divide-y divide-border">
        {filtered.map((evt) => {
          const Icon = objectIcons[evt.object_type] || History;
          return (
            <motion.button
              key={evt.event_id}
              {...fadeInUp}
              onClick={() => setDetailEvent(evt)}
              className="w-full text-left p-4 flex items-start gap-4 hover:bg-muted/20 transition-colors"
            >
              <div className={`p-1.5 rounded-lg shrink-0 ${severityColors[evt.severity]}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm">{evt.summary}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground font-medium">{evt.actor_display_name}</span>
                  <span className="text-[10px] text-muted-foreground/60">({evt.actor_role})</span>
                  <span className="text-[10px] font-mono text-muted-foreground/50">{evt.action}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={`text-[9px] ${severityColors[evt.severity]}`}>{evt.severity}</Badge>
                <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{timeAgo(evt.timestamp)}</span>
              </div>
            </motion.button>
          );
        })}
        {filtered.length === 0 && (
          <div className="p-8 text-center text-sm text-muted-foreground">No events match your filters.</div>
        )}
      </div>

      {/* Event Detail Drawer */}
      <Sheet open={!!detailEvent} onOpenChange={(v) => { if (!v) setDetailEvent(null); }}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto" style={{ background: 'hsl(var(--card))' }}>
          {detailEvent && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base" style={{ color: 'hsl(var(--foreground))' }}>Event Details</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {([
                    ['Event ID', detailEvent.event_id],
                    ['Timestamp', new Date(detailEvent.timestamp).toLocaleString()],
                    ['Actor', `${detailEvent.actor_display_name} (${detailEvent.actor_role})`],
                    ['Actor Type', detailEvent.actor_type],
                    ['Action', detailEvent.action],
                    ['Object Type', detailEvent.object_type],
                    ['Object ID', detailEvent.object_id || '—'],
                    ['Deal ID', detailEvent.deal_id || 'Global'],
                    ['Severity', detailEvent.severity],
                    ['Source', detailEvent.source],
                    ['Category', detailEvent.category],
                    ['Correlation ID', detailEvent.correlation_id || '—'],
                  ] as [string, string][]).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                      <p className="text-sm font-mono break-all">{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Summary</p>
                  <p className="text-sm">{detailEvent.summary}</p>
                </div>

                {/* Before/After Diff */}
                {(detailEvent.before_state || detailEvent.after_state) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Before State</p>
                      <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-40 border border-border">
                        {detailEvent.before_state ? JSON.stringify(detailEvent.before_state, null, 2) : 'null'}
                      </pre>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">After State</p>
                      <pre className="text-[11px] font-mono bg-muted/50 rounded-lg p-3 overflow-auto max-h-40 border border-border">
                        {detailEvent.after_state ? JSON.stringify(detailEvent.after_state, null, 2) : 'null'}
                      </pre>
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Event Hash</p>
                  <code className="text-[10px] font-mono bg-muted/50 px-2 py-1 rounded break-all">{detailEvent.event_hash}</code>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ExportAuditLogModal open={exportOpen} onOpenChange={setExportOpen} />
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
              <div className="p-2 rounded-lg bg-muted/50"><FileText className="w-5 h-5 text-accent" /></div>
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
