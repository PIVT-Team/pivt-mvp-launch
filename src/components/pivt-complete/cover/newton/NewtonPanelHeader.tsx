/**
 * Newton Panel Header — 56px top bar with branding, deal selector, and status dot.
 */
import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles, ChevronDown, Search, Plus } from 'lucide-react';

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
  onCreateNewDeal: () => void;
  operationMode: 'global' | 'deal';
  readinessPct: number;
}

export const NewtonPanelHeader: React.FC<Props> = ({
  deals, selectedDealId, onSelectDeal, onCreateNewDeal, operationMode, readinessPct,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selectedDeal = deals.find(d => d.id === selectedDealId);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = deals.filter(d =>
    d.deal_name.toLowerCase().includes(search.toLowerCase()) ||
    d.deal_number.toLowerCase().includes(search.toLowerCase())
  );
  const live = filtered.filter(d => !d.is_demo);
  const demo = filtered.filter(d => d.is_demo);

  const statusColor = readinessPct >= 80 ? 'bg-validated' : readinessPct >= 40 ? 'bg-accent' : 'bg-blocking';
  const statusLabel = readinessPct >= 80 ? 'Ready to close' : readinessPct >= 40 ? `${Math.round(100 - readinessPct)}% remaining` : 'Action required';

  return (
    <div className="h-14 shrink-0 flex items-center gap-3 px-4 border-b border-border">
      {/* Newton branding */}
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, hsl(var(--accent)), hsl(var(--pivt-blue)))' }}
      >
        <Sparkles className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-sm font-semibold tracking-tight">Newton</span>

      {/* Deal selector / mode label */}
      <div className="flex-1 min-w-0" ref={ref}>
        <div className="relative">
          <button
            onClick={() => setOpen(!open)}
            className="flex items-center gap-1.5 h-7 rounded-lg px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors max-w-full"
          >
            <span className="truncate">
              {operationMode === 'global'
                ? 'Portfolio Mode'
                : selectedDeal
                  ? selectedDeal.deal_name
                  : 'Select deal…'}
            </span>
            <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute top-full left-0 mt-1.5 z-50 w-64 rounded-xl border border-border bg-popover shadow-xl overflow-hidden"
              >
                <div className="p-2 border-b border-border">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search deals…"
                      className="w-full h-7 pl-8 pr-2 text-xs bg-muted/50 rounded-md border-0 outline-none focus:ring-1 focus:ring-accent/40 placeholder:text-muted-foreground/50"
                    />
                  </div>
                </div>

                <button
                  onClick={() => { setOpen(false); setSearch(''); onCreateNewDeal(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-accent hover:bg-accent/5 transition-colors border-b border-border"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Deal
                </button>

                <div className="max-h-52 overflow-y-auto">
                  {live.length > 0 && (
                    <>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1 font-semibold">Your Deals</p>
                      {live.map(d => (
                        <button
                          key={d.id}
                          onClick={() => { onSelectDeal(d.id); setOpen(false); setSearch(''); }}
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
                  {demo.length > 0 && (
                    <>
                      <p className="text-[9px] uppercase tracking-widest text-muted-foreground px-3 pt-2 pb-1 font-semibold">Demo</p>
                      {demo.map(d => (
                        <button
                          key={d.id}
                          onClick={() => { onSelectDeal(d.id); setOpen(false); setSearch(''); }}
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
                  {filtered.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No deals found</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Status dot */}
      {operationMode === 'deal' && selectedDeal && (
        <div className="flex items-center gap-1.5 shrink-0" title={statusLabel}>
          <div className={cn('w-2 h-2 rounded-full', statusColor)} />
          <span className="text-[10px] text-muted-foreground hidden lg:inline">{statusLabel}</span>
        </div>
      )}
    </div>
  );
};
