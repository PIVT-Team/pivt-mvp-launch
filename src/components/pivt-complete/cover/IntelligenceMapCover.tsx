import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal, DemoDeal } from '@/stores/pivtStore';
import {
  Search, Play, RotateCcw, X, ArrowRight, Sparkles, ChevronDown, Check,
  Eye, Users, CreditCard, FileText, Shield, Activity, ExternalLink,
  Calendar, AlertTriangle, Ban, TrendingUp, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
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
  const [labelMode, setLabelMode] = useState<'off' | 'smart' | 'all'>('smart');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filters, setFilters] = useState<Record<string, boolean>>({
    stakeholder: true, waterfall: true, compliance: true, document: true, payment: true,
  });

  // Escape key exits fullscreen
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

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
    const cx = 1200, cy = 900;

    ns.push({
      id: deal.id, label: deal.codeName, type: 'deal', x: cx, y: cy,
      color: typeColors.deal, size: 180, riskLevel: deal.hasBlocker ? 'critical' : 'none',
      metadata: { value: `$${(deal.consideration / 1e6).toFixed(0)}M`, status: deal.status, buyer: deal.buyerName, target: deal.targetCompany },
    });

    if (filters.stakeholder) {
      stakeholders.forEach((s, i) => {
        const angle = (-Math.PI / 2) + (i - stakeholders.length / 2) * 0.4;
        const risk: GraphNode['riskLevel'] = s.kycStatus === 'failed' ? 'critical' : s.kycStatus === 'pending' ? 'warning' : 'none';
        ns.push({
          id: s.id, label: s.name, type: 'stakeholder',
          x: cx + Math.cos(angle) * 720, y: cy + Math.sin(angle) * 600,
          color: typeColors.stakeholder, size: 80, riskLevel: risk,
          metadata: { role: s.role, kyc: s.kycStatus, payout: `$${(s.payoutAmount / 1e6).toFixed(0)}M`, ownership: `${s.ownershipPct}%` },
        });
        es.push({ from: deal.id, to: s.id, label: 'has_stakeholder', strength: s.ownershipPct / 30 });
      });
    }

    if (filters.document) {
      documents.slice(0, 6).forEach((d, i) => {
        const angle = 0 + (i - 3) * 0.45;
        const risk: GraphNode['riskLevel'] = d.status === 'rejected' ? 'critical' : d.status === 'pending' ? 'warning' : 'none';
        ns.push({
          id: d.id, label: d.name.slice(0, 20), type: 'document',
          x: cx + Math.cos(angle) * 800, y: cy + Math.sin(angle) * 640,
          color: typeColors.document, size: 64, riskLevel: risk,
          metadata: { docType: d.type, status: d.status, uploaded: d.uploadedAt },
        });
        es.push({ from: deal.id, to: d.id, label: 'references' });
      });
    }

    if (filters.payment) {
      payments.forEach((p, i) => {
        const angle = (Math.PI / 2) + (i - payments.length / 2) * 0.45;
        const risk: GraphNode['riskLevel'] = p.status === 'failed' ? 'critical' : p.status === 'pending' ? 'info' : 'none';
        ns.push({
          id: p.id, label: p.recipientName.split(' ')[0], type: 'payment',
          x: cx + Math.cos(angle) * 740, y: cy + Math.sin(angle) * 620,
          color: typeColors.payment, size: 68, riskLevel: risk,
          metadata: { amount: `$${(p.amount / 1e6).toFixed(0)}M`, status: p.status, method: p.method },
        });
        es.push({ from: deal.id, to: p.id, label: 'pays' });
      });
    }

    if (filters.waterfall) {
      waterfallTiers.forEach((t, i) => {
        const angle = Math.PI + (i - waterfallTiers.length / 2) * 0.45;
        ns.push({
          id: t.id, label: t.name.slice(0, 15), type: 'waterfall',
          x: cx + Math.cos(angle) * 760, y: cy + Math.sin(angle) * 600,
          color: typeColors.waterfall, size: 64, riskLevel: 'none',
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

  // Smart label visibility: compute which labels to show by priority with collision detection
  const smartVisibleIds = useMemo(() => {
    if (labelMode === 'off') return new Set<string>();
    if (labelMode === 'all') return new Set(nodes.map(n => n.id));

    // Priority scoring: deal=100, risk critical=80, risk warning=60, risk info=40, then by connectivity
    const connectionCount = new Map<string, number>();
    edges.forEach(e => {
      connectionCount.set(e.from, (connectionCount.get(e.from) || 0) + 1);
      connectionCount.set(e.to, (connectionCount.get(e.to) || 0) + 1);
    });

    const scored = nodes.map(n => {
      let score = 0;
      if (n.type === 'deal') score = 100;
      else if (n.riskLevel === 'critical') score = 80;
      else if (n.riskLevel === 'warning') score = 60;
      else if (n.riskLevel === 'info') score = 40;
      score += (connectionCount.get(n.id) || 0) * 3;
      // Key entity types get a boost
      if (n.type === 'escrow' || n.type === 'stakeholder') score += 10;
      return { node: n, score };
    }).sort((a, b) => b.score - a.score);

    // Take top 10 candidates, then collision-check
    const candidates = scored.slice(0, 12);
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const visible = new Set<string>();

    for (const { node } of candidates) {
      const labelLen = Math.min(node.label.length, 18);
      const w = labelLen * 7; // approx width
      const h = 16;
      const lx = node.x - w / 2;
      const ly = node.y + node.size / 2 + 10;

      // Check collision with already-placed labels
      const collides = placed.some(p =>
        lx < p.x + p.w && lx + w > p.x && ly < p.y + p.h && ly + h > p.y
      );

      if (!collides) {
        placed.push({ x: lx, y: ly, w, h });
        visible.add(node.id);
      }
    }

    return visible;
  }, [nodes, edges, labelMode]);

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
    <motion.div {...fadeInUp} className={`flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`} style={{ height: isFullscreen ? '100vh' : '85vh' }}>
      {/* ══ ROW 1: Deal Context + Deal Selector ══ */}
      <div
        className="flex items-center justify-between gap-4 px-4 shrink-0"
        style={{ minHeight: 40, background: isFullscreen ? 'hsl(var(--background))' : undefined }}
      >
        {/* Left: Deal context */}
      <div className="flex-1 flex items-baseline gap-3 min-w-0">
          {viewMode === 'deal' ? (
            <>
              <h2
                className="text-[22px] font-semibold"
                style={{ letterSpacing: '-0.04em', whiteSpace: 'normal', overflow: 'visible' }}
              >
                {deal.codeName}
              </h2>
              {deal.hasBlocker && (
                <span className="text-[10px] font-medium text-blocking/80 uppercase tracking-wider whitespace-nowrap shrink-0">
                  Blocked
                </span>
              )}
              <span className="text-sm text-muted-foreground/70 truncate whitespace-nowrap hidden md:inline">
                {deal.buyerName} acquiring {deal.targetCompany}
              </span>
              <span className="text-[13px] text-muted-foreground/50 whitespace-nowrap hidden lg:inline">
                ${(deal.consideration / 1e6).toFixed(0)}M · {deal.closingDate} · {deal.readyToPayPercent}% Ready
              </span>
            </>
          ) : (
            <>
              <h2
                className="text-[22px] font-semibold whitespace-nowrap"
                style={{ letterSpacing: '-0.04em' }}
              >
                Portfolio
              </h2>
              <span className="text-[13px] text-muted-foreground/50 whitespace-nowrap">
                {deals.length} Deals · ${(deals.reduce((s, d) => s + d.consideration, 0) / 1e6).toFixed(0)}M Total
              </span>
            </>
          )}
        </div>

        {/* Right: Deal selector (always visible) */}
        <div className="shrink-0 flex-shrink-0">
          <DealSelectorDropdown
            deals={deals}
            selectedDealId={deal.id}
            onSelect={handleDealSwitch}
          />
        </div>
      </div>

      {/* ══ ROW 2: Toolbar — strict flex, no wrap, fixed 48px height ══ */}
      <div
        className="flex items-center justify-between gap-6 rounded-xl px-4"
        style={{
          minHeight: 48,
          maxHeight: 48,
          background: 'hsl(var(--muted) / 0.25)',
          border: '1px solid hsl(var(--border) / 0.5)',
          flexWrap: 'nowrap',
          overflow: 'hidden',
        }}
      >
        {/* LEFT: View mode controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Deal / Portfolio toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode('deal')}
                className={`relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
                  viewMode === 'deal'
                    ? 'text-foreground'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                }`}
              >
                <Eye className="w-3 h-3 shrink-0" />
                Deal
                {viewMode === 'deal' && (
                  <motion.div
                    layoutId="view-mode-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent) / 0.4))' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>View this deal's individual relationship network</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setViewMode('portfolio')}
                className={`relative flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
                  viewMode === 'portfolio'
                    ? 'text-foreground'
                    : 'text-muted-foreground/50 hover:text-muted-foreground'
                }`}
              >
                <TrendingUp className="w-3 h-3 shrink-0" />
                Portfolio
                {viewMode === 'portfolio' && (
                  <motion.div
                    layoutId="view-mode-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent) / 0.4))' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>View cross-deal relationships and systemic exposure</TooltipContent>
          </Tooltip>

          {/* Separator */}
          {viewMode === 'deal' && <div className="w-px h-5 bg-border/30 mx-1 shrink-0" />}

          {/* Filter segments (deal view only) */}
          {viewMode === 'deal' && FILTER_DEFS.map(f => {
            const active = filters[f.key];
            const filterTooltips: Record<string, string> = {
              stakeholder: 'Equity holders, management, and key participants',
              waterfall: 'Funds, lenders, vehicles, and capital structures',
              compliance: 'Regulatory risks and outstanding verification issues',
              document: 'Executed and pending legal documents',
              payment: 'Payments, transfers, and waterfall movements',
            };
            return (
              <Tooltip key={f.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => toggleFilter(f.key)}
                    className={`relative flex items-center gap-1 px-2.5 h-8 text-[11px] font-medium whitespace-nowrap transition-colors duration-200 ${
                      active ? 'text-foreground' : 'text-muted-foreground/50 hover:text-muted-foreground'
                    }`}
                  >
                    <f.icon className="w-3 h-3 shrink-0" />
                    <span className="hidden xl:inline">{f.label}</span>
                    {active && (
                      <div
                        className="absolute bottom-0 left-1.5 right-1.5 h-[2px] rounded-full"
                        style={{ background: 'linear-gradient(90deg, hsl(var(--accent)), hsl(var(--accent) / 0.4))' }}
                      />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{filterTooltips[f.key]}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* CENTER: Search */}
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="bg-transparent rounded-lg pl-8 pr-3 h-8 text-[12px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:bg-muted/20 w-36 transition-all duration-200 focus:w-48 border-none"
          />
        </div>

        {/* RIGHT: Risk + What-If + Open Deal */}
        <div className="flex items-center gap-2 shrink-0">
          {viewMode === 'deal' && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setHighlightRisk(!highlightRisk)}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all duration-200 ${
                      highlightRisk
                        ? 'text-foreground bg-muted/40'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="hidden lg:inline">Risk</span>
                    {riskNodeCount > 0 && (
                      <span className={`text-[10px] whitespace-nowrap ${highlightRisk ? 'text-blocking/70' : 'text-muted-foreground/40'}`}>
                        · {riskNodeCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{riskNodeCount > 0 ? `${riskNodeCount} flagged risks detected across this network` : 'Highlight flagged risk nodes'}</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setShowSimPanel(!showSimPanel)}
                    className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all duration-200 ${
                      showSimPanel
                        ? 'text-foreground bg-muted/40'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                    }`}
                  >
                    <Play className="w-3 h-3 shrink-0" />
                    <span className="hidden lg:inline">What-If</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>Simulate changes to see how structure and payouts are affected</TooltipContent>
              </Tooltip>

              <button
                onClick={handleGoToWorkspace}
                className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-medium text-muted-foreground/50 hover:text-foreground hover:bg-muted/20 whitespace-nowrap transition-all duration-200"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="hidden lg:inline">Open Deal</span>
              </button>

              {/* Label mode toggle */}
              <div className="w-px h-5 bg-border/30 mx-0.5 shrink-0" />
              <div className="flex items-center gap-0.5">
                {(['off', 'smart', 'all'] as const).map(mode => (
                  <button
                    key={mode}
                    onClick={() => setLabelMode(mode)}
                    className={`px-2 h-7 rounded text-[10px] font-medium whitespace-nowrap transition-all duration-200 ${
                      labelMode === mode
                        ? 'text-foreground bg-muted/50'
                        : 'text-muted-foreground/40 hover:text-muted-foreground'
                    }`}
                  >
                    {mode === 'off' ? 'Labels Off' : mode === 'smart' ? 'Smart' : 'All Labels'}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Graph ── */}
      <div className="flex-1 overflow-hidden flex rounded-xl border border-border/30">
        <div className="flex-1 relative" style={{ background: 'hsl(var(--background))' }}>
          {viewMode === 'portfolio' ? (
            <PortfolioGraph deals={deals} onDealClick={handleDealSwitch} />
          ) : (
            <>
              <svg width="100%" height="100%" viewBox="0 0 2400 1800" className="absolute inset-0" preserveAspectRatio="xMidYMid meet">
                <defs>
                  <radialGradient id="im-glow-accent" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="im-center-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity="0.15" />
                    <stop offset="60%" stopColor="#7C3AED" stopOpacity="0.05" />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
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

                {/* Ambient center glow */}
                <circle cx="1200" cy="900" r="500" fill="url(#im-center-glow)" />

                {/* Edges — curved paths, always visible */}
                {edges.map((e, i) => {
                  const from = nodes.find(n => n.id === e.from);
                  const to = nodes.find(n => n.id === e.to);
                  if (!from || !to) return null;
                  const visible = filteredIds.has(from.id) && filteredIds.has(to.id);
                  const highlighted = hoveredNode ? connectedIds.has(from.id) && connectedIds.has(to.id) : false;
                  const dimmedEdge = hoveredNode && !highlighted;
                  const mx = (from.x + to.x) / 2;
                  const my = (from.y + to.y) / 2;
                  const dx = to.x - from.x;
                  const dy = to.y - from.y;
                  const cx2 = mx - dy * 0.08;
                  const cy2 = my + dx * 0.08;

                  let strokeColor = 'rgba(168,162,200,0.7)';
                  let strokeOp = visible ? 0.3 : 0.08;
                  let strokeW = e.strength ? Math.max(1.8, e.strength * 2) : 1.8;

                  if (highlighted) {
                    strokeColor = '#A78BFA';
                    strokeOp = 0.7;
                    strokeW = 2.5;
                  } else if (dimmedEdge) {
                    strokeOp = 0.08;
                  }

                  return (
                    <path key={i}
                      d={`M${from.x},${from.y} Q${cx2},${cy2} ${to.x},${to.y}`}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeW}
                      strokeLinecap="round"
                      strokeDasharray={e.label === 'receives_payment' ? '4 3' : undefined}
                      strokeOpacity={strokeOp}
                      style={{ transition: 'stroke-opacity 0.2s, stroke 0.2s' }}
                    />
                  );
                })}

                {/* Nodes */}
                {nodes.map((node) => {
                  const visible = filteredIds.has(node.id);
                  const isHovered = hoveredNode === node.id;
                  const isSelected = selectedNode?.id === node.id;
                  const isConnected = connectedIds.has(node.id);
                  const dimmed = hoveredNode && !isConnected;
                  const showHalo = highlightRisk && node.riskLevel && node.riskLevel !== 'none';
                  const isDealNode = node.type === 'deal';
                  const showLabel = isDealNode || isHovered || isSelected || (isConnected && hoveredNode !== null) || smartVisibleIds.has(node.id);
                  return (
                    <g key={node.id}
                      onClick={() => handleNodeClick(node)}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      className="cursor-pointer"
                      opacity={dimmed ? 0.12 : visible ? 1 : 0.12}
                    >
                      {/* Deal node slow radial pulse */}
                      {isDealNode && (
                        <circle cx={node.x} cy={node.y} r={node.size * 0.8} fill={node.color} opacity={0.06}>
                          <animate attributeName="r" values={`${node.size * 0.7};${node.size * 1.0};${node.size * 0.7}`} dur="3s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.08;0.03;0.08" dur="3s" repeatCount="indefinite" />
                        </circle>
                      )}
                      {showHalo && (
                        <circle cx={node.x} cy={node.y} r={node.size * 1.2}
                          fill={`url(#halo-${node.riskLevel})`}
                        >
                          <animate attributeName="r" values={`${node.size * 1.1};${node.size * 1.4};${node.size * 1.1}`} dur="2.5s" repeatCount="indefinite" />
                        </circle>
                      )}
                      {isHovered && (
                        <circle cx={node.x} cy={node.y} r={node.size * 1.1} fill="url(#im-glow-accent)" />
                      )}
                      {/* Outer ring */}
                      <circle cx={node.x} cy={node.y} r={node.size / 2} fill={node.color} opacity={isDealNode ? 0.15 : 0.2} />
                      {/* Deal node gets gradient ring */}
                      {isDealNode && (
                        <circle cx={node.x} cy={node.y} r={node.size / 2 + 4}
                          fill="none" stroke={node.color} strokeWidth="2" strokeOpacity="0.35"
                        />
                      )}
                      {/* Inner circle */}
                      <circle cx={node.x} cy={node.y} r={isDealNode ? node.size / 2.5 : node.size / 3}
                        fill={node.color}
                        stroke={showHalo ? riskHaloColors[node.riskLevel!] : isHovered ? '#fff' : 'transparent'}
                        strokeWidth={showHalo ? 2.5 : 2}
                      />
                      {/* Label — high contrast for dark bg */}
                      {showLabel && (
                        <>
                          <text x={node.x} y={node.y + node.size / 2 + 20}
                            textAnchor="middle"
                            fill="#0F0F1A"
                            fontSize={isDealNode ? 15 : 13}
                            fontWeight={isDealNode || isHovered ? 700 : 500}
                            stroke="#0F0F1A"
                            strokeWidth="4"
                            strokeLinejoin="round"
                          >
                            {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                          </text>
                          <text x={node.x} y={node.y + node.size / 2 + 20}
                            textAnchor="middle"
                            fill={isHovered ? '#fff' : 'rgba(255,255,255,0.85)'}
                            fontSize={isDealNode ? 15 : 13}
                            fontWeight={isDealNode || isHovered ? 700 : 500}
                          >
                            {node.label.length > 18 ? node.label.slice(0, 16) + '…' : node.label}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}
              </svg>
            </>
          )}

          {/* Entity counts (Deal View only) */}
          {viewMode === 'deal' && (
            <div className="absolute bottom-4 left-4 flex gap-2">
              {Object.entries(typeColors).map(([type, color]) => {
                const count = nodes.filter(n => n.type === type).length;
                if (count === 0) return null;
                return (
                  <div key={type} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] cursor-default" style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    <span className="text-white/60 capitalize">{type}</span>
                    <span className="text-white font-semibold">{count}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Top-right controls */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            <Badge variant="outline" className="text-[9px] border-white/20 text-white/50 cursor-default bg-transparent">
              Read-Only View
            </Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/70 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isFullscreen ? 'Exit Fullscreen' : 'Expand'}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isFullscreen ? 'Exit fullscreen (Esc)' : 'Expand Intelligence Map to fullscreen'}</TooltipContent>
            </Tooltip>
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
