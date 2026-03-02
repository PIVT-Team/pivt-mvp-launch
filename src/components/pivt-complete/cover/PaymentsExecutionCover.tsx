/**
 * PaymentsExecutionCover — Stripe-style execution layer for M&A disbursements
 * Sub-tabs: Dashboard, Waterfall Designer, FX Monitor, Consideration Types, Reconciliation
 */
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { usePIVTStore } from '@/stores/pivtStore';
import {
  Banknote, ArrowRight, CheckCircle2, Clock, XCircle, Lock, Unlock,
  RefreshCw, Send, AlertTriangle, TrendingUp, Layers, FileText,
  DollarSign, Zap, BarChart3, Shield, Eye, ChevronRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

// ── Types ──
interface DisbursementIntent {
  id: string;
  deal: string;
  dealNumber: string;
  recipient: string;
  amountOriginal: number;
  currencyOriginal: string;
  settlementCurrency: string;
  fxLocked: boolean;
  rail: string;
  status: string;
  considerationType: string;
  requiredApprovals: { role: string; approved: boolean }[];
  requiredConditions: { key: string; met: boolean }[];
  providerRef: string | null;
  createdAt: string;
}

interface WaterfallTierDef {
  id: string;
  rank: number;
  name: string;
  logicType: string;
  amount: number;
  percentage: number;
  recipients: number;
  allocated: number;
}

interface FxQuote {
  id: string;
  pair: string;
  rate: number;
  source: string;
  quotedAt: string;
  expiresAt: string;
  locked: boolean;
  spreadBps: number;
  riskBearer: string;
}

interface ConsiderationRecord {
  id: string;
  deal: string;
  recipient: string;
  type: string;
  status: string;
  terms: string;
}

interface ReconciliationEvent {
  id: string;
  timestamp: string;
  eventType: string;
  entityType: string;
  detail: string;
  status: string;
}

// ── Mock Data ──
const MOCK_INTENTS: DisbursementIntent[] = [
  { id: 'di-001', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Sarah Chen', amountOriginal: 55_500_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'eligible', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: true }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }], providerRef: null, createdAt: '2026-02-14' },
  { id: 'di-002', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Marcus Williams', amountOriginal: 37_000_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'pending_approvals', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: false }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }], providerRef: null, createdAt: '2026-02-14' },
  { id: 'di-003', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Sequoia Capital Fund XIV', amountOriginal: 27_750_000, currencyOriginal: 'USD', settlementCurrency: 'EUR', fxLocked: false, rail: 'swift', status: 'pending_conditions', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: false }, { role: 'SELLER_COUNSEL', approved: false }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: false }], providerRef: null, createdAt: '2026-02-13' },
  { id: 'di-004', deal: 'Project BEACON', dealNumber: 'PIVT-2026-000143', recipient: 'Andreessen Horowitz', amountOriginal: 18_500_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'executing', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: true }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }], providerRef: 'mock-17092384', createdAt: '2026-02-12' },
  { id: 'di-005', deal: 'Project CIPHER', dealNumber: 'PIVT-2026-000144', recipient: 'Tiger Global Management', amountOriginal: 14_800_000, currencyOriginal: 'USD', settlementCurrency: 'GBP', fxLocked: true, rail: 'swift', status: 'settled', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: true }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }], providerRef: 'mock-17091234', createdAt: '2026-02-10' },
  { id: 'di-006', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Employee Option Pool', amountOriginal: 12_950_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'draft', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: false }, { role: 'SELLER_COUNSEL', approved: false }], requiredConditions: [{ key: 'kyc_verified', met: false }, { key: 'wire_instructions', met: false }], providerRef: null, createdAt: '2026-02-15' },
];

const MOCK_TIERS: WaterfallTierDef[] = [
  { id: 'wt1', rank: 1, name: 'Transaction Expenses', logicType: 'fixed', amount: 3_200_000, percentage: 1.7, recipients: 3, allocated: 3_200_000 },
  { id: 'wt2', rank: 2, name: 'Senior Secured Debt', logicType: 'fixed', amount: 72_000_000, percentage: 38.9, recipients: 2, allocated: 72_000_000 },
  { id: 'wt3', rank: 3, name: 'Escrow Holdback (10%)', logicType: 'percentage', amount: 18_500_000, percentage: 10, recipients: 1, allocated: 18_500_000 },
  { id: 'wt4', rank: 4, name: 'Series B Preferred', logicType: 'pro_rata', amount: 47_800_000, percentage: 25.8, recipients: 4, allocated: 47_800_000 },
  { id: 'wt5', rank: 5, name: 'Common Distribution', logicType: 'pro_rata', amount: 43_500_000, percentage: 23.5, recipients: 8, allocated: 43_500_000 },
];

const MOCK_FX: FxQuote[] = [
  { id: 'fx1', pair: 'USD/EUR', rate: 0.9215, source: 'mock', quotedAt: '2026-02-14 09:00', expiresAt: '2026-02-14 09:30', locked: true, spreadBps: 18, riskBearer: 'buyer' },
  { id: 'fx2', pair: 'USD/GBP', rate: 0.7912, source: 'mock', quotedAt: '2026-02-14 10:15', expiresAt: '2026-02-14 10:45', locked: true, spreadBps: 22, riskBearer: 'buyer' },
  { id: 'fx3', pair: 'USD/CHF', rate: 0.8834, source: 'mock', quotedAt: '2026-02-14 11:00', expiresAt: '2026-02-14 11:30', locked: false, spreadBps: 15, riskBearer: 'shared' },
];

const MOCK_CONSIDERATION: ConsiderationRecord[] = [
  { id: 'cr1', deal: 'Project ATLAS', recipient: 'Sarah Chen', type: 'earnout', status: 'pending', terms: '$5M earnout over 24 months, based on ARR growth ≥ 30%' },
  { id: 'cr2', deal: 'Project ATLAS', recipient: 'Marcus Williams', type: 'rollover_equity', status: 'draft', terms: '2.5% equity rollover in NewCo, Class B Common' },
  { id: 'cr3', deal: 'Project CIPHER', recipient: 'NeuralPath AI ESOP', type: 'shares', status: 'executed', terms: '150,000 shares Class A Common at $42.50/share' },
  { id: 'cr4', deal: 'Project BEACON', recipient: 'CloudVault Security', type: 'seller_note', status: 'pending', terms: '$8M seller note, 5.5% annual interest, 3-year maturity' },
];

const MOCK_RECON: ReconciliationEvent[] = [
  { id: 'r1', timestamp: '2026-02-14 09:35', eventType: 'webhook_received', entityType: 'disbursement_intent', detail: 'Wire confirmed for Tiger Global — $14.8M settled via HSBC', status: 'settled' },
  { id: 'r2', timestamp: '2026-02-14 09:20', eventType: 'execution_initiated', entityType: 'disbursement_intent', detail: 'Mock wire initiated for a16z — $18.5M via JPMorgan', status: 'executing' },
  { id: 'r3', timestamp: '2026-02-13 16:00', eventType: 'status_changed', entityType: 'disbursement_intent', detail: 'Sarah Chen intent moved to eligible — all conditions met', status: 'eligible' },
  { id: 'r4', timestamp: '2026-02-13 14:30', eventType: 'locked', entityType: 'fx_quote', detail: 'USD/EUR rate locked at 0.9215 for Sequoia settlement', status: 'locked' },
  { id: 'r5', timestamp: '2026-02-12 11:00', eventType: 'approved', entityType: 'disbursement_intent', detail: 'Buyer Counsel approved $55.5M payout to Sarah Chen', status: 'approved' },
  { id: 'r6', timestamp: '2026-02-12 10:45', eventType: 'calculated', entityType: 'waterfall', detail: 'Waterfall recalculated — version hash wf-a3b8c1d2', status: 'complete' },
];

// ── Status helpers ──
const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-muted-foreground', icon: <FileText className="w-3 h-3" />, label: 'Draft' },
  pending_conditions: { color: 'text-discrepancy', icon: <AlertTriangle className="w-3 h-3" />, label: 'Pending Conditions' },
  pending_approvals: { color: 'text-discrepancy', icon: <Clock className="w-3 h-3" />, label: 'Pending Approvals' },
  eligible: { color: 'text-validated', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Eligible' },
  executing: { color: 'text-blue-500', icon: <Zap className="w-3 h-3 animate-pulse" />, label: 'Executing' },
  executed: { color: 'text-blue-600', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Executed' },
  settled: { color: 'text-validated', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Settled' },
  reconciled: { color: 'text-validated', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Reconciled' },
  failed: { color: 'text-destructive', icon: <XCircle className="w-3 h-3" />, label: 'Failed' },
  pending: { color: 'text-discrepancy', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  confirmed: { color: 'text-validated', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Confirmed' },
};

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

// ── Detail Panel ──
const IntentDetail: React.FC<{ intent: DisbursementIntent; onClose: () => void }> = ({ intent, onClose }) => {
  const sc = statusConfig[intent.status] || statusConfig.draft;
  const steps = ['draft', 'pending_conditions', 'pending_approvals', 'eligible', 'executing', 'executed', 'settled', 'reconciled'];
  const currentIdx = steps.indexOf(intent.status);

  return (
    <motion.div {...fadeInUp} className="pivt-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-mono">{intent.id}</p>
          <h3 className="text-lg font-semibold mt-1">{intent.recipient}</h3>
          <p className="text-sm text-muted-foreground">{intent.deal} · {intent.dealNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light tabular-nums">{fmt(intent.amountOriginal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{intent.currencyOriginal} → {intent.settlementCurrency} · {intent.rail.toUpperCase()}</p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">INTENT LIFECYCLE</p>
        <div className="flex items-center gap-1">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${i <= currentIdx ? (i === currentIdx ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground') : 'bg-muted/30 text-muted-foreground/40'}`}>
                {i < currentIdx ? <CheckCircle2 className="w-2.5 h-2.5 text-validated" /> : null}
                {s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground/30" />}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">CONDITIONS</p>
        <div className="space-y-1">
          {intent.requiredConditions.map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {c.met ? <CheckCircle2 className="w-3.5 h-3.5 text-validated" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              <span>{c.key.replace(/_/g, ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Approvals */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">APPROVALS (DUAL COUNSEL)</p>
        <div className="space-y-1">
          {intent.requiredApprovals.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              {a.approved ? <CheckCircle2 className="w-3.5 h-3.5 text-validated" /> : <Clock className="w-3.5 h-3.5 text-discrepancy" />}
              <span>{a.role.replace(/_/g, ' ')}</span>
              <Badge variant="outline" className={`text-[9px] ml-auto ${a.approved ? 'border-validated/50 text-validated' : 'border-discrepancy/50 text-discrepancy'}`}>
                {a.approved ? 'APPROVED' : 'PENDING'}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* FX */}
      {intent.currencyOriginal !== intent.settlementCurrency && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">FX CONVERSION</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            {intent.fxLocked ? <Lock className="w-4 h-4 text-validated" /> : <Unlock className="w-4 h-4 text-discrepancy" />}
            <div>
              <p className="text-sm font-medium">{intent.currencyOriginal}/{intent.settlementCurrency}</p>
              <p className="text-[10px] text-muted-foreground">{intent.fxLocked ? 'Rate locked' : 'Rate not locked — required before execution'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onClose}>← Back</Button>
        {intent.status === 'eligible' && (
          <Button size="sm" className="bg-validated text-white hover:bg-validated/90" onClick={() => toast.success(`Execution initiated for ${intent.recipient}`)}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Send for Execution
          </Button>
        )}
        {intent.status === 'executing' && (
          <Button size="sm" variant="outline" onClick={() => toast.info('Simulating settlement webhook...')}>
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Simulate Settlement
          </Button>
        )}
      </div>
    </motion.div>
  );
};

// ── Main Component ──
export const PaymentsExecutionCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedIntent, setSelectedIntent] = useState<DisbursementIntent | null>(null);

  const totalValue = MOCK_INTENTS.reduce((s, i) => s + i.amountOriginal, 0);
  const eligible = MOCK_INTENTS.filter(i => i.status === 'eligible');
  const settled = MOCK_INTENTS.filter(i => i.status === 'settled' || i.status === 'reconciled');
  const pending = MOCK_INTENTS.filter(i => ['pending_conditions', 'pending_approvals', 'draft'].includes(i.status));

  if (selectedIntent) {
    return <IntentDetail intent={selectedIntent} onClose={() => setSelectedIntent(null)} />;
  }

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      {/* Header */}
      <motion.div {...fadeInUp} className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'var(--pivt-gradient-primary)' }}>
              <Banknote className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Payments Execution</h1>
              <p className="text-sm text-muted-foreground">Stripe-style disbursement intents · Non-custodial execution layer</p>
            </div>
          </div>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-accent/30 text-accent">
          Provider: MOCK
        </Badge>
      </motion.div>

      {/* KPIs */}
      <motion.div {...fadeInUp} className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Total Pipeline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-light tabular-nums">{fmt(totalValue)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{MOCK_INTENTS.length} disbursement intents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Eligible to Execute</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-light tabular-nums text-validated">{fmt(eligible.reduce((s, i) => s + i.amountOriginal, 0))}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{eligible.length} intents ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Settled</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-light tabular-nums">{fmt(settled.reduce((s, i) => s + i.amountOriginal, 0))}</p>
            <p className="text-[10px] text-validated mt-1">{settled.length} confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Blocked / Pending</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-light tabular-nums text-discrepancy">{fmt(pending.reduce((s, i) => s + i.amountOriginal, 0))}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{pending.length} require action</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="dashboard" className="text-xs">Disbursement Intents</TabsTrigger>
          <TabsTrigger value="waterfall" className="text-xs">Waterfall Designer</TabsTrigger>
          <TabsTrigger value="fx" className="text-xs">FX Monitor</TabsTrigger>
          <TabsTrigger value="consideration" className="text-xs">Consideration Types</TabsTrigger>
          <TabsTrigger value="reconciliation" className="text-xs">Reconciliation</TabsTrigger>
        </TabsList>

        {/* ── Dashboard ── */}
        <TabsContent value="dashboard" className="mt-4">
          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-medium">Deal #</TableHead>
                  <TableHead className="text-xs font-medium">Recipient</TableHead>
                  <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                  <TableHead className="text-xs font-medium">Currency</TableHead>
                  <TableHead className="text-xs font-medium text-center">FX</TableHead>
                  <TableHead className="text-xs font-medium">Rail</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_INTENTS.map((intent) => {
                  const sc = statusConfig[intent.status] || statusConfig.draft;
                  const needsFx = intent.currencyOriginal !== intent.settlementCurrency;
                  return (
                    <TableRow key={intent.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedIntent(intent)}>
                      <TableCell className="font-mono text-xs text-accent/70">{intent.dealNumber}</TableCell>
                      <TableCell className="text-sm font-medium">{intent.recipient}</TableCell>
                      <TableCell className="text-sm font-mono text-right tabular-nums">{fmt(intent.amountOriginal)}</TableCell>
                      <TableCell className="text-xs">
                        {intent.currencyOriginal}
                        {needsFx && <span className="text-muted-foreground"> → {intent.settlementCurrency}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {needsFx ? (
                          intent.fxLocked
                            ? <Lock className="w-3.5 h-3.5 text-validated mx-auto" />
                            : <Unlock className="w-3.5 h-3.5 text-discrepancy mx-auto" />
                        ) : <span className="text-[10px] text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{intent.rail.toUpperCase()}</Badge></TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {intent.status === 'eligible' ? (
                          <Button size="sm" className="h-6 text-[10px] bg-validated text-white hover:bg-validated/90" onClick={(e) => { e.stopPropagation(); toast.success(`Executing ${intent.recipient}...`); }}>
                            Execute
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={(e) => { e.stopPropagation(); setSelectedIntent(intent); }}>
                            <Eye className="w-3 h-3 mr-1" /> View
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Waterfall Designer ── */}
        <TabsContent value="waterfall" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Waterfall Tiers</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Priority-ordered allocation rules · Total: {fmt(185_000_000)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info('Recalculating waterfall...')}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Recalculate
              </Button>
              <Button size="sm" onClick={() => toast.success('Waterfall snapshot locked — version hash generated')}>
                <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Snapshot
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {MOCK_TIERS.map((tier) => (
              <motion.div key={tier.id} {...fadeInUp} className="pivt-card p-4">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
                    {tier.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{tier.name}</p>
                      <Badge variant="outline" className="text-[9px]">{tier.logicType.toUpperCase()}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{tier.recipients} recipients · {tier.percentage}% of total</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono tabular-nums">{fmt(tier.amount)}</p>
                    <p className="text-[10px] text-validated">{fmt(tier.allocated)} allocated</p>
                  </div>
                  <div className="w-32">
                    <Progress value={tier.percentage} className="h-1.5" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="pivt-card p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Allocated</span>
              <span className="text-sm font-mono tabular-nums font-semibold">{fmt(MOCK_TIERS.reduce((s, t) => s + t.allocated, 0))}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">Remaining Unallocated</span>
              <span className="text-xs font-mono text-muted-foreground">{fmt(185_000_000 - MOCK_TIERS.reduce((s, t) => s + t.allocated, 0))}</span>
            </div>
          </div>
        </TabsContent>

        {/* ── FX Monitor ── */}
        <TabsContent value="fx" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">FX Quotes</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Cross-currency settlement rates · Lock before execution</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Requesting new FX quote...')}>
              <TrendingUp className="w-3.5 h-3.5 mr-1.5" /> New Quote
            </Button>
          </div>

          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-medium">Pair</TableHead>
                  <TableHead className="text-xs font-medium">Rate</TableHead>
                  <TableHead className="text-xs font-medium">Spread (bps)</TableHead>
                  <TableHead className="text-xs font-medium">Source</TableHead>
                  <TableHead className="text-xs font-medium">Quoted At</TableHead>
                  <TableHead className="text-xs font-medium">Expires</TableHead>
                  <TableHead className="text-xs font-medium">Risk Bearer</TableHead>
                  <TableHead className="text-xs font-medium text-center">Status</TableHead>
                  <TableHead className="text-xs font-medium w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_FX.map((fx) => (
                  <TableRow key={fx.id}>
                    <TableCell className="font-mono text-sm font-medium">{fx.pair}</TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">{fx.rate.toFixed(4)}</TableCell>
                    <TableCell className="text-xs">{fx.spreadBps}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[9px]">{fx.source}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fx.quotedAt}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fx.expiresAt}</TableCell>
                    <TableCell className="text-xs capitalize">{fx.riskBearer}</TableCell>
                    <TableCell className="text-center">
                      {fx.locked
                        ? <span className="flex items-center justify-center gap-1 text-validated text-xs"><Lock className="w-3 h-3" /> Locked</span>
                        : <span className="flex items-center justify-center gap-1 text-discrepancy text-xs"><Unlock className="w-3 h-3" /> Open</span>}
                    </TableCell>
                    <TableCell>
                      {fx.locked ? (
                        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => toast.info('Unlocking FX quote...')}>
                          <Unlock className="w-3 h-3 mr-1" /> Unlock
                        </Button>
                      ) : (
                        <Button size="sm" className="h-6 text-[10px]" onClick={() => toast.success(`${fx.pair} rate locked at ${fx.rate}`)}>
                          <Lock className="w-3 h-3 mr-1" /> Lock
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Consideration Types ── */}
        <TabsContent value="consideration" className="mt-4 space-y-4">
          <div>
            <h3 className="font-semibold">Non-Cash Consideration</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Shares, earnouts, seller notes, and other structured instruments</p>
          </div>

          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-medium">Deal</TableHead>
                  <TableHead className="text-xs font-medium">Recipient</TableHead>
                  <TableHead className="text-xs font-medium">Type</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium">Terms</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_CONSIDERATION.map((cr) => {
                  const sc = statusConfig[cr.status] || statusConfig.draft;
                  return (
                    <TableRow key={cr.id}>
                      <TableCell className="text-sm">{cr.deal}</TableCell>
                      <TableCell className="text-sm font-medium">{cr.recipient}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] capitalize">{cr.type.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell><span className={`flex items-center gap-1.5 text-xs font-medium ${sc.color}`}>{sc.icon} {sc.label}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{cr.terms}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Reconciliation ── */}
        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <div>
            <h3 className="font-semibold">Reconciliation Feed</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Provider events, settlements, and audit trail</p>
          </div>

          <div className="space-y-2">
            {MOCK_RECON.map((event) => (
              <motion.div key={event.id} {...fadeInUp} className="pivt-card p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                  {event.eventType === 'webhook_received' && <Zap className="w-3.5 h-3.5 text-validated" />}
                  {event.eventType === 'execution_initiated' && <Send className="w-3.5 h-3.5 text-blue-500" />}
                  {event.eventType === 'status_changed' && <RefreshCw className="w-3.5 h-3.5 text-accent" />}
                  {event.eventType === 'locked' && <Lock className="w-3.5 h-3.5 text-validated" />}
                  {event.eventType === 'approved' && <Shield className="w-3.5 h-3.5 text-validated" />}
                  {event.eventType === 'calculated' && <BarChart3 className="w-3.5 h-3.5 text-accent" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">{event.detail}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-mono text-muted-foreground">{event.timestamp}</span>
                    <Badge variant="outline" className="text-[9px]">{event.entityType}</Badge>
                    <Badge variant="outline" className="text-[9px]">{event.eventType.replace(/_/g, ' ')}</Badge>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};
