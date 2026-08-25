/**
 * Deal Readiness Header — Shows deal context, closing readiness score,
 * blockers, and recommended next actions at the top of Newton.
 * Includes searchable deal switcher with "+ New Deal" action.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, RefreshCw, Sparkles,
  XCircle, ArrowRight, Shield, Zap, Plus, Search, ChevronDown, Globe, Briefcase,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
  onCreateNewDeal?: () => void;
  dealState: string | undefined;
  readinessPct: number;
  blockers: string[];
  recommendations: { label: string; prompt: string }[];
  lastUpdated: Date | null;
  onRefresh: () => void;
  onAction?: (prompt: string) => void;
  operationMode?: 'global' | 'deal';
}

export const DealReadinessHeader: React.FC<Props> = ({
  deals, selectedDealId, onSelectDeal, onCreateNewDeal, dealState, readinessPct, blockers,
  recommendations, lastUpdated, onRefresh, onAction, operationMode = 'deal',
}) => {
  const selectedDeal = deals.find(d => d.id === selectedDealId);
  const readinessColor = readinessPct >= 80 ? 'text-validated' : readinessPct >= 40 ? 'text-accent' : 'text-blocking';
  const ringColor = readinessPct >= 80 ? 'stroke-validated' : readinessPct >= 40 ? 'stroke-accent' : 'stroke-blocking';
  const barColor = readinessPct >= 80 ? 'bg-validated' : readinessPct >= 40 ? 'bg-accent' : 'bg-blocking';

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dropdownOpen && searchRef.current) searchRef.current.focus();
  }, [dropdownOpen]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredDeals = deals.filter(d =>
    d.deal_name.toLowerCase().includes(search.toLowerCase()) ||
    d.deal_number.toLowerCase().includes(search.toLowerCase())
  );
  const demoDeals = filteredDeals.filter(d => d.is_demo);
  const liveDeals = filteredDeals.filter(d => !d.is_demo);

  const handleSelect = (id: string) => {
    onSelectDeal(id);
    setDropdownOpen(false);
    setSearch('');
  };

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
                  style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--primary)))' }}>
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-accent text-accent-foreground text-xs font-medium border-0">
                Newton AI Copilot
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">Newton</h2>
              <Badge variant="outline" className="h-5 text-[9px] gap-1 px-1.5">
                {operationMode === 'global' ? <Globe className="w-2.5 h-2.5" /> : <Briefcase className="w-2.5 h-2.5" />}
                {operationMode === 'global' ? 'Global' : 'Deal'}
              </Badge>
              {lastUpdated && (
                <button onClick={onRefresh} className="ml-auto p-1 rounded-md hover:bg-muted transition-colors" title="Refresh">
                  <RefreshCw className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Searchable deal dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center gap-2 h-8 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
              >
                <span className="flex-1 text-left truncate">
                  {selectedDeal ? `${selectedDeal.deal_name} (${selectedDeal.deal_number})` : 'Select a deal…'}
                </span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform', dropdownOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
                  >
                    {/* Search */}
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <input
                          ref={searchRef}
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Search deals…"
                          className="w-full h-7 pl-8 pr-2 text-xs bg-muted/50 rounded-md border-0 outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-muted-foreground/50"
                        />
                      </div>
                    </div>

                    {/* + New Deal */}
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        setSearch('');
                        onCreateNewDeal?.();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/5 transition-colors border-b border-border"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      New Deal
                    </button>

                    {/* Deal list */}
                    <div className="max-h-52 overflow-y-auto">
                      {liveDeals.length > 0 && (
                        <>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1 font-semibold">Your Deals</p>
                          {liveDeals.map(d => (
                            <button
                              key={d.id}
                              onClick={() => handleSelect(d.id)}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left',
                                d.id === selectedDealId ? 'bg-accent/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              )}
                            >
                              <span className="flex-1 truncate">{d.deal_name}</span>
                              <span className="text-[9px] text-muted-foreground shrink-0">{d.deal_number}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {demoDeals.length > 0 && (
                        <>
                          <p className="text-[9px] uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1 font-semibold">Demo</p>
                          {demoDeals.map(d => (
                            <button
                              key={d.id}
                              onClick={() => handleSelect(d.id)}
                              className={cn(
                                'w-full flex items-center gap-2 px-3 py-1.5 text-xs transition-colors text-left',
                                d.id === selectedDealId ? 'bg-accent/10 text-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              )}
                            >
                              <span className="flex-1 truncate">{d.deal_name}</span>
                              <span className="text-[9px] text-muted-foreground shrink-0">{d.deal_number}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {filteredDeals.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">No deals match "{search}"</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* ── Row 2: Closing Readiness Score ── */}
        {selectedDeal && (
          <div className="flex items-center gap-4 px-1">
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