import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, Clock, XCircle, Plus, DollarSign, Shield, Users, Percent, CreditCard, Lock, UserPlus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { AddStakeholderModal } from './AddStakeholderModal';
import { useEditGuard } from '@/hooks/useEditGuard';
import { supabase } from '@/integrations/supabase/client';

interface DbStakeholder {
  id: string;
  shareholder_name: string;
  ownership_pct: number;
  payout_amount: number;
  escrow_holdback: number | null;
  fees: number | null;
  net_payout: number | null;
}

export const StakeholdersDealTab: React.FC = () => {
  const { isDemoDeal, dealId } = useDealWorkspace();
  const { stakeholders: demoStakeholders } = usePIVTStore();
  const [modalOpen, setModalOpen] = useState(false);
  const { isProtected, guardEdit } = useEditGuard();
  const [dbStakeholders, setDbStakeholders] = useState<DbStakeholder[]>([]);
  const [loading, setLoading] = useState(!isDemoDeal);

  const fetchStakeholders = () => {
    if (isDemoDeal || !dealId) return;
    setLoading(true);
    supabase
      .from('cap_table_entries')
      .select('*')
      .eq('deal_id', dealId)
      .then(({ data }) => {
        setDbStakeholders((data as DbStakeholder[]) || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchStakeholders();
  }, [isDemoDeal, dealId]);

  const handleAddClick = () => {
    guardEdit('ADD_STAKEHOLDER', null, () => setModalOpen(true));
  };

  // For non-demo deals with no stakeholders, show empty state
  if (!isDemoDeal) {
    if (loading) {
      return (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (dbStakeholders.length === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Stakeholders</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Manage deal participants, ownership, and payout details.</p>
            </div>
          </div>

          {/* Summary Cards — all zeros */}
          <div className="grid grid-cols-5 gap-3">
            {[
              { label: 'Total Payout', value: '$0', icon: DollarSign, color: 'text-accent' },
              { label: 'Verified', value: '0/0', icon: Shield, color: 'text-validated' },
              { label: 'KYC Complete', value: '0/0', icon: CheckCircle2, color: 'text-validated' },
              { label: 'Wire Collected', value: '0/0', icon: CreditCard, color: 'text-accent' },
              { label: 'Ownership', value: '0%', icon: Percent, color: 'text-foreground' },
            ].map(card => (
              <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
                </div>
                <p className="text-lg font-semibold">{card.value}</p>
              </motion.div>
            ))}
          </div>

          <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Users className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No stakeholders added yet</h3>
              <p className="text-sm text-muted-foreground mt-1">Add stakeholders to define ownership, KYC, and payout details.</p>
            </div>
            <button
              onClick={handleAddClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add Stakeholder
            </button>
          </motion.div>

          <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} dealId={dealId} isDemoDeal={false} onAdded={fetchStakeholders} />
        </div>
      );
    }

    // Non-demo deal with DB stakeholders
    const totalPayout = dbStakeholders.reduce((s, x) => s + x.payout_amount, 0);
    const totalOwnership = dbStakeholders.reduce((s, x) => s + x.ownership_pct, 0);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Stakeholders</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Manage deal participants, ownership, and payout details.</p>
          </div>
          <button
            onClick={handleAddClick}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Stakeholder
          </button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Payout', value: `$${(totalPayout / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'text-accent' },
            { label: 'Stakeholders', value: `${dbStakeholders.length}`, icon: Shield, color: 'text-validated' },
            { label: 'KYC Complete', value: '0/0', icon: CheckCircle2, color: 'text-validated' },
            { label: 'Wire Collected', value: '0/0', icon: CreditCard, color: 'text-accent' },
            { label: 'Ownership', value: `${totalOwnership}%`, icon: Percent, color: 'text-foreground' },
          ].map(card => (
            <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-lg font-semibold">{card.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="grid grid-cols-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Shareholder</span>
              <span className="text-right">Ownership %</span>
              <span className="text-right">Payout</span>
              <span className="text-right">Net Payout</span>
            </div>
          </div>
          {dbStakeholders.map((s) => (
            <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-5 items-center">
                <div className="col-span-2">
                  <p className="font-medium text-sm">{s.shareholder_name}</p>
                </div>
                <span className="text-right font-mono text-sm">{s.ownership_pct}%</span>
                <span className="text-right font-mono text-sm">${(s.payout_amount / 1e6).toFixed(1)}M</span>
                <span className="text-right font-mono text-sm text-validated">${((s.net_payout || 0) / 1e6).toFixed(1)}M</span>
              </div>
            </motion.div>
          ))}
        </div>

        <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} dealId={dealId} isDemoDeal={false} onAdded={fetchStakeholders} />
      </div>
    );
  }

  // Demo deal — existing behavior
  const verified = demoStakeholders.filter(s => s.kycStatus === 'verified').length;
  const total = demoStakeholders.length;
  const totalPayout = demoStakeholders.reduce((s, x) => s + x.payoutAmount, 0);
  const totalOwnership = demoStakeholders.reduce((s, x) => s + x.ownershipPct, 0);

  const wireStatus = (s: typeof demoStakeholders[0]) =>
    s.kycStatus === 'verified' ? 'Collected' : s.kycStatus === 'pending' ? 'Pending' : 'Not Sent';

  const summaryCards = [
    { label: 'Total Payout', value: `$${(totalPayout / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'text-accent' },
    { label: 'Verified', value: `${verified}/${total}`, icon: Shield, color: 'text-validated' },
    { label: 'KYC Complete', value: `${verified}/${total}`, icon: CheckCircle2, color: 'text-validated' },
    { label: 'Wire Collected', value: `${verified}/${total}`, icon: CreditCard, color: 'text-accent' },
    { label: 'Ownership', value: `${totalOwnership}%`, icon: Percent, color: 'text-foreground' },
  ];

  const statusBadge = (s: typeof demoStakeholders[0]) => {
    if (s.kycStatus === 'verified') return <Badge className="bg-validated/10 text-validated text-[10px]">Verified</Badge>;
    if (s.kycStatus === 'pending') return <Badge className="bg-discrepancy/10 text-discrepancy text-[10px]">Pending</Badge>;
    return <Badge className="bg-blocking/10 text-blocking text-[10px]">Blocked</Badge>;
  };

  const kycBadge = (s: typeof demoStakeholders[0]) => {
    if (s.kycStatus === 'verified') return <span className="text-validated text-xs font-medium">Complete</span>;
    if (s.kycStatus === 'pending') return <span className="text-discrepancy text-xs font-medium">Pending</span>;
    return <span className="text-blocking text-xs font-medium">Failed</span>;
  };

  const wireBadge = (s: typeof demoStakeholders[0]) => {
    const w = wireStatus(s);
    if (w === 'Collected') return <span className="text-validated text-xs font-medium">Collected</span>;
    if (w === 'Pending') return <span className="text-discrepancy text-xs font-medium">Pending</span>;
    return <span className="text-muted-foreground text-xs font-medium">Not Sent</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Stakeholders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage deal participants, ownership, and payout details.</p>
        </div>
        <button
          onClick={handleAddClick}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          {isProtected ? <Lock className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isProtected ? 'Duplicate to edit' : 'Add Stakeholder'}
        </button>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {summaryCards.map(card => (
          <motion.div key={card.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-lg font-semibold">{card.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-8 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Stakeholder</span>
            <span className="text-right">Ownership %</span>
            <span className="text-right">Payout</span>
            <span className="text-center">Status</span>
            <span className="text-center">KYC</span>
            <span className="text-center">Wire</span>
            <span className="text-center">Actions</span>
          </div>
        </div>
        {demoStakeholders.map((s) => (
          <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
            <div className="grid grid-cols-8 items-center">
              <div className="col-span-2">
                <p className="font-medium text-sm">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.email}</p>
              </div>
              <span className="text-right font-mono text-sm">{s.ownershipPct}%</span>
              <span className="text-right font-mono text-sm">${(s.payoutAmount / 1e6).toFixed(0)}M</span>
              <div className="flex justify-center">{statusBadge(s)}</div>
              <div className="flex justify-center">{kycBadge(s)}</div>
              <div className="flex justify-center">{wireBadge(s)}</div>
              <div className="flex justify-center">
                <button className="text-xs text-accent hover:underline">View</button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AddStakeholderModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
};
