/**
 * OrchestrationShell — 3-column shell wrapper applied ONLY to deal-aware
 * orchestration tabs (Closing Checklist, Conditions Precedent, Signature
 * Packets, Closing Book).
 *
 * Layout:
 *   • Sticky LEFT  — Workspace Checklist quick-nav (categories + counts)
 *   • Center       — Active orchestration cover (children)
 *   • Sticky RIGHT — Next Required Action + Verification summary
 *
 * Visual language: 100% existing PIVT tokens. No new colors, no new card
 * styles. Uses `pivt-card`, semantic `accent` / `validated` / `blocking`
 * tokens, and the same typography scale used across covers.
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
  ListChecks, Scale, DollarSign, ShieldCheck, Cpu,
  AlertTriangle, ArrowRight, CheckCircle2, Clock, FileSignature,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePIVTStore, ActiveSection } from '@/stores/pivtStore';

const SECTION_LABEL: Partial<Record<ActiveSection, string>> = {
  'closing-checklist':   'Closing Checklist',
  'conditions-precedent':'Conditions Precedent',
  'signature-packets':   'Signature Packets',
  'closing-book':        'Closing Book',
};

const CATEGORIES = [
  { key: 'legal',       label: 'Legal',       icon: Scale,       tone: 'text-accent' },
  { key: 'financial',   label: 'Financial',   icon: DollarSign,  tone: 'text-validated' },
  { key: 'regulatory',  label: 'Regulatory',  icon: ShieldCheck, tone: 'text-warning' },
  { key: 'technical',   label: 'Technical',   icon: Cpu,         tone: 'text-muted-foreground' },
];

interface Props {
  children: React.ReactNode;
}

export const OrchestrationShell: React.FC<Props> = ({ children }) => {
  const { activeSection, setActiveSection, selectedDealId } = usePIVTStore();
  const sectionLabel = SECTION_LABEL[activeSection] ?? '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_300px] gap-8 lg:gap-10 px-6 lg:px-10 py-8 lg:py-10 w-full max-w-[1600px] mx-auto">
      {/* ──────────────────────────────────────────────────────────────── */}
      {/* LEFT — Workspace Checklist (sticky)                             */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-6">
          <div className="pivt-card p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <ListChecks className="w-4 h-4 text-accent" />
              <h3 className="text-[13px] font-semibold text-foreground">Workspace Checklist</h3>
            </div>
            <p className="text-[11px] text-muted-foreground/70 mb-5 leading-relaxed">
              0 of 0 conditions complete
            </p>

            <div className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-[12px] text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <cat.icon className={`w-3.5 h-3.5 ${cat.tone}`} />
                  <span className="flex-1 text-left">{cat.label}</span>
                  <span className="text-[10px] text-muted-foreground/50 font-mono">0</span>
                </button>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-border/40 space-y-1">
              <Button variant="ghost" size="sm" className="w-full justify-start h-9 text-[12px] text-muted-foreground hover:text-foreground">
                <ArrowRight className="w-3 h-3" /> Add item
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start h-9 text-[12px] text-muted-foreground hover:text-foreground">
                <ArrowRight className="w-3 h-3" /> Export PDF
              </Button>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="pivt-card p-6 shadow-sm">
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-3.5">
              Bulk Actions
            </h4>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start h-9 text-[12px]">
                Mark all reviewed
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start h-9 text-[12px]">
                Assign owners
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* CENTER — Active orchestration cover                             */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        className="min-w-0"
      >
        {/* Primary surface — the dedicated cover (Checklist / Packets / Book)
            owns the center column. Wrapped in a pivt-card so it reads as the
            main focus while left/right remain supporting context. */}
        <div className="pivt-card shadow-sm p-6 lg:p-8">
          {children}
        </div>
      </motion.section>

      {/* ──────────────────────────────────────────────────────────────── */}
      {/* RIGHT — Next Action + Verification (sticky)                     */}
      {/* ──────────────────────────────────────────────────────────────── */}
      <aside className="hidden lg:block">
        <div className="sticky top-6 space-y-6">
          {/* Next Required Action */}
          <div className="pivt-card p-6 shadow-sm border-accent/30">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-3.5 h-3.5 text-accent" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-accent">
                Next Required Action
              </h4>
            </div>
            <p className="text-[13px] font-semibold text-foreground leading-snug mb-2">
              {selectedDealId ? `Review ${sectionLabel || 'pending items'}` : 'Select a deal to begin'}
            </p>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed mb-4">
              {selectedDealId
                ? 'Resolve outstanding items to advance closing readiness.'
                : 'Pick an active deal from the breadcrumb above.'}
            </p>
            <Button
              size="sm"
              className="w-full h-9 text-[12px]"
              disabled={!selectedDealId}
              onClick={() => setActiveSection('workspace' as ActiveSection)}
            >
              Open Workspace
            </Button>
          </div>

          {/* Verification Summary */}
          <div className="pivt-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="w-3.5 h-3.5 text-validated" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                Verification
              </h4>
            </div>
            <div className="space-y-3">
              <Row icon={CheckCircle2} tone="text-validated" label="Verified" value="0" />
              <Row icon={Clock}        tone="text-warning"   label="Pending"  value="0" />
              <Row icon={AlertTriangle} tone="text-blocking" label="Failed"   value="0" />
            </div>
            <div className="mt-4 pt-4 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Readiness</span>
                <span className="text-[11px] font-mono text-muted-foreground">0%</span>
              </div>
              <Progress value={0} className="h-1" />
            </div>
          </div>

          {/* Contextual quick action */}
          <div className="pivt-card p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileSignature className="w-3.5 h-3.5 text-muted-foreground" />
              <h4 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {sectionLabel || 'Quick Actions'}
              </h4>
            </div>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              Progress and recent activity for this section appear here as items are completed.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">Live</Badge>
              <span className="text-[10px] text-muted-foreground/50">Last updated just now</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

const Row: React.FC<{ icon: React.ElementType; tone: string; label: string; value: string }> = ({
  icon: Icon, tone, label, value,
}) => (
  <div className="flex items-center justify-between text-[12px]">
    <span className="flex items-center gap-2 text-muted-foreground">
      <Icon className={`w-3 h-3 ${tone}`} />
      {label}
    </span>
    <span className="font-mono text-foreground">{value}</span>
  </div>
);
