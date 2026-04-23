/**
 * DealContextBar
 * ----------------------------------------------------------------------------
 * Persistent deal selector that sits above any deal-scoped section
 * (Closing Checklist, Conditions Precedent, Signature Packets, Closing Book,
 * Timeline, Communications, Intelligence, Intelligence Map, Workspace).
 *
 * Visual style intentionally mirrors the existing "Project ATLAS" deal header
 * inside DealWorkspaceCover (bold deal name + mono dealNumber pill on a card
 * surface) — no new tokens, no new layout primitives. It is purely additive.
 *
 * Behaviour:
 *  - Reads/writes selectedDealId on the unified PIVT store.
 *  - Mirrors selectedDealId into the URL as ?dealId= so navigation deep-links
 *    survive refreshes and can be shared (without changing the section route).
 *  - Lists demo deals (always) and live deals from the deals table when the
 *    user is authenticated, matching IntelligenceDashboardCover's pattern.
 *  - Empty deal -> shows a soft "Select a deal" pill so the underlying
 *    cover still renders its existing "Select a deal to view…" empty state.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Briefcase, ChevronDown } from 'lucide-react';
import { usePIVTStore } from '@/stores/pivtStore';
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
  SelectValue,
} from '@/components/ui/select';

interface DealOption {
  id: string;
  label: string;
  dealNumber?: string;
  isLive: boolean;
}

const isUuid = (v?: string | null) =>
  !!v && /^[0-9a-f-]{36}$/i.test(v);

export const DealContextBar: React.FC = () => {
  const { selectedDealId, setSelectedDealId, deals } = usePIVTStore();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [liveDeals, setLiveDeals] = useState<
    Array<{ id: string; deal_name: string; deal_number: string }>
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
        .select('id, deal_name, deal_number')
        .is('deleted_at', null)
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

  return (
    <div className="shrink-0 px-8 lg:px-10 pt-4">
      <div className="max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border/50 shadow-sm">
          <div className="flex items-center gap-2 shrink-0 text-muted-foreground">
            <Briefcase className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em]">
              Active Deal
            </span>
          </div>

          <div className="h-4 w-px bg-border/50" />

          <Select
            value={selectedDealId || undefined}
            onValueChange={(v) => setSelectedDealId(v)}
          >
            <SelectTrigger className="h-8 border-0 bg-transparent hover:bg-muted/40 px-2 gap-2 focus:ring-0 focus:ring-offset-0 shadow-none w-auto min-w-[220px]">
              {current ? (
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-sm font-semibold text-foreground truncate"
                    style={{ letterSpacing: '-0.02em' }}
                  >
                    {current.label}
                  </span>
                  {current.dealNumber && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">
                      {current.dealNumber}
                    </span>
                  )}
                  {current.isLive && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                      Live
                    </span>
                  )}
                </span>
              ) : (
                <SelectValue placeholder="Select a deal…" />
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground opacity-60" />
            </SelectTrigger>

            <SelectContent align="start" className="min-w-[280px]">
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

          <div className="flex-1" />

          {!selectedDealId && (
            <span className="text-[11px] text-muted-foreground hidden sm:inline">
              No deal selected
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
