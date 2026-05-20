// NewtonStepChips — inline contextual Newton action buttons rendered above
// each workspace step's content. The deal workspace audit found that
// Newton had 32+ backend actions wired but zero of them surfaced in the
// per-step UI — every interaction required the global chat. This fixes
// that by giving each step a small bar of "Newton can…" buttons that
// invoke the matching action directly.
//
// Design choices:
//   - Chips are step-specific. Overview gets "Summarize readiness", KYC
//     gets "Generate KYC requests", Verification gets "Run discrepancy
//     check", etc. Defined in STEP_CHIPS below.
//   - On click: chip flips to loading; action fires; result lands in an
//     inline expandable "Newton said" card directly below the chip row.
//     Markdown is supported via react-markdown.
//   - Multiple chips can hold results simultaneously (click each one,
//     each shows its own card).
//   - Errors render in red. Auto-dismiss after 12s for success, manual
//     dismiss for errors.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Loader2, X, AlertCircle, CheckCircle2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { callNewtonAction } from '@/services/newtonActionService';

// ────────────────────────────────────────────────────────────────────────
// Step → chips map
// ────────────────────────────────────────────────────────────────────────
//
// Each chip declares: a label, an action key (matches newton-action edge
// function's switch), an optional sub-step gate, and an emoji/icon hint.
// Keep labels short — these render in a horizontal bar. Use sentence case.
//
// `subSteps`: when present, the chip only renders on those sub-step ids.
// `requiresDealId`: defaults to true (most actions need a deal). Set to
// false for portfolio-wide actions.

interface ChipDef {
  label: string;
  action: string;
  emoji: string;
  /** Restrict to specific sub-steps (e.g. only on 'kyc' under stakeholders). */
  subSteps?: string[];
  /** Most actions need a deal_id; set to false for portfolio actions. */
  requiresDealId?: boolean;
}

const STEP_CHIPS: Record<string, ChipDef[]> = {
  overview: [
    { label: 'Summarize readiness', action: 'summarize_readiness', emoji: '📊' },
    { label: 'List blockers', action: 'list_blockers', emoji: '🚧' },
    { label: 'Suggest next steps', action: 'suggest_next_actions', emoji: '➡️' },
    { label: 'Predict closing date', action: 'predict_delays', emoji: '🗓️' },
  ],
  stakeholders: [
    { label: 'Generate KYC requests', action: 'generate_kyc_requests', emoji: '🪪', subSteps: ['kyc', 'contacts'] },
    { label: 'Generate KYB requests', action: 'generate_kyb_requests', emoji: '🏢', subSteps: ['kyc'] },
    { label: 'List blockers', action: 'list_blockers', emoji: '🚧' },
  ],
  'deal-inputs': [
    { label: 'Parse uploaded funds flow', action: 'parse_funds_flow', emoji: '💸' },
    { label: 'Run discrepancy check', action: 'run_discrepancy_check', emoji: '🔍' },
    { label: 'Summarize readiness', action: 'summarize_readiness', emoji: '📊' },
  ],
  verification: [
    { label: 'Run discrepancy check', action: 'run_discrepancy_check', emoji: '🔍' },
    { label: 'Summarize closing risks', action: 'summarize_closing_risks', emoji: '⚠️' },
  ],
  approvals: [
    { label: 'Prepare approval package', action: 'prepare_approval_package', emoji: '📝' },
    { label: 'List blockers', action: 'list_blockers', emoji: '🚧' },
    { label: 'Predict delays', action: 'predict_delays', emoji: '⏳' },
  ],
  execution: [
    { label: 'Summarize closing risks', action: 'summarize_closing_risks', emoji: '⚠️' },
    { label: 'Suggest next actions', action: 'suggest_next_actions', emoji: '➡️' },
    { label: 'Predict delays', action: 'predict_delays', emoji: '⏳' },
    { label: 'Draft closing certificate', action: 'draft_certificate', emoji: '📜' },
  ],
  audit: [
    { label: 'Summarize closing risks', action: 'summarize_closing_risks', emoji: '⚠️' },
    { label: 'List blockers', action: 'list_blockers', emoji: '🚧' },
  ],
  comments: [
    { label: 'Suggest next actions', action: 'suggest_next_actions', emoji: '➡️' },
  ],
};

// ────────────────────────────────────────────────────────────────────────

interface ChipResult {
  action: string;
  loading: boolean;
  success?: boolean;
  message?: string;
  error?: string;
}

interface Props {
  stepId: string;
  subStepId?: string;
  dealId: string | null;
}

export const NewtonStepChips: React.FC<Props> = ({ stepId, subStepId, dealId }) => {
  const [results, setResults] = useState<Record<string, ChipResult>>({});
  const chips = (STEP_CHIPS[stepId] || []).filter(
    (c) => !c.subSteps || (subStepId && c.subSteps.includes(subStepId)),
  );

  if (chips.length === 0) return null;

  const runChip = async (chip: ChipDef) => {
    const requiresDeal = chip.requiresDealId !== false;
    if (requiresDeal && !dealId) {
      setResults((prev) => ({
        ...prev,
        [chip.action]: { action: chip.action, loading: false, success: false, error: 'No deal selected.' },
      }));
      return;
    }
    setResults((prev) => ({ ...prev, [chip.action]: { action: chip.action, loading: true } }));

    const result = await callNewtonAction(chip.action, dealId ? { deal_id: dealId } : {});

    setResults((prev) => ({
      ...prev,
      [chip.action]: {
        action: chip.action,
        loading: false,
        success: result.success,
        message: result.message,
        error: result.success ? undefined : result.message,
      },
    }));

    // Auto-dismiss successes after 12s so the page doesn't fill up with
    // stale cards. Errors stick until manually closed.
    if (result.success) {
      setTimeout(() => {
        setResults((prev) => {
          const next = { ...prev };
          // Only clear if it still belongs to this same result (avoid
          // overwriting a fresh re-run that finished in <12s).
          if (next[chip.action]?.loading === false) delete next[chip.action];
          return next;
        });
      }, 12000);
    }
  };

  const dismiss = (action: string) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[action];
      return next;
    });
  };

  return (
    <div className="space-y-3 mb-5">
      {/* Chip row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground/70 mr-1">
          <Sparkles className="w-3 h-3 text-accent" />
          <span>Newton can</span>
        </div>
        {chips.map((chip) => {
          const result = results[chip.action];
          const loading = result?.loading;
          return (
            <button
              key={chip.action}
              onClick={() => runChip(chip)}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                loading
                  ? 'border-accent/40 bg-accent/5 text-accent cursor-wait'
                  : 'border-border bg-card hover:border-accent/40 hover:bg-accent/5 hover:text-accent'
              }`}
              title={`Newton: ${chip.label}`}
            >
              {loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span className="text-[13px] leading-none">{chip.emoji}</span>
              )}
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* Result cards (one per recent chip click) */}
      <AnimatePresence mode="popLayout">
        {Object.values(results).map((r) => (
          <motion.div
            key={r.action}
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {!r.loading && (r.success || r.error) && (
              <div
                className={`rounded-lg border p-4 text-sm ${
                  r.success
                    ? 'border-accent/30 bg-accent/5'
                    : 'border-destructive/30 bg-destructive/5'
                }`}
              >
                <div className="flex items-start gap-3">
                  {r.success ? (
                    <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Badge variant="outline" className="text-[10px]">Newton</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {chips.find((c) => c.action === r.action)?.label}
                      </span>
                    </div>
                    {/* Markdown so Newton's structured replies render with
                        headings, lists, bold, etc. instead of one wall of text. */}
                    <div className="prose prose-sm max-w-none dark:prose-invert text-foreground/90 [&_p]:my-1 [&_ul]:my-1 [&_h2]:text-sm [&_h3]:text-sm">
                      <ReactMarkdown>{(r.message || r.error || '').toString()}</ReactMarkdown>
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(r.action)}
                    className="p-1 -m-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
