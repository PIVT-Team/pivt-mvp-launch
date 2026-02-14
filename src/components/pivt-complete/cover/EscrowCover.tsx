import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import {
  Lock, ArrowUpRight, Clock, TrendingUp, Info, Building2,
  Copy, CheckCircle2, Shield, Upload, Users, Banknote,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type EscrowPageTab = 'overview' | 'ledger' | 'beneficiaries' | 'funding';

export const EscrowCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [activeTab, setActiveTab] = useState<EscrowPageTab>('overview');
  const [escrowStatus, setEscrowStatus] = useState<'active' | 'funded'>('funded');
  const [copied, setCopied] = useState(false);

  const escrowAmount = deal.consideration * 0.1;
  const released = escrowAmount * 0.3;
  const held = escrowAmount - released;

  // Interest calculation
  const interestRate = 4.25;
  const clientSplit = 85;
  const platformSplit = 15;
  const openDate = new Date('2026-01-15');
  const closeDate = new Date(deal.closingDate || '2026-06-15');
  const holdingDays = Math.max(1, Math.round((closeDate.getTime() - openDate.getTime()) / (1000 * 60 * 60 * 24)));
  const grossInterest = held * (interestRate / 100) * (holdingDays / 365);
  const clientInterest = grossInterest * (clientSplit / 100);
  const platformInterest = grossInterest * (platformSplit / 100);

  const refCode = `PIVT-${deal.id.slice(0, 6).toUpperCase()}`;

  const fmt = (n: number) => {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  const copyRef = () => {
    navigator.clipboard.writeText(refCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const beneficiaries = [
    { id: 'b1', name: 'Andreessen Horowitz Fund VII', entityType: 'Fund', jurisdiction: 'Delaware, USA', payoutAmount: 280000000, bankMasked: 'JPM ****4821', status: 'verified' },
    { id: 'b2', name: 'Sequoia Capital Global Growth', entityType: 'Fund', jurisdiction: 'Cayman Islands', payoutAmount: 420000000, bankMasked: 'Citi ****7293', status: 'verified' },
    { id: 'b3', name: 'GIC Private Limited', entityType: 'Corporation', jurisdiction: 'Singapore', payoutAmount: 560000000, bankMasked: 'DBS ****1847', status: 'pending' },
    { id: 'b4', name: 'Tiger Global Management', entityType: 'Fund', jurisdiction: 'New York, USA', payoutAmount: 350000000, bankMasked: 'GS ****5512', status: 'verified' },
    { id: 'b5', name: 'DataStream Founders Trust', entityType: 'Trust', jurisdiction: 'Delaware, USA', payoutAmount: 910000000, bankMasked: 'BNY ****3398', status: 'verified' },
  ];

  const ledger = [
    { date: '2026-01-15', description: 'Escrow funded (partner institution)', debit: 0, credit: escrowAmount },
    { date: '2026-02-01', description: 'Working capital adjustment released', debit: released, credit: 0 },
    { date: '2026-02-14', description: 'Projected interest accrual', debit: 0, credit: grossInterest },
    { date: '2026-03-01', description: 'Advisory fee deducted', debit: escrowAmount * 0.005, credit: 0 },
    { date: '2026-06-15', description: 'Indemnity escrow release (scheduled)', debit: held * 0.5, credit: 0 },
    { date: '2027-01-15', description: 'Final escrow release (scheduled)', debit: held * 0.5, credit: 0 },
  ];

  let runningBalance = 0;
  const ledgerWithBalance = ledger.map(entry => {
    runningBalance += entry.credit - entry.debit;
    return { ...entry, balance: runningBalance };
  });

  const tabs: { id: EscrowPageTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'funding', label: 'Funding' },
    { id: 'ledger', label: 'Ledger' },
    { id: 'beneficiaries', label: 'Beneficiaries' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Escrow & Funds Tracking</h2>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className={escrowStatus === 'funded' ? 'border-validated/50 text-validated' : 'border-accent/50 text-accent'}>
            {escrowStatus.toUpperCase()}
          </Badge>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Building2 className="w-3 h-3" />
            JPMorgan Chase • FBO
          </div>
        </div>
      </div>

      {/* Non-custody notice */}
      <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/15 flex items-center gap-2">
        <Info className="w-3.5 h-3.5 text-accent shrink-0" />
        <p className="text-[11px] text-muted-foreground">
          PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              activeTab === tab.id ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <motion.div {...fadeInUp} className="pivt-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-accent" />
                <span className="text-sm text-muted-foreground">Total Escrow</span>
              </div>
              <p className="pivt-stat">{fmt(escrowAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1">10% of deal value</p>
            </motion.div>
            <motion.div {...fadeInUp} className="pivt-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpRight className="w-4 h-4 text-validated" />
                <span className="text-sm text-muted-foreground">Released</span>
              </div>
              <p className="pivt-stat text-validated">{fmt(released)}</p>
            </motion.div>
            <motion.div {...fadeInUp} className="pivt-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-discrepancy" />
                <span className="text-sm text-muted-foreground">Held</span>
              </div>
              <p className="pivt-stat text-discrepancy">{fmt(held)}</p>
            </motion.div>
            <motion.div {...fadeInUp} className="pivt-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span className="text-sm text-muted-foreground">Projected Interest</span>
              </div>
              <p className="pivt-stat text-accent">{fmt(grossInterest)}</p>
              <p className="text-xs text-muted-foreground mt-1">{interestRate}% • {holdingDays}d hold</p>
            </motion.div>
          </div>

          {/* Interest Projection */}
          <motion.div {...fadeInUp} className="pivt-card p-5 border-l-2 border-l-accent">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h3 className="font-medium">Projected Interest Earnings</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium ml-auto">Projected (simulated)</span>
            </div>
            <div className="grid grid-cols-5 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Holding Period</p>
                <p className="font-mono font-semibold mt-0.5">{holdingDays} days</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interest Rate</p>
                <p className="font-mono font-semibold mt-0.5">{interestRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross Interest</p>
                <p className="font-mono font-semibold mt-0.5">{fmt(grossInterest)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Client ({clientSplit}%)</p>
                <p className="font-mono font-semibold mt-0.5 text-validated">{fmt(clientInterest)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform ({platformSplit}%)</p>
                <p className="font-mono font-semibold mt-0.5 text-accent">{fmt(platformInterest)}</p>
              </div>
            </div>
          </motion.div>

          {/* Timeline */}
          <div className="pivt-card p-5">
            <h3 className="font-medium mb-4">Escrow Timeline</h3>
            <div className="space-y-4">
              {[
                { date: '2026-01-15', event: 'Escrow funded at partner institution', amount: escrowAmount, type: 'in' },
                { date: '2026-02-01', event: 'Working capital adjustment released', amount: released, type: 'out' },
                { date: '2026-08-15', event: 'Indemnity escrow release (scheduled)', amount: held * 0.5, type: 'pending' },
                { date: '2027-01-15', event: 'Final escrow release (scheduled)', amount: held * 0.5, type: 'pending' },
              ].map((evt, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${evt.type === 'in' ? 'bg-accent' : evt.type === 'out' ? 'bg-validated' : 'bg-muted-foreground'}`} />
                  <span className="text-xs font-mono text-muted-foreground w-24">{evt.date}</span>
                  <span className="flex-1 text-sm">{evt.event}</span>
                  <span className={`font-mono text-sm ${evt.type === 'out' ? 'text-validated' : ''}`}>
                    {evt.type === 'out' ? '-' : ''}{fmt(evt.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* FUNDING TAB */}
      {activeTab === 'funding' && (
        <div className="space-y-5">
          {/* Funding Instructions */}
          <div className="pivt-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-accent" />
              <h3 className="font-medium">Funding Instructions</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Bank Name</p>
                <p className="font-medium mt-0.5">JPMorgan Chase</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Type</p>
                <p className="font-medium mt-0.5">FBO (For Benefit Of)</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Routing (Masked)</p>
                <p className="font-mono mt-0.5">****0210</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account (Masked)</p>
                <p className="font-mono mt-0.5">****7842</p>
              </div>
            </div>
            <div className="pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1.5">Reference / Memo (Required)</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted/50 rounded-lg text-accent font-mono text-sm">{refCode}</code>
                <button onClick={copyRef} className="px-3 py-2 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-medium flex items-center gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Funding Confirmation */}
          <div className="pivt-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" />
              <h3 className="font-medium">Funding Confirmation</h3>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Admin</span>
            </div>
            {escrowStatus !== 'funded' ? (
              <>
                <p className="text-xs text-muted-foreground">Confirm funds have been received at the partner institution.</p>
                <div className="flex gap-3">
                  <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors text-xs">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Receipt (Optional)
                  </button>
                  <button
                    onClick={() => setEscrowStatus('funded')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-validated text-white text-sm font-medium hover:bg-validated/80 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as Funded
                  </button>
                </div>
              </>
            ) : (
              <div className="p-3 rounded-lg bg-validated/10 border border-validated/20 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-validated" />
                <div>
                  <p className="text-sm font-semibold text-validated">Escrow Funded</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Interest projection active • Ledger entry created</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h3 className="font-medium">Escrow Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Debit</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Credit</th>
                  <th className="text-right px-4 py-3 text-xs text-muted-foreground font-medium uppercase tracking-wide">Running Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledgerWithBalance.map((entry, i) => (
                  <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.date}</td>
                    <td className="px-4 py-3 text-sm">{entry.description}</td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {entry.debit > 0 ? <span className="text-destructive">-{fmt(entry.debit)}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {entry.credit > 0 ? <span className="text-validated">+{fmt(entry.credit)}</span> : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold">{fmt(entry.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BENEFICIARIES TAB */}
      {activeTab === 'beneficiaries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-accent" />
              <h3 className="font-medium">Beneficiary Registry</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              {beneficiaries.filter(b => b.status === 'verified').length}/{beneficiaries.length} verified
            </p>
          </div>
          <div className="pivt-card overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30 grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Beneficiary</span>
              <span>Type</span>
              <span>Jurisdiction</span>
              <span className="text-right">Payout</span>
              <span className="text-right">Status</span>
            </div>
            {beneficiaries.map(b => (
              <div key={b.id} className="p-3 border-b border-border last:border-0 grid grid-cols-6 items-center text-sm hover:bg-muted/20 transition-colors">
                <div className="col-span-2">
                  <p className="font-medium text-sm">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.bankMasked}</p>
                </div>
                <span className="text-xs text-muted-foreground">{b.entityType}</span>
                <span className="text-xs text-muted-foreground">{b.jurisdiction}</span>
                <span className="text-right font-mono text-sm">{fmtCurrency(b.payoutAmount)}</span>
                <div className="text-right">
                  <Badge variant="outline" className={b.status === 'verified' ? 'border-validated/50 text-validated' : 'border-amber-400/50 text-amber-400'}>
                    {b.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            Beneficiary registry must be complete before execution can proceed. Changes after approval are flagged.
          </p>
        </div>
      )}
    </div>
  );
};
