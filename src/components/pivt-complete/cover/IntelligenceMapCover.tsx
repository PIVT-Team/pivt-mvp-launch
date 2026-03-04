import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DemoDeal } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Search, Play, RotateCcw, X, Sparkles, ChevronDown, Check,
  Eye, TrendingUp, Maximize2, Minimize2, Map, Crosshair, AlertTriangle, ShieldAlert,
  Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { fadeInUp } from '@/lib/animations';
import { GraphLegend } from './intelligence-map/GraphLegend';
import { NodeDrawer } from './intelligence-map/NodeDrawer';
import { NextActionsBanner } from './intelligence-map/NextActionsBanner';

// ── Types ──
interface DbNode {
  id: string;
  deal_id: string;
  node_type: string;
  label: string;
  status: string;
  metadata: Record<string, unknown>;
  source_entity_id: string | null;
}

interface DbEdge {
  id: string;
  deal_id: string;
  from_node_id: string;
  to_node_id: string;
  edge_type: string;
  metadata: Record<string, unknown>;
}

interface PositionedNode extends DbNode {
  x: number;
  y: number;
  color: string;
  size: number;
}

// ── Color Maps ──
const typeColors: Record<string, string> = {
  deal: '#7C3AED',
  stakeholder: '#A78BFA',
  document: '#22C55E',
  obligation: '#8B5CF6',
  compliance_check: '#06B6D4',
  approval: '#3B82F6',
  payment_intent: '#F59E0B',
  settlement: '#10B981',
  waterfall: '#C084FC',
  discrepancy: '#EF4444',
};

const statusRingColors: Record<string, string> = {
  not_started: 'rgba(148,163,184,0.5)',
  in_progress: '#3B82F6',
  complete: '#22C55E',
  blocked: '#EF4444',
  failed: '#EF4444',
};

type ViewMode = 'overview' | 'execution' | 'risk' | 'ownership';

const VIEW_MODES: { key: ViewMode; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'overview', label: 'Overview', icon: Map, desc: 'Full deal graph' },
  { key: 'execution', label: 'Execution', icon: Crosshair, desc: 'Docs → Compliance → Approvals → Payments' },
  { key: 'risk', label: 'Risk', icon: ShieldAlert, desc: 'Discrepancies & blockers' },
  { key: 'ownership', label: 'Ownership', icon: UsersIcon, desc: 'Stakeholders & payouts' },
];

// Types visible per view mode
const viewTypeFilters: Record<ViewMode, Set<string>> = {
  overview: new Set(Object.keys(typeColors)),
  execution: new Set(['deal', 'document', 'compliance_check', 'approval', 'payment_intent', 'settlement']),
  risk: new Set(['deal', 'discrepancy', 'payment_intent', 'compliance_check']),
  ownership: new Set(['deal', 'stakeholder', 'waterfall', 'payment_intent']),
};

// ── Layout helper: position nodes radially by type ──
function layoutNodes(nodes: DbNode[], viewMode: ViewMode): PositionedNode[] {
  const cx = 400, cy = 300;
  const allowedTypes = viewTypeFilters[viewMode];
  const filtered = nodes.filter(n => allowedTypes.has(n.node_type));

  // Group by type
  const groups = new Map<string, DbNode[]>();
  for (const n of filtered) {
    if (!groups.has(n.node_type)) groups.set(n.node_type, []);
    groups.get(n.node_type)!.push(n);
  }

  const typeOrder = ['deal', 'stakeholder', 'document', 'obligation', 'compliance_check', 'approval', 'payment_intent', 'settlement', 'waterfall', 'discrepancy'];
  const orderedTypes = typeOrder.filter(t => groups.has(t));

  const positioned: PositionedNode[] = [];

  for (let gi = 0; gi < orderedTypes.length; gi++) {
    const type = orderedTypes[gi];
    const group = groups.get(type)!;

    if (type === 'deal') {
      // Center
      for (const n of group) {
        positioned.push({ ...n, x: cx, y: cy, color: typeColors[type] || '#888', size: 40 });
      }
      continue;
    }

    // Spread each type in a sector
    const sectorAngle = (2 * Math.PI) / Math.max(orderedTypes.length - 1, 1);
    const baseAngle = sectorAngle * (gi - 1) - Math.PI / 2;
    const radius = 160 + Math.min(group.length, 8) * 5;

    for (let i = 0; i < group.length; i++) {
      const n = group[i];
      const spread = group.length > 1 ? (i - (group.length - 1) / 2) * 0.3 : 0;
      const angle = baseAngle + spread;
      const r = radius + (i % 2) * 20;
      positioned.push({
        ...n,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        color: typeColors[type] || '#888',
        size: type === 'discrepancy' ? 16 : 20,
      });
    }
  }

  return positioned;
}

// ── Main Component ──
export const IntelligenceMapCover: React.FC = () => {
  const { deals, stakeholders, documents, payments, waterfallTiers, setSelectedDealId, setActiveSection } = usePIVTStore();
  const deal = useSelectedDeal();

  // Try to get deal workspace context (may not exist in all routes)
  let workspaceDealId: string | undefined;
  let isDemoDeal = true;
  try {
    const ctx = useDealWorkspace();
    workspaceDealId = ctx.dealId;
    isDemoDeal = ctx.isDemoDeal;
  } catch {
    // Not within DealWorkspaceProvider — use demo mode
  }

  const [search, setSearch] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLegend, setShowLegend] = useState(true);

  // Graph data from DB
  const [dbNodes, setDbNodes] = useState<DbNode[]>([]);
  const [dbEdges, setDbEdges] = useState<DbEdge[]>([]);
  const [dealState, setDealState] = useState<string | null>(null);
  const [nextActions, setNextActions] = useState<string[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);

  // Fetch graph for real deals
  useEffect(() => {
    if (isDemoDeal || !workspaceDealId) return;
    setGraphLoading(true);

    Promise.all([
      supabase.from('graph_nodes').select('*').eq('deal_id', workspaceDealId),
      supabase.from('graph_edges').select('*').eq('deal_id', workspaceDealId),
    ]).then(([nodesRes, edgesRes]) => {
      setDbNodes((nodesRes.data as DbNode[]) || []);
      setDbEdges((edgesRes.data as DbEdge[]) || []);
      setGraphLoading(false);
    });
  }, [isDemoDeal, workspaceDealId]);

  // Build graph trigger for real deals
  const triggerBuildGraph = useCallback(async () => {
    if (!workspaceDealId || isDemoDeal) return;
    setGraphLoading(true);
    try {
      const { data } = await supabase.functions.invoke('build-deal-graph', {
        body: { deal_id: workspaceDealId },
      });
      if (data) {
        setDealState(data.deal_state);
        setBlockers(data.blockers || []);
        setNextActions(data.next_actions || []);
      }
      // Refresh graph data
      const [nodesRes, edgesRes] = await Promise.all([
        supabase.from('graph_nodes').select('*').eq('deal_id', workspaceDealId),
        supabase.from('graph_edges').select('*').eq('deal_id', workspaceDealId),
      ]);
      setDbNodes((nodesRes.data as DbNode[]) || []);
      setDbEdges((edgesRes.data as DbEdge[]) || []);
    } finally {
      setGraphLoading(false);
    }
  }, [workspaceDealId, isDemoDeal]);

  // ── Demo graph (fallback for demo deals) ──
  const { demoNodes, demoEdges } = useMemo(() => {
    if (!isDemoDeal) return { demoNodes: [] as DbNode[], demoEdges: [] as DbEdge[] };

    const ns: DbNode[] = [];
    const es: DbEdge[] = [];

    ns.push({ id: deal.id, deal_id: deal.id, node_type: 'deal', label: deal.codeName, status: 'in_progress', metadata: { value: `$${(deal.consideration / 1e6).toFixed(0)}M`, buyer: deal.buyerName, target: deal.targetCompany }, source_entity_id: deal.id });

    stakeholders.forEach(s => {
      const st = s.kycStatus === 'verified' ? 'complete' : s.kycStatus === 'failed' ? 'failed' : 'in_progress';
      ns.push({ id: s.id, deal_id: deal.id, node_type: 'stakeholder', label: s.name, status: st, metadata: { ownership: `${s.ownershipPct}%`, payout: `$${(s.payoutAmount / 1e6).toFixed(0)}M`, kyc: s.kycStatus }, source_entity_id: s.id });
      es.push({ id: `e-${deal.id}-${s.id}`, deal_id: deal.id, from_node_id: deal.id, to_node_id: s.id, edge_type: 'HAS_PARTY', metadata: {} });
    });

    documents.slice(0, 6).forEach(d => {
      const st = d.status === 'verified' ? 'complete' : d.status === 'pending' ? 'in_progress' : 'not_started';
      ns.push({ id: d.id, deal_id: deal.id, node_type: 'document', label: d.name.slice(0, 25), status: st, metadata: { type: d.type, status: d.status }, source_entity_id: d.id });
      es.push({ id: `e-${deal.id}-${d.id}`, deal_id: deal.id, from_node_id: deal.id, to_node_id: d.id, edge_type: 'HAS_DOCUMENT', metadata: {} });
    });

    // Demo obligations
    const obligationDemos = [
      { id: 'ob-1', label: 'Base Purchase Price', status: 'complete' },
      { id: 'ob-2', label: 'Escrow Holdback', status: 'in_progress' },
      { id: 'ob-3', label: 'Debt Payoff', status: 'complete' },
      { id: 'ob-4', label: 'Legal Fees', status: 'not_started' },
    ];
    obligationDemos.forEach(ob => {
      ns.push({ id: ob.id, deal_id: deal.id, node_type: 'obligation', label: ob.label, status: ob.status, metadata: {}, source_entity_id: ob.id });
      if (documents[0]) es.push({ id: `e-${documents[0].id}-${ob.id}`, deal_id: deal.id, from_node_id: documents[0].id, to_node_id: ob.id, edge_type: 'DERIVED_FROM', metadata: {} });
    });

    payments.forEach(p => {
      const st = p.status === 'completed' ? 'complete' : p.status === 'failed' ? 'failed' : 'in_progress';
      ns.push({ id: p.id, deal_id: deal.id, node_type: 'payment_intent', label: `${p.recipientName.split(' ')[0]} $${(p.amount / 1e6).toFixed(0)}M`, status: st, metadata: { amount: `$${(p.amount / 1e6).toFixed(0)}M`, method: p.method }, source_entity_id: p.id });
      es.push({ id: `e-${deal.id}-${p.id}`, deal_id: deal.id, from_node_id: deal.id, to_node_id: p.id, edge_type: 'REQUIRES', metadata: {} });
    });

    waterfallTiers.forEach(t => {
      ns.push({ id: t.id, deal_id: deal.id, node_type: 'waterfall', label: t.name.slice(0, 20), status: 'complete', metadata: { amount: `$${(t.amount / 1e6).toFixed(0)}M` }, source_entity_id: t.id });
      es.push({ id: `e-${deal.id}-${t.id}`, deal_id: deal.id, from_node_id: deal.id, to_node_id: t.id, edge_type: 'REQUIRES', metadata: {} });
    });

    // Demo discrepancy
    if (deal.hasBlocker) {
      ns.push({ id: 'disc-1', deal_id: deal.id, node_type: 'discrepancy', label: 'Missing W-9 for Seller', status: 'blocked', metadata: { severity: 'blocker' }, source_entity_id: 'disc-1' });
      if (payments[0]) es.push({ id: 'e-disc-pay', deal_id: deal.id, from_node_id: 'disc-1', to_node_id: payments[0].id, edge_type: 'BLOCKS', metadata: {} });
    }

    return { demoNodes: ns, demoEdges: es };
  }, [deal, stakeholders, documents, payments, waterfallTiers, isDemoDeal]);

  // Choose data source
  const activeNodes = isDemoDeal ? demoNodes : dbNodes;
  const activeEdges = isDemoDeal ? demoEdges : dbEdges;

  // Position nodes
  const positioned = useMemo(() => layoutNodes(activeNodes, viewMode), [activeNodes, viewMode]);

  // Search filter
  const searchFiltered = search
    ? positioned.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : positioned;
  const searchIds = new Set(searchFiltered.map(n => n.id));

  // Hover connectivity
  const connectedIds = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>();
    ids.add(hoveredNode);
    activeEdges.forEach(e => {
      if (e.from_node_id === hoveredNode) ids.add(e.to_node_id);
      if (e.to_node_id === hoveredNode) ids.add(e.from_node_id);
    });
    return ids;
  }, [hoveredNode, activeEdges]);

  const selectedNode = selectedNodeId ? activeNodes.find(n => n.id === selectedNodeId) || null : null;

  // Escape exits fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  // Next actions for banner
  const bannerActions = useMemo(() => {
    if (isDemoDeal) {
      const actions: { label: string; type: 'doc' | 'compliance' | 'approval' | 'payment' | 'discrepancy' }[] = [];
      if (deal.hasBlocker) actions.push({ label: 'Upload Seller W-9', type: 'doc' });
      if (deal.pendingApprovals > 0) actions.push({ label: 'Get Seller Counsel Approval', type: 'approval' });
      const pending = stakeholders.filter(s => s.kycStatus === 'pending');
      if (pending.length > 0) actions.push({ label: `Complete KYC for ${pending[0].name}`, type: 'compliance' });
      return actions;
    }
    return nextActions.map(a => ({
      label: a,
      type: (a.toLowerCase().includes('upload') ? 'doc' :
        a.toLowerCase().includes('compliance') || a.toLowerCase().includes('kyc') ? 'compliance' :
        a.toLowerCase().includes('approv') ? 'approval' :
        a.toLowerCase().includes('resolv') ? 'discrepancy' : 'payment') as any,
    }));
  }, [isDemoDeal, deal, stakeholders, nextActions]);

  const blockerCount = isDemoDeal
    ? positioned.filter(n => n.status === 'blocked' || n.status === 'failed').length
    : blockers.length;

  return (
    <motion.div {...fadeInUp} className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`} style={{ height: isFullscreen ? '100vh' : '85vh' }}>
      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center justify-between gap-4 px-4 shrink-0" style={{ minHeight: 48, background: 'hsl(var(--muted) / 0.25)', border: '1px solid hsl(var(--border) / 0.5)' }}>
        {/* Left: View modes */}
        <div className="flex items-center gap-0.5 shrink-0">
          {VIEW_MODES.map(vm => (
            <Tooltip key={vm.key}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setViewMode(vm.key)}
                  className={`relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors ${
                    viewMode === vm.key ? 'text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                >
                  <vm.icon className="w-3 h-3 shrink-0" />
                  {vm.label}
                  {viewMode === vm.key && (
                    <motion.div layoutId="map-view-underline" className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent) / 0.4))' }} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>{vm.desc}</TooltipContent>
            </Tooltip>
          ))}
        </div>

        {/* Center: Search */}
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search nodes..."
            className="bg-transparent rounded-lg pl-8 pr-3 h-8 text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:bg-muted/20 w-36 focus:w-48 transition-all border-none" />
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {!isDemoDeal && (
            <Button variant="ghost" size="sm" onClick={triggerBuildGraph} disabled={graphLoading} className="text-[11px] h-8 gap-1.5">
              <RotateCcw className={`w-3 h-3 ${graphLoading ? 'animate-spin' : ''}`} />
              Rebuild
            </Button>
          )}
          {dealState && (
            <Badge variant="outline" className="text-[10px]">{dealState.replace(/_/g, ' ')}</Badge>
          )}
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium text-muted-foreground/50 hover:text-foreground transition-colors">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ═══ Graph Canvas ═══ */}
      <div className="flex-1 overflow-hidden relative rounded-xl border border-border/30" style={{ background: 'hsl(var(--background))' }}>
        {graphLoading && !isDemoDeal && positioned.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : positioned.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Map className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-medium">No graph data yet</p>
              <p className="text-xs text-muted-foreground mt-1">Add stakeholders, documents, or payments to populate the deal graph.</p>
            </div>
            {!isDemoDeal && (
              <Button size="sm" onClick={triggerBuildGraph} className="text-xs gap-1.5">
                <RotateCcw className="w-3 h-3" /> Build Graph
              </Button>
            )}
          </div>
        ) : (
          <>
            <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0" preserveAspectRatio="xMidYMid meet">
              <defs>
                <radialGradient id="g-center" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.12" />
                  <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="g-halo-blocked" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="g-halo-progress" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Center glow */}
              <circle cx="400" cy="300" r="100" fill="url(#g-center)" />

              {/* Edges */}
              {activeEdges.map((e, i) => {
                const from = positioned.find(n => n.id === e.from_node_id);
                const to = positioned.find(n => n.id === e.to_node_id);
                if (!from || !to) return null;

                const visible = searchIds.has(from.id) && searchIds.has(to.id);
                const highlighted = hoveredNode ? connectedIds.has(from.id) && connectedIds.has(to.id) : false;
                const dimmed = hoveredNode && !highlighted;
                const isBlocking = e.edge_type === 'BLOCKS';
                const isDerived = e.edge_type === 'DERIVED_FROM';

                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                const dx = to.x - from.x;
                const dy = to.y - from.y;
                const cx2 = mx - dy * 0.08;
                const cy2 = my + dx * 0.08;

                return (
                  <path key={i}
                    d={`M${from.x},${from.y} Q${cx2},${cy2} ${to.x},${to.y}`}
                    fill="none"
                    stroke={isBlocking ? '#EF4444' : highlighted ? '#A78BFA' : 'rgba(168,162,200,0.7)'}
                    strokeWidth={isBlocking ? 3 : highlighted ? 2.5 : 1.5}
                    strokeDasharray={isDerived ? '5 3' : undefined}
                    strokeOpacity={dimmed ? 0.08 : visible ? (highlighted ? 0.8 : 0.3) : 0.08}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-opacity 0.2s' }}
                  />
                );
              })}

              {/* Nodes */}
              {positioned.map(node => {
                const visible = searchIds.has(node.id);
                const isHovered = hoveredNode === node.id;
                const isSelected = selectedNodeId === node.id;
                const isConnected = connectedIds.has(node.id);
                const dimmed = hoveredNode && !isConnected;
                const isDealNode = node.node_type === 'deal';
                const isBlocked = node.status === 'blocked' || node.status === 'failed';
                const ringColor = statusRingColors[node.status] || statusRingColors.not_started;

                // Label: always show for deal, hovered, selected, connected, or top-level
                const showLabel = isDealNode || isHovered || isSelected || (isConnected && !!hoveredNode);

                // Two-line label wrapping
                const labelLines: string[] = [];
                if (node.label.length > 20) {
                  const mid = node.label.lastIndexOf(' ', 20);
                  if (mid > 8) {
                    labelLines.push(node.label.slice(0, mid));
                    labelLines.push(node.label.slice(mid + 1, 40));
                  } else {
                    labelLines.push(node.label.slice(0, 18) + '…');
                  }
                } else {
                  labelLines.push(node.label);
                }

                return (
                  <g key={node.id}
                    onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    className="cursor-pointer"
                    opacity={dimmed ? 0.12 : visible ? 1 : 0.12}
                  >
                    {/* Blocked halo */}
                    {isBlocked && (
                      <circle cx={node.x} cy={node.y} r={node.size * 1.3} fill="url(#g-halo-blocked)">
                        <animate attributeName="r" values={`${node.size * 1.1};${node.size * 1.5};${node.size * 1.1}`} dur="2.5s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Deal pulse */}
                    {isDealNode && (
                      <circle cx={node.x} cy={node.y} r={node.size * 0.8} fill={node.color} opacity={0.06}>
                        <animate attributeName="r" values={`${node.size * 0.7};${node.size * 1.0};${node.size * 0.7}`} dur="3s" repeatCount="indefinite" />
                      </circle>
                    )}
                    {/* Hover glow */}
                    {isHovered && <circle cx={node.x} cy={node.y} r={node.size * 1.1} fill="url(#g-halo-progress)" />}

                    {/* Status ring */}
                    <circle cx={node.x} cy={node.y} r={node.size / 2 + 3} fill="none" stroke={ringColor} strokeWidth="2" opacity="0.6" />

                    {/* Outer */}
                    <circle cx={node.x} cy={node.y} r={node.size / 2} fill={node.color} opacity={0.2} />
                    {/* Inner */}
                    <circle cx={node.x} cy={node.y} r={isDealNode ? node.size / 2.5 : node.size / 3}
                      fill={node.color}
                      stroke={isHovered ? '#fff' : 'transparent'}
                      strokeWidth={2}
                    />

                    {/* Label with wrapping */}
                    {showLabel && labelLines.map((line, li) => (
                      <text key={li} x={node.x} y={node.y + node.size / 2 + 14 + li * 13}
                        textAnchor="middle" fill="hsl(var(--foreground))"
                        fontSize={isDealNode ? 13 : 10}
                        fontWeight={isDealNode || isHovered ? 700 : 500}
                      >
                        {line}
                      </text>
                    ))}

                    {/* Hover tooltip */}
                    {isHovered && !showLabel && (
                      <title>{`${node.label} (${node.node_type}) — ${node.status}`}</title>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Next Actions Banner */}
            {bannerActions.length > 0 && !selectedNode && (
              <NextActionsBanner actions={bannerActions} blockerCount={blockerCount} />
            )}

            {/* Legend */}
            <GraphLegend collapsed={!showLegend} />

            {/* Legend toggle */}
            <button
              onClick={() => setShowLegend(!showLegend)}
              className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-lg bg-background/80 backdrop-blur-sm border border-border/30 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
              style={{ display: showLegend ? 'none' : 'block' }}
            >
              Show Legend
            </button>

            {/* Node type counts */}
            <div className="absolute bottom-3 right-3 flex gap-1.5">
              {Object.entries(typeColors).map(([type, color]) => {
                const count = positioned.filter(n => n.node_type === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center gap-1 rounded-full px-2 py-1 text-[10px] border border-border/30 bg-background/80 backdrop-blur-sm">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Node Drawer */}
        <AnimatePresence>
          {selectedNode && (
            <NodeDrawer
              node={selectedNode}
              edges={activeEdges}
              allNodes={activeNodes}
              onClose={() => setSelectedNodeId(null)}
              onSelectNode={setSelectedNodeId}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
