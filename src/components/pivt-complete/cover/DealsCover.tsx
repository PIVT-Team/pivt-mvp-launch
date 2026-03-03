import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, List, LayoutGrid, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { usePIVTStore } from '@/stores/pivtStore';
import { useKycStore } from '@/stores/kycStore';
import { fadeInUp } from '@/lib/animations';
import { KycGateModal } from '@/components/deal-wizard/KycGateModal';
import { Badge } from '@/components/ui/badge';
import { useDealOperations, RealDeal } from '@/hooks/useDealOperations';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type DealsView = 'list' | 'portfolio';

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-accent text-accent-foreground',
  closing: 'bg-discrepancy text-white',
  closed: 'bg-validated text-white',
  settled: 'bg-validated text-white',
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const DealsCover: React.FC = () => {
  const { setSelectedDealId, setActiveSection } = usePIVTStore();
  const { userKyc, orgKyb, fetchKycData } = useKycStore();
  const { createDeal, createDealFromTemplate, fetchDeals } = useDealOperations();
  const { user } = useAuth();

  const [deals, setDeals] = useState<RealDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGate, setShowGate] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<DealsView>('list');
  const [form, setForm] = useState({ deal_name: '', deal_value: '', closing_date: '', escrow_amount: '' });

  const loadDeals = useCallback(async () => {
    setLoading(true);
    const data = await fetchDeals();
    setDeals(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchKycData(); loadDeals(); }, []);

  const handleNewDeal = () => {
    const kycApproved = userKyc?.status === 'approved';
    const kybApproved = orgKyb?.status === 'approved';
    if (!kycApproved || !kybApproved) {
      setShowGate(true);
    } else {
      setShowCreate(true);
    }
  };

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

  const handleCreateFromTemplate = async () => {
    setCreating(true);
    const deal = await createDealFromTemplate();
    if (deal) {
      setShowGate(false);
      setSelectedDealId(deal.id);
      setActiveSection('workspace');
    }
    setCreating(false);
  };

  const openDeal = (deal: RealDeal) => {
    setSelectedDealId(deal.id);
    setActiveSection('workspace');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Deals</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {deals.length} deal{deals.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="w-4 h-4" />
              List View
            </button>
            <button
              onClick={() => setView('portfolio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${view === 'portfolio' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="w-4 h-4" />
              Portfolio View
            </button>
          </div>

          <button
            onClick={handleNewDeal}
            className="pivt-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
          >
            <Plus className="w-4 h-4" />
            New Deal
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <div className="pivt-card p-12 text-center">
          <p className="text-muted-foreground mb-2">No deals yet.</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first deal to get started.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleNewDeal}
              className="pivt-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            >
              <Plus className="w-4 h-4" /> New Deal
            </button>
          </div>
        </div>
      ) : view === 'list' ? (
        <div className="grid gap-4">
          {deals.map((deal) => (
            <motion.div
              key={deal.id}
              {...fadeInUp}
              onClick={() => openDeal(deal)}
              className="pivt-card p-5 cursor-pointer transition-all hover:shadow-md hover:border-accent/30"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-lg">{deal.deal_name}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[deal.status] || STATUS_COLOR.draft}`}>
                      {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(deal.deal_number); }}
                      className="font-mono text-xs text-accent/70 bg-muted px-1.5 py-0.5 rounded hover:bg-accent/10 transition-colors"
                      title="Click to copy"
                    >
                      {deal.deal_number}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Closing {deal.closing_date || 'TBD'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold">{formatCurrency(deal.deal_value)}</p>
                  {deal.escrow_amount ? (
                    <p className="text-xs text-muted-foreground mt-1">Escrow: {formatCurrency(deal.escrow_amount)}</p>
                  ) : null}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="pivt-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-5 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Deal</span>
              <span>Status</span>
              <span className="text-right">Value</span>
              <span className="text-right">Closing</span>
            </div>
            {deals.map(deal => (
              <div
                key={deal.id}
                onClick={() => openDeal(deal)}
                className="p-4 border-b border-border last:border-0 grid grid-cols-5 items-center hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <div className="col-span-2">
                  <p className="text-base font-semibold">{deal.deal_name}</p>
                  <span className="font-mono text-xs text-accent/70">{deal.deal_number}</span>
                </div>
                <Badge className={`text-xs w-fit ${STATUS_COLOR[deal.status] || STATUS_COLOR.draft}`}>
                  {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                </Badge>
                <p className="font-mono text-sm text-right">{formatCurrency(deal.deal_value)}</p>
                <p className="text-sm text-muted-foreground text-right">{deal.closing_date || 'TBD'}</p>
              </div>
            ))}
          </div>
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

      <KycGateModal
        open={showGate}
        onClose={() => setShowGate(false)}
        onGoToVerification={() => { setShowGate(false); setActiveSection('verification'); }}
        onCreateDemo={handleCreateFromTemplate}
      />
    </div>
  );
};
