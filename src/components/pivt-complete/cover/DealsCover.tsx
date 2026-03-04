import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Calendar, Hash, Users, FileText, Table, ChevronRight, Eye, Briefcase, Copy, TrendingUp, Trash2 } from 'lucide-react';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { useDealOperations, RealDeal, DealTemplate, DealSummaryCounts } from '@/hooks/useDealOperations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

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

const PROGRESS_BAR_STYLE = 'bg-gradient-to-r from-accent to-[hsl(217,100%,55%)]';

// Golden demo summaries — never query DB for these
const DEMO_GOLDEN_SUMMARIES: Record<string, DealSummaryCounts & { buyerBorrower: string; sector: string; dealKindTags: string[]; funded: number; fundedPct: number; waterfallTiers: number }> = {
  atlas_demo: {
    deal_id: '', partiesCount: 28, docsCount: 108, capTableCount: 26, waterfallTiers: 8,
    conditionsMet: 6, conditionsTotal: 8, approvalsGranted: 5, approvalsTotal: 7,
    buyerBorrower: 'Apex Capital Partners', sector: 'Enterprise Software / SaaS',
    dealKindTags: ['M&A', 'Stock Purchase', 'Take Private'],
    funded: 109_700_000, fundedPct: 77,
  },
  beacon_demo: {
    deal_id: '', partiesCount: 25, docsCount: 75, capTableCount: 0, waterfallTiers: 6,
    conditionsMet: 3, conditionsTotal: 6, approvalsGranted: 2, approvalsTotal: 5,
    buyerBorrower: 'Beacon Holdings, LLC', sector: 'Healthcare Services / Healthcare IT',
    dealKindTags: ['Credit', 'Unitranche Credit Facility'],
    funded: 89_000_000, fundedPct: 100,
  },
  cipher_demo: {
    deal_id: '', partiesCount: 48, docsCount: 145, capTableCount: 24, waterfallTiers: 10,
    conditionsMet: 9, conditionsTotal: 10, approvalsGranted: 9, approvalsTotal: 10,
    buyerBorrower: 'Titan Strategic Group', sector: 'Cybersecurity / Enterprise Software',
    dealKindTags: ['M&A', 'Stock Purchase', 'Take Private'],
    funded: 0, fundedPct: 0,
  },
};

// ── Deal Card (unified for both demo and private deals) ──
const DealCard: React.FC<{
  deal: RealDeal;
  summary?: DealSummaryCounts;
  isDemo: boolean;
  onView: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
}> = ({ deal, summary, isDemo, onView, onDuplicate, duplicating }) => {
  const sts = STATUS_LABELS[deal.status] || STATUS_LABELS.draft;
  const letter = deal.deal_name.charAt(0).toUpperCase();
  const seedKey = (deal as any).seed_key as string | null;
  const goldenDemo = isDemo && seedKey ? DEMO_GOLDEN_SUMMARIES[seedKey] : null;

  const partiesCount = goldenDemo?.partiesCount ?? summary?.partiesCount ?? 0;
  const docsCount = goldenDemo?.docsCount ?? summary?.docsCount ?? 0;
  const capTableCount = goldenDemo?.capTableCount ?? summary?.capTableCount ?? 0;
  const tierCount = goldenDemo?.waterfallTiers ?? summary?.waterfallTiers ?? 0;
  const sector = goldenDemo?.sector || (deal as any).sector || '—';
  const buyerBorrower = goldenDemo?.buyerBorrower || (deal as any).buyer || '—';
  const dealType = (deal as any).deal_type || '';
  const dealKindTags = goldenDemo?.dealKindTags || (dealType ? [dealType] : []);
  const funded = goldenDemo?.funded ?? 0;
  const fundedPct = goldenDemo?.fundedPct ?? 0;

  // For non-demo deals, use conditions-based progress
  const conditionsMet = goldenDemo?.conditionsMet ?? summary?.conditionsMet ?? 0;
  const conditionsTotal = goldenDemo?.conditionsTotal ?? summary?.conditionsTotal ?? 0;

  return (
    <motion.div
      {...fadeInUp}
      className="border border-border rounded-xl bg-card hover:shadow-lg transition-all group cursor-pointer"
      onClick={onView}
    >
      {/* Header row */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0 mt-0.5">
              {letter}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold leading-tight">{deal.deal_name}</h3>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center w-2 h-2 rounded-full ${
                  sts.label === 'active' ? 'bg-validated' :
                  sts.label === 'ready' ? 'bg-validated' :
                  sts.label === 'setup' ? 'bg-amber-400' :
                  'bg-muted-foreground/40'
                }`} />
                <span className={`text-[11px] font-medium ${sts.text}`}>{sts.label}</span>
                {dealKindTags.map(tag => (
                  <span key={tag} className="text-[10px] text-muted-foreground">· {tag}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold font-mono">{fmt(deal.deal_value)}</p>
            <p className="text-[11px] text-muted-foreground">Total Value</p>
          </div>
        </div>
      </div>

      {/* Funded progress bar */}
      {isDemo && (
        <div className="px-5 pb-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-accent font-medium">Ready to disburse</span>
            <span className="text-[11px] font-mono font-semibold text-right">
              {fmt(funded)} ({fundedPct}%)
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${fundedPct >= 100 ? 'bg-validated' : PROGRESS_BAR_STYLE}`}
              style={{ width: `${Math.max(fundedPct, 1)}%` }}
            />
          </div>
        </div>
      )}

      {/* Deal details grid */}
      <div className="px-5 py-3 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Buyer</p>
          <p className="font-medium text-foreground text-sm">{buyerBorrower}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Seller</p>
          <p className="font-medium text-foreground text-sm">{(deal as any).seller || '—'}</p>
        </div>
        {(deal as any).target_company && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Target</p>
            <p className="font-medium text-foreground text-sm">{(deal as any).target_company}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Sector</p>
          <p className="font-medium text-foreground text-sm">{sector}</p>
        </div>
        {(deal as any).jurisdiction && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Jurisdiction</p>
            <p className="font-medium text-foreground text-sm">{(deal as any).jurisdiction}</p>
          </div>
        )}
        {tierCount > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-accent font-semibold mb-0.5">Waterfall Tiers</p>
            <p className="font-medium text-foreground text-sm">{tierCount} tiers</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{deal.closing_date || 'TBD'}</span>
          <span className="flex items-center gap-1"><Hash className="w-3.5 h-3.5" />{deal.deal_number}</span>
          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{partiesCount} parties</span>
          <span className="flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{docsCount} docs</span>
          <span className="flex items-center gap-1"><Table className="w-3.5 h-3.5" />{capTableCount} cap table</span>
        </div>
        <div className="flex items-center gap-1">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
};

// ── Main component ──
export const DealsCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();
  const { createDeal, fetchDeals, fetchTemplates, fetchDealSummaries, duplicateDeal } = useDealOperations();
  const { user } = useAuth();

  const [allDeals, setAllDeals] = useState<RealDeal[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DealSummaryCounts>>({});
  const [_templates, setTemplates] = useState<DealTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [form, setForm] = useState({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '', buyer: '', seller: '', target_company: '', sector: '', deal_type: '', currency: 'USD', jurisdiction: '' });

  const loadDeals = useCallback(async () => {
    setLoading(true);
    const data = await fetchDeals();
    setAllDeals(data);
    if (data.length > 0) {
      const sums = await fetchDealSummaries(data.map(d => d.id));
      setSummaries(sums);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDeals();
    fetchTemplates().then(setTemplates);
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const deal = await createDeal({
      deal_name: form.deal_name,
      deal_value: Number(form.deal_value),
      closing_date: form.closing_date || null,
      escrow_amount: Number(form.escrow_amount) || 0,
      buyer: form.buyer || null,
      seller: form.seller || null,
      target_company: form.target_company || null,
      sector: form.sector || null,
      deal_type: form.deal_type || null,
      currency: form.currency || 'USD',
      jurisdiction: form.jurisdiction || null,
    });
    if (deal) {
      setShowCreate(false);
      setForm({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '', buyer: '', seller: '', target_company: '', sector: '', deal_type: '', currency: 'USD', jurisdiction: '' });
      setSelectedDealId(deal.id);
      setActiveSection('workspace');
    }
    setCreating(false);
  };

  const handleDuplicate = async (dealId: string) => {
    setDuplicatingId(dealId);
    const newDeal = await duplicateDeal(dealId);
    setDuplicatingId(null);
    if (newDeal) {
      setSelectedDealId(newDeal.id);
      setActiveSection('workspace');
    }
  };

  const openDeal = (id: string) => {
    setSelectedDealId(id);
    setActiveSection('workspace');
  };

  // Separate demo deals from user's private deals
  const demoDeals = allDeals.filter(d => d.is_demo || d.visibility === 'global_demo');
  const privateDeals = allDeals.filter(d => !d.is_demo && d.visibility !== 'global_demo');

  const sortedPrivate = [...privateDeals].sort((a, b) => a.deal_name.localeCompare(b.deal_name, undefined, { sensitivity: 'base' }));
  const sortedDemo = [...demoDeals].sort((a, b) => a.deal_name.localeCompare(b.deal_name, undefined, { sensitivity: 'base' }));
  const totalDeals = sortedPrivate.length + sortedDemo.length;
  const showOnboarding = !loading && privateDeals.length === 0 && demoDeals.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Deals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {totalDeals} deal{totalDeals !== 1 ? 's' : ''}
            {sortedDemo.length > 0 ? ` · ${sortedPrivate.length} mine · ${sortedDemo.length} demo` : ''}
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
      ) : showOnboarding ? (
        <motion.div {...fadeInUp} className="border border-border rounded-xl bg-card p-10 text-center space-y-6">
          <h3 className="text-lg font-semibold">Welcome to PIVT</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Get started by creating your first deal to see how the platform works.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Button
              onClick={() => setShowCreate(true)}
              className="pivt-btn-primary gap-2 px-6 py-3 rounded-xl"
            >
              <Briefcase className="w-4 h-4" />
              Create Your First Deal
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {/* User's private deals */}
          {sortedPrivate.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your Deals</h3>
              <div className="grid gap-4">
                {sortedPrivate.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    summary={summaries[deal.id]}
                    isDemo={false}
                    onView={() => openDeal(deal.id)}
                    onDuplicate={() => {}}
                    duplicating={false}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Demo deals */}
          {sortedDemo.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Demo Deals</h3>
              <p className="text-[11px] text-muted-foreground">
                These are read-only demo deals. Duplicate one to create your own editable copy.
              </p>
              <div className="grid gap-4">
                {sortedDemo.map((deal) => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    summary={summaries[deal.id]}
                    isDemo={true}
                    onView={() => openDeal(deal.id)}
                    onDuplicate={() => handleDuplicate(deal.id)}
                    duplicating={duplicatingId === deal.id}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Deal Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Deal</DialogTitle>
            <p className="text-sm text-muted-foreground">Fill in deal metadata to initialize the transaction workspace.</p>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit} className="space-y-5">
            {/* Transaction Overview */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Transaction Overview</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Deal Name</Label>
                  <Input value={form.deal_name} onChange={(e) => setForm({ ...form, deal_name: e.target.value })} placeholder="Project Nimbus Acquisition" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Deal Type</Label>
                    <Select value={form.deal_type} onValueChange={(v) => setForm({ ...form, deal_type: v })}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Private Company Share Purchase">Private Company Share Purchase</SelectItem>
                        <SelectItem value="Asset Acquisition">Asset Acquisition</SelectItem>
                        <SelectItem value="Merger">Merger</SelectItem>
                        <SelectItem value="Leveraged Buyout">Leveraged Buyout</SelectItem>
                        <SelectItem value="Growth Equity">Growth Equity</SelectItem>
                        <SelectItem value="Venture Investment">Venture Investment</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sector</Label>
                    <Select value={form.sector} onValueChange={(v) => setForm({ ...form, sector: v })}>
                      <SelectTrigger><SelectValue placeholder="Select sector" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Technology">Technology</SelectItem>
                        <SelectItem value="Healthcare">Healthcare</SelectItem>
                        <SelectItem value="Financial Services">Financial Services</SelectItem>
                        <SelectItem value="Energy">Energy</SelectItem>
                        <SelectItem value="Real Estate">Real Estate</SelectItem>
                        <SelectItem value="Consumer">Consumer</SelectItem>
                        <SelectItem value="Industrials">Industrials</SelectItem>
                        <SelectItem value="Media & Entertainment">Media & Entertainment</SelectItem>
                        <SelectItem value="Telecommunications">Telecommunications</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Parties */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Parties</p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Buyer</Label>
                  <Input value={form.buyer} onChange={(e) => setForm({ ...form, buyer: e.target.value })} placeholder="Orion Data Systems LLC" />
                </div>
                <div className="space-y-1.5">
                  <Label>Seller</Label>
                  <Input value={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.value })} placeholder="Aurora Ventures Fund I, LP" />
                </div>
                <div className="space-y-1.5">
                  <Label>Target Company</Label>
                  <Input value={form.target_company} onChange={(e) => setForm({ ...form, target_company: e.target.value })} placeholder="Nimbus Analytics Inc." />
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Financial Terms */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Financial Terms</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Deal Value ($)</Label>
                  <Input type="number" value={form.deal_value} onChange={(e) => setForm({ ...form, deal_value: e.target.value })} placeholder="12500000" required min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label>Escrow Amount ($)</Label>
                  <Input type="number" value={form.escrow_amount} onChange={(e) => setForm({ ...form, escrow_amount: e.target.value })} placeholder="200000" min={0} />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Jurisdiction & Timing */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Jurisdiction & Timing</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Jurisdiction</Label>
                  <Input value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} placeholder="Delaware, United States" />
                </div>
                <div className="space-y-1.5">
                  <Label>Expected Close Date</Label>
                  <Input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} />
                </div>
              </div>
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
