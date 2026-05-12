import React, { useEffect, useMemo, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { formatDistanceToNowStrict } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  GitBranch,
  Lock,
  Network,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  TimerReset,
  TrendingUp,
  Users,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type BenchmarkRow = {
  deal_id: string;
  deal_type: string | null;
  current_days_since_signing: number | null;
  benchmark_days_since_signing: number | null;
  current_conditions_satisfied_pct: number;
  benchmark_conditions_satisfied_pct: number | null;
  current_open_discrepancies: number;
  benchmark_open_discrepancies: number | null;
  benchmark_sample_size: number;
  has_minimum_group: boolean;
};

type CpBenchmarkRow = {
  cp_type: string;
  average_days_to_satisfaction: number | null;
  current_days_outstanding: number;
  status_indicator: 'on-track' | 'delayed' | 'insufficient-data';
  benchmark_sample_size: number;
  has_minimum_group: boolean;
};

type DealContextResponse = {
  deal: {
    id: string;
    deal_name: string;
    deal_type: string | null;
    signing_date: string | null;
    status: string;
  };
  participantOptions: Array<{ user_id: string; display_name: string }>;
  counterpartyIntelligence: Array<{
    entity_id: string;
    canonical_name: string;
    firm_name: string;
    deals_participated: number | null;
    has_minimum_group: boolean;
    average_signature_response_hours: number | null;
    relationship_count: number;
  }>;
  entityCount: number;
  relationshipCount: number;
  dealPartyCount: number;
};

type GraphNode = {
  id: string;
  label: string;
  entity_type: string;
  relationship_count: number;
  deals_appeared_in: string[];
  deals_count: number;
  canonical_name: string;
  known_relationships: Array<{ id: string; relationship_type: string; other_entity_name: string }>;
  x?: number;
  y?: number;
};

type GraphLink = {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
  relationship_type: string;
  confidence: number | null;
};

type GraphResponse = {
  minimum_group_size: number;
  search_entities: Array<{ id: string; canonical_name: string; entity_type: string }>;
  graph: {
    nodes: GraphNode[];
    links: GraphLink[];
  };
};

const relationshipColorByType: Record<string, string> = {
  controls: 'hsl(var(--accent))',
  owns: 'hsl(var(--validated))',
  advises: 'hsl(var(--pivt-blue))',
  funds: 'hsl(var(--discrepancy))',
};

const statusTone: Record<CpBenchmarkRow['status_indicator'], string> = {
  'on-track': 'bg-validated/10 text-validated border-validated/20',
  delayed: 'bg-blocking/10 text-blocking border-blocking/20',
  'insufficient-data': 'bg-muted text-muted-foreground border-border',
};

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)}%`;
}

function formatDays(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${Math.round(value)}d`;
}

function formatHours(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return 'Hidden';
  return `${value.toFixed(1)}h avg`;
}

function useSemanticGraphPalette() {
  return useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        accent: '#7c3aed',
        validated: '#10b981',
        muted: '#94a3b8',
        border: '#cbd5e1',
        foreground: '#0f172a',
        background: '#ffffff',
      };
    }

    const styles = getComputedStyle(document.documentElement);
    return {
      accent: `hsl(${styles.getPropertyValue('--accent').trim()})`,
      validated: `hsl(${styles.getPropertyValue('--validated').trim()})`,
      muted: `hsl(${styles.getPropertyValue('--muted-foreground').trim()})`,
      border: `hsl(${styles.getPropertyValue('--border').trim()})`,
      foreground: `hsl(${styles.getPropertyValue('--foreground').trim()})`,
      background: `hsl(${styles.getPropertyValue('--card').trim()})`,
    };
  }, []);
}

export const IntelligenceDashboardCover: React.FC = () => {
  const { user, isAdmin, isPlatformAdmin, isIntelligenceUser } = useAuth();
  const { selectedDealId, setSelectedDealId, deals } = usePIVTStore();
  const selectedDemoDeal = useSelectedDeal();
  const graphPalette = useSemanticGraphPalette();

  const [dealOptions, setDealOptions] = useState<Array<{ id: string; label: string; isLive: boolean }>>([]);
  const [selectedDealType, setSelectedDealType] = useState<'live' | 'demo'>('demo');
  const [currentLiveDeal, setCurrentLiveDeal] = useState<{ id: string; deal_name: string; deal_type: string | null; signing_date: string | null; status: string } | null>(null);
  const [benchmark, setBenchmark] = useState<BenchmarkRow | null>(null);
  const [cpBenchmarks, setCpBenchmarks] = useState<CpBenchmarkRow[]>([]);
  const [dealContext, setDealContext] = useState<DealContextResponse | null>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [graphLoading, setGraphLoading] = useState(false);

  const hasPrivilegedAccess = isPlatformAdmin || isAdmin || isIntelligenceUser;
  const selectedDealIsUuid = Boolean(selectedDealId && /^[0-9a-f-]{36}$/i.test(selectedDealId));

  useEffect(() => {
    let cancelled = false;

    const loadDeals = async () => {
      const demoOptions = deals.map((deal) => ({ id: deal.id, label: deal.name, isLive: false }));

      if (!user) {
        if (!cancelled) {
          setDealOptions(demoOptions);
          setSelectedDealType('demo');
        }
        return;
      }

      const { data } = await supabase.from('deals').select('id, deal_name').is('deleted_at', null).eq('is_demo', false).order('created_at', { ascending: false });
      if (!cancelled) {
        const liveOptions = (data ?? []).map((deal) => ({ id: deal.id, label: deal.deal_name, isLive: true }));
        setDealOptions([...liveOptions, ...demoOptions]);
      }
    };

    loadDeals();
    return () => {
      cancelled = true;
    };
  }, [deals, user]);

  useEffect(() => {
    setSelectedDealType(selectedDealIsUuid ? 'live' : 'demo');
  }, [selectedDealIsUuid]);

  useEffect(() => {
    let cancelled = false;

    const loadDealIntelligence = async () => {
      if (!selectedDealId) return;

      if (!selectedDealIsUuid || !user) {
        setCurrentLiveDeal(null);
        setDealContext(null);
        setBenchmark({
          deal_id: selectedDemoDeal.id,
          deal_type: selectedDemoDeal.sector,
          current_days_since_signing: 18,
          benchmark_days_since_signing: 26,
          current_conditions_satisfied_pct: selectedDemoDeal.readyToPayPercent,
          benchmark_conditions_satisfied_pct: 72,
          current_open_discrepancies: selectedDemoDeal.discrepanciesFound,
          benchmark_open_discrepancies: 4.4,
          benchmark_sample_size: 8,
          has_minimum_group: true,
        });
        setCpBenchmarks([
          {
            cp_type: 'Board consent',
            average_days_to_satisfaction: 7,
            current_days_outstanding: 5,
            status_indicator: 'on-track',
            benchmark_sample_size: 9,
            has_minimum_group: true,
          },
          {
            cp_type: 'Escrow confirmation',
            average_days_to_satisfaction: 11,
            current_days_outstanding: 14,
            status_indicator: 'delayed',
            benchmark_sample_size: 6,
            has_minimum_group: true,
          },
        ]);
        setDealContext({
          deal: {
            id: selectedDemoDeal.id,
            deal_name: selectedDemoDeal.name,
            deal_type: selectedDemoDeal.sector,
            signing_date: new Date(Date.now() - 18 * 86400000).toISOString(),
            status: selectedDemoDeal.status,
          },
          participantOptions: [],
          counterpartyIntelligence: [
            {
              entity_id: 'demo-counterparty-1',
              canonical_name: selectedDemoDeal.buyerName,
              firm_name: selectedDemoDeal.buyerName,
              deals_participated: 7,
              has_minimum_group: true,
              average_signature_response_hours: 10.4,
              relationship_count: 3,
            },
            {
              entity_id: 'demo-counterparty-2',
              canonical_name: selectedDemoDeal.targetCompany,
              firm_name: selectedDemoDeal.targetCompany,
              deals_participated: 5,
              has_minimum_group: true,
              average_signature_response_hours: 16.2,
              relationship_count: 2,
            },
          ],
          entityCount: 14,
          relationshipCount: 19,
          dealPartyCount: 2,
        });
        return;
      }

      setLoading(true);
      const [benchmarkRes, cpRes, contextRes, dealRes] = await Promise.all([
        supabase.rpc('get_deal_benchmark_panel' as any, { _deal_id: selectedDealId }),
        supabase.rpc('get_condition_precedent_benchmarks' as any, { _deal_id: selectedDealId }),
        supabase.functions.invoke('intelligence-dashboard', { body: { action: 'dealContext', dealId: selectedDealId } }),
        supabase.from('deals').select('id, deal_name, deal_type, signing_date, status').eq('id', selectedDealId).single(),
      ]);

      if (!cancelled) {
        setBenchmark((benchmarkRes.data?.[0] as BenchmarkRow | undefined) ?? null);
        setCpBenchmarks((cpRes.data as CpBenchmarkRow[] | null) ?? []);
        setDealContext((contextRes.data as DealContextResponse | null) ?? null);
        setCurrentLiveDeal(dealRes.data ?? null);
        setLoading(false);
      }
    };

    loadDealIntelligence();
    return () => {
      cancelled = true;
    };
  }, [selectedDealId, selectedDealIsUuid, selectedDemoDeal, user]);

  useEffect(() => {
    let cancelled = false;
    const loadGraph = async () => {
      if (!selectedDealId || !selectedDealIsUuid || !hasPrivilegedAccess || !user) {
        setGraphData(null);
        setSelectedNode(null);
        return;
      }

      setGraphLoading(true);
      const { data } = await supabase.functions.invoke('intelligence-dashboard', {
        body: { action: 'graphExplorer', dealId: selectedDealId, search: search || undefined },
      });

      if (!cancelled) {
        const graph = data as GraphResponse | null;
        setGraphData(graph);
        setSelectedNode(graph?.graph.nodes?.[0] ?? null);
        setGraphLoading(false);
      }
    };

    const timeout = window.setTimeout(loadGraph, search ? 250 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [hasPrivilegedAccess, search, selectedDealId, selectedDealIsUuid, user]);

  const effectiveDeal = currentLiveDeal ?? dealContext?.deal ?? {
    id: selectedDemoDeal.id,
    deal_name: selectedDemoDeal.name,
    deal_type: selectedDemoDeal.sector,
    signing_date: null,
    status: selectedDemoDeal.status,
  };

  const graphNodes = graphData?.graph.nodes ?? [];
  const graphLinks = graphData?.graph.links ?? [];

  const benchmarkCards = benchmark
    ? [
        {
          label: 'Days since signing',
          current: formatDays(benchmark.current_days_since_signing),
          average: formatDays(benchmark.benchmark_days_since_signing),
          icon: TimerReset,
        },
        {
          label: 'Conditions satisfied',
          current: formatPercent(benchmark.current_conditions_satisfied_pct),
          average: formatPercent(benchmark.benchmark_conditions_satisfied_pct),
          icon: ShieldCheck,
        },
        {
          label: 'Open discrepancies',
          current: benchmark.current_open_discrepancies.toString(),
          average: benchmark.benchmark_open_discrepancies?.toFixed(1) ?? '—',
          icon: AlertTriangle,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Intelligence
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">PIVT Intelligence</h1>
            <p className="text-sm text-muted-foreground">
              Cross-deal analytics powered by the entity graph, with anonymised benchmarks and gated raw intelligence.
            </p>
          </div>
        </div>

        <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Deal context</p>
            <Select value={selectedDealId || selectedDemoDeal.id} onValueChange={(value) => setSelectedDealId(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a deal" />
              </SelectTrigger>
              <SelectContent>
                {dealOptions.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="border-border/60 bg-card/80 shadow-sm">
            <CardContent className="flex h-full items-center justify-between p-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Scope</p>
                <p className="mt-1 text-sm font-medium text-foreground">{effectiveDeal.deal_name}</p>
              </div>
              <Badge variant="outline" className="capitalize">
                {selectedDealType}
              </Badge>
            </CardContent>
          </Card>
        </div>
      </div>

      <Alert>
        <Radar className="h-4 w-4" />
        <AlertTitle>Aggregated benchmark methodology</AlertTitle>
        <AlertDescription>
          Benchmarks are computed from anonymised, aggregated data across PIVT deals. Any metric with fewer than 5 contributing deals is withheld.
        </AlertDescription>
      </Alert>

      {!user && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Live backend intelligence requires authentication</AlertTitle>
          <AlertDescription>
            You’re currently seeing demo-safe intelligence data for MVP review. Sign in to load participant-scoped live deal benchmarks.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="pivt-card border-border/60">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl">Deal Benchmark Panel</CardTitle>
                <CardDescription>How does this deal compare?</CardDescription>
              </div>
              <Badge variant="outline" className="capitalize">{effectiveDeal.deal_type || 'Unclassified'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && !benchmark ? (
              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 rounded-lg" />)}
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                {benchmarkCards.map((item) => (
                  <div key={item.label} className="rounded-lg border border-border bg-background/70 p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <item.icon className="h-4 w-4" />
                      <span className="text-xs uppercase tracking-[0.16em]">{item.label}</span>
                    </div>
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-2xl font-semibold text-foreground">{item.current}</p>
                        <p className="text-xs text-muted-foreground">Current deal</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-medium text-muted-foreground">{item.average}</p>
                        <p className="text-xs text-muted-foreground">Benchmark avg</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {benchmark && !benchmark.has_minimum_group && (
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertTitle>Benchmark withheld</AlertTitle>
                <AlertDescription>
                  Fewer than 5 comparable deals matched this deal type, so the aggregated benchmark is hidden to prevent de-anonymisation.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="pivt-card border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Condition Precedent Benchmarks</CardTitle>
            <CardDescription>Outstanding CPs against anonymised portfolio baselines.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading && cpBenchmarks.length === 0 ? (
              <div className="space-y-3">
                {[0, 1, 2].map((item) => <Skeleton key={item} className="h-14 rounded-lg" />)}
              </div>
            ) : cpBenchmarks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                No outstanding conditions are currently open on this deal.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CP type</TableHead>
                    <TableHead>Avg to satisfy</TableHead>
                    <TableHead>This deal</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cpBenchmarks.map((row) => (
                    <TableRow key={row.cp_type}>
                      <TableCell className="font-medium">{row.cp_type}</TableCell>
                      <TableCell>{formatDays(row.average_days_to_satisfaction)}</TableCell>
                      <TableCell>{formatDays(row.current_days_outstanding)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('capitalize', statusTone[row.status_indicator])}>
                          {row.status_indicator.replace('-', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="pivt-card border-border/60">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Counterparty Intelligence Panel</CardTitle>
              <CardDescription>Who are you working with?</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3.5 w-3.5" />
              {dealContext?.dealPartyCount ?? 0} deal parties
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {!hasPrivilegedAccess && user ? (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>Restricted raw cross-deal intelligence</AlertTitle>
              <AlertDescription>
                Counterparty cross-deal history is available only to admins and users with the intelligence role.
              </AlertDescription>
            </Alert>
          ) : loading && !dealContext ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => <Skeleton key={item} className="h-32 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(dealContext?.counterpartyIntelligence ?? []).map((party) => (
                <div key={party.entity_id} className="rounded-lg border border-border bg-background/70 p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback>{initials(party.canonical_name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{party.canonical_name}</p>
                      <p className="truncate text-sm text-muted-foreground">{party.firm_name}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md border border-border bg-card p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">PIVT deals</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {party.deals_participated ?? 'Hidden'}
                      </p>
                    </div>
                    <div className="rounded-md border border-border bg-card p-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Signature response</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {formatHours(party.average_signature_response_hours)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{party.relationship_count} known relationships</span>
                    {party.has_minimum_group ? (
                      <Badge variant="outline" className="border-validated/20 bg-validated/10 text-validated">Eligible</Badge>
                    ) : (
                      <Badge variant="outline">Below privacy threshold</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="pivt-card border-border/60">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle className="text-xl">Entity Graph Explorer</CardTitle>
              <CardDescription>Cross-deal network intelligence for admins and power users.</CardDescription>
            </div>

            <div className="flex w-full max-w-xl items-center gap-3">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search entities across the graph" className="pl-9" />
              </div>
              <Button variant="outline" size="sm" onClick={() => setSearch('')}>Reset</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasPrivilegedAccess ? (
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertTitle>Restricted intelligence graph</AlertTitle>
              <AlertDescription>
                The full cross-deal entity graph is limited to admins and users with the intelligence role.
              </AlertDescription>
            </Alert>
          ) : !selectedDealIsUuid ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              Select a live deal to explore the cross-deal entity graph.
            </div>
          ) : graphLoading && !graphData ? (
            <Skeleton className="h-[440px] rounded-lg" />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[1.4fr_380px]">
              <div className="rounded-lg border border-border bg-background/80 p-2">
                <div className="mb-3 flex flex-wrap items-center gap-2 px-3 pt-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="gap-1"><Network className="h-3.5 w-3.5" /> {graphNodes.length} nodes</Badge>
                  <Badge variant="outline" className="gap-1"><GitBranch className="h-3.5 w-3.5" /> {graphLinks.length} relationships</Badge>
                  <Badge variant="outline" className="gap-1"><Activity className="h-3.5 w-3.5" /> min group {graphData?.minimum_group_size ?? 5}</Badge>
                </div>
                <div className="h-[420px] overflow-hidden rounded-lg">
                  <ForceGraph2D
                    graphData={{ nodes: graphNodes, links: graphLinks }}
                    nodeLabel={(node) => (node as GraphNode).canonical_name}
                    linkLabel={(link) => (link as GraphLink).relationship_type}
                    onNodeClick={(node) => setSelectedNode(node as GraphNode)}
                    nodeRelSize={6}
                    cooldownTicks={80}
                    linkWidth={1.8}
                    linkColor={(link) => relationshipColorByType[(link as GraphLink).relationship_type.toLowerCase()] ?? graphPalette.border}
                    nodeCanvasObject={(node, ctx, globalScale) => {
                      const typedNode = node as GraphNode;
                      const label = typedNode.canonical_name;
                      const fontSize = 12 / globalScale;
                      const isActive = selectedNode?.id === typedNode.id;
                      ctx.beginPath();
                      ctx.arc(typedNode.x ?? 0, typedNode.y ?? 0, isActive ? 8 : 6, 0, 2 * Math.PI, false);
                      ctx.fillStyle = isActive ? graphPalette.accent : graphPalette.validated;
                      ctx.fill();
                      ctx.strokeStyle = graphPalette.background;
                      ctx.lineWidth = 1.5;
                      ctx.stroke();
                      ctx.font = `${fontSize}px Inter, sans-serif`;
                      ctx.fillStyle = graphPalette.foreground;
                      ctx.fillText(label, (typedNode.x ?? 0) + 10, (typedNode.y ?? 0) + 4);
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border bg-background/70 p-4">
                {selectedNode ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Selected entity</p>
                      <h3 className="mt-1 text-lg font-semibold text-foreground">{selectedNode.canonical_name}</h3>
                      <p className="text-sm capitalize text-muted-foreground">{selectedNode.entity_type.replace(/_/g, ' ')}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-md border border-border p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Deals on PIVT</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{selectedNode.deals_count}</p>
                      </div>
                      <div className="rounded-md border border-border p-3">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Known relationships</p>
                        <p className="mt-1 text-xl font-semibold text-foreground">{selectedNode.relationship_count}</p>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">All deals this entity appears in</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedNode.deals_appeared_in.map((dealId) => (
                          <Badge key={dealId} variant="outline" className="font-mono text-[10px]">{dealId.slice(0, 8)}</Badge>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Known relationships</p>
                      <div className="space-y-2">
                        {selectedNode.known_relationships.slice(0, 8).map((relationship) => (
                          <div key={relationship.id} className="rounded-md border border-border p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-foreground">{relationship.other_entity_name}</span>
                              <Badge variant="outline" className="capitalize">{relationship.relationship_type.replace(/_/g, ' ')}</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
                    Select a node to inspect its cross-deal presence and known relationships.
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {effectiveDeal.signing_date && (
        <div className="text-xs text-muted-foreground">
          Current deal has been active for {formatDistanceToNowStrict(new Date(effectiveDeal.signing_date), { addSuffix: false })}.
        </div>
      )}
    </div>
  );
};