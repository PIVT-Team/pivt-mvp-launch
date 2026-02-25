import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import {
  Search, Play, RotateCcw, X, ArrowRight, Sparkles,
  Eye, Users, CreditCard, FileText, Shield, Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { springConfig, fadeInUp } from '@/lib/animations';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  color: string;
  size: number;
  riskLevel?: 'critical' | 'warning' | 'info' | 'none';
  metadata?: Record<string, any>;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
  strength?: number;
}

const typeColors: Record<string, string> = {
  deal: '#7C3AED',
  stakeholder: '#A78BFA',
  document: '#22C55E',
  payment: '#F59E0B',
  escrow: '#06B6D4',
  waterfall: '#C084FC',
};

const riskHaloColors: Record<string, string> = {
  critical: '#EF4444',
  warning: '#F59E0B',
  info: '#F97316',
  none: 'transparent',
};

const FILTER_DEFS = [
  { key: 'stakeholder', label: 'Stakeholders', icon: Users },
  { key: 'waterfall', label: 'Financial Entities', icon: CreditCard },
  { key: 'compliance', label: 'Compliance Flags', icon: Shield },
  { key: 'document', label: 'Documents', icon: FileText },
  { key: 'payment', label: 'Transactions', icon: Activity },
] as const;

const SIMULATIONS = [
  { id: 'remove-stakeholder', label: 'Remove a stakeholder', description: 'See how removing a key stakeholder affects the waterfall distribution' },
  { id: 'increase-escrow', label: 'Increase escrow 20%', description: 'Model impact of a larger escrow holdback on net payouts' },
  { id: 'delay-closing', label: 'Delay closing 30 days', description: 'Assess timeline impact on all connected entities' },
  { id: 'add-expense', label: 'Add $50M transaction expense', description: 'See how additional fees flow through the waterfall' },
];

export const IntelligenceMapCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, payments, waterfallTiers } = usePIVTStore();
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [highlightRisk, setHighlightRisk] = useState(true);
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [activeSim, setActiveSim] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, boolean>>({
    stakeholder: true,
    waterfall: true,
    compliance: true,
    document: true,
    payment: true,
  });

  const toggleFilter = (key: string) => setFilters(f => ({ ...f, [key]: !f[key] }));

  // Build graph with risk annotations
  const { nodes, edges } = useMemo(() => {
    const ns: GraphNode[] = [];
    const es: GraphEdge[] = [];
    const cx = 400, cy = 300;

    // Deal node (center, always visible)
    ns.push({
      id: deal.id, label: deal.codeName, type: 'deal', x: cx, y: cy,
      color: typeColors.deal, size: 48, riskLevel: deal.hasBlocker ? 'critical' : 'none',
      metadata: { value: `$${(deal.consideration / 1e9).toFixed(1)}B`, status: deal.status, buyer: deal.buyerName, target: deal.targetCompany },
    });

    // Stakeholders
    if (filters.stakeholder) {
      stakeholders.forEach((s, i) => {
        const angle = (-Math.PI / 2) + (i - stakeholders.length / 2) * 0.3;
        const risk: GraphNode['riskLevel'] =
          s.kycStatus === 'failed' ? 'critical' :
          s.kycStatus === 'pending' ? 'warning' : 'none';
        ns.push({
          id: s.id, label: s.name, type: 'stakeholder',
          x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 180,
          color: typeColors.stakeholder, size: 26, riskLevel: risk,
          metadata: { role: s.role, kyc: s.kycStatus, payout: `$${(s.payoutAmount / 1e6).toFixed(0)}M`, ownership: `${s.ownershipPct}%` },
        });
        es.push({ from: deal.id, to: s.id, label: 'has_stakeholder', strength: s.ownershipPct / 30 });
      });
    }

    // Documents
    if (filters.document) {
      documents.slice(0, 6).forEach((d, i) => {
        const angle = 0 + (i - 3) * 0.35;
        const risk: GraphNode['riskLevel'] =
          d.status === 'rejected' ? 'critical' :
          d.status === 'pending' ? 'warning' : 'none';
        ns.push({
          id: d.id, label: d.name.slice(0, 20), type: 'document',
          x: cx + Math.cos(angle) * 260, y: cy + Math.sin(angle) * 200,
          color: typeColors.document, size: 20, riskLevel: risk,
          metadata: { docType: d.type, status: d.status, uploaded: d.uploadedAt },
        });
        es.push({ from: deal.id, to: d.id, label: 'references' });
      });
    }

    // Payments
    if (filters.payment) {
      payments.forEach((p, i) => {
        const angle = (Math.PI / 2) + (i - payments.length / 2) * 0.35;
        const risk: GraphNode['riskLevel'] =
          p.status === 'failed' ? 'critical' :
          p.status === 'pending' ? 'info' : 'none';
        ns.push({
          id: p.id, label: p.recipientName.split(' ')[0], type: 'payment',
          x: cx + Math.cos(angle) * 230, y: cy + Math.sin(angle) * 190,
          color: typeColors.payment, size: 22, riskLevel: risk,
          metadata: { amount: `$${(p.amount / 1e6).toFixed(0)}M`, status: p.status, method: p.method },
        });
        es.push({ from: deal.id, to: p.id, label: 'pays' });
      });
    }

    // Waterfall
    if (filters.waterfall) {
      waterfallTiers.forEach((t, i) => {
        const angle = Math.PI + (i - waterfallTiers.length / 2) * 0.35;
        ns.push({
          id: t.id, label: t.name.slice(0, 15), type: 'waterfall',
          x: cx + Math.cos(angle) * 240, y: cy + Math.sin(angle) * 180,
          color: typeColors.waterfall, size: 20, riskLevel: 'none',
          metadata: { amount: `$${(t.amount / 1e6).toFixed(0)}M`, percentage: `${t.percentage}%`, recipients: t.recipients },
        });
        es.push({ from: deal.id, to: t.id, label: 'distributes' });
      });
    }

    // Cross-entity edges
    if (filters.stakeholder && filters.payment) {
      stakeholders.forEach(s => {
        const mp = payments.find(p => p.recipientName === s.name);
        if (mp) es.push({ from: s.id, to: mp.id, label: 'receives_payment', strength: 0.5 });
      });
    }

    return { nodes: ns, edges: es };
  }, [deal, stakeholders, documents, payments, waterfallTiers, filters]);

  const filtered = search ? nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase())) : nodes;
  const filteredIds = new Set(filtered.map(n => n.id));

  const connectedIds = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const ids = new Set<string>();
    ids.add(hoveredNode);
    edges.forEach(e => {
      if (e.from === hoveredNode) ids.add(e.to);
      if (e.to === hoveredNode) ids.add(e.from);
    });
    return ids;
  }, [hoveredNode, edges]);

  const runSimulation = (simId: string) => {
    setActiveSim(simId);
    const results: Record<string, string> = {
      'remove-stakeholder': `Removing ${stakeholders[0]?.name} redistributes $${(stakeholders[0]?.payoutAmount / 1e6).toFixed(0)}M across ${stakeholders.length - 1} remaining parties.`,
      'increase-escrow': `20% escrow increase ($${((deal.consideration * 0.1 * 0.2) / 1e6).toFixed(0)}M additional) reduces immediate payouts by ~4% per stakeholder.`,
      'delay-closing': `30-day delay: 3 KYC verifications may expire, 2 wire instructions need revalidation, est. $2.1M additional costs.`,
      'add-expense': `$50M expense reduces Common Distribution from $${(waterfallTiers[waterfallTiers.length - 1]?.amount / 1e6).toFixed(0)}M to $${((waterfallTiers[waterfallTiers.length - 1]?.amount - 50_000_000) / 1e6).toFixed(0)}M.`,
    };
    setSimResult(results[simId] || 'Simulation complete.');
  };

  const riskNodeCount = nodes.filter(n => n.riskLevel && n.riskLevel !== 'none').length;

  return (
    <motion.div {...fadeInUp} className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">Intelligence Map</h2>
        <p className="text-sm text-muted-foreground">Relationship and risk visualization for this deal.</p>
      </div>

      {/* Toolbar */}
      <div className="pivt-card p-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="bg-muted/50 border border-border rounded-lg pl-9 pr-4 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent/50 w-56"
          />
        </div>

        {/* Filters */}
        {FILTER_DEFS.map(f => (
          <button
            key={f.key}
            onClick={() => toggleFilter(f.key)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
              filters[f.key]
                ? 'bg-accent/10 border-accent/20 text-foreground'
                : 'bg-muted/30 border-border text-muted-foreground'
            }`}
          >
            <f.icon className="w-3 h-3" />
            {f.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Risk toggle */}
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Highlight Risk Nodes</span>
          <Switch checked={highlightRisk} onCheckedChange={setHighlightRisk} />
          {riskNodeCount > 0 && (
            <Badge variant="outline" className="text-[9px] border-destructive/30 text-destructive">
              {riskNodeCount} flagged
            </Badge>
          )}
        </div>

        {/* What-If */}
        <Button variant="outline" size="sm" onClick={() => setShowSimPanel(!showSimPanel)}>
          <Play className="w-3.5 h-3.5 mr-1.5" />
          What-If
        </Button>
      </div>

      {/* Graph + Panels */}
      <div className="pivt-card overflow-hidden flex" style={{ height: 520 }}>
        {/* SVG Graph */}
        <div className="flex-1 relative bg-background">
          <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
            <defs>
              <radialGradient id="im-glow-accent" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
              </radialGradient>
              {/* Risk halos */}
              <radialGradient id="halo-critical" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#EF4444" stopOpacity="0.5" />
                <stop offset="70%" stopColor="#EF4444" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="halo-warning" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.5" />
                <stop offset="70%" stopColor="#F59E0B" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="halo-info" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.4" />
                <stop offset="70%" stopColor="#F97316" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => {
              const from = nodes.find(n => n.id === e.from);
              const to = nodes.find(n => n.id === e.to);
              if (!from || !to) return null;
              const visible = filteredIds.has(from.id) && filteredIds.has(to.id);
              const highlighted = hoveredNode ? connectedIds.has(from.id) && connectedIds.has(to.id) : false;
              return (
                <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={highlighted ? 'hsl(var(--accent))' : visible ? 'hsl(var(--border))' : 'hsl(var(--border) / 0.2)'}
                  strokeWidth={highlighted ? 2 : e.strength ? Math.max(1, e.strength * 2) : 1}
                  strokeDasharray={e.label === 'receives_payment' ? '4 2' : undefined}
                  strokeOpacity={highlighted ? 0.7 : visible ? 0.4 : 0.1}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const visible = filteredIds.has(node.id);
              const isHovered = hoveredNode === node.id;
              const isConnected = connectedIds.has(node.id);
              const dimmed = hoveredNode && !isConnected;
              const showHalo = highlightRisk && node.riskLevel && node.riskLevel !== 'none';
              return (
                <g key={node.id}
                  onClick={() => setSelectedNode(node)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.15 : visible ? 1 : 0.15}
                >
                  {/* Risk halo */}
                  {showHalo && (
                    <circle cx={node.x} cy={node.y} r={node.size * 1.2}
                      fill={`url(#halo-${node.riskLevel})`}
                    >
                      <animate attributeName="r" values={`${node.size * 1.1};${node.size * 1.4};${node.size * 1.1}`} dur="2.5s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {isHovered && (
                    <circle cx={node.x} cy={node.y} r={node.size} fill="url(#im-glow-accent)" />
                  )}
                  <circle cx={node.x} cy={node.y} r={node.size / 2} fill={node.color} opacity={0.2} />
                  <circle cx={node.x} cy={node.y} r={node.size / 3}
                    fill={node.color}
                    stroke={showHalo ? riskHaloColors[node.riskLevel!] : isHovered ? 'hsl(var(--foreground))' : 'transparent'}
                    strokeWidth={showHalo ? 2.5 : 2}
                  />
                  {(node.size > 18 || isHovered) && (
                    <text x={node.x} y={node.y + node.size / 2 + 14}
                      textAnchor="middle"
                      fill={isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'}
                      fontSize={isHovered ? 11 : 10}
                      fontWeight={isHovered ? 600 : 400}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Entity counts */}
          <div className="absolute bottom-3 left-3 flex gap-2">
            {Object.entries(typeColors).map(([type, color]) => {
              const count = nodes.filter(n => n.type === type).length;
              if (count === 0) return null;
              return (
                <div key={type} className="flex items-center gap-1.5 bg-muted/60 rounded-full px-2.5 py-1 text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-muted-foreground capitalize">{type}</span>
                  <span className="text-foreground font-medium">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Read-only badge */}
          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="text-[9px] border-border text-muted-foreground">
              Read-Only View
            </Badge>
          </div>
        </div>

        {/* What-If Panel */}
        <AnimatePresence>
          {showSimPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={springConfig.standard}
              className="border-l border-border overflow-hidden shrink-0 bg-muted/30"
            >
              <div className="p-4 w-[300px]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-semibold">What-If Simulations</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowSimPanel(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="space-y-2">
                  {SIMULATIONS.map(sim => (
                    <button key={sim.id} onClick={() => runSimulation(sim.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-xs ${
                        activeSim === sim.id ? 'border-accent/50 bg-accent/5' : 'border-border bg-background hover:bg-muted/50'
                      }`}
                    >
                      <p className="font-medium">{sim.label}</p>
                      <p className="text-muted-foreground mt-0.5">{sim.description}</p>
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {simResult && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-medium text-accent">Simulation Result</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{simResult}</p>
                      <button onClick={() => { setSimResult(null); setActiveSim(null); }}
                        className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected Node Detail */}
        <AnimatePresence>
          {selectedNode && !showSimPanel && (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute top-16 right-4 w-72 rounded-xl border border-border overflow-hidden bg-background shadow-lg"
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: selectedNode.color }} />
                  <Badge variant="outline" className="text-[10px]">
                    {selectedNode.type}
                  </Badge>
                  {selectedNode.riskLevel && selectedNode.riskLevel !== 'none' && (
                    <Badge className={`text-[9px] ${
                      selectedNode.riskLevel === 'critical' ? 'bg-destructive/10 text-destructive' :
                      selectedNode.riskLevel === 'warning' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-orange-500/10 text-orange-600'
                    }`}>
                      {selectedNode.riskLevel}
                    </Badge>
                  )}
                  <button onClick={() => setSelectedNode(null)} className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-semibold text-sm">{selectedNode.label}</p>
                {selectedNode.metadata && (
                  <div className="mt-3 space-y-1.5">
                    {Object.entries(selectedNode.metadata).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Connected to {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length} entities
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {edges
                      .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
                      .slice(0, 5)
                      .map((edge, i) => {
                        const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                        const other = nodes.find(n => n.id === otherId);
                        if (!other) return null;
                        return (
                          <button key={i} onClick={() => setSelectedNode(other)}
                            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5"
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: other.color }} />
                            <span className="truncate">{other.label}</span>
                            <ArrowRight className="w-3 h-3 ml-auto shrink-0" />
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
