/**
 * Newton — Deal Intelligence Panel
 * Active monitoring, Deep Deal Scan, discrepancy management, and approval tracking.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, springConfig } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  Activity, AlertTriangle, CheckCircle2, Clock, Info,
  ArrowRight, Play, Loader2, RefreshCw, Sparkles,
  FileWarning, ChevronDown, ChevronUp, ExternalLink,
  XCircle, Check, Zap, FileSearch, ClipboardCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentFinding {
  id: string;
  rule_key: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  affected_entities: { type: string; id: string; label: string }[];
  expected_value?: string;
  actual_value?: string;
  recommendation: string;
}

interface AgentRun {
  id: string;
  deal_id: string;
  agent_type: string;
  agent_version: string;
  status: string;
  triggered_by: string | null;
  input_snapshot: Record<string, any>;
  findings: AgentFinding[];
  finding_count: number;
  critical_count: number;
  summary_text: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
}

interface Discrepancy {
  id: string;
  deal_id: string;
  rule_key: string;
  severity: string;
  message: string;
  status: string;
  object_type: string;
  object_id: string;
  details: Record<string, any>;
  created_at: string;
}

// ─── Severity Styling ────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  critical: { bg: 'bg-blocking/6', text: 'text-blocking', border: 'border-blocking/20', icon: ShieldX },
  high: { bg: 'bg-discrepancy/6', text: 'text-discrepancy', border: 'border-discrepancy/20', icon: ShieldAlert },
  medium: { bg: 'bg-amber-500/6', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-400/20', icon: AlertTriangle },
  low: { bg: 'bg-muted/40', text: 'text-muted-foreground', border: 'border-border', icon: Info },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  open: { label: 'Open', className: 'bg-blocking/10 text-blocking border-blocking/20' },
  acknowledged: { label: 'Acknowledged', className: 'bg-discrepancy/10 text-discrepancy border-discrepancy/20' },
  resolved: { label: 'Resolved', className: 'bg-validated/10 text-validated border-validated/20' },
};

// ─── Deal Health Indicator ───────────────────────────────────────────────────

const DealHealthCard: React.FC<{
  latestRun: AgentRun | null;
  openDiscrepancies: number;
  criticalCount: number;
}> = ({ latestRun, openDiscrepancies, criticalCount }) => {
  const getHealthStatus = () => {
    if (!latestRun) return { level: 'unknown', label: 'Awaiting First Scan', color: 'text-muted-foreground', bg: 'bg-muted/40', Icon: Shield, summary: 'Run a Deep Deal Scan to assess this transaction.' };
    if (criticalCount > 0) return { level: 'critical', label: 'Critical Issues Found', color: 'text-blocking', bg: 'bg-blocking/6', Icon: ShieldX, summary: `${criticalCount} critical issue${criticalCount !== 1 ? 's' : ''} require immediate attention before this deal can close.` };
    if (openDiscrepancies > 3) return { level: 'warning', label: 'Needs Attention', color: 'text-discrepancy', bg: 'bg-discrepancy/6', Icon: ShieldAlert, summary: `${openDiscrepancies} open discrepancies detected. Review and resolve before proceeding.` };
    if (openDiscrepancies > 0) return { level: 'caution', label: 'Minor Issues', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/6', Icon: AlertTriangle, summary: `${openDiscrepancies} minor issue${openDiscrepancies !== 1 ? 's' : ''} found — not blocking, but should be reviewed.` };
    return { level: 'healthy', label: 'Ready to Close', color: 'text-validated', bg: 'bg-validated/6', Icon: ShieldCheck, summary: 'All checks passed. No discrepancies detected. This deal is clear to proceed.' };
  };

  const health = getHealthStatus();
  const { Icon } = health;

  return (
    <motion.div {...fadeInUp} className={cn('pivt-card p-5 border', health.bg, 'border-border')}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center', health.bg)}>
            <Icon className={cn('w-5 h-5', health.color)} />
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Deal Health</p>
            <p className={cn('text-lg font-semibold tracking-tight', health.color)}>{health.label}</p>
          </div>
        </div>
        {latestRun && (
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Last scan</p>
            <p className="text-xs font-mono text-muted-foreground">
              {latestRun.completed_at
                ? new Date(latestRun.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Plain-English summary */}
      <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{health.summary}</p>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center">
          <p className="font-mono text-xl font-semibold">{openDiscrepancies}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Open Issues</p>
        </div>
        <div className="text-center">
          <p className={cn('font-mono text-xl font-semibold', criticalCount > 0 ? 'text-blocking' : '')}>
            {criticalCount}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Critical</p>
        </div>
        <div className="text-center">
          <p className="font-mono text-xl font-semibold">
            {latestRun?.finding_count ?? '—'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Findings</p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Agent Findings Summary ──────────────────────────────────────────────────

const AgentFindingsCard: React.FC<{
  run: AgentRun | null;
  isRunning: boolean;
  onRunAgent: () => void;
}> = ({ run, isRunning, onRunAgent }) => {
  const [expanded, setExpanded] = useState(false);

  if (!run && !isRunning) {
    return (
      <motion.div {...fadeInUp} className="pivt-card p-5 border border-dashed border-border">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="w-12 h-12 rounded-xl bg-accent/8 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">Funds Flow Validation</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
              Run the AI agent to validate payout instructions, reconcile wire amounts, and detect discrepancies.
            </p>
          </div>
          <Button onClick={onRunAgent} size="sm" className="mt-2 gap-2">
            <Play className="w-3.5 h-3.5" />
            Run Validation
          </Button>
        </div>
      </motion.div>
    );
  }

  const topFindings = run?.findings?.slice(0, expanded ? undefined : 5) || [];
  const hasMore = (run?.findings?.length || 0) > 5;

  return (
    <motion.div {...fadeInUp} className="pivt-card border border-border overflow-hidden">
      {/* Header */}
      <div className="p-5 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <p className="text-sm font-semibold">Agent Findings</p>
            {run && (
              <Badge variant="outline" className="text-[9px] px-1.5">
                v{run.agent_version}
              </Badge>
            )}
          </div>
          {run?.status === 'completed' && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {run.finding_count} finding{run.finding_count !== 1 ? 's' : ''} · {run.duration_ms}ms
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRunAgent}
          disabled={isRunning}
          className="gap-1.5 text-xs"
        >
          {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          {isRunning ? 'Running…' : 'Re-run'}
        </Button>
      </div>

      {/* AI Summary */}
      {run?.summary_text && (
        <div className="px-5 pb-4">
          <div className="rounded-lg bg-accent/5 border border-accent/10 p-3.5">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-accent mt-0.5 shrink-0" />
              <p className="text-xs leading-relaxed text-foreground/80">{run.summary_text}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isRunning && !run && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
            <Loader2 className="w-4 h-4 text-accent animate-spin" />
            <div>
              <p className="text-xs font-medium">Validating funds flow…</p>
              <p className="text-[10px] text-muted-foreground">Analyzing wire instructions, cap table, and obligations</p>
            </div>
          </div>
        </div>
      )}

      {/* Findings List */}
      {topFindings.length > 0 && (
        <div className="border-t border-border">
          <div className="divide-y divide-border">
            {topFindings.map((finding) => {
              const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.low;
              const SevIcon = sev.icon;
              return (
                <div key={finding.id} className={cn('px-5 py-3.5', sev.bg)}>
                  <div className="flex items-start gap-2.5">
                    <SevIcon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', sev.text)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold truncate">{finding.title}</p>
                        <Badge variant="outline" className={cn('text-[8px] px-1 py-0 shrink-0', sev.text, sev.border)}>
                          {finding.severity}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{finding.description}</p>
                      {finding.expected_value && finding.actual_value && (
                        <div className="flex gap-4 mt-1.5">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Expected: <span className="text-foreground">{finding.expected_value}</span>
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            Actual: <span className={sev.text}>{finding.actual_value}</span>
                          </span>
                        </div>
                      )}
                      <p className="text-[10px] text-accent mt-1.5 flex items-center gap-1">
                        <ArrowRight className="w-2.5 h-2.5" />
                        {finding.recommendation}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full px-5 py-2.5 flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors border-t border-border"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              {expanded ? 'Show less' : `Show ${run!.findings.length - 5} more`}
            </button>
          )}
        </div>
      )}

      {/* Clean bill */}
      {run?.status === 'completed' && run.finding_count === 0 && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-validated/5 border border-validated/15">
            <CheckCircle2 className="w-5 h-5 text-validated" />
            <div>
              <p className="text-xs font-medium text-validated">All checks passed</p>
              <p className="text-[10px] text-muted-foreground">No funds flow discrepancies detected.</p>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {run?.status === 'failed' && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 p-4 rounded-lg bg-blocking/5 border border-blocking/15">
            <XCircle className="w-4 h-4 text-blocking" />
            <div>
              <p className="text-xs font-medium text-blocking">Agent failed</p>
              <p className="text-[10px] text-muted-foreground">{run.error_message || 'Unknown error'}</p>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

// ─── Recommended Next Step ───────────────────────────────────────────────────

const RecommendedActionCard: React.FC<{ run: AgentRun | null }> = ({ run }) => {
  if (!run || run.finding_count === 0) return null;

  // Pick the highest-severity finding's recommendation
  const topFinding = run.findings?.[0];
  if (!topFinding) return null;

  const sev = SEVERITY_CONFIG[topFinding.severity] || SEVERITY_CONFIG.medium;

  return (
    <motion.div {...fadeInUp} className="pivt-card p-5 border border-accent/15 bg-accent/3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
          <ArrowRight className="w-4 h-4 text-accent" />
        </div>
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Recommended Next Step</p>
          <p className="text-sm font-semibold mt-1">{topFinding.recommendation}</p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={cn('text-[9px]', sev.text, sev.border)}>
              {topFinding.severity} priority
            </Badge>
            <span className="text-[10px] text-muted-foreground">from: {topFinding.title}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Agent Activity Log ──────────────────────────────────────────────────────

const AgentActivityLog: React.FC<{ runs: AgentRun[] }> = ({ runs }) => {
  if (runs.length === 0) {
    return (
      <div className="pivt-card p-5 border border-border">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-3">Agent Activity</p>
        <p className="text-xs text-muted-foreground text-center py-4">No agent runs recorded yet.</p>
      </div>
    );
  }

  const statusIcon: Record<string, React.ElementType> = {
    completed: CheckCircle2,
    failed: XCircle,
    running: Loader2,
    queued: Clock,
  };

  const statusColor: Record<string, string> = {
    completed: 'text-validated',
    failed: 'text-blocking',
    running: 'text-accent',
    queued: 'text-muted-foreground',
  };

  return (
    <div className="pivt-card border border-border overflow-hidden">
      <div className="p-5 pb-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Agent Activity</p>
      </div>
      <div className="divide-y divide-border">
        {runs.slice(0, 8).map((run) => {
          const Icon = statusIcon[run.status] || Clock;
          const color = statusColor[run.status] || 'text-muted-foreground';
          return (
            <div key={run.id} className="px-5 py-3 flex items-center gap-3">
              <Icon className={cn('w-3.5 h-3.5 shrink-0', color, run.status === 'running' && 'animate-spin')} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium truncate">
                    {run.agent_type === 'funds_flow_validation' ? 'Funds Flow Validation' : run.agent_type}
                  </p>
                  <Badge variant="outline" className={cn('text-[8px] px-1 py-0', color)}>
                    {run.status}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {run.finding_count} finding{run.finding_count !== 1 ? 's' : ''}
                  {run.critical_count > 0 && ` · ${run.critical_count} critical`}
                  {run.duration_ms ? ` · ${run.duration_ms}ms` : ''}
                </p>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                {run.completed_at
                  ? new Date(run.completed_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : run.started_at
                    ? new Date(run.started_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Discrepancies Panel ─────────────────────────────────────────────────────

const DiscrepanciesPanel: React.FC<{
  discrepancies: Discrepancy[];
  onResolve: (id: string) => void;
  onAcknowledge: (id: string) => void;
}> = ({ discrepancies, onResolve, onAcknowledge }) => {
  const open = discrepancies.filter((d) => d.status === 'open');
  const acknowledged = discrepancies.filter((d) => d.status === 'acknowledged');
  const resolved = discrepancies.filter((d) => d.status === 'resolved');

  const renderGroup = (label: string, items: Discrepancy[], showActions: boolean) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-1">{label} ({items.length})</p>
        {items.map((d) => {
          const sev = SEVERITY_CONFIG[d.severity] || SEVERITY_CONFIG.low;
          const SevIcon = sev.icon;
          const statusBadge = STATUS_BADGES[d.status] || STATUS_BADGES.open;
          return (
            <motion.div
              key={d.id}
              layout
              className={cn('pivt-card p-4 border', sev.border, sev.bg)}
            >
              <div className="flex items-start gap-2.5">
                <SevIcon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', sev.text)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold">{d.message}</p>
                    <Badge variant="outline" className={cn('text-[8px] px-1 py-0', sev.text, sev.border)}>
                      {d.severity}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[8px] px-1 py-0', statusBadge.className)}>
                      {statusBadge.label}
                    </Badge>
                  </div>
                  {d.details?.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {d.details.description}
                    </p>
                  )}
                  {d.details?.recommendation && (
                    <p className="text-[10px] text-accent mt-1.5 flex items-center gap-1">
                      <ArrowRight className="w-2.5 h-2.5" />
                      {d.details.recommendation}
                    </p>
                  )}
                  {showActions && (
                    <div className="flex items-center gap-2 mt-2.5">
                      {d.status === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onAcknowledge(d.id)}
                          className="h-6 text-[10px] px-2 gap-1"
                        >
                          <Check className="w-2.5 h-2.5" />
                          Acknowledge
                        </Button>
                      )}
                      {(d.status === 'open' || d.status === 'acknowledged') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onResolve(d.id)}
                          className="h-6 text-[10px] px-2 gap-1 text-validated border-validated/30 hover:bg-validated/10"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  )}
                  <p className="text-[9px] text-muted-foreground/60 mt-1.5 font-mono">
                    {d.rule_key} · {new Date(d.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="pivt-card border border-border overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Discrepancies</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Agent-detected issues requiring review
          </p>
        </div>
        <div className="flex items-center gap-2">
          {open.length > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5">
              {open.length} open
            </Badge>
          )}
        </div>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {discrepancies.length === 0 ? (
          <div className="text-center py-6">
            <ShieldCheck className="w-8 h-8 text-validated/40 mx-auto" />
            <p className="text-xs text-muted-foreground mt-2">No agent-detected discrepancies.</p>
          </div>
        ) : (
          <>
            {renderGroup('Open', open, true)}
            {renderGroup('Acknowledged', acknowledged, true)}
            {renderGroup('Resolved', resolved, false)}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Deal Selector ───────────────────────────────────────────────────────────

interface DealOption {
  id: string;
  deal_name: string;
  deal_number: string;
  status: string;
  is_demo: boolean;
}

const DealSelector: React.FC<{
  deals: DealOption[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  loading: boolean;
}> = ({ deals, selectedId, onSelect, loading }) => (
  <div className="flex items-center gap-2">
    <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground shrink-0">Deal:</span>
    <select
      value={selectedId || ''}
      onChange={(e) => onSelect(e.target.value)}
      disabled={loading || deals.length === 0}
      className="flex-1 h-8 rounded-lg border border-border bg-card px-2.5 pr-7 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 appearance-none cursor-pointer truncate"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
    >
      {deals.length === 0 && <option value="">No deals available</option>}
      {deals.filter(d => d.is_demo).length > 0 && (
        <optgroup label="Demo Deals">
          {deals.filter(d => d.is_demo).map(d => (
            <option key={d.id} value={d.id}>{d.deal_name} ({d.deal_number})</option>
          ))}
        </optgroup>
      )}
      {deals.filter(d => !d.is_demo).length > 0 && (
        <optgroup label="Your Deals">
          {deals.filter(d => !d.is_demo).map(d => (
            <option key={d.id} value={d.id}>{d.deal_name} ({d.deal_number})</option>
          ))}
        </optgroup>
      )}
    </select>
  </div>
);

// ─── Agent Registry ──────────────────────────────────────────────────────────

interface AgentDef {
  key: string;
  label: string;
  icon: React.ElementType;
  edgeFunction: string | null; // null = coming soon
  description: string;
}

const AGENT_REGISTRY: AgentDef[] = [
  { key: 'funds_flow', label: 'Funds Flow Agent', icon: Activity, edgeFunction: 'funds-flow-agent', description: 'Wire reconciliation & payout validation' },
  { key: 'document', label: 'Document Agent', icon: FileSearch, edgeFunction: null, description: 'Contract completeness & clause extraction' },
  { key: 'closing_readiness', label: 'Closing Readiness Agent', icon: ClipboardCheck, edgeFunction: null, description: 'Pre-closing condition & approval check' },
];

// ─── Full Deal Analysis Card ─────────────────────────────────────────────────

const FullDealAnalysisCard: React.FC<{
  onRun: () => void;
  isRunning: boolean;
  agentStatuses: Record<string, 'idle' | 'running' | 'done' | 'error' | 'unavailable'>;
}> = ({ onRun, isRunning, agentStatuses }) => {
  const completedCount = Object.values(agentStatuses).filter(s => s === 'done').length;
  const totalAvailable = AGENT_REGISTRY.filter(a => a.edgeFunction).length;
  const hasResults = completedCount > 0;

  return (
    <motion.div {...fadeInUp} className="pivt-card border border-accent/20 overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-accent via-accent/60 to-accent/20" />

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
              <Zap className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-sm font-semibold">Run Full Deal Analysis</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Execute all available agents in parallel
              </p>
            </div>
          </div>
          <Button
            onClick={onRun}
            disabled={isRunning}
            size="sm"
            className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Run All Agents
              </>
            )}
          </Button>
        </div>

        {/* Agent pipeline */}
        <div className="mt-4 space-y-2">
          {AGENT_REGISTRY.map((agent) => {
            const status = agentStatuses[agent.key] || 'idle';
            const available = !!agent.edgeFunction;
            const AgentIcon = agent.icon;

            return (
              <div
                key={agent.key}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all',
                  status === 'running' ? 'border-accent/30 bg-accent/5' :
                  status === 'done' ? 'border-validated/20 bg-validated/3' :
                  status === 'error' ? 'border-blocking/20 bg-blocking/3' :
                  !available ? 'border-border bg-muted/20 opacity-60' :
                  'border-border bg-card'
                )}
              >
                <AgentIcon className={cn(
                  'w-4 h-4 shrink-0',
                  status === 'running' ? 'text-accent animate-pulse' :
                  status === 'done' ? 'text-validated' :
                  status === 'error' ? 'text-blocking' :
                  'text-muted-foreground'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{agent.label}</p>
                  <p className="text-[10px] text-muted-foreground">{agent.description}</p>
                </div>
                <div className="shrink-0">
                  {status === 'running' && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
                  {status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-validated" />}
                  {status === 'error' && <XCircle className="w-3.5 h-3.5 text-blocking" />}
                  {!available && (
                    <Badge variant="outline" className="text-[8px] px-1.5 py-0 text-muted-foreground border-border">
                      Coming Soon
                    </Badge>
                  )}
                  {available && status === 'idle' && (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress summary */}
        {(isRunning || hasResults) && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-accent"
                initial={{ width: 0 }}
                animate={{ width: `${totalAvailable > 0 ? (completedCount / totalAvailable) * 100 : 0}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {completedCount}/{totalAvailable}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const NewtonAgentPanel: React.FC = () => {
  const { dealId: contextDealId } = useDealWorkspace();
  const [allDeals, setAllDeals] = useState<DealOption[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | undefined>(contextDealId);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isFullRunning, setIsFullRunning] = useState(false);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, 'idle' | 'running' | 'done' | 'error' | 'unavailable'>>({});
  const [loading, setLoading] = useState(true);
  const [dealsLoading, setDealsLoading] = useState(true);

  // Sync context deal id when it changes
  useEffect(() => {
    if (contextDealId) setSelectedDealId(contextDealId);
  }, [contextDealId]);

  // Fetch all available deals for the selector
  useEffect(() => {
    const fetchDeals = async () => {
      setDealsLoading(true);
      const { data } = await supabase
        .from('deals')
        .select('id, deal_name, deal_number, status, is_demo')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (data) {
        setAllDeals(data as DealOption[]);
        if (!selectedDealId && data.length > 0) {
          setSelectedDealId(data[0].id);
        }
      }
      setDealsLoading(false);
    };
    fetchDeals();
  }, []);

  // Reset state when deal changes
  useEffect(() => {
    setRuns([]);
    setDiscrepancies([]);
    setAgentStatuses({});
  }, [selectedDealId]);

  // Fetch agent runs and discrepancies for selected deal
  const fetchData = useCallback(async () => {
    if (!selectedDealId) { setLoading(false); return; }
    setLoading(true);

    const [runsRes, discRes] = await Promise.all([
      supabase
        .from('agent_runs')
        .select('*')
        .eq('deal_id', selectedDealId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('discrepancies')
        .select('*')
        .eq('deal_id', selectedDealId)
        .like('rule_key', 'agent.funds_flow.%')
        .order('created_at', { ascending: false }),
    ]);

    const agentRuns = (runsRes.data || []) as unknown as AgentRun[];
    const discs = (discRes.data || []) as unknown as Discrepancy[];

    // Debug logging for development verification
    console.log('[Newton] selectedDealId:', selectedDealId);
    console.log('[Newton] agent_runs count:', agentRuns.length);
    console.log('[Newton] discrepancies count:', discs.length);

    setRuns(agentRuns);
    setDiscrepancies(discs);
    setLoading(false);
  }, [selectedDealId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Run agent with retry logic
  const invokeWithRetry = async (fnName: string, body: Record<string, any>, retries = 2): Promise<{ data: any; error: any }> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      const { data, error } = await supabase.functions.invoke(fnName, { body });
      if (!error) return { data, error: null };
      // Only retry on transient errors (network / 5xx)
      if (attempt < retries && (!data || error.message?.includes('network') || error.message?.includes('5'))) {
        console.warn(`[Newton] Retry ${attempt + 1}/${retries} for ${fnName}`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return { data, error };
    }
    return { data: null, error: { message: 'Max retries exceeded' } };
  };

  const handleRunAgent = async () => {
    if (!selectedDealId || isRunning) return;
    setIsRunning(true);

    try {
      const { data, error } = await invokeWithRetry('funds-flow-agent', { deal_id: selectedDealId });

      if (error) {
        toast.error('Agent failed to start', { description: error.message });
        setIsRunning(false);
        return;
      }

      if (data && !data.success) {
        toast.error('Agent error', { description: data.error });
        setIsRunning(false);
        return;
      }

      toast.success('Validation complete', {
        description: `${data.finding_count} finding${data.finding_count !== 1 ? 's' : ''} detected.`,
      });

      await fetchData();
    } catch (e) {
      toast.error('Failed to run agent');
      console.error(e);
    } finally {
      setIsRunning(false);
    }
  };

  // Run Full Deal Analysis — all available agents in parallel
  const handleFullAnalysis = async () => {
    if (!selectedDealId || isFullRunning) return;
    setIsFullRunning(true);

    // Initialize statuses
    const initStatuses: Record<string, 'idle' | 'running' | 'done' | 'error' | 'unavailable'> = {};
    AGENT_REGISTRY.forEach(a => {
      initStatuses[a.key] = a.edgeFunction ? 'running' : 'unavailable';
    });
    setAgentStatuses(initStatuses);

    const availableAgents = AGENT_REGISTRY.filter(a => a.edgeFunction);

    const results = await Promise.allSettled(
      availableAgents.map(async (agent) => {
        try {
          const { data, error } = await invokeWithRetry(agent.edgeFunction!, { deal_id: selectedDealId });

          if (error || (data && !data.success)) {
            setAgentStatuses(prev => ({ ...prev, [agent.key]: 'error' }));
            return { agent: agent.key, success: false, error: error?.message || data?.error };
          }

          setAgentStatuses(prev => ({ ...prev, [agent.key]: 'done' }));
          return { agent: agent.key, success: true, findings: data?.finding_count || 0 };
        } catch (e) {
          setAgentStatuses(prev => ({ ...prev, [agent.key]: 'error' }));
          return { agent: agent.key, success: false, error: (e as Error).message };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled' && (r.value as any)?.success).length;
    const totalFindings = results
      .filter(r => r.status === 'fulfilled' && (r.value as any)?.success)
      .reduce((sum, r) => sum + ((r as any).value?.findings || 0), 0);

    if (successCount === availableAgents.length) {
      toast.success('Full analysis complete', {
        description: `${availableAgents.length} agent${availableAgents.length !== 1 ? 's' : ''} completed · ${totalFindings} total finding${totalFindings !== 1 ? 's' : ''}`,
      });
    } else {
      toast.warning('Analysis partially complete', {
        description: `${successCount}/${availableAgents.length} agents succeeded`,
      });
    }

    await fetchData();
    setIsFullRunning(false);
  };

  const handleResolve = async (id: string) => {
    const disc = discrepancies.find(d => d.id === id);
    const { error } = await supabase
      .from('discrepancies')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);

    if (error) { toast.error('Failed to resolve'); return; }

    // Audit log
    const { data: { user } } = await supabase.auth.getUser();
    if (user && selectedDealId) {
      await supabase.from('audit_log').insert({
        deal_id: selectedDealId, user_id: user.id, action: 'discrepancy_resolved',
        details: { discrepancy_id: id, rule_key: disc?.rule_key, severity: disc?.severity },
      });
    }

    toast.success('Discrepancy resolved');
    setDiscrepancies((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'resolved' } : d))
    );
  };

  const handleAcknowledge = async (id: string) => {
    const disc = discrepancies.find(d => d.id === id);
    const { error } = await supabase
      .from('discrepancies')
      .update({ status: 'acknowledged', acknowledged_at: new Date().toISOString() })
      .eq('id', id);

    if (error) { toast.error('Failed to acknowledge'); return; }

    // Audit log
    const { data: { user } } = await supabase.auth.getUser();
    if (user && selectedDealId) {
      await supabase.from('audit_log').insert({
        deal_id: selectedDealId, user_id: user.id, action: 'discrepancy_acknowledged',
        details: { discrepancy_id: id, rule_key: disc?.rule_key, severity: disc?.severity },
      });
    }

    toast.success('Discrepancy acknowledged');
    setDiscrepancies((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'acknowledged' } : d))
    );
  };

  const latestRun = runs[0] || null;
  const openDiscrepancies = discrepancies.filter((d) => d.status === 'open').length;
  const criticalCount = discrepancies.filter((d) => d.severity === 'critical' && d.status !== 'resolved').length;

  if (dealsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-5 h-5 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header with Deal Selector */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/8 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Newton — Deal Intelligence</h2>
            <p className="text-xs text-muted-foreground">
              AI-powered validation and deal intelligence
            </p>
          </div>
        </div>

        <DealSelector
          deals={allDeals}
          selectedId={selectedDealId}
          onSelect={setSelectedDealId}
          loading={dealsLoading}
        />
      </div>

      {/* Full Deal Analysis */}
      <FullDealAnalysisCard
        onRun={handleFullAnalysis}
        isRunning={isFullRunning}
        agentStatuses={agentStatuses}
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-accent animate-spin" />
        </div>
      ) : (
        <>
          <DealHealthCard
            latestRun={latestRun}
            openDiscrepancies={openDiscrepancies}
            criticalCount={criticalCount}
          />

          <AgentFindingsCard
            run={latestRun}
            isRunning={isRunning}
            onRunAgent={handleRunAgent}
          />

          <RecommendedActionCard run={latestRun} />

          <DiscrepanciesPanel
            discrepancies={discrepancies}
            onResolve={handleResolve}
            onAcknowledge={handleAcknowledge}
          />

          <AgentActivityLog runs={runs} />
        </>
      )}
    </div>
  );
};
