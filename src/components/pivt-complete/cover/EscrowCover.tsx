import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import {
  Lock, ArrowUpRight, Clock, TrendingUp, Info, Building2,
  Users, AlertTriangle, Flag,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EscrowAccountDetails } from './escrow/EscrowAccountDetails';
import { FundingConfirmation } from './escrow/FundingConfirmation';
import { EscrowRiskIndicators } from './escrow/EscrowRiskIndicators';
import { ExecutionAuthSnapshot } from './escrow/ExecutionAuthSnapshot';
import { EscrowAuditLog } from './escrow/EscrowAuditLog';
import { InterestTooltip } from './escrow/InterestTooltip';
import { EscrowLifecycleTimeline } from './escrow/EscrowLifecycleTimeline';

type EscrowPageTab = 'overview' | 'ledger' | 'beneficiaries' | 'funding' | 'risk' | 'audit';

export const EscrowCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [activeTab, setActiveTab] = useState<EscrowPageTab>('overview');
  const [escrowStatus, setEscrowStatus] = useState<'pending' | 'active' | 'funded' | 'disbursed' | 'closed'>('funded');

  const escrowAmount = deal.consideration * 0.1;
  const released = escrowAmount * 0.3;
  const held = escrowAmount - released;

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

  // --- Data for new sections ---

  const beneficiaries = [
    { id: 'b1', name: 'Andreessen Horowitz Fund VII', entityType: 'Fund', jurisdiction: 'Delaware, USA', payoutAmount: 8_500_000, bankMasked: 'JPM ****4821', status: 'verified' as const, changedAfterApproval: false },
    { id: 'b2', name: 'Sequoia Capital Global Growth', entityType: 'Fund', jurisdiction: 'Cayman Islands', payoutAmount: 12_800_000, bankMasked: 'Citi ****7293', status: 'verified' as const, changedAfterApproval: false },
    { id: 'b3', name: 'GIC Private Limited', entityType: 'Corporation', jurisdiction: 'Singapore', payoutAmount: 7_400_000, bankMasked: 'DBS ****1847', status: 'pending' as const, changedAfterApproval: false },
    { id: 'b4', name: 'Tiger Global Management', entityType: 'Fund', jurisdiction: 'New York, USA', payoutAmount: 6_800_000, bankMasked: 'GS ****5512', status: 'verified' as const, changedAfterApproval: true },
    { id: 'b5', name: 'Northbridge Founders Trust', entityType: 'Trust', jurisdiction: 'Delaware, USA', payoutAmount: 40_700_000, bankMasked: 'BNY ****3398', status: 'verified' as const, changedAfterApproval: false },
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

  const riskChecks = [
    { label: 'KYC/KYB — All parties approved', status: 'pass' as const, detail: '4/5 verified, 1 pending review' },
    { label: 'Escrow status = Funded', status: escrowStatus === 'funded' ? 'pass' as const : 'pending' as const },
    { label: 'Validation engine — All checks passed', status: 'pass' as const },
    { label: 'High-severity discrepancies resolved', status: 'pass' as const, detail: '0 open high-severity items' },
    { label: 'Required approvals complete', status: 'pending' as const, detail: '3/4 approvers signed' },
    { label: 'Beneficiary registry complete', status: 'pass' as const },
    { label: 'Anti-fraud screening clear', status: 'pass' as const, detail: 'OFAC/AML checks passed' },
  ];

  const approvers = [
    { name: 'Sarah Chen', role: 'Seller Counsel', status: 'approved' as const, timestamp: '2026-02-12 14:32' },
    { name: 'David Park', role: 'Buyer Counsel', status: 'approved' as const, timestamp: '2026-02-12 16:10' },
    { name: 'Maria Rodriguez', role: 'Compliance Officer', status: 'approved' as const, timestamp: '2026-02-13 09:45' },
    { name: 'James Wright', role: 'Deal Admin', status: 'pending' as const },
  ];

  const auditEntries = [
    { timestamp: '2026-02-14 09:12', actor: 'System', action: 'Interest accrual projection recalculated', dealRef: refCode },
    { timestamp: '2026-02-13 09:45', actor: 'Maria Rodriguez', action: 'Execution authorization approved', dealRef: refCode },
    { timestamp: '2026-02-12 16:10', actor: 'David Park', action: 'Execution authorization approved', dealRef: refCode },
    { timestamp: '2026-02-12 14:32', actor: 'Sarah Chen', action: 'Execution authorization approved', dealRef: refCode },
    { timestamp: '2026-02-10 11:00', actor: 'Deal Admin', action: 'Beneficiary bank details updated (Tiger Global)', dealRef: refCode },
    { timestamp: '2026-02-01 10:15', actor: 'Deal Admin', action: 'Working capital adjustment released', dealRef: refCode },
    { timestamp: '2026-01-20 14:30', actor: 'Deal Admin', action: 'Escrow marked as funded', dealRef: refCode },
    { timestamp: '2026-01-15 09:00', actor: 'System', action: 'Funding instructions generated', dealRef: refCode },
    { timestamp: '2026-01-15 08:45', actor: 'Deal Admin', action: 'Escrow account activated at partner institution', dealRef: refCode },
  ];

  const lifecycleEvents = [
    { date: '2026-01-15', label: 'Escrow account opened at JPMorgan Chase', status: 'completed' as const },
    { date: '2026-01-15', label: 'Funding instructions issued', status: 'completed' as const },
    { date: '2026-01-20', label: 'Funding confirmed', status: 'completed' as const },
    { date: '2026-02-01', label: 'Working capital adjustment released', status: 'completed' as const },
    { date: '2026-02-14', label: 'Execution authorization in progress', status: 'active' as const },
    { date: '2026-06-15', label: 'Indemnity escrow release (scheduled)', status: 'upcoming' as const },
    { date: '2027-01-15', label: 'Final escrow release (scheduled)', status: 'upcoming' as const },
  ];

  const tabs: { id: EscrowPageTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'funding', label: 'Funding' },
    { id: 'ledger', label: 'Ledger' },
    { id: 'beneficiaries', label: 'Beneficiaries' },
    { id: 'risk', label: 'Risk & Auth' },
    { id: 'audit', label: 'Audit Trail' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Escrow & Funds Tracking</h2>
        <div className="flex items-center gap-3">
          <span className={escrowStatus === 'funded' ? 'pivt-chip pivt-chip-green' : 'pivt-chip pivt-chip-purple'}>
            {escrowStatus.toUpperCase()}
          </span>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Building2 className="w-3 h-3" />
            JPMorgan Chase • FBO
          </div>
        </div>
      </div>

      {/* Non-custody notice */}
      <div className="pivt-card p-3 flex items-center gap-2.5">
        <div className="pivt-icon-chip pivt-icon-blue">
          <Info className="w-4 h-4" strokeWidth={1.75} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-2xl p-1.5 w-fit flex-wrap" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl text-sm transition-all ${
              activeTab === tab.id ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* =============== OVERVIEW TAB =============== */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Existing summary cards */}
          <div className="grid grid-cols-4 gap-5">
            <motion.div {...fadeInUp} className="pivt-card-accent p-6">
              <div className="pivt-icon-chip pivt-icon-purple mb-3">
                <Lock className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Total Escrow</p>
              <p className="pivt-stat">{fmt(escrowAmount)}</p>
              <p className="text-xs text-muted-foreground mt-1.5">10% of deal value</p>
            </motion.div>
            <motion.div {...fadeInUp} className="pivt-card p-6">
              <div className="pivt-icon-chip pivt-icon-green mb-3">
                <ArrowUpRight className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Released</p>
              <p className="pivt-stat" style={{ color: 'hsl(var(--pivt-emerald))' }}>{fmt(released)}</p>
            </motion.div>
            <motion.div {...fadeInUp} className="pivt-card p-6">
              <div className="pivt-icon-chip pivt-icon-amber mb-3">
                <Clock className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-muted-foreground tracking-wide mb-1">Held</p>
              <p className="pivt-stat" style={{ color: 'hsl(var(--pivt-amber))' }}>{fmt(held)}</p>
            </motion.div>
            <motion.div {...fadeInUp} className="pivt-card p-6">
              <div className="pivt-icon-chip pivt-icon-blue mb-3">
                <TrendingUp className="w-[18px] h-[18px]" strokeWidth={1.75} />
              </div>
              <div className="flex items-center gap-1.5 mb-1">
                <p className="text-[11px] text-muted-foreground tracking-wide">Projected Interest</p>
                <InterestTooltip interestRate={interestRate} clientSplit={clientSplit} platformSplit={platformSplit} />
              </div>
              <p className="pivt-stat" style={{ color: 'hsl(var(--pivt-blue))' }}>{fmt(grossInterest)}</p>
              <p className="text-xs text-muted-foreground mt-1.5">{interestRate}% • {holdingDays}d hold</p>
            </motion.div>
          </div>

          {/* Escrow Account Details */}
          <EscrowAccountDetails
            institutionName="JPMorgan Chase"
            accountType="FBO (For Benefit Of)"
            referenceCode={refCode}
            status={escrowStatus}
            openedAt="2026-01-15"
            maskedAccount="****7842"
            maskedRouting="****0210"
            fundedAt={escrowStatus === 'funded' ? '2026-01-20 14:30 UTC' : undefined}
          />

          {/* Interest Projection */}
          <motion.div {...fadeInUp} className="pivt-card p-5 border-l-2 border-l-accent">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h3 className="font-medium">Projected Interest Earnings</h3>
              <InterestTooltip interestRate={interestRate} clientSplit={clientSplit} platformSplit={platformSplit} />
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

          {/* Lifecycle Timeline */}
          <EscrowLifecycleTimeline events={lifecycleEvents} />
        </div>
      )}

      {/* =============== FUNDING TAB =============== */}
      {activeTab === 'funding' && (
        <div className="space-y-5">
          <FundingConfirmation
            expectedAmount={escrowAmount}
            receivedAmount={escrowAmount}
            confirmedBy={escrowStatus === 'funded' ? 'Deal Admin' : null}
            confirmedAt={escrowStatus === 'funded' ? '2026-01-20 14:30 UTC' : null}
            isFunded={escrowStatus === 'funded'}
            onMarkFunded={() => setEscrowStatus('funded')}
          />

          <EscrowAccountDetails
            institutionName="JPMorgan Chase"
            accountType="FBO (For Benefit Of)"
            referenceCode={refCode}
            status={escrowStatus}
            openedAt="2026-01-15"
            maskedAccount="****7842"
            maskedRouting="****0210"
            fundedAt={escrowStatus === 'funded' ? '2026-01-20 14:30 UTC' : undefined}
          />
        </div>
      )}

      {/* =============== LEDGER TAB =============== */}
      {activeTab === 'ledger' && (
        <div className="pivt-table overflow-hidden">
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

      {/* =============== BENEFICIARIES TAB =============== */}
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
          <div className="pivt-table overflow-hidden">
            <div className="p-3 border-b border-border bg-muted/30 grid grid-cols-7 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Beneficiary</span>
              <span>Type</span>
              <span>Jurisdiction</span>
              <span className="text-right">Payout</span>
              <span className="text-center">Verified</span>
              <span className="text-center">Flags</span>
            </div>
            {beneficiaries.map(b => (
              <div key={b.id} className="p-3 border-b border-border last:border-0 grid grid-cols-7 items-center text-sm hover:bg-muted/20 transition-colors">
                <div className="col-span-2">
                  <p className="font-medium text-sm">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.bankMasked}</p>
                </div>
                <span className="text-xs text-muted-foreground">{b.entityType}</span>
                <span className="text-xs text-muted-foreground">{b.jurisdiction}</span>
                <span className="text-right font-mono text-sm">{fmtCurrency(b.payoutAmount)}</span>
                <div className="text-center">
                  <Badge variant="outline" className={b.status === 'verified' ? 'border-validated/50 text-validated' : 'border-amber-400/50 text-amber-400'}>
                    {b.status}
                  </Badge>
                </div>
                <div className="text-center">
                  {b.changedAfterApproval ? (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-discrepancy/10 text-discrepancy text-[10px] font-medium">
                      <Flag className="w-3 h-3" />
                      Changed
                    </div>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {beneficiaries.some(b => b.changedAfterApproval) && (
            <div className="p-2.5 rounded-lg bg-discrepancy/10 border border-discrepancy/20 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-discrepancy shrink-0" />
              <p className="text-[11px] text-discrepancy">
                One or more beneficiaries were modified after approval. Re-verification required before execution.
              </p>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground italic">
            Beneficiary registry must be complete before execution can proceed. Changes after approval are flagged.
          </p>
        </div>
      )}

      {/* =============== RISK & AUTH TAB =============== */}
      {activeTab === 'risk' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EscrowRiskIndicators checks={riskChecks} />
          <ExecutionAuthSnapshot approvers={approvers} allApproved={approvers.every(a => a.status === 'approved')} />
        </div>
      )}

      {/* =============== AUDIT TRAIL TAB =============== */}
      {activeTab === 'audit' && (
        <EscrowAuditLog entries={auditEntries} />
      )}
    </div>
  );
};
