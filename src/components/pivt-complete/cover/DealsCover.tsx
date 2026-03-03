import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Hash, Users, FileText, Table, ChevronRight, Layers } from 'lucide-react';
import { usePIVTStore, DemoDeal } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { useDealOperations, RealDeal } from '@/hooks/useDealOperations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// ── Rich demo deal data matching old MVP screenshot ──
interface DemoCardData {
  id: string;
  name: string;
  letter: string;
  dealNumber: string;
  status: string;
  statusColor: string;
  tags: string[];
  totalValue: number;
  executedAmount: number;
  executedPercent: number;
  readinessPercent: number;
  buyerBorrower: string;
  sector: string;
  waterfallTiers: number;
  closingDate: string;
  partiesCount: number;
  docsCount: number;
  capTableCount: number;
}

const DEMO_CARDS: DemoCardData[] = [
  {
    id: 'atlas',
    name: 'Project ATLAS',
    letter: 'A',
    dealNumber: 'PIVT-2026-000142',
    status: 'active',
    statusColor: 'bg-amber-500',
    tags: ['M&A', 'Stock Purchase – Take Private'],
    totalValue: 142_500_000,
    executedAmount: 109_700_000,
    executedPercent: 77,
    readinessPercent: 77,
    buyerBorrower: 'N/A',
    sector: 'Enterprise Software / SaaS',
    waterfallTiers: 8,
    closingDate: '2025-01-15',
    partiesCount: 28,
    docsCount: 108,
    capTableCount: 26,
  },
  {
    id: 'beacon',
    name: 'Project BEACON',
    letter: 'B',
    dealNumber: 'PIVT-2026-000143',
    status: 'ready',
    statusColor: 'bg-emerald-500',
    tags: ['Credit', 'Unitranche Credit Facility'],
    totalValue: 89_000_000,
    executedAmount: 89_000_000,
    executedPercent: 100,
    readinessPercent: 100,
    buyerBorrower: 'Beacon Holdings, LLC',
    sector: 'Healthcare Services / Healthcare IT',
    waterfallTiers: 6,
    closingDate: '2025-01-18',
    partiesCount: 25,
    docsCount: 75,
    capTableCount: 0,
  },
  {
    id: 'cipher',
    name: 'Project CIPHER',
    letter: 'C',
    dealNumber: 'PIVT-2026-000144',
    status: 'setup',
    statusColor: 'bg-muted-foreground',
    tags: ['M&A', 'Stock Purchase – Take Private'],
    totalValue: 215_000_000,
    executedAmount: 0,
    executedPercent: 0,
    readinessPercent: 0,
    buyerBorrower: 'N/A',
    sector: 'Cybersecurity / Enterprise Software',
    waterfallTiers: 10,
    closingDate: '2025-01-22',
    partiesCount: 48,
    docsCount: 145,
    capTableCount: 24,
  },
];

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'active', bg: 'bg-accent/10', text: 'text-accent' },
  ready: { label: 'ready', bg: 'bg-validated/10', text: 'text-validated' },
  setup: { label: 'setup', bg: 'bg-muted', text: 'text-muted-foreground' },
  draft: { label: 'draft', bg: 'bg-muted', text: 'text-muted-foreground' },
  closing: { label: 'closing', bg: 'bg-discrepancy/10', text: 'text-discrepancy' },
  closed: { label: 'closed', bg: 'bg-validated/10', text: 'text-validated' },
  settled: { label: 'settled', bg: 'bg-validated/10', text: 'text-validated' },
};

const fmt = (n: number) => {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
};

// ── Progress bar uses PIVT purple gradient ──
const PROGRESS_BAR_STYLE = 'bg-gradient-to-r from-accent to-[hsl(217,100%,55%)]';

// ── Demo Deal Card ──
const DemoDealCard: React.FC<{ deal: DemoCardData; onClick: () => void }> = ({ deal, onClick }) => {
  const sts = STATUS_LABELS[deal.status] || STATUS_LABELS.draft;

  return (
    <motion.div
      {...fadeInUp}
      onClick={onClick}
      className="border border-border rounded-xl bg-card hover:shadow-lg transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 mt-0.5">
              {deal.letter}
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">{deal.name}</h3>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${sts.bg} ${sts.text}`}>
                  {sts.label}
                </span>
                {deal.tags.map((tag) => (
                  <span key={tag} className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold font-mono">{fmt(deal.totalValue)}</p>
            <p className="text-[11px] text-muted-foreground">Total Value</p>
          </div>
        </div>
      </div>

      {/* Readiness bar */}
      <div className="px-5 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-accent font-medium">Ready to disburse</span>
          <span className="text-[11px] font-mono font-semibold text-right">
            {fmt(deal.executedAmount)} ({deal.executedPercent}%)
          </span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${PROGRESS_BAR_STYLE}`}
            style={{ width: `${Math.max(deal.executedPercent, 1)}%` }}
          />
        </div>
      </div>

      {/* Body: 2 columns */}
      <div className="px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Buyer/Borrower</p>
          <p className="font-medium text-foreground text-sm">{deal.buyerBorrower}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Sector</p>
          <p className="font-medium text-foreground text-sm">{deal.sector}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Waterfall Tiers</p>
          <p className="font-medium text-foreground text-sm">{deal.waterfallTiers} tiers</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" />
            {deal.dealNumber}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {deal.closingDate}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            {deal.partiesCount} parties
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            {deal.docsCount} docs
          </span>
          <span className="flex items-center gap-1">
            <Table className="w-3.5 h-3.5" />
            {deal.capTableCount} cap table
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </motion.div>
  );
};

// ── Real Deal Card (user-created) ──
const RealDealCard: React.FC<{ deal: RealDeal; letter: string; onClick: () => void }> = ({ deal, letter, onClick }) => {
  const sts = STATUS_LABELS[deal.status] || STATUS_LABELS.draft;

  return (
    <motion.div
      {...fadeInUp}
      onClick={onClick}
      className="border border-border rounded-xl bg-card hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 mt-0.5">
              {letter}
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">{deal.deal_name}</h3>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${sts.bg} ${sts.text}`}>
                  {sts.label}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold font-mono">{fmt(deal.deal_value)}</p>
            <p className="text-[11px] text-muted-foreground">Total Value</p>
          </div>
        </div>
      </div>

      {/* Progress bar placeholder */}
      <div className="px-5 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-accent font-medium">Ready to disburse</span>
          <span className="text-[11px] font-mono font-semibold text-right">$0 (0%)</span>
        </div>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${PROGRESS_BAR_STYLE}`} style={{ width: '1%' }} />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-3 grid grid-cols-2 gap-x-8 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Buyer/Borrower</p>
          <p className="font-medium text-foreground text-sm">—</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Sector</p>
          <p className="font-medium text-foreground text-sm">—</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {deal.closing_date || 'TBD'}
          </span>
          <span className="flex items-center gap-1">
            <Hash className="w-3.5 h-3.5" />
            {deal.deal_number}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5" />
            0 parties
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3.5 h-3.5" />
            0 docs
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </div>
    </motion.div>
  );
};

// ── Main component ──
export const DealsCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();
  const { createDeal, fetchDeals } = useDealOperations();
  const { user } = useAuth();

  const [realDeals, setRealDeals] = useState<RealDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '' });

  const loadDeals = useCallback(async () => {
    setLoading(true);
    const data = await fetchDeals();
    const userDeals = data.filter(d => !d.seed_key);
    setRealDeals(userDeals);
    setLoading(false);
  }, []);

  useEffect(() => { loadDeals(); }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const deal = await createDeal({
      deal_name: form.deal_name,
      deal_value: Number(form.deal_value),
      closing_date: form.closing_date || null,
      escrow_amount: Number(form.escrow_amount) || 0,
    });
    if (deal) {
      setShowCreate(false);
      setForm({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '' });
      setSelectedDealId(deal.id);
      setActiveSection('workspace');
    }
    setCreating(false);
  };

  const openDeal = (id: string) => {
    setSelectedDealId(id);
    setActiveSection('workspace');
  };

  // Sort demo cards alphabetically (already A, B, C)
  const sortedDemos = [...DEMO_CARDS].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  const sortedReal = [...realDeals].sort((a, b) => a.deal_name.localeCompare(b.deal_name, undefined, { sensitivity: 'base' }));

  const totalDeals = sortedDemos.length + sortedReal.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Deals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} deal{totalDeals !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="pivt-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
        >
          <Plus className="w-4 h-4" />
          New Deal
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedDemos.map((deal) => (
            <DemoDealCard key={deal.id} deal={deal} onClick={() => openDeal(deal.id)} />
          ))}
          {sortedReal.map((deal, i) => (
            <RealDealCard
              key={deal.id}
              deal={deal}
              letter={deal.deal_name.charAt(0).toUpperCase()}
              onClick={() => openDeal(deal.id)}
            />
          ))}
        </div>
      )}

      {/* Create Deal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Deal Name</Label>
              <Input
                value={form.deal_name}
                onChange={(e) => setForm({ ...form, deal_name: e.target.value })}
                placeholder="Project Atlas Acquisition"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Deal Value ($)</Label>
                <Input
                  type="number"
                  value={form.deal_value}
                  onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                  placeholder="50000000"
                  required
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>Escrow Amount ($)</Label>
                <Input
                  type="number"
                  value={form.escrow_amount}
                  onChange={(e) => setForm({ ...form, escrow_amount: e.target.value })}
                  placeholder="5000000"
                  min={0}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Closing Date</Label>
              <Input
                type="date"
                value={form.closing_date}
                onChange={(e) => setForm({ ...form, closing_date: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={creating}>
              {creating ? 'Creating...' : 'Create Deal'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
