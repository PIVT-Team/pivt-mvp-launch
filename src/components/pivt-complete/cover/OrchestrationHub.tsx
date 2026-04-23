import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { usePIVTStore, type ActiveSection } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import {
  ClipboardCheck,
  ShieldCheck,
  PenTool,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Rocket,
  Loader2,
} from 'lucide-react';

interface ChecklistRow { status: string }
interface ConditionRow { status: string }
interface PacketRow { status: string; packet_name: string | null; approval_side: string }

const statusBadge = (variant: 'ready' | 'progress' | 'blocking', label: string) => {
  const cls = variant === 'ready'
    ? 'bg-validated/10 text-validated'
    : variant === 'blocking'
      ? 'bg-blocking/10 text-blocking'
      : 'bg-discrepancy/10 text-discrepancy';
  return <Badge className={`text-[9px] ${cls}`}>{label}</Badge>;
};

export const OrchestrationHub: React.FC = () => {
  const { dealId, metrics, isDemoDeal } = useDealWorkspace();
  const setActiveSection = usePIVTStore(s => s.setActiveSection);
  const { toast } = useToast();

  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [packets, setPackets] = useState<PacketRow[]>([]);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    (async () => {
      const [chk, cond, pkt] = await Promise.all([
        supabase.from('closing_checklist_items').select('status').eq('deal_id', dealId),
        supabase.from('conditions').select('status').eq('deal_id', dealId),
        supabase.from('deal_approvals').select('status, packet_name, approval_side').eq('deal_id', dealId),
      ]);
      if (cancelled) return;
      setChecklist((chk.data as ChecklistRow[]) || []);
      setConditions((cond.data as ConditionRow[]) || []);
      setPackets((pkt.data as PacketRow[]) || []);
    })();
    return () => { cancelled = true; };
  }, [dealId]);

  const checklistStats = useMemo(() => {
    const total = checklist.length;
    const done = checklist.filter(c => c.status === 'satisfied' || c.status === 'waived').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { total, done, pct };
  }, [checklist]);

  const cpStats = useMemo(() => {
    const total = conditions.length;
    const satisfied = conditions.filter(c => {
      const s = (c.status as string).toLowerCase();
      return s === 'satisfied' || s === 'waived';
    }).length;
    const open = total - satisfied;
    const pct = total ? Math.round((satisfied / total) * 100) : 0;
    return { total, satisfied, open, pct };
  }, [conditions]);

  const sigStats = useMemo(() => {
    const total = packets.length;
    const completed = packets.filter(p => p.status === 'completed' || p.status === 'granted').length;
    const pending = packets.filter(p => ['sent', 'pending', 'viewed', 'in_progress'].includes(p.status)).length;
    return { total, completed, pending };
  }, [packets]);

  // Derive next actions (deterministic)
  const nextActions = useMemo(() => {
    const actions: { label: string; section: ActiveSection; tone: 'blocking' | 'progress' | 'ready' }[] = [];
    if (cpStats.open > 0) {
      actions.push({
        label: `${cpStats.open} condition${cpStats.open > 1 ? 's' : ''} precedent outstanding`,
        section: 'conditions-precedent',
        tone: 'blocking',
      });
    }
    if (checklistStats.total - checklistStats.done > 0) {
      const remaining = checklistStats.total - checklistStats.done;
      actions.push({
        label: `${remaining} checklist item${remaining > 1 ? 's' : ''} pending evidence`,
        section: 'closing-checklist',
        tone: 'progress',
      });
    }
    if (sigStats.pending > 0) {
      actions.push({
        label: `${sigStats.pending} signature packet${sigStats.pending > 1 ? 's' : ''} awaiting return`,
        section: 'signature-packets',
        tone: 'progress',
      });
    }
    if (metrics) {
      const wireRemaining = metrics.totalWireInstructions - metrics.verifiedWireInstructions;
      if (wireRemaining > 0) {
        actions.push({
          label: `${wireRemaining} wire instruction${wireRemaining > 1 ? 's' : ''} awaiting verification`,
          section: 'execution',
          tone: 'blocking',
        });
      }
      const apvRemaining = metrics.totalApprovals - metrics.grantedApprovals;
      if (apvRemaining > 0) {
        actions.push({
          label: `${apvRemaining} approval${apvRemaining > 1 ? 's' : ''} pending sign-off`,
          section: 'signature-packets',
          tone: 'progress',
        });
      }
    }
    return actions.slice(0, 4);
  }, [cpStats, checklistStats, sigStats, metrics]);

  // One-Click Close gating
  const closeGates = useMemo(() => {
    const items = [
      { label: 'All conditions precedent satisfied', met: cpStats.total > 0 && cpStats.open === 0 },
      { label: 'Closing checklist complete', met: checklistStats.total > 0 && checklistStats.done === checklistStats.total },
      { label: 'All signature packets executed', met: sigStats.total > 0 && sigStats.completed === sigStats.total },
      { label: 'Wire instructions verified', met: !!metrics && metrics.totalWireInstructions > 0 && metrics.verifiedWireInstructions === metrics.totalWireInstructions },
      { label: 'Approvals granted', met: !!metrics && metrics.totalApprovals > 0 && metrics.grantedApprovals === metrics.totalApprovals },
    ];
    return items;
  }, [cpStats, checklistStats, sigStats, metrics]);

  const allGatesMet = closeGates.every(g => g.met);
  const failedGates = closeGates.filter(g => !g.met);

  const handleOneClickClose = async () => {
    if (!allGatesMet) {
      toast({
        title: 'Cannot trigger close',
        description: `${failedGates.length} gate${failedGates.length > 1 ? 's' : ''} not yet satisfied.`,
        variant: 'destructive',
      });
      return;
    }
    if (isDemoDeal) {
      toast({ title: 'Demo deal', description: 'Close simulated. No funds will move.' });
      return;
    }
    setClosing(true);
    // Route to execution → wire pack for actual disbursement trigger
    setTimeout(() => {
      setClosing(false);
      setActiveSection('execution');
      toast({
        title: 'Validation passed',
        description: 'Routing to Execution to release disbursements.',
      });
    }, 600);
  };

  const summaryCards: {
    key: string;
    title: string;
    icon: React.ElementType;
    pct: number;
    primary: string;
    secondary: string;
    badge: React.ReactNode;
    section: ActiveSection;
  }[] = [
    {
      key: 'checklist',
      title: 'Closing Checklist',
      icon: ClipboardCheck,
      pct: checklistStats.pct,
      primary: `${checklistStats.done}/${checklistStats.total || 0}`,
      secondary: checklistStats.total === 0 ? 'No items yet' : `${checklistStats.total - checklistStats.done} remaining`,
      badge: checklistStats.total === 0
        ? statusBadge('progress', 'empty')
        : checklistStats.pct === 100
          ? statusBadge('ready', 'complete')
          : statusBadge('progress', `${checklistStats.pct}%`),
      section: 'closing-checklist',
    },
    {
      key: 'cp',
      title: 'Conditions Precedent',
      icon: ShieldCheck,
      pct: cpStats.pct,
      primary: `${cpStats.satisfied}/${cpStats.total || 0}`,
      secondary: cpStats.total === 0 ? 'None tracked' : `${cpStats.open} open`,
      badge: cpStats.total === 0
        ? statusBadge('progress', 'empty')
        : cpStats.open === 0
          ? statusBadge('ready', 'satisfied')
          : statusBadge('blocking', `${cpStats.open} open`),
      section: 'conditions-precedent',
    },
    {
      key: 'sigs',
      title: 'Pending Signatures',
      icon: PenTool,
      pct: sigStats.total ? Math.round((sigStats.completed / sigStats.total) * 100) : 0,
      primary: `${sigStats.completed}/${sigStats.total || 0}`,
      secondary: sigStats.total === 0 ? 'No packets' : `${sigStats.pending} awaiting`,
      badge: sigStats.total === 0
        ? statusBadge('progress', 'none')
        : sigStats.pending === 0
          ? statusBadge('ready', 'executed')
          : statusBadge('progress', `${sigStats.pending} pending`),
      section: 'signature-packets',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Orchestration Hub</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Live readiness across closing, conditions and signatures</p>
        </div>
        <Badge variant="outline" className="text-[10px] font-mono">
          {closeGates.filter(g => g.met).length}/{closeGates.length} gates
        </Badge>
      </div>

      {/* Summary cards — match existing pivt-card grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map(card => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.key}
              {...fadeInUp}
              onClick={() => setActiveSection(card.section)}
              className="pivt-card p-5 text-left hover:border-accent/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-accent" />
                </div>
                {card.badge}
              </div>
              <p className="pivt-metric-label">{card.title}</p>
              <p className="text-xl font-semibold mt-1 font-mono" style={{ letterSpacing: '-0.02em' }}>
                {card.primary}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{card.secondary}</p>
              <Progress value={card.pct} className="h-1 mt-3" />
              <div className="flex items-center gap-1 text-[10px] text-accent mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Next Actions + One-Click Close */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div {...fadeInUp} className="pivt-card p-5 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-discrepancy" />
            <h4 className="text-sm font-semibold">Next Actions</h4>
            <span className="text-[10px] text-muted-foreground ml-auto">{nextActions.length} item{nextActions.length !== 1 ? 's' : ''}</span>
          </div>
          {nextActions.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-validated py-4">
              <CheckCircle2 className="w-4 h-4" />
              All orchestration steps clear — ready to close.
            </div>
          ) : (
            <div className="space-y-2">
              {nextActions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSection(a.section)}
                  className={`w-full flex items-center gap-2 p-3 rounded-lg border text-left transition-all hover:border-accent/40 ${
                    a.tone === 'blocking'
                      ? 'border-blocking/20 bg-blocking/4'
                      : 'border-discrepancy/20 bg-discrepancy/4'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${a.tone === 'blocking' ? 'bg-blocking' : 'bg-discrepancy'}`} />
                  <span className="text-xs flex-1">{a.label}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </motion.div>

        <motion.div {...fadeInUp} className="pivt-card p-5 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-semibold">One-Click Close</h4>
          </div>
          <div className="space-y-1.5 mb-4 flex-1">
            {closeGates.map((g, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                {g.met ? (
                  <CheckCircle2 className="w-3 h-3 text-validated shrink-0" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className={g.met ? 'text-foreground' : 'text-muted-foreground'}>{g.label}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={handleOneClickClose}
            disabled={closing}
            className="w-full gap-2"
            variant={allGatesMet ? 'default' : 'outline'}
            size="sm"
          >
            {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
            {closing ? 'Validating…' : allGatesMet ? 'Trigger Disbursement' : 'Validate & Close'}
          </Button>
          {!allGatesMet && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              {failedGates.length} gate{failedGates.length !== 1 ? 's' : ''} remaining
            </p>
          )}
        </motion.div>
      </div>
    </div>
  );
};
