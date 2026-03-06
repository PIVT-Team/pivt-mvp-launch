import React, { useState, useCallback, useMemo } from 'react';
import { useEditGuard } from '@/hooks/useEditGuard';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  useWaterfallStore,
  TierCategory,
  TierRuleType,
  AllocationType,
  TierStatus,
  WaterfallTier,
  RecipientAllocation,
} from '@/stores/waterfallStore';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus, Trash2, Copy, ChevronDown, ChevronRight,
  Calculator, Download, CheckCircle2, Clock, Ban,
  CreditCard, DollarSign, Users, AlertTriangle,
  FileText, FileJson, Layers,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ── Helpers ──

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmt(n);
};

const statusIcon = (s: TierStatus) => {
  switch (s) {
    case 'READY': return <CheckCircle2 className="w-3.5 h-3.5 text-validated" />;
    case 'PENDING': return <Clock className="w-3.5 h-3.5 text-discrepancy" />;
    case 'BLOCKED': return <Ban className="w-3.5 h-3.5 text-blocking" />;
  }
};

const statusBadgeClass = (s: TierStatus) => {
  switch (s) {
    case 'READY': return 'bg-validated/10 text-validated border-validated/20';
    case 'PENDING': return 'bg-discrepancy/10 text-discrepancy border-discrepancy/20';
    case 'BLOCKED': return 'bg-blocking/10 text-blocking border-blocking/20';
  }
};

const categoryColors: Record<TierCategory, string> = {
  expense: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  debt: 'bg-red-500/10 text-red-600 border-red-500/20',
  preferred: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  common: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

// ── Add Tier Dialog ──

const AddTierDialog: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const { addTier } = useWaterfallStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TierCategory>('common');
  const [ruleType, setRuleType] = useState<TierRuleType>('FIXED_AMOUNT');
  const [ruleValue, setRuleValue] = useState('');

  const handleAdd = () => {
    if (!name.trim()) return;
    addTier(name.trim(), category, ruleType, Number(ruleValue) || 0);
    setName(''); setRuleValue('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Waterfall Tier</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Tier Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Preferred Return" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <Select value={category} onValueChange={v => setCategory(v as TierCategory)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['expense', 'debt', 'preferred', 'common', 'other'] as TierCategory[]).map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Rule Type</label>
              <Select value={ruleType} onValueChange={v => setRuleType(v as TierRuleType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                  <SelectItem value="PERCENT_OF_POOL">% of Pool</SelectItem>
                  <SelectItem value="PRO_RATA">Pro Rata</SelectItem>
                  <SelectItem value="WATERFALL_CAP">Waterfall Cap</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">
              {ruleType === 'PERCENT_OF_POOL' ? 'Percentage' : 'Amount ($)'}
            </label>
            <Input type="number" value={ruleValue} onChange={e => setRuleValue(e.target.value)} className="mt-1 font-mono" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">Add Tier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Add Recipient Dialog ──

const AddRecipientDialog: React.FC<{ open: boolean; tierId: string; onClose: () => void }> = ({ open, tierId, onClose }) => {
  const { addRecipient } = useWaterfallStore();
  const { stakeholders } = usePIVTStore();
  const [mode, setMode] = useState<'stakeholder' | 'external'>('stakeholder');
  const [selectedStakeholder, setSelectedStakeholder] = useState('');
  const [externalName, setExternalName] = useState('');
  const [externalEmail, setExternalEmail] = useState('');
  const [entityType, setEntityType] = useState<'individual' | 'entity'>('individual');
  const [allocType, setAllocType] = useState<AllocationType>('PERCENT_OF_TIER');
  const [amount, setAmount] = useState('');

  const handleAdd = () => {
    const sh = stakeholders.find(s => s.id === selectedStakeholder);
    addRecipient(tierId, {
      stakeholderId: mode === 'stakeholder' ? selectedStakeholder : null,
      externalName: mode === 'stakeholder' ? (sh?.name || '') : externalName,
      externalEmail: mode === 'stakeholder' ? (sh?.email || '') : externalEmail,
      entityType,
      allocationType: allocType,
      amountOrPercent: Number(amount) || 0,
      prerequisites: { kycRequired: true, wireRequired: true, approvalRequired: false },
    });
    onClose();
    setExternalName(''); setExternalEmail(''); setAmount('');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Recipient</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex gap-2">
            <Button variant={mode === 'stakeholder' ? 'default' : 'outline'} size="sm" onClick={() => setMode('stakeholder')}>From Stakeholders</Button>
            <Button variant={mode === 'external' ? 'default' : 'outline'} size="sm" onClick={() => setMode('external')}>External</Button>
          </div>
          {mode === 'stakeholder' ? (
            <Select value={selectedStakeholder} onValueChange={setSelectedStakeholder}>
              <SelectTrigger><SelectValue placeholder="Select stakeholder..." /></SelectTrigger>
              <SelectContent>
                {stakeholders.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name} — {s.role}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-2">
              <Input value={externalName} onChange={e => setExternalName(e.target.value)} placeholder="Name" />
              <Input value={externalEmail} onChange={e => setExternalEmail(e.target.value)} placeholder="Email" />
              <Select value={entityType} onValueChange={v => setEntityType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">Individual</SelectItem>
                  <SelectItem value="entity">Entity</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Allocation Type</label>
              <Select value={allocType} onValueChange={v => setAllocType(v as AllocationType)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED_AMOUNT">Fixed Amount</SelectItem>
                  <SelectItem value="PERCENT_OF_TIER">% of Tier</SelectItem>
                  <SelectItem value="PRO_RATA">Pro Rata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                {allocType === 'FIXED_AMOUNT' ? 'Amount ($)' : 'Value'}
              </label>
              <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="mt-1 font-mono" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleAdd} className="bg-accent text-accent-foreground hover:bg-accent/90">Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Recipient Row ──

const RecipientRow: React.FC<{
  r: RecipientAllocation;
  tierId: string;
  pool: number;
}> = ({ r, tierId, pool }) => {
  const { removeRecipient, updateRecipient } = useWaterfallStore();

  return (
    <div className="grid grid-cols-12 items-center gap-2 px-4 py-2.5 text-xs border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
      <div className="col-span-3 flex items-center gap-2">
        {statusIcon(r.status)}
        <span className="font-medium truncate">{r.externalName}</span>
      </div>
      <div className="col-span-2">
        <Badge variant="outline" className="text-[9px]">{r.allocationType.replace(/_/g, ' ')}</Badge>
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          value={r.amountOrPercent}
          onChange={e => updateRecipient(tierId, r.id, { amountOrPercent: Number(e.target.value) || 0 })}
          className="h-7 text-xs font-mono w-24"
        />
      </div>
      <div className="col-span-2 text-right font-mono font-semibold">{fmtCompact(r.computedPayout)}</div>
      <div className="col-span-2 text-right font-mono text-muted-foreground">{r.computedPctOfPool.toFixed(2)}%</div>
      <div className="col-span-1 flex justify-end">
        <button onClick={() => removeRecipient(tierId, r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

// ── Tier Card ──

const TierCard: React.FC<{ tier: WaterfallTier; pool: number }> = ({ tier, pool }) => {
  const { deleteTier, duplicateTier, toggleTierExpand, updateTier } = useWaterfallStore();
  const [addRecipientOpen, setAddRecipientOpen] = useState(false);
  const pctOfPool = pool > 0 ? (tier.computedTotal / pool) * 100 : 0;

  return (
    <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => toggleTierExpand(tier.id)}
      >
        {tier.expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-mono font-bold text-accent">P{tier.priority}</span>
          <span className="font-semibold text-sm truncate">{tier.name}</span>
          <Badge variant="outline" className={`text-[9px] shrink-0 ${categoryColors[tier.tierCategory]}`}>
            {tier.tierCategory}
          </Badge>
          <Badge className={`text-[9px] shrink-0 ${statusBadgeClass(tier.status)}`}>
            {statusIcon(tier.status)} <span className="ml-1">{tier.status}</span>
          </Badge>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{tier.recipients.length} recipients</p>
            <p className="text-xs font-mono text-muted-foreground">{pctOfPool.toFixed(1)}% of pool</p>
          </div>
          <span className="font-mono text-sm font-bold">{fmtCompact(tier.computedTotal)}</span>
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => duplicateTier(tier.id)} className="p-1 rounded hover:bg-muted transition-colors" title="Duplicate">
              <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
            <button onClick={() => deleteTier(tier.id)} className="p-1 rounded hover:bg-destructive/10 transition-colors" title="Delete">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded: recipients */}
      <AnimatePresence>
        {tier.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border">
              {/* Recipient header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide bg-muted/40">
                <span className="col-span-3">Recipient</span>
                <span className="col-span-2">Allocation</span>
                <span className="col-span-2">Value</span>
                <span className="col-span-2 text-right">Payout</span>
                <span className="col-span-2 text-right">% of Pool</span>
                <span className="col-span-1"></span>
              </div>
              {tier.recipients.map(r => (
                <RecipientRow key={r.id} r={r} tierId={tier.id} pool={pool} />
              ))}
              {tier.recipients.length === 0 && (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">No recipients. Add one below.</div>
              )}
              <div className="p-3 bg-muted/20 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setAddRecipientOpen(true)} className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Add Recipient
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AddRecipientDialog open={addRecipientOpen} tierId={tier.id} onClose={() => setAddRecipientOpen(false)} />
    </motion.div>
  );
};

// ── Distribution Flow Visualization ──

const DistributionFlow: React.FC<{ tiers: WaterfallTier[]; pool: number; unallocated: number }> = ({ tiers, pool, unallocated }) => {
  const barColors = ['bg-amber-500', 'bg-red-500', 'bg-muted-foreground', 'bg-purple-500', 'bg-blue-500', 'bg-emerald-500', 'bg-pink-500'];

  return (
    <div className="pivt-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold">Distribution Flow</h3>
      </div>
      <div className="flex h-8 rounded-lg overflow-hidden">
        {tiers.map((t, i) => {
          const pct = pool > 0 ? (t.computedTotal / pool) * 100 : 0;
          if (pct < 0.5) return null;
          return (
            <motion.div
              key={t.id}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className={`${barColors[i % barColors.length]} transition-all relative group`}
              title={`${t.name}: ${fmtCompact(t.computedTotal)} (${pct.toFixed(1)}%)`}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] font-bold text-white drop-shadow">{pct.toFixed(0)}%</span>
              </div>
            </motion.div>
          );
        })}
        {unallocated > 0 && pool > 0 && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(unallocated / pool) * 100}%` }}
            className="bg-muted border-l-2 border-dashed border-border flex items-center justify-center"
          >
            <span className="text-[8px] text-muted-foreground">Unalloc.</span>
          </motion.div>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {tiers.map((t, i) => (
          <div key={t.id} className="flex items-center gap-1.5 text-[10px]">
            <div className={`w-2.5 h-2.5 rounded-sm ${barColors[i % barColors.length]}`} />
            <span className="text-muted-foreground">{t.name}</span>
          </div>
        ))}
        {unallocated > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            <div className="w-2.5 h-2.5 rounded-sm bg-muted border border-dashed border-border" />
            <span className="text-muted-foreground">Unallocated ({fmtCompact(unallocated)})</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Export Helpers ──

function exportCSV(tiers: WaterfallTier[], pool: number) {
  let csv = 'Priority,Tier,Category,Status,Recipient,Allocation Type,Value,Computed Payout,% of Pool\n';
  tiers.forEach(t => {
    t.recipients.forEach(r => {
      csv += `${t.priority},"${t.name}",${t.tierCategory},${t.status},"${r.externalName}",${r.allocationType},${r.amountOrPercent},${r.computedPayout.toFixed(2)},${r.computedPctOfPool.toFixed(4)}\n`;
    });
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'waterfall-export.csv'; a.click();
  URL.revokeObjectURL(url);
}

function exportJSON(waterfall: any) {
  const blob = new Blob([JSON.stringify(waterfall, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'waterfall-export.json'; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Component ──

export const WaterfallCover: React.FC = () => {
  const { waterfall, recalculate, addAuditEntry, initForDeal } = useWaterfallStore();
  const { tiers, distributionPoolAmount, unallocated, hasDiscrepancy } = waterfall;
  const deal = useSelectedDeal();
  const { importPayments } = usePIVTStore();
  const { toast } = useToast();
  const [addTierOpen, setAddTierOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const { guardEdit } = useEditGuard();

  // Initialize waterfall for the current deal (empty state, no seed data)
  React.useEffect(() => {
    if (deal) {
      initForDeal(deal.id, deal.deal_value || 0);
    }
  }, [deal?.id, deal?.deal_value, initForDeal]);

  const guardedSetAddTierOpen = () => {
    guardEdit('ADD_WATERFALL_TIER', null, () => setAddTierOpen(true));
  };

  const readyTiers = tiers.filter(t => t.status === 'READY');
  const pendingTiers = tiers.filter(t => t.status === 'PENDING');
  const blockedTiers = tiers.filter(t => t.status === 'BLOCKED');
  const readyAmount = readyTiers.reduce((s, t) => s + t.computedTotal, 0);
  const pendingAmount = pendingTiers.reduce((s, t) => s + t.computedTotal, 0);
  const blockedAmount = blockedTiers.reduce((s, t) => s + t.computedTotal, 0);

  const generatePaymentBatch = useCallback(() => {
    const readyRecipients: { id: string; recipientName: string; amount: number; status: 'pending'; method: string }[] = [];
    tiers.forEach(t => {
      t.recipients.forEach(r => {
        if (r.status === 'READY' && r.computedPayout > 0) {
          readyRecipients.push({
            id: crypto.randomUUID(),
            recipientName: r.externalName,
            amount: r.computedPayout,
            status: 'pending',
            method: 'Wire Transfer',
          });
        }
      });
    });
    if (readyRecipients.length === 0) {
      toast({ title: 'No ready recipients', description: 'All recipients have pending prerequisites.', variant: 'destructive' });
      return;
    }
    importPayments(readyRecipients);
    addAuditEntry('Payment batch generated', `${readyRecipients.length} items totalling ${fmtCompact(readyRecipients.reduce((s, r) => s + r.amount, 0))}`);
    toast({ title: 'Payment Batch Generated', description: `${readyRecipients.length} payment items created and sent to Payments tab.` });
  }, [tiers, importPayments, addAuditEntry, toast]);

  return (
    <div className="space-y-5">
      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Distribution', value: fmtCompact(distributionPoolAmount), sub: `${tiers.length} tiers`, icon: DollarSign, color: '' },
          { label: 'Ready', value: fmtCompact(readyAmount), sub: `${readyTiers.length} tiers`, icon: CheckCircle2, color: 'text-validated' },
          { label: 'Pending', value: fmtCompact(pendingAmount), sub: `${pendingTiers.length} tiers`, icon: Clock, color: 'text-discrepancy' },
          { label: 'Blocked', value: fmtCompact(blockedAmount), sub: `${blockedTiers.length} tiers`, icon: Ban, color: 'text-blocking' },
        ].map(kpi => (
          <motion.div key={kpi.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <kpi.icon className={`w-4 h-4 ${kpi.color || 'text-accent'}`} />
            </div>
            <p className={`font-mono text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Discrepancy / Unallocated Warning ── */}
      {hasDiscrepancy && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blocking/10 text-blocking text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          Calculation discrepancy: tier totals exceed distribution pool. Execution blocked.
        </div>
      )}
      {unallocated > 1000 && !hasDiscrepancy && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-discrepancy/10 text-discrepancy text-sm font-medium">
          <AlertTriangle className="w-4 h-4" />
          {fmtCompact(unallocated)} unallocated — assign to a tier or adjust calculations.
        </div>
      )}

      {/* ── Action Buttons ── */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={guardedSetAddTierOpen} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Tier
        </Button>
        <Button variant="outline" size="sm" onClick={recalculate} className="gap-1.5">
          <Calculator className="w-3.5 h-3.5" /> Recalculate
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
        <Button size="sm" onClick={generatePaymentBatch} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90 ml-auto">
          <CreditCard className="w-3.5 h-3.5" /> Generate Payment Batch
        </Button>
      </div>

      {/* ── Tier List ── */}
      <div className="space-y-3">
        {tiers
          .sort((a, b) => a.priority - b.priority)
          .map(tier => (
            <TierCard key={tier.id} tier={tier} pool={distributionPoolAmount} />
          ))}
        {tiers.length === 0 && (
          <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
            No tiers yet. Click "Add Tier" to get started.
          </div>
        )}
      </div>

      {/* ── Distribution Flow ── */}
      <DistributionFlow tiers={tiers} pool={distributionPoolAmount} unallocated={unallocated} />

      {/* ── Dialogs ── */}
      <AddTierDialog open={addTierOpen} onClose={() => setAddTierOpen(false)} />

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle>Export Waterfall</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { exportCSV(tiers, distributionPoolAmount); setExportOpen(false); addAuditEntry('Export generated', 'CSV'); }}>
              <FileText className="w-4 h-4" /> CSV — Recipient Payouts
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => { exportJSON(waterfall); setExportOpen(false); addAuditEntry('Export generated', 'JSON'); }}>
              <FileJson className="w-4 h-4" /> JSON — Full Structure
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
