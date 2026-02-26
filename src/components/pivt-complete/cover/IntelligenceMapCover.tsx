import React, { useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DemoDeal } from '@/stores/pivtStore';
import {
  Search, Play, RotateCcw, X, ArrowRight, Sparkles, ChevronDown, Check,
  Eye, Users, CreditCard, FileText, Shield, Activity, ExternalLink,
  Calendar, AlertTriangle, Ban, TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { springConfig, fadeInUp } from '@/lib/animations';

// ── Types ──
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

// ── Deal Selector Dropdown ──
const DealSelectorDropdown: React.FC<{
  deals: DemoDeal[];
  selectedDealId: string;
  onSelect: (id: string) => void;
}> = ({ deals, selectedDealId, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const selected = deals.find(d => d.id === selectedDealId) || deals[0];

  const filtered = searchTerm
    ? deals.filter(d => d.codeName.toLowerCase().includes(searchTerm.toLowerCase()) || d.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : deals;

  const statusDot: Record<string, string> = {
    drafting: 'bg-muted-foreground/40',
    diligence: 'bg-amber-400',
    signing: 'bg-blue-400',
    closing: 'bg-emerald-500',
    completed: 'bg-emerald-600',
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/50 bg-background/60 backdrop-blur-sm hover:bg-muted/40 transition-all text-sm"
      >
        <span className={`w-2 h-2 rounded-full ${statusDot[selected.status] || 'bg-muted-foreground/40'}`} />
        <span className="font-medium">Viewing: {selected.codeName}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-xl z-50 overflow-hidden"
            >
              <div className="p-2">
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search deals..."
                    className="w-full bg-muted/40 border border-border/50 rounded-lg pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:border-accent/40"
                    autoFocus
                  />
                </div>
              </div>
              <div className="max-h-60 overflow-y-auto px-1 pb-1">
                {filtered.map(deal => (
                  <button
                    key={deal.id}
                    onClick={() => { onSelect(deal.id); setOpen(false); setSearchTerm(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-all ${
                      deal.id === selectedDealId ? 'bg-accent/8' : 'hover:bg-muted/40'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot[deal.status] || 'bg-muted-foreground/40'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{deal.codeName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{deal.buyerName} → {deal.targetCompany}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs">${(deal.consideration / 1e6).toFixed(0)}M</p>
                      <p className="text-[10px] text-muted-foreground">{deal.readyToPayPercent}%</p>
                    </div>
                    {deal.id === selectedDealId && <Check className="w-3.5 h-3.5 text-accent shrink-0" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Deal Detail Side Panel ──
const DealDetailPanel: React.FC<{
  deal: DemoDeal;
  onClose: () => void;
  onGoToWorkspace: () => void;
  riskCount: number;
}> = ({ deal, onClose, onGoToWorkspace, riskCount }) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className="absolute top-4 right-4 w-80 rounded-2xl border border-border/50 overflow-hidden bg-background/95 backdrop-blur-xl shadow-xl z-10"
  >
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Deal Details</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div>
        <h4 className="text-lg font-semibold" style={{ letterSpacing: '-0.03em' }}>{deal.codeName}</h4>
        <p className="text-xs text-muted-foreground/70 mt-0.5">{deal.buyerName} acquiring {deal.targetCompany}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="pivt-card p-3">
          <p className="pivt-metric-label">Deal Value</p>
          <p className="font-mono text-sm font-medium mt-1">${(deal.consideration / 1e6).toFixed(0)}M</p>
        </div>
        <div className="pivt-card p-3">
          <p className="pivt-metric-label">Readiness</p>
          <p className="font-mono text-sm font-medium mt-1">{deal.readyToPayPercent}%</p>
        </div>
        <div className="pivt-card p-3">
          <p className="pivt-metric-label">Risk Nodes</p>
          <p className={`font-mono text-sm font-medium mt-1 ${riskCount > 0 ? 'text-blocking' : 'text-validated'}`}>{riskCount}</p>
        </div>
        <div className="pivt-card p-3">
          <p className="pivt-metric-label">Approvals</p>
          <p className={`font-mono text-sm font-medium mt-1 ${deal.pendingApprovals > 0 ? 'text-discrepancy' : 'text-validated'}`}>{deal.pendingApprovals}</p>
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Discrepancies</span>
          <span className={`font-medium ${deal.discrepanciesFound > 0 ? 'text-discrepancy' : 'text-validated'}`}>{deal.discrepanciesFound}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Closing Date</span>
          <span className="font-medium">{deal.closingDate}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Sector</span>
          <span className="font-medium">{deal.sector}</span>
        </div>
      </div>

      <button
        onClick={onGoToWorkspace}
        className="w-full pivt-btn-primary text-white text-xs font-medium py-2.5 rounded-xl flex items-center justify-center gap-2"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        Go to Deal Workspace
      </button>
    </div>
  </motion.div>
);

// ── Portfolio View (aggregate graph of all deals) ──
const PortfolioGraph: React.FC<{
  deals: DemoDeal[];
  onDealClick: (dealId: string) => void;
}> = ({ deals, onDealClick }) => {
  const [hoveredDeal, setHoveredDeal] = useState<string | null>(null);
  const cx = 400, cy = 300;

  // Position deals in a circle
  const dealNodes = deals.map((d, i) => {
    const angle = (2 * Math.PI * i) / deals.length - Math.PI / 2;
    const radius = deals.length <= 3 ? 160 : 200;
    return {
      ...d,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      riskLevel: d.hasBlocker ? 'critical' as const : d.discrepanciesFound > 3 ? 'warning' as const : 'none' as const,
    };
  });

  // Find shared stakeholders (demo: just connect deals that share sectors conceptually)
  const crossEdges: { from: string; to: string; label: string }[] = [];
  // For demo, connect deals that share high risk
  for (let i = 0; i < dealNodes.length; i++) {
    for (let j = i + 1; j < dealNodes.length; j++) {
      if (dealNodes[i].pendingApprovals > 0 && dealNodes[j].pendingApprovals > 0) {
        crossEdges.push({ from: dealNodes[i].id, to: dealNodes[j].id, label: 'shared_risk' });
      }
    }
  }

  return (
    <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
      <defs>
        <radialGradient id="portfolio-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.2" />
          <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="p-halo-critical" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#EF4444" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#EF4444" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="p-halo-warning" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Center label */}
      <text x={cx} y={cy - 10} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10" fontWeight="500">
        PORTFOLIO
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="13" fontWeight="600">
        {deals.length} Deals
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="10">
        ${(deals.reduce((s, d) => s + d.consideration, 0) / 1e6).toFixed(0)}M Total
      </text>

      {/* Cross-deal edges */}
      {crossEdges.map((e, i) => {
        const from = dealNodes.find(d => d.id === e.from);
        const to = dealNodes.find(d => d.id === e.to);
        if (!from || !to) return null;
        return (
          <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="hsl(var(--accent))" strokeWidth="1" strokeDasharray="6 3" strokeOpacity="0.3"
          />
        );
      })}

      {/* Spokes from center */}
      {dealNodes.map(d => (
        <line key={`spoke-${d.id}`} x1={cx} y1={cy} x2={d.x} y2={d.y}
          stroke="hsl(var(--border))" strokeWidth="1" strokeOpacity="0.25"
        />
      ))}

      {/* Deal nodes */}
      {dealNodes.map(d => {
        const isHovered = hoveredDeal === d.id;
        const showHalo = d.riskLevel !== 'none';
        return (
          <g key={d.id}
            onClick={() => onDealClick(d.id)}
            onMouseEnter={() => setHoveredDeal(d.id)}
            onMouseLeave={() => setHoveredDeal(null)}
            className="cursor-pointer"
          >
            {showHalo && (
              <circle cx={d.x} cy={d.y} r={50}
                fill={d.riskLevel === 'critical' ? 'url(#p-halo-critical)' : 'url(#p-halo-warning)'}
              >
                <animate attributeName="r" values="45;55;45" dur="2.5s" repeatCount="indefinite" />
              </circle>
            )}
            {isHovered && <circle cx={d.x} cy={d.y} r={42} fill="url(#portfolio-glow)" />}
            <circle cx={d.x} cy={d.y} r={28} fill={typeColors.deal} opacity={0.15} />
            <circle cx={d.x} cy={d.y} r={20} fill={typeColors.deal}
              stroke={isHovered ? 'hsl(var(--foreground))' : showHalo ? riskHaloColors[d.riskLevel] : 'transparent'}
              strokeWidth={2}
            />
            <text x={d.x} y={d.y + 38} textAnchor="middle" fill={isHovered ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))'} fontSize={isHovered ? 12 : 11} fontWeight={isHovered ? 600 : 500}>
              {d.codeName}
            </text>
            <text x={d.x} y={d.y + 52} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9">
              ${(d.consideration / 1e6).toFixed(0)}M · {d.readyToPayPercent}%
            </text>
            {/* Readiness arc */}
            <circle cx={d.x} cy={d.y} r={24} fill="none" stroke="hsl(var(--border))" strokeWidth="2" opacity="0.2" />
            <circle cx={d.x} cy={d.y} r={24} fill="none" stroke={typeColors.deal} strokeWidth="2"
              strokeDasharray={`${(d.readyToPayPercent / 100) * 150.8} 150.8`}
              strokeLinecap="round"
              transform={`rotate(-90 ${d.x} ${d.y})`}
              opacity="0.7"
            />
          </g>
        );
      })}
    </svg>
  );
};

// ── Main Component ──
export const IntelligenceMapCover: React.FC = () => {
  const { deals, stakeholders, documents, payments, waterfallTiers, setSelectedDealId, setActiveSection } = usePIVTStore();
  const deal = useSelectedDeal();
  const [search, setSearch] = useState('');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [highlightRisk, setHighlightRisk] = useState(true);
  const [showSimPanel, setShowSimPanel] = useState(false);
  const [activeSim, setActiveSim] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<string | null>(null);
  const [showDealDetail, setShowDealDetail] = useState(false);
  const [viewMode, setViewMode] = useState<'deal' | 'portfolio'>('deal');
  const [filters, setFilters] = useState<Record<string, boolean>>({
    stakeholder: true, waterfall: true, compliance: true, document: true, payment: true,
  });

  const toggleFilter = (key: string) => setFilters(f => ({ ...f, [key]: !f[key] }));

  const handleDealSwitch = useCallback((dealId: string) => {
    setSelectedDealId(dealId);
    setSelectedNode(null);
    setShowDealDetail(false);
    if (viewMode === 'portfolio') setViewMode('deal');
  }, [setSelectedDealId, viewMode]);

  const handleGoToWorkspace = useCallback(() => {
    setActiveSection('workspace');
  }, [setActiveSection]);

  // Build graph (same logic as before)
  const { nodes, edges } = useMemo(() => {
    const ns: GraphNode[] = [];
    const es: GraphEdge[] = [];
    const cx = 400, cy = 300;

    ns.push({
      id: deal.id, label: deal.codeName, type: 'deal', x: cx, y: cy,
      color: typeColors.deal, size: 48, riskLevel: deal.hasBlocker ? 'critical' : 'none',
      metadata: { value: `$${(deal.consideration / 1e6).toFixed(0)}M`, status: deal.status, buyer: deal.buyerName, target: deal.targetCompany },
    });

    if (filters.stakeholder) {
      stakeholders.forEach((s, i) => {
        const angle = (-Math.PI / 2) + (i - stakeholders.length / 2) * 0.3;
        const risk: GraphNode['riskLevel'] = s.kycStatus === 'failed' ? 'critical' : s.kycStatus === 'pending' ? 'warning' : 'none';
        ns.push({
          id: s.id, label: s.name, type: 'stakeholder',
          x: cx + Math.cos(angle) * 220, y: cy + Math.sin(angle) * 180,
          color: typeColors.stakeholder, size: 26, riskLevel: risk,
          metadata: { role: s.role, kyc: s.kycStatus, payout: `$${(s.payoutAmount / 1e6).toFixed(0)}M`, ownership: `${s.ownershipPct}%` },
        });
        es.push({ from: deal.id, to: s.id, label: 'has_stakeholder', strength: s.ownershipPct / 30 });
      });
    }

    if (filters.document) {
      documents.slice(0, 6).forEach((d, i) => {
        const angle = 0 + (i - 3) * 0.35;
        const risk: GraphNode['riskLevel'] = d.status === 'rejected' ? 'critical' : d.status === 'pending' ? 'warning' : 'none';
        ns.push({
          id: d.id, label: d.name.slice(0, 20), type: 'document',
          x: cx + Math.cos(angle) * 260, y: cy + Math.sin(angle) * 200,
          color: typeColors.document, size: 20, riskLevel: risk,
          metadata: { docType: d.type, status: d.status, uploaded: d.uploadedAt },
        });
        es.push({ from: deal.id, to: d.id, label: 'references' });
      });
    }

    if (filters.payment) {
      payments.forEach((p, i) => {
        const angle = (Math.PI / 2) + (i - payments.length / 2) * 0.35;
        const risk: GraphNode['riskLevel'] = p.status === 'failed' ? 'critical' : p.status === 'pending' ? 'info' : 'none';
        ns.push({
          id: p.id, label: p.recipientName.split(' ')[0], type: 'payment',
          x: cx + Math.cos(angle) * 230, y: cy + Math.sin(angle) * 190,
          color: typeColors.payment, size: 22, riskLevel: risk,
          metadata: { amount: `$${(p.amount / 1e6).toFixed(0)}M`, status: p.status, method: p.method },
        });
        es.push({ from: deal.id, to: p.id, label: 'pays' });
      });
    }

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

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (node.type === 'deal') {
      setShowDealDetail(true);
      setSelectedNode(null);
    } else {
      setShowDealDetail(false);
      setSelectedNode(node);
    }
  }, []);

  return (
    <motion.div {...fadeInUp} className="space-y-3">
      {/* ── 3-Zone Command Bar ── */}
      <div className="bg-white/60 backdrop-blur-md border-b border-border/10" style={{ minHeight: 64 }}>
        <div className="flex items-center h-16 px-5 gap-6">

          {/* ═══ ZONE 1 — Deal Context (Left) ═══ */}
          <div className="flex-1 min-w-0">
            {viewMode === 'deal' ? (
              <div className="flex items-baseline gap-3">
                <h2 className="text-[22px] font-semibold tracking-tight truncate" style={{ letterSpacing: '-0.04em' }}>
                  {deal.codeName}
                </h2>
                {deal.hasBlocker && (
                  <span className="text-[10px] font-medium text-blocking/80 uppercase tracking-wider">Blocked</span>
                )}
                <span className="text-sm text-muted-foreground/70 font-normal truncate hidden md:inline">
                  {deal.buyerName} acquiring {deal.targetCompany}
                </span>
                <span className="text-[13px] text-muted-foreground/50 font-normal hidden lg:inline ml-1">
                  ${(deal.consideration / 1e6).toFixed(0)}M · {deal.closingDate} · {deal.readyToPayPercent}% Ready
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2">
                <h2 className="text-[22px] font-semibold tracking-tight" style={{ letterSpacing: '-0.04em' }}>
                  Portfolio
                </h2>
                <span className="text-[13px] text-muted-foreground/50">
                  {deals.length} Deals · ${(deals.reduce((s, d) => s + d.consideration, 0) / 1e6).toFixed(0)}M Total
                </span>
              </div>
            )}
          </div>

          {/* ═══ ZONE 2 — View Mode Control (Center) ═══ */}
          <div className="shrink-0">
            {viewMode === 'deal' ? (
              /* Segmented filter control */
              <div className="flex items-center rounded-xl bg-muted/20 overflow-hidden">
                {FILTER_DEFS.map(f => {
                  const active = filters[f.key];
                  return (
                    <button
                      key={f.key}
                      onClick={() => toggleFilter(f.key)}
                      className="relative px-3 py-2 text-[11px] font-medium transition-colors duration-200 group"
                    >
                      <span className={`flex items-center gap-1.5 relative z-10 ${
                        active ? 'text-foreground' : 'text-muted-foreground/60 hover:text-muted-foreground'
                      }`}>
                        <f.icon className="w-3 h-3" />
                        <span className="hidden xl:inline">{f.label}</span>
                      </span>
                      {/* Gradient underline for active state */}
                      {active && (
                        <motion.div
                          layoutId="filter-underline"
                          className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                          style={{ background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent) / 0.4))' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      {/* Subtle hover tint */}
                      <span className="absolute inset-0 bg-muted/0 group-hover:bg-muted/30 transition-colors duration-200 rounded-lg" />
                    </button>
                  );
                })}
                {/* Mode toggle divider */}
                <div className="w-px h-5 bg-border/20 mx-1" />
                <button
                  onClick={() => setViewMode('deal')}
                  className="relative px-3 py-2 text-[11px] font-medium text-foreground"
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  <span className="hidden xl:inline">Deal</span>
                  <motion.div
                    layoutId="mode-underline"
                    className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-foreground/30"
                  />
                </button>
                <button
                  onClick={() => setViewMode('portfolio')}
                  className="px-3 py-2 text-[11px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  <span className="hidden xl:inline">Portfolio</span>
                </button>
              </div>
            ) : (
              /* Portfolio mode: simple mode switch */
              <div className="flex items-center rounded-xl bg-muted/20 overflow-hidden">
                <button
                  onClick={() => setViewMode('deal')}
                  className="px-3 py-2 text-[11px] font-medium text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Eye className="w-3 h-3 inline mr-1" />
                  Deal
                </button>
                <button
                  onClick={() => setViewMode('portfolio')}
                  className="relative px-3 py-2 text-[11px] font-medium text-foreground"
                >
                  <TrendingUp className="w-3 h-3 inline mr-1" />
                  Portfolio
                  <motion.div
                    layoutId="mode-underline-p"
                    className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-foreground/30"
                  />
                </button>
              </div>
            )}
          </div>

          {/* ═══ ZONE 3 — Intelligence Actions (Right) ═══ */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Compact search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="bg-transparent border-none rounded-lg pl-8 pr-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:bg-muted/20 w-32 transition-all duration-200 focus:w-44"
              />
            </div>

            {viewMode === 'deal' && (
              <>
                {/* Risk toggle — inline, no badge */}
                <button
                  onClick={() => setHighlightRisk(!highlightRisk)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[11px] font-medium transition-all duration-200 ${
                    highlightRisk
                      ? 'text-foreground bg-muted/30'
                      : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  Risk
                  {riskNodeCount > 0 && (
                    <span className={`text-[10px] ${highlightRisk ? 'text-blocking/70' : 'text-muted-foreground/40'}`}>
                      · {riskNodeCount} flagged
                    </span>
                  )}
                </button>

                {/* What-If */}
                <button
                  onClick={() => setShowSimPanel(!showSimPanel)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[11px] font-medium transition-all duration-200 ${
                    showSimPanel
                      ? 'text-foreground bg-muted/30'
                      : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                >
                  <Play className="w-3 h-3" />
                  What-If
                </button>

                {/* Deal selector */}
                <DealSelectorDropdown
                  deals={deals}
                  selectedDealId={deal.id}
                  onSelect={handleDealSwitch}
                />

                {/* Open Deal */}
                <button
                  onClick={handleGoToWorkspace}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] text-[11px] font-medium text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 transition-all duration-200"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open Deal
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Graph ── */}
      <div className="pivt-card overflow-hidden flex" style={{ height: 520 }}>
        <div className="flex-1 relative bg-background/50">
          {viewMode === 'portfolio' ? (
            <PortfolioGraph deals={deals} onDealClick={handleDealSwitch} />
          ) : (
            <>
              <svg width="100%" height="100%" viewBox="0 0 800 600" className="absolute inset-0">
                <defs>
                  <radialGradient id="im-glow-accent" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
                  </radialGradient>
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
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="cursor-pointer"
                      opacity={dimmed ? 0.15 : visible ? 1 : 0.15}
                    >
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
            </>
          )}

          {/* Entity counts (Deal View only) */}
          {viewMode === 'deal' && (
            <div className="absolute bottom-3 left-3 flex gap-2">
              {Object.entries(typeColors).map(([type, color]) => {
                const count = nodes.filter(n => n.type === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2.5 py-1 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-muted-foreground capitalize">{type}</span>
                    <span className="text-foreground font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="absolute top-3 right-3">
            <Badge variant="outline" className="text-[9px] border-border/50 text-muted-foreground">
              Read-Only View
            </Badge>
          </div>

          {/* Deal Detail Panel (appears when clicking central deal node) */}
          <AnimatePresence>
            {showDealDetail && viewMode === 'deal' && (
              <DealDetailPanel
                deal={deal}
                onClose={() => setShowDealDetail(false)}
                onGoToWorkspace={handleGoToWorkspace}
                riskCount={riskNodeCount}
              />
            )}
          </AnimatePresence>
        </div>

        {/* What-If Panel */}
        <AnimatePresence>
          {showSimPanel && viewMode === 'deal' && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={springConfig.standard}
              className="border-l border-border/50 overflow-hidden shrink-0 bg-muted/20"
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
                      className={`w-full text-left p-3 rounded-lg border text-xs ${
                        activeSim === sim.id ? 'border-accent/50 bg-accent/5' : 'border-border/50 bg-background hover:bg-muted/40'
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

        {/* Selected Node Detail (non-deal nodes) */}
        <AnimatePresence>
          {selectedNode && !showSimPanel && !showDealDetail && viewMode === 'deal' && (
            <motion.div
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
              className="absolute top-16 right-4 w-72 rounded-xl border border-border/50 overflow-hidden bg-background/95 backdrop-blur-xl shadow-xl"
            >
              <div className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-3 h-3 rounded-full" style={{ background: selectedNode.color }} />
                  <Badge variant="outline" className="text-[10px]">
                    {selectedNode.type}
                  </Badge>
                  {selectedNode.riskLevel && selectedNode.riskLevel !== 'none' && (
                    <Badge className={`text-[9px] ${
                      selectedNode.riskLevel === 'critical' ? 'bg-blocking/10 text-blocking' :
                      selectedNode.riskLevel === 'warning' ? 'bg-discrepancy/10 text-discrepancy' :
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
                <div className="mt-3 pt-3 border-t border-border/50">
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
                          <button key={i} onClick={() => handleNodeClick(other)}
                            className="w-full flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-0.5"
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
