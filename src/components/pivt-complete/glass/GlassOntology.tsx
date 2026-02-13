import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { Search, Zap, Play, RotateCcw, Maximize2, X, ArrowRight, AlertTriangle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { springConfig, fadeInUp } from '@/lib/animations';

interface GraphNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  color: string;
  size: number;
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

const typeLabels: Record<string, string> = {
  deal: 'Deal',
  stakeholder: 'Stakeholder',
  document: 'Document',
  payment: 'Payment',
  escrow: 'Escrow',
  waterfall: 'Waterfall Tier',
};

// What-if simulation presets
const SIMULATIONS = [
  { id: 'remove-stakeholder', label: 'Remove a stakeholder', description: 'See how removing a key stakeholder affects the waterfall distribution' },
  { id: 'increase-escrow', label: 'Increase escrow 20%', description: 'Model impact of a larger escrow holdback on net payouts' },
  { id: 'delay-closing', label: 'Delay closing 30 days', description: 'Assess timeline impact on all connected entities' },
  { id: 'add-expense', label: 'Add $50M transaction expense', description: 'See how additional fees flow through the waterfall' },
];

export const GlassOntology: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, payments, waterfallTiers, setActiveSection } = usePIVTStore();
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [activeSim, setActiveSim] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ node: GraphNode; x: number; y: number } | null>(null);

  const { nodes, edges } = useMemo(() => {
    const ns: GraphNode[] = [];
    const es: GraphEdge[] = [];
    const cx = 400, cy = 300;

    // Deal node (center)
    ns.push({
      id: deal.id, label: deal.codeName, type: 'deal', x: cx, y: cy,
      color: typeColors.deal, size: 44,
      metadata: { value: `$${(deal.consideration / 1e9).toFixed(1)}B`, status: deal.status, buyer: deal.buyerName, target: deal.targetCompany },
    });

    // Stakeholders (top arc)
    stakeholders.forEach((s, i) => {
      const angle = (-Math.PI / 2) + (i - stakeholders.length / 2) * 0.3;
      ns.push({
        id: s.id, label: s.name, type: 'stakeholder',
        x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 180,
        color: typeColors.stakeholder, size: 26,
        metadata: { role: s.role, kyc: s.kycStatus, payout: `$${(s.payoutAmount / 1e6).toFixed(0)}M`, ownership: `${s.ownershipPct}%` },
      });
      es.push({ from: deal.id, to: s.id, label: 'has_stakeholder', strength: s.ownershipPct / 30 });
    });

    // Documents (right arc)
    documents.slice(0, 6).forEach((d, i) => {
      const angle = 0 + (i - 3) * 0.35;
      ns.push({
        id: d.id, label: d.name.slice(0, 20), type: 'document',
        x: cx + Math.cos(angle) * 260, y: cy + Math.sin(angle) * 200,
        color: typeColors.document, size: 20,
        metadata: { docType: d.type, status: d.status, uploaded: d.uploadedAt },
      });
      es.push({ from: deal.id, to: d.id, label: 'references' });
    });

    // Payments (bottom arc)
    payments.forEach((p, i) => {
      const angle = (Math.PI / 2) + (i - payments.length / 2) * 0.35;
      ns.push({
        id: p.id, label: p.recipientName.split(' ')[0], type: 'payment',
        x: cx + Math.cos(angle) * 230, y: cy + Math.sin(angle) * 190,
        color: typeColors.payment, size: 22,
        metadata: { amount: `$${(p.amount / 1e6).toFixed(0)}M`, status: p.status, method: p.method },
      });
      es.push({ from: deal.id, to: p.id, label: 'pays' });
    });

    // Waterfall (left arc)
    waterfallTiers.forEach((t, i) => {
      const angle = Math.PI + (i - waterfallTiers.length / 2) * 0.35;
      ns.push({
        id: t.id, label: t.name.slice(0, 15), type: 'waterfall',
        x: cx + Math.cos(angle) * 240, y: cy + Math.sin(angle) * 180,
        color: typeColors.waterfall, size: 20,
        metadata: { amount: `$${(t.amount / 1e6).toFixed(0)}M`, percentage: `${t.percentage}%`, recipients: t.recipients },
      });
      es.push({ from: deal.id, to: t.id, label: 'distributes' });
    });

    // Cross-entity edges: link stakeholders to payments
    stakeholders.forEach(s => {
      const matchingPayment = payments.find(p => p.recipientName === s.name);
      if (matchingPayment) {
        es.push({ from: s.id, to: matchingPayment.id, label: 'receives_payment', strength: 0.5 });
      }
    });

    return { nodes: ns, edges: es };
  }, [deal, stakeholders, documents, payments, waterfallTiers]);

  const filtered = search
    ? nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : nodes;
  const filteredIds = new Set(filtered.map(n => n.id));

  // Connected node IDs for hover highlighting
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

  const handleContextMenu = useCallback((e: React.MouseEvent, node: GraphNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ node, x: e.clientX, y: e.clientY });
  }, []);

  const runSimulation = (simId: string) => {
    setActiveSim(simId);
    // Simulated results
    const results: Record<string, string> = {
      'remove-stakeholder': `Removing the largest stakeholder (${stakeholders[0]?.name}) would redistribute $${(stakeholders[0]?.payoutAmount / 1e6).toFixed(0)}M across ${stakeholders.length - 1} remaining parties. Common distribution tier increases by ${((stakeholders[0]?.ownershipPct || 0)).toFixed(1)}%.`,
      'increase-escrow': `Increasing escrow holdback by 20% ($${((deal.consideration * 0.1 * 0.2) / 1e6).toFixed(0)}M additional) reduces immediate payouts. Net effect: each stakeholder receives ~4% less at closing, with deferred release at 18-month milestone.`,
      'delay-closing': `30-day delay impacts: 3 time-sensitive KYC verifications may expire, 2 wire instructions need revalidation, estimated additional transaction costs of $2.1M in interest and advisory fees.`,
      'add-expense': `$50M additional expense reduces Common Distribution tier from $${(waterfallTiers[waterfallTiers.length - 1]?.amount / 1e6).toFixed(0)}M to $${((waterfallTiers[waterfallTiers.length - 1]?.amount - 50_000_000) / 1e6).toFixed(0)}M. Pro-rata reduction of ~3.1% across ${waterfallTiers[waterfallTiers.length - 1]?.recipients} recipients.`,
    };
    setSimResult(results[simId] || 'Simulation complete.');
  };

  const navigateToSection = (type: string) => {
    const sectionMap: Record<string, string> = {
      stakeholder: 'stakeholders',
      document: 'documents',
      payment: 'payments',
      waterfall: 'waterfall',
      deal: 'command',
    };
    setActiveSection((sectionMap[type] || 'command') as any);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: '#0B0B0B', color: '#fff' }} onClick={() => setContextMenu(null)}>
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-white/10">
        <Zap className="w-5 h-5 text-accent" />
        <h2 className="text-lg font-semibold">Deal Ontology — {deal.codeName}</h2>
        <div className="flex-1" />

        {/* What-if button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowSimPanel(!showSimPanel)}
          className="border-white/10 text-white/70 hover:text-white hover:bg-white/5 bg-transparent"
        >
          <Play className="w-3.5 h-3.5 mr-1.5" />
          What-If
        </Button>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 w-64"
          />
        </div>
        <div className="flex items-center gap-3 text-xs">
          {Object.entries(typeColors).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-white/50 capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex relative overflow-hidden">
        {/* Graph SVG */}
        <div className="flex-1 relative">
          <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
            {/* Animated gradient defs */}
            <defs>
              <radialGradient id="glow-accent" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
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
                <line
                  key={i}
                  x1={from.x} y1={from.y}
                  x2={to.x} y2={to.y}
                  stroke={highlighted ? 'rgba(124,58,237,0.5)' : visible ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.03)'}
                  strokeWidth={highlighted ? 2 : e.strength ? Math.max(1, e.strength * 2) : 1}
                  strokeDasharray={e.label === 'receives_payment' ? '4 2' : undefined}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const visible = filteredIds.has(node.id);
              const isHovered = hoveredNode === node.id;
              const isConnected = connectedIds.has(node.id);
              const dimmed = hoveredNode && !isConnected;
              return (
                <g
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onContextMenu={(e) => handleContextMenu(e as any, node)}
                  className="cursor-pointer"
                  opacity={dimmed ? 0.1 : visible ? 1 : 0.15}
                >
                  {/* Glow on hover */}
                  {isHovered && (
                    <circle cx={node.x} cy={node.y} r={node.size} fill="url(#glow-accent)" />
                  )}
                  <circle cx={node.x} cy={node.y} r={node.size / 2} fill={node.color} opacity={0.2} />
                  <circle
                    cx={node.x} cy={node.y} r={node.size / 3}
                    fill={node.color}
                    stroke={isHovered ? '#fff' : 'transparent'}
                    strokeWidth={2}
                  />
                  {(node.size > 18 || isHovered) && (
                    <text
                      x={node.x}
                      y={node.y + node.size / 2 + 14}
                      textAnchor="middle"
                      fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'}
                      fontSize={isHovered ? 11 : 10}
                      fontFamily="Inter"
                      fontWeight={isHovered ? 600 : 400}
                    >
                      {node.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Entity count overlay */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            {Object.entries(typeColors).map(([type, color]) => {
              const count = nodes.filter(n => n.type === type).length;
              return (
                <div key={type} className="flex items-center gap-1.5 bg-white/5 rounded-full px-2.5 py-1 text-[10px]">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-white/60">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* What-If Simulation Panel */}
        <AnimatePresence>
          {showSimPanel && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={springConfig.standard}
              className="border-l border-white/10 overflow-hidden shrink-0"
              style={{ background: 'rgba(17,17,17,0.98)' }}
            >
              <div className="p-4 w-80">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-accent" />
                    <h3 className="text-sm font-semibold">What-If Simulations</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40" onClick={() => setShowSimPanel(false)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="space-y-2">
                  {SIMULATIONS.map(sim => (
                    <button
                      key={sim.id}
                      onClick={() => runSimulation(sim.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors text-xs ${
                        activeSim === sim.id
                          ? 'border-accent/50 bg-accent/5'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/5 hover:border-white/10'
                      }`}
                    >
                      <p className="font-medium text-white/90">{sim.label}</p>
                      <p className="text-white/40 mt-0.5">{sim.description}</p>
                    </button>
                  ))}
                </div>

                {/* Simulation Result */}
                <AnimatePresence>
                  {simResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="mt-4 p-3 rounded-lg bg-accent/5 border border-accent/20"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-accent" />
                        <span className="text-xs font-medium text-accent">Simulation Result</span>
                      </div>
                      <p className="text-xs text-white/70 leading-relaxed">{simResult}</p>
                      <button
                        onClick={() => { setSimResult(null); setActiveSim(null); }}
                        className="mt-2 flex items-center gap-1 text-[10px] text-white/40 hover:text-white/60"
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

        {/* Selected node detail panel */}
        <AnimatePresence>
          {selectedNode && !showSimPanel && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-4 right-4 w-80 rounded-xl border border-white/10 overflow-hidden"
              style={{ background: 'rgba(17,17,17,0.95)', backdropFilter: 'blur(20px)' }}
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: selectedNode.color }} />
                  <Badge variant="outline" className="text-[10px] border-white/10 text-white/60">
                    {typeLabels[selectedNode.type] || selectedNode.type}
                  </Badge>
                  <button onClick={() => setSelectedNode(null)} className="ml-auto text-white/40 hover:text-white text-xs">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-semibold text-white text-sm">{selectedNode.label}</p>

                {/* Metadata */}
                {selectedNode.metadata && (
                  <div className="mt-3 space-y-1.5">
                    {Object.entries(selectedNode.metadata).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-white/40 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="text-white/80 font-medium">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                  <p className="text-xs text-white/50">
                    Connected to {edges.filter(e => e.from === selectedNode.id || e.to === selectedNode.id).length} entities
                  </p>

                  {/* Connected entities list */}
                  <div className="space-y-1">
                    {edges
                      .filter(e => e.from === selectedNode.id || e.to === selectedNode.id)
                      .slice(0, 5)
                      .map((edge, i) => {
                        const otherId = edge.from === selectedNode.id ? edge.to : edge.from;
                        const other = nodes.find(n => n.id === otherId);
                        if (!other) return null;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedNode(other)}
                            className="w-full flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors py-0.5"
                          >
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: other.color }} />
                            <span className="truncate">{other.label}</span>
                            <ArrowRight className="w-3 h-3 ml-auto shrink-0" />
                          </button>
                        );
                      })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 border-white/10 text-white/60 hover:text-white bg-transparent text-xs"
                    onClick={() => navigateToSection(selectedNode.type)}
                  >
                    <Maximize2 className="w-3 h-3 mr-1.5" />
                    Open in Cover Mode
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context menu */}
        <AnimatePresence>
          {contextMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 rounded-lg border border-white/10 py-1 min-w-[160px]"
              style={{
                left: contextMenu.x,
                top: contextMenu.y,
                background: 'rgba(17,17,17,0.98)',
                backdropFilter: 'blur(20px)',
              }}
            >
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                onClick={() => { setSelectedNode(contextMenu.node); setContextMenu(null); }}
              >
                View details
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                onClick={() => { navigateToSection(contextMenu.node.type); setContextMenu(null); }}
              >
                Open in Cover Mode
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-white/70 hover:bg-white/5 hover:text-white"
                onClick={() => { setHoveredNode(contextMenu.node.id); setContextMenu(null); }}
              >
                Highlight connections
              </button>
              <div className="border-t border-white/5 my-1" />
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-white/40 hover:bg-white/5 hover:text-white/60"
                onClick={() => setContextMenu(null)}
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
