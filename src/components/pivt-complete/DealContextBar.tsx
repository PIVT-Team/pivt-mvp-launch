/**
 * DealContextBar
 * ----------------------------------------------------------------------------
 * Persistent, prominent deal selector that sits above any deal-aware section
 * (Timeline, Communications, Intelligence, Intelligence Map).
 *
 * Visual style mirrors the existing "Project ATLAS" deal header inside
 * DealWorkspaceCover (bold deal name + mono dealNumber pill on a card surface)
 * — uses only PIVT design tokens.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Layers, Circle } from 'lucide-react';
import { usePIVTStore, useActiveSection } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
} from '@/components/ui/select';

interface DealOption {
  id: string;
  label: string;
  dealNumber?: string;
  value?: number;
  status?: string;
  isLive: boolean;
}

const SECTION_LABELS: Record<string, string> = {
  'timeline': 'Timeline',
  'communications': 'Communications',
  'intelligence': 'Intelligence',
  'intelligence-map': 'Intelligence Map',
};

const STATUS_TONE: Record<string, string> = {
  drafting: 'bg-muted-foreground/10 text-muted-foreground border-muted-foreground/20',
  diligence: 'bg-accent/10 text-accent border-accent/20',
  signing: 'bg-warning/10 text-warning border-warning/20',
  closing: 'bg-validated/10 text-validated border-validated/20',
  completed: 'bg-validated/15 text-validated border-validated/25',
};

const formatCompactValue = (n?: number) => {
  if (!n || n <= 0) return null;
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
};

export const DealContextBar: React.FC = () => {
  const { selectedDealId, setSelectedDealId, deals } = usePIVTStore();
  const activeSection = useActiveSection();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [liveDeals, setLiveDeals] = useState<
    Array<{ id: string; deal_name: string; deal_number: string; deal_value: number | null; status: string | null }>
  >([]);

  // ── Sync URL ?dealId= → store (on first mount only) ──
  useEffect(() => {
    const urlDealId = searchParams.get('dealId');
    if (urlDealId && urlDealId !== selectedDealId) {
      setSelectedDealId(urlDealId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync store → URL (preserve other params) ──
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedDealId) next.set('dealId', selectedDealId);
    else next.delete('dealId');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDealId]);

  // ── Load live deals (if signed in) ──
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user) {
        if (!cancelled) setLiveDeals([]);
        return;
      }
      const { data } = await supabase
        .from('deals')
        .select('id, deal_name, deal_number, deal_value, status')
        .is('deleted_at', null)
        .eq('is_demo', false)
        .order('created_at', { ascending: false })
        .limit(50);
      if (!cancelled) setLiveDeals(data ?? []);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const demoOptions: DealOption[] = useMemo(
    () =>
      deals.map((d) => ({
        id: d.id,
        label: d.name,
        dealNumber: d.dealNumber,
        value: d.consideration,
        status: d.status,
        isLive: false,
      })),
    [deals],
  );

  const liveOptions: DealOption[] = useMemo(
    () =>
      liveDeals.map((d) => ({
        id: d.id,
        label: d.deal_name,
        dealNumber: d.deal_number,
        value: d.deal_value ?? undefined,
        status: d.status ?? undefined,
        isLive: true,
      })),
    [liveDeals],
  );

  const allOptions = useMemo(
    () => [...liveOptions, ...demoOptions],
    [liveOptions, demoOptions],
  );

  const current = useMemo(
    () => allOptions.find((o) => o.id === selectedDealId) || null,
    [allOptions, selectedDealId],
  );

  const sectionLabel = SECTION_LABELS[activeSection] ?? null;
  const compactValue = formatCompactValue(current?.value);
  const statusToneCls = current?.status ? STATUS_TONE[current.status] ?? STATUS_TONE.drafting : '';

  return (
    <div className="sticky top-0 z-30 shrink-0 px-8 lg:px-10 pt-4 pb-3 bg-background/85 backdrop-blur-md border-b border-border/40">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border/60 shadow-sm">
          {/* ── Breadcrumb row: Deals › [Deal Name ▾] › Section ───────────── */}
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 min-w-0 flex-1 text-sm"
          >
            {/* Root crumb */}
            <button
              onClick={() => usePIVTStore.getState().setActiveSection('deals')}
              className="text-muted-foreground hover:text-foreground transition-colors text-[13px] font-medium shrink-0"
            >
              Deals
            </button>

            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />

            {/* Deal crumb — acts as the dropdown trigger */}
            <Select
              value={selectedDealId || undefined}
              onValueChange={(v) => setSelectedDealId(v)}
            >
              <SelectTrigger className="h-auto border-0 bg-transparent hover:bg-muted/30 px-1.5 py-0.5 gap-1.5 focus:ring-0 focus:ring-offset-0 shadow-none w-auto justify-start rounded-md [&>svg]:hidden min-w-0">
                {current ? (
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[13px] font-semibold text-foreground truncate"
                      style={{ letterSpacing: '-0.01em' }}
                    >
                      {current.label}
                    </span>
                    {current.dealNumber && (
                      <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground shrink-0">
                        {current.dealNumber}
                      </span>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground opacity-60 shrink-0" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <Layers className="w-3.5 h-3.5" />
                    Select a deal…
                    <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                  </span>
                )}
              </SelectTrigger>

              <SelectContent align="start" className="min-w-[320px]">
                {liveOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
                      Live Deals
                    </SelectLabel>
                    {liveOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{opt.label}</span>
                          {opt.dealNumber && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {opt.dealNumber}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {liveOptions.length > 0 && demoOptions.length > 0 && (
                  <SelectSeparator />
                )}
                {demoOptions.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/60">
                      Demo Deals
                    </SelectLabel>
                    {demoOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        <span className="flex items-center gap-2">
                          <span className="font-medium">{opt.label}</span>
                          {opt.dealNumber && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {opt.dealNumber}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>

            {/* Section crumb (terminal — current page) */}
            {sectionLabel && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                <span
                  aria-current="page"
                  className="text-[13px] font-medium text-foreground truncate"
                >
                  {sectionLabel}
                </span>
              </>
            )}
          </nav>

          {/* ── Right-side meta: status, value, live tag ─────────────────── */}
          {current && (
            <div className="hidden md:flex items-center gap-2 shrink-0 pl-3 border-l border-border/40">
              {current.status && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[10px] font-medium capitalize ${statusToneCls}`}>
                  <Circle className="w-1.5 h-1.5 fill-current" />
                  {current.status}
                </span>
              )}
              {compactValue && (
                <span className="text-[11px] font-mono text-muted-foreground">
                  {compactValue}
                </span>
              )}
              {current.isLive && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  Live
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
