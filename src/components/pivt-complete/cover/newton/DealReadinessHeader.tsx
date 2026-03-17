/**
 * Deal Readiness Header — Shows deal context, closing readiness score,
 * blockers, and recommended next actions at the top of Newton.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, RefreshCw, Sparkles,
  XCircle, ArrowRight, Shield, Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface DealOption {
  id: string;
  deal_name: string;
  deal_number: string;
  status: string;
  is_demo: boolean;
  deal_state: string;
}

interface Props {
  deals: DealOption[];
  selectedDealId: string | undefined;
  onSelectDeal: (id: string) => void;
  dealState: string | undefined;
  readinessPct: number;
  blockers: string[];
  recommendations: { label: string; prompt: string }[];
  lastUpdated: Date | null;
  onRefresh: () => void;
  onAction?: (prompt: string) => void;
}

export const DealReadinessHeader: React.FC<Props> = ({
  deals, selectedDealId, onSelectDeal, dealState, readinessPct, blockers,
  recommendations, lastUpdated, onRefresh, onAction,
}) => {
  const selectedDeal = deals.find(d => d.id === selectedDealId);
  const readinessColor = readinessPct >= 80 ? 'text-validated' : readinessPct >= 40 ? 'text-accent' : 'text-blocking';
  const ringColor = readinessPct >= 80 ? 'stroke-validated' : readinessPct >= 40 ? 'stroke-accent' : 'stroke-blocking';
  const barColor = readinessPct >= 80 ? 'bg-validated' : readinessPct >= 40 ? 'bg-accent' : 'bg-blocking';

  return (
    <div className="pivt-card border border-border overflow-hidden">
      {/* Readiness progress bar */}
      <div className="h-1.5 w-full bg-muted">
        <motion.div
          className={cn('h-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${readinessPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="p-4 space-y-4">
        {/* ── Row 1: Branding + Deal Selector ── */}
        <div className="flex items-start gap-3">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 cursor-pointer"
                  style={{ background: 'linear-gradient(135deg, #3b82f6, #06b6d4)' }}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-yellow-400 text-black text-xs font-medium border-0">
                Ask the Newton Chatbot
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Newton</h2>
              <span className="text-[10px] text-muted-foreground">Deal Copilot</span>
              {lastUpdated && (
                <button onClick={onRefresh} className="ml-auto p-1 rounded-md hover:bg-muted transition-colors" title="Refresh">
                  <RefreshCw className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedDealId || ''}
                onChange={(e) => onSelectDeal(e.target.value)}
                disabled={deals.length === 0}
                className="flex-1 h-7 rounded-lg border border-border bg-card px-2 pr-6 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 appearance-none cursor-pointer truncate"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
              >
                {deals.length === 0 && <option value="">No deals</option>}
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
              {dealState && (
                <Badge variant="outline" className="text-[9px] px-1.5 shrink-0">
                  {dealState.replace(/_/g, ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* ── Row 2: Closing Readiness Score ── */}
        {selectedDeal && (
          <div className="flex items-center gap-4 px-1">
            {/* Circular readiness gauge */}
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-muted/40" />
                <circle
                  cx="18" cy="18" r="15.5" fill="none" strokeWidth="2.5"
                  strokeDasharray={`${readinessPct * 0.975} 100`}
                  strokeLinecap="round"
                  className={ringColor}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn('text-sm font-bold', readinessColor)}>{readinessPct}%</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold">Closing Readiness</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {readinessPct === 100
                  ? 'All pre-conditions met — ready for execution'
                  : readinessPct >= 80
                    ? 'Nearly ready — a few items remain'
                    : `${blockers.length} blocker${blockers.length !== 1 ? 's' : ''} preventing closing`}
              </p>
            </div>

            {readinessPct === 100 && (
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-validated/10 border border-validated/20">
                <CheckCircle2 className="w-3 h-3 text-validated" />
                <span className="text-[10px] font-medium text-validated">Ready</span>
              </div>
            )}
          </div>
        )}

        {/* ── Row 3: Blockers ── */}
        {blockers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-blocking" />
              Blockers
            </p>
            <div className="space-y-1">
              {blockers.map((b, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-blocking/5 border border-blocking/10">
                  <XCircle className="w-3 h-3 text-blocking shrink-0" />
                  <span className="text-[11px] text-foreground">{b}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Row 4: Recommended Next Actions ── */}
        {recommendations.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-accent" />
              Recommended Actions
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recommendations.map((rec, i) => (
                <button
                  key={i}
                  onClick={() => onAction?.(rec.prompt)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-accent/20 bg-accent/5 hover:bg-accent/10 transition-colors group"
                >
                  <Sparkles className="w-3 h-3 text-accent shrink-0" />
                  <span className="text-[11px] text-foreground whitespace-nowrap">{rec.label}</span>
                  <ArrowRight className="w-3 h-3 text-accent/40 group-hover:text-accent shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
