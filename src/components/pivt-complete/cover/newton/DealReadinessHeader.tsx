/**
 * Deal Readiness Header — Shows deal context and closing readiness at the top of Newton.
 */
import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
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
  lastUpdated: Date | null;
  onRefresh: () => void;
}

export const DealReadinessHeader: React.FC<Props> = ({
  deals, selectedDealId, onSelectDeal, dealState, readinessPct, blockers, lastUpdated, onRefresh,
}) => {
  const selectedDeal = deals.find(d => d.id === selectedDealId);
  const readinessColor = readinessPct >= 80 ? 'text-validated' : readinessPct >= 40 ? 'text-accent' : 'text-blocking';

  return (
    <div className="pivt-card border border-border overflow-hidden">
      {/* Readiness progress bar */}
      <div className="h-1 w-full bg-muted">
        <motion.div
          className={cn(
            'h-full',
            readinessPct >= 80 ? 'bg-validated' : readinessPct >= 40 ? 'bg-accent' : 'bg-blocking'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${readinessPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Top row: Newton branding + deal selector */}
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent/8 flex items-center justify-center shrink-0">
            <Sparkles className="w-4.5 h-4.5 text-accent" />
          </div>
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

            {/* Deal selector */}
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

        {/* Readiness summary */}
        {selectedDeal && (
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-1.5">
              {readinessPct >= 80 ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-validated" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-blocking" />
              )}
              <span className={cn('text-xs font-semibold', readinessColor)}>
                {readinessPct}% Closing Readiness
              </span>
            </div>
            {blockers.length > 0 && (
              <div className="flex-1 flex items-center gap-1.5 overflow-x-auto">
                <span className="text-[10px] text-muted-foreground shrink-0">·</span>
                {blockers.slice(0, 3).map((b, i) => (
                  <Badge key={i} variant="outline" className="text-[9px] px-1.5 text-blocking border-blocking/20 whitespace-nowrap shrink-0">
                    {b}
                  </Badge>
                ))}
                {blockers.length > 3 && (
                  <span className="text-[9px] text-muted-foreground shrink-0">+{blockers.length - 3} more</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
