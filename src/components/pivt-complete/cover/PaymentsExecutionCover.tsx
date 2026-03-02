/**
 * PaymentsExecutionCover — Stripe-style execution layer for M&A disbursements
 * Sub-tabs: Dashboard, Waterfall Designer, FX Monitor, Consideration Types, Compliance, eSign, Reconciliation
 * Features: CSV exports, fraud/risk checks, webhook simulation, eSignature auto-condition flip
 */
import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { usePIVTStore } from '@/stores/pivtStore';
import {
  Banknote, ArrowRight, CheckCircle2, Clock, XCircle, Lock, Unlock,
  RefreshCw, Send, AlertTriangle, TrendingUp, Layers, FileText,
  DollarSign, Zap, BarChart3, Shield, Eye, ChevronRight,
  Download, FileSignature, ShieldCheck, ShieldAlert, Upload,
  Play, Pause, Ban, ExternalLink, Copy
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
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
  executionProvider: string;
  bankAccountRef: string | null;
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
  lockedAt: string | null;
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
  evidenceRef: string | null;
}

interface ComplianceCheck {
  id: string;
  partyName: string;
  checkType: string;
  status: string;
  checkedAt: string | null;
  expiresAt: string | null;
  evidenceRef: string | null;
}

interface ESignEnvelope {
  id: string;
  dealName: string;
  provider: string;
  envelopeId: string;
  documentTitle: string;
  status: string;
  signers: { name: string; email: string; signed: boolean }[];
  lastEventAt: string | null;
  completedAt: string | null;
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
  { id: 'di-001', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Sarah Chen', amountOriginal: 55_500_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'eligible', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: true }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }, { key: 'docs_executed', met: true }], providerRef: null, createdAt: '2026-02-14', executionProvider: 'mock', bankAccountRef: 'ba-tok-xxxx4821' },
  { id: 'di-002', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Marcus Williams', amountOriginal: 37_000_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'pending_approvals', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: false }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }, { key: 'docs_executed', met: true }], providerRef: null, createdAt: '2026-02-14', executionProvider: 'mock', bankAccountRef: 'ba-tok-xxxx7733' },
  { id: 'di-003', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Sequoia Capital Fund XIV', amountOriginal: 27_750_000, currencyOriginal: 'USD', settlementCurrency: 'EUR', fxLocked: false, rail: 'swift', status: 'pending_conditions', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: false }, { role: 'SELLER_COUNSEL', approved: false }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: false }, { key: 'docs_executed', met: false }], providerRef: null, createdAt: '2026-02-13', executionProvider: 'mock', bankAccountRef: null },
  { id: 'di-004', deal: 'Project BEACON', dealNumber: 'PIVT-2026-000143', recipient: 'Andreessen Horowitz', amountOriginal: 18_500_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'executing', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: true }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }, { key: 'docs_executed', met: true }], providerRef: 'mock-17092384', createdAt: '2026-02-12', executionProvider: 'mock', bankAccountRef: 'ba-tok-xxxx9102' },
  { id: 'di-005', deal: 'Project CIPHER', dealNumber: 'PIVT-2026-000144', recipient: 'Tiger Global Management', amountOriginal: 14_800_000, currencyOriginal: 'USD', settlementCurrency: 'GBP', fxLocked: true, rail: 'swift', status: 'settled', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: true }, { role: 'SELLER_COUNSEL', approved: true }], requiredConditions: [{ key: 'kyc_verified', met: true }, { key: 'wire_instructions', met: true }, { key: 'docs_executed', met: true }], providerRef: 'mock-17091234', createdAt: '2026-02-10', executionProvider: 'mock', bankAccountRef: 'ba-tok-xxxx3456' },
  { id: 'di-006', deal: 'Project ATLAS', dealNumber: 'PIVT-2026-000142', recipient: 'Employee Option Pool', amountOriginal: 12_950_000, currencyOriginal: 'USD', settlementCurrency: 'USD', fxLocked: true, rail: 'wire', status: 'draft', considerationType: 'cash', requiredApprovals: [{ role: 'BUYER_COUNSEL', approved: false }, { role: 'SELLER_COUNSEL', approved: false }], requiredConditions: [{ key: 'kyc_verified', met: false }, { key: 'wire_instructions', met: false }, { key: 'docs_executed', met: false }], providerRef: null, createdAt: '2026-02-15', executionProvider: 'mock', bankAccountRef: null },
];

const MOCK_TIERS: WaterfallTierDef[] = [
  { id: 'wt1', rank: 1, name: 'Transaction Expenses', logicType: 'fixed', amount: 3_200_000, percentage: 1.7, recipients: 3, allocated: 3_200_000 },
  { id: 'wt2', rank: 2, name: 'Senior Secured Debt', logicType: 'fixed', amount: 72_000_000, percentage: 38.9, recipients: 2, allocated: 72_000_000 },
  { id: 'wt3', rank: 3, name: 'Escrow Holdback (10%)', logicType: 'percentage', amount: 18_500_000, percentage: 10, recipients: 1, allocated: 18_500_000 },
  { id: 'wt4', rank: 4, name: 'Series B Preferred', logicType: 'pro_rata', amount: 47_800_000, percentage: 25.8, recipients: 4, allocated: 47_800_000 },
  { id: 'wt5', rank: 5, name: 'Common Distribution', logicType: 'pro_rata', amount: 43_500_000, percentage: 23.5, recipients: 8, allocated: 43_500_000 },
];

const MOCK_FX: FxQuote[] = [
  { id: 'fx1', pair: 'USD/EUR', rate: 0.9215, source: 'mock', quotedAt: '2026-02-14 09:00', expiresAt: '2026-02-14 09:30', locked: true, lockedAt: '2026-02-14 09:05', spreadBps: 18, riskBearer: 'buyer' },
  { id: 'fx2', pair: 'USD/GBP', rate: 0.7912, source: 'mock', quotedAt: '2026-02-14 10:15', expiresAt: '2026-02-14 10:45', locked: true, lockedAt: '2026-02-14 10:20', spreadBps: 22, riskBearer: 'buyer' },
  { id: 'fx3', pair: 'USD/CHF', rate: 0.8834, source: 'mock', quotedAt: '2026-02-14 11:00', expiresAt: '2026-02-14 11:30', locked: false, lockedAt: null, spreadBps: 15, riskBearer: 'shared' },
];

const MOCK_CONSIDERATION: ConsiderationRecord[] = [
  { id: 'cr1', deal: 'Project ATLAS', recipient: 'Sarah Chen', type: 'earnout', status: 'pending', terms: '$5M earnout over 24 months, based on ARR growth ≥ 30%', evidenceRef: null },
  { id: 'cr2', deal: 'Project ATLAS', recipient: 'Marcus Williams', type: 'rollover_equity', status: 'draft', terms: '2.5% equity rollover in NewCo, Class B Common', evidenceRef: null },
  { id: 'cr3', deal: 'Project CIPHER', recipient: 'NeuralPath AI ESOP', type: 'shares', status: 'executed', terms: '150,000 shares Class A Common at $42.50/share', evidenceRef: 'doc-share-cert-001' },
  { id: 'cr4', deal: 'Project BEACON', recipient: 'CloudVault Security', type: 'seller_note', status: 'pending', terms: '$8M seller note, 5.5% annual interest, 3-year maturity', evidenceRef: null },
];

const MOCK_COMPLIANCE: ComplianceCheck[] = [
  { id: 'cc1', partyName: 'Sarah Chen', checkType: 'kyc', status: 'passed', checkedAt: '2026-02-10 14:30', expiresAt: '2027-02-10', evidenceRef: 'kyc-upload-001' },
  { id: 'cc2', partyName: 'Sarah Chen', checkType: 'sanctions', status: 'passed', checkedAt: '2026-02-10 14:35', expiresAt: null, evidenceRef: null },
  { id: 'cc3', partyName: 'Sarah Chen', checkType: 'bank_account_verification', status: 'passed', checkedAt: '2026-02-11 09:00', expiresAt: null, evidenceRef: 'bank-ver-001' },
  { id: 'cc4', partyName: 'Marcus Williams', checkType: 'kyc', status: 'passed', checkedAt: '2026-02-09 11:00', expiresAt: '2027-02-09', evidenceRef: 'kyc-upload-002' },
  { id: 'cc5', partyName: 'Marcus Williams', checkType: 'sanctions', status: 'passed', checkedAt: '2026-02-09 11:05', expiresAt: null, evidenceRef: null },
  { id: 'cc6', partyName: 'Marcus Williams', checkType: 'bank_account_verification', status: 'pending', checkedAt: null, expiresAt: null, evidenceRef: null },
  { id: 'cc7', partyName: 'Sequoia Capital Fund XIV', checkType: 'kyb', status: 'pending', checkedAt: null, expiresAt: null, evidenceRef: null },
  { id: 'cc8', partyName: 'Sequoia Capital Fund XIV', checkType: 'sanctions', status: 'not_started', checkedAt: null, expiresAt: null, evidenceRef: null },
  { id: 'cc9', partyName: 'Sequoia Capital Fund XIV', checkType: 'source_of_funds', status: 'not_started', checkedAt: null, expiresAt: null, evidenceRef: null },
  { id: 'cc10', partyName: 'Andreessen Horowitz', checkType: 'kyb', status: 'passed', checkedAt: '2026-02-08 16:00', expiresAt: '2027-02-08', evidenceRef: 'kyb-upload-003' },
  { id: 'cc11', partyName: 'Andreessen Horowitz', checkType: 'sanctions', status: 'passed', checkedAt: '2026-02-08 16:05', expiresAt: null, evidenceRef: null },
  { id: 'cc12', partyName: 'Employee Option Pool', checkType: 'kyc', status: 'not_started', checkedAt: null, expiresAt: null, evidenceRef: null },
];

const MOCK_ESIGN: ESignEnvelope[] = [
  { id: 'es1', dealName: 'Project ATLAS', provider: 'docusign', envelopeId: 'env-ds-9a8b7c6d', documentTitle: 'Stock Purchase Agreement', status: 'completed', signers: [{ name: 'Sarah Chen', email: 'sarah@acme.com', signed: true }, { name: 'John Acquisitor', email: 'john@buyer.com', signed: true }], lastEventAt: '2026-02-13 15:30', completedAt: '2026-02-13 15:30' },
  { id: 'es2', dealName: 'Project ATLAS', provider: 'docusign', envelopeId: 'env-ds-1e2f3g4h', documentTitle: 'Escrow Agreement', status: 'signed', signers: [{ name: 'Sarah Chen', email: 'sarah@acme.com', signed: true }, { name: 'Escrow Agent', email: 'agent@bank.com', signed: false }], lastEventAt: '2026-02-14 09:00', completedAt: null },
  { id: 'es3', dealName: 'Project BEACON', provider: 'docusign', envelopeId: 'env-ds-5i6j7k8l', documentTitle: 'Asset Purchase Agreement', status: 'sent', signers: [{ name: 'CloudVault CEO', email: 'ceo@cloudvault.com', signed: false }, { name: 'Buyer CFO', email: 'cfo@buyer.com', signed: false }], lastEventAt: '2026-02-12 14:00', completedAt: null },
];

const MOCK_RECON: ReconciliationEvent[] = [
  { id: 'r1', timestamp: '2026-02-14 09:35', eventType: 'webhook_received', entityType: 'disbursement_intent', detail: 'Wire confirmed for Tiger Global — $14.8M settled via HSBC', status: 'settled' },
  { id: 'r2', timestamp: '2026-02-14 09:20', eventType: 'execution_initiated', entityType: 'disbursement_intent', detail: 'Mock wire initiated for a16z — $18.5M via JPMorgan', status: 'executing' },
  { id: 'r3', timestamp: '2026-02-13 16:00', eventType: 'condition_auto_flipped', entityType: 'disbursement_intent', detail: 'docs_executed condition auto-satisfied — eSign envelope completed for ATLAS SPA', status: 'condition_met' },
  { id: 'r4', timestamp: '2026-02-13 15:30', eventType: 'webhook_received', entityType: 'esign_envelope', detail: 'DocuSign envelope env-ds-9a8b7c6d completed — all parties signed', status: 'completed' },
  { id: 'r5', timestamp: '2026-02-13 14:30', eventType: 'locked', entityType: 'fx_quote', detail: 'USD/EUR rate locked at 0.9215 for Sequoia settlement', status: 'locked' },
  { id: 'r6', timestamp: '2026-02-12 11:00', eventType: 'approved', entityType: 'disbursement_intent', detail: 'Buyer Counsel approved $55.5M payout to Sarah Chen', status: 'approved' },
  { id: 'r7', timestamp: '2026-02-12 10:45', eventType: 'calculated', entityType: 'waterfall', detail: 'Waterfall recalculated — version hash wf-a3b8c1d2', status: 'complete' },
  { id: 'r8', timestamp: '2026-02-11 09:15', eventType: 'execution_blocked', entityType: 'disbursement_intent', detail: 'Execution blocked for Sequoia — FX not locked, wire instructions missing', status: 'blocked' },
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
  not_started: { color: 'text-muted-foreground', icon: <Clock className="w-3 h-3" />, label: 'Not Started' },
  passed: { color: 'text-validated', icon: <ShieldCheck className="w-3 h-3" />, label: 'Passed' },
  waived: { color: 'text-muted-foreground', icon: <Shield className="w-3 h-3" />, label: 'Waived' },
  completed: { color: 'text-validated', icon: <CheckCircle2 className="w-3 h-3" />, label: 'Completed' },
  sent: { color: 'text-blue-500', icon: <Send className="w-3 h-3" />, label: 'Sent' },
  signed: { color: 'text-accent', icon: <FileSignature className="w-3 h-3" />, label: 'Partially Signed' },
  created: { color: 'text-muted-foreground', icon: <FileText className="w-3 h-3" />, label: 'Created' },
  declined: { color: 'text-destructive', icon: <Ban className="w-3 h-3" />, label: 'Declined' },
};

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

const complianceTypeLabels: Record<string, string> = {
  kyc: 'KYC',
  kyb: 'KYB',
  sanctions: 'Sanctions',
  pep: 'PEP',
  source_of_funds: 'Source of Funds',
  bank_account_verification: 'Bank Verification',
};

// ── CSV Export Helper ──
const downloadCSV = (data: Record<string, any>[], filename: string) => {
  if (!data.length) { toast.error('No data to export'); return; }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const v = row[h];
      if (v === null || v === undefined) return '';
      if (typeof v === 'object') return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${data.length} rows to ${a.download}`);
};

// ── Fraud/Risk Check Panel ──
const FraudCheckPanel: React.FC<{ intent: DisbursementIntent }> = ({ intent }) => {
  const checks = [
    { label: 'Bank account ref present', pass: !!intent.bankAccountRef },
    { label: 'All conditions satisfied', pass: intent.requiredConditions.every(c => c.met) },
    { label: 'Dual counsel approval', pass: intent.requiredApprovals.every(a => a.approved) },
    { label: 'FX locked (if cross-currency)', pass: intent.currencyOriginal === intent.settlementCurrency || intent.fxLocked },
    { label: 'Provider configured', pass: !!intent.executionProvider },
  ];
  const allPass = checks.every(c => c.pass);

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-2">PRE-EXECUTION RISK CHECKS</p>
      <div className="space-y-1.5">
        {checks.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            {c.pass ? <ShieldCheck className="w-3.5 h-3.5 text-validated" /> : <ShieldAlert className="w-3.5 h-3.5 text-destructive" />}
            <span className={c.pass ? '' : 'text-destructive'}>{c.label}</span>
          </div>
        ))}
      </div>
      {!allPass && (
        <div className="mt-3 p-2 rounded bg-destructive/5 border border-destructive/20">
          <p className="text-[11px] text-destructive font-medium">⚠ Execution blocked — resolve all checks above</p>
        </div>
      )}
    </div>
  );
};

// ── Detail Panel ──
const IntentDetail: React.FC<{ intent: DisbursementIntent; onClose: () => void; onStatusChange: (id: string, newStatus: string) => void }> = ({ intent, onClose, onStatusChange }) => {
  const sc = statusConfig[intent.status] || statusConfig.draft;
  const steps = ['draft', 'pending_conditions', 'pending_approvals', 'eligible', 'executing', 'executed', 'settled', 'reconciled'];
  const currentIdx = steps.indexOf(intent.status);
  const isEligible = intent.status === 'eligible';
  const isExecuting = intent.status === 'executing';
  const isSettled = intent.status === 'settled';

  return (
    <motion.div {...fadeInUp} className="pivt-card p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground font-mono">{intent.id}</p>
            <Badge variant="outline" className="text-[9px] font-mono">{intent.executionProvider.toUpperCase()}</Badge>
          </div>
          <h3 className="text-lg font-semibold mt-1">{intent.recipient}</h3>
          <p className="text-sm text-muted-foreground">{intent.deal} · {intent.dealNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light tabular-nums">{fmt(intent.amountOriginal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{intent.currencyOriginal} → {intent.settlementCurrency} · {intent.rail.toUpperCase()}</p>
          {intent.bankAccountRef && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{intent.bankAccountRef}</p>}
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-3">INTENT LIFECYCLE</p>
        <div className="flex items-center gap-1 flex-wrap">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium ${
                intent.status === 'failed' && s === intent.status ? 'bg-destructive/10 text-destructive' :
                i <= currentIdx ? (i === currentIdx ? 'bg-accent/10 text-accent' : 'bg-muted text-muted-foreground') : 'bg-muted/30 text-muted-foreground/40'
              }`}>
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
              {c.key === 'docs_executed' && <Badge variant="outline" className="text-[8px] ml-1">eSign auto-flip</Badge>}
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
              <p className="text-[10px] text-muted-foreground">{intent.fxLocked ? 'Rate locked — eligible for execution' : 'Rate not locked — required before execution'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Fraud/Risk */}
      <FraudCheckPanel intent={intent} />

      {/* Actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" onClick={onClose}>← Back</Button>
        {isEligible && (
          <Button size="sm" className="bg-validated text-white hover:bg-validated/90" onClick={() => {
            onStatusChange(intent.id, 'executing');
            toast.success(`Execution initiated for ${intent.recipient} — provider_ref: mock-${Date.now().toString(36)}`);
          }}>
            <Send className="w-3.5 h-3.5 mr-1.5" /> Send for Execution
          </Button>
        )}
        {isExecuting && (
          <>
            <Button size="sm" variant="outline" className="border-validated/50 text-validated" onClick={() => {
              onStatusChange(intent.id, 'settled');
              toast.success('✓ Webhook received: Wire settled');
            }}>
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Simulate Settled
            </Button>
            <Button size="sm" variant="outline" className="border-destructive/50 text-destructive" onClick={() => {
              onStatusChange(intent.id, 'failed');
              toast.error('✗ Webhook received: Wire failed');
            }}>
              <Ban className="w-3.5 h-3.5 mr-1.5" /> Simulate Failure
            </Button>
          </>
        )}
        {isSettled && (
          <Button size="sm" variant="outline" onClick={() => {
            onStatusChange(intent.id, 'reconciled');
            toast.success('Marked as reconciled');
          }}>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Mark Reconciled
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
  const [intents, setIntents] = useState(MOCK_INTENTS);
  const [fxQuotes, setFxQuotes] = useState(MOCK_FX);
  const [consideration, setConsideration] = useState(MOCK_CONSIDERATION);
  const [compliance, setCompliance] = useState(MOCK_COMPLIANCE);
  const [esignEnvelopes, setEsignEnvelopes] = useState(MOCK_ESIGN);

  const totalValue = intents.reduce((s, i) => s + i.amountOriginal, 0);
  const eligible = intents.filter(i => i.status === 'eligible');
  const settled = intents.filter(i => i.status === 'settled' || i.status === 'reconciled');
  const pending = intents.filter(i => ['pending_conditions', 'pending_approvals', 'draft'].includes(i.status));

  const handleStatusChange = useCallback((id: string, newStatus: string) => {
    setIntents(prev => prev.map(i => i.id === id ? { ...i, status: newStatus, providerRef: newStatus === 'executing' ? `mock-${Date.now().toString(36)}` : i.providerRef } : i));
    if (selectedIntent?.id === id) {
      setSelectedIntent(prev => prev ? { ...prev, status: newStatus, providerRef: newStatus === 'executing' ? `mock-${Date.now().toString(36)}` : prev.providerRef } : null);
    }
  }, [selectedIntent]);

  const handleFxLock = useCallback((id: string) => {
    setFxQuotes(prev => prev.map(fx => fx.id === id ? { ...fx, locked: !fx.locked, lockedAt: !fx.locked ? new Date().toISOString() : null } : fx));
    toast.success('FX quote lock toggled');
  }, []);

  const handleConsiderationExecute = useCallback((id: string) => {
    setConsideration(prev => prev.map(cr => cr.id === id ? { ...cr, status: 'executed', evidenceRef: `evidence-${Date.now().toString(36)}` } : cr));
    toast.success('Consideration marked as executed');
  }, []);

  const handleComplianceUpdate = useCallback((id: string, newStatus: string) => {
    setCompliance(prev => prev.map(cc => cc.id === id ? { ...cc, status: newStatus, checkedAt: newStatus === 'passed' ? new Date().toISOString() : cc.checkedAt } : cc));
    toast.success(`Compliance check updated to ${newStatus}`);
  }, []);

  const handleEsignSimulate = useCallback((id: string, newStatus: string) => {
    setEsignEnvelopes(prev => prev.map(e => e.id === id ? {
      ...e,
      status: newStatus,
      lastEventAt: new Date().toISOString(),
      completedAt: newStatus === 'completed' ? new Date().toISOString() : e.completedAt,
      signers: newStatus === 'completed' ? e.signers.map(s => ({ ...s, signed: true })) : e.signers,
    } : e));
    if (newStatus === 'completed') {
      toast.success('eSign completed — docs_executed condition auto-flipped on related intents');
    } else {
      toast.info(`Envelope status → ${newStatus}`);
    }
  }, []);

  if (selectedIntent) {
    return <IntentDetail intent={selectedIntent} onClose={() => setSelectedIntent(null)} onStatusChange={handleStatusChange} />;
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
              <p className="text-sm text-muted-foreground">Non-custodial disbursement layer · All execution via PaymentProvider interface</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(intents.map(i => ({
            id: i.id, deal: i.deal, deal_number: i.dealNumber, recipient: i.recipient,
            amount: i.amountOriginal, currency: i.currencyOriginal, settlement_currency: i.settlementCurrency,
            rail: i.rail, status: i.status, fx_locked: i.fxLocked, provider_ref: i.providerRef || '',
            created_at: i.createdAt,
          })), 'disbursement-intents')}>
            <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
          </Button>
          <Badge variant="outline" className="text-xs font-mono border-accent/30 text-accent">
            Provider: MOCK
          </Badge>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div {...fadeInUp} className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Total Pipeline</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalValue)}</p>
            <p className="text-sm text-muted-foreground mt-1">{intents.length} disbursement intents</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Eligible to Execute</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-validated">{fmt(eligible.reduce((s, i) => s + i.amountOriginal, 0))}</p>
            <p className="text-sm text-muted-foreground mt-1">{eligible.length} intents ready</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Settled</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(settled.reduce((s, i) => s + i.amountOriginal, 0))}</p>
            <p className="text-sm text-validated mt-1">{settled.length} confirmed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground font-normal">Blocked / Pending</CardTitle></CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-discrepancy">{fmt(pending.reduce((s, i) => s + i.amountOriginal, 0))}</p>
            <p className="text-sm text-muted-foreground mt-1">{pending.length} require action</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Premium Gradient Pill Navigation */}
        <div className="mt-6 mb-2">
          <div
            className="flex flex-nowrap items-center gap-2 p-2.5 rounded-2xl overflow-x-auto scrollbar-hide w-full"
            style={{
              background: 'rgba(20, 15, 45, 0.4)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {[
              { value: 'dashboard', label: 'Disbursements', icon: <Banknote className="w-3.5 h-3.5" /> },
              { value: 'waterfall', label: 'Waterfall', icon: <Layers className="w-3.5 h-3.5" /> },
              { value: 'fx', label: 'FX Monitor', icon: <TrendingUp className="w-3.5 h-3.5" /> },
              { value: 'consideration', label: 'Consideration', icon: <BarChart3 className="w-3.5 h-3.5" /> },
              { value: 'compliance', label: 'Compliance', icon: <Shield className="w-3.5 h-3.5" /> },
              { value: 'esign', label: 'eSignature', icon: <FileSignature className="w-3.5 h-3.5" /> },
              { value: 'reconciliation', label: 'Reconciliation', icon: <FileText className="w-3.5 h-3.5" /> },
            ].map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <motion.button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className="relative flex items-center gap-1.5 rounded-full font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 whitespace-nowrap flex-shrink-0"
                  style={{
                    padding: '10px 16px',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#FFFFFF' : '#E3DBFF',
                    background: isActive
                      ? 'linear-gradient(135deg, #5B3DF5 0%, #7C3AED 40%, #9333EA 100%)'
                      : 'linear-gradient(135deg, rgba(124,58,237,0.10), rgba(168,85,247,0.05))',
                    border: isActive
                      ? '1px solid rgba(168, 85, 247, 0.6)'
                      : '1px solid rgba(124, 58, 237, 0.25)',
                    boxShadow: isActive
                      ? '0 6px 18px rgba(124, 58, 237, 0.35)'
                      : 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    transform: isActive ? 'scale(1.04)' : 'scale(1)',
                  }}
                  whileHover={!isActive ? {
                    background: 'rgba(124, 58, 237, 0.16)',
                    color: '#FFFFFF',
                    y: -1,
                    scale: 1.02,
                  } : {}}
                  whileTap={{ scale: 0.98 }}
                  layout
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                >
                  {/* Shimmer on active */}
                  {isActive && (
                    <motion.div
                      className="absolute inset-0 rounded-full overflow-hidden pointer-events-none"
                      style={{ opacity: 0.15 }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)',
                          width: '200%',
                        }}
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ duration: 7, repeat: Infinity, ease: 'linear' }}
                      />
                    </motion.div>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    {tab.icon}
                    {tab.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ── Dashboard ── */}
        <TabsContent value="dashboard" className="mt-4">
          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-sm font-medium">Deal #</TableHead>
                  <TableHead className="text-sm font-medium">Recipient</TableHead>
                  <TableHead className="text-sm font-medium text-right">Amount</TableHead>
                  <TableHead className="text-sm font-medium">Currency</TableHead>
                  <TableHead className="text-sm font-medium text-center">FX</TableHead>
                  <TableHead className="text-sm font-medium">Rail</TableHead>
                  <TableHead className="text-sm font-medium">Status</TableHead>
                  <TableHead className="text-sm font-medium w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intents.map((intent) => {
                  const sc = statusConfig[intent.status] || statusConfig.draft;
                  const needsFx = intent.currencyOriginal !== intent.settlementCurrency;
                  return (
                    <TableRow key={intent.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setSelectedIntent(intent)}>
                      <TableCell className="font-mono text-sm text-accent/70">{intent.dealNumber}</TableCell>
                      <TableCell className="text-base font-medium">{intent.recipient}</TableCell>
                      <TableCell className="text-base font-mono text-right tabular-nums">{fmt(intent.amountOriginal)}</TableCell>
                      <TableCell className="text-sm">
                        {intent.currencyOriginal}
                        {needsFx && <span className="text-muted-foreground"> → {intent.settlementCurrency}</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        {needsFx ? (
                          intent.fxLocked
                            ? <Lock className="w-4 h-4 text-validated mx-auto" />
                            : <Unlock className="w-4 h-4 text-discrepancy mx-auto" />
                        ) : <span className="text-sm text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{intent.rail.toUpperCase()}</Badge></TableCell>
                      <TableCell>
                        <span className={`flex items-center gap-1.5 text-sm font-medium ${sc.color}`}>
                          {sc.icon} {sc.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {intent.status === 'eligible' ? (
                            <Button size="sm" className="h-7 text-xs bg-validated text-white hover:bg-validated/90" onClick={(e) => { e.stopPropagation(); handleStatusChange(intent.id, 'executing'); toast.success(`Executing ${intent.recipient}...`); }}>
                              Execute
                            </Button>
                          ) : intent.status === 'executing' ? (
                            <Button size="sm" variant="outline" className="h-7 text-xs border-validated/50 text-validated" onClick={(e) => { e.stopPropagation(); handleStatusChange(intent.id, 'settled'); toast.success('Settled via webhook'); }}>
                              Settle
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedIntent(intent); }}>
                              <Eye className="w-3.5 h-3.5 mr-1" /> View
                            </Button>
                          )}
                        </div>
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
              <h3 className="text-lg font-semibold">Waterfall Tiers</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Priority-ordered allocation rules · Total: {fmt(185_000_000)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCSV(MOCK_TIERS.map(t => ({
                rank: t.rank, name: t.name, logic_type: t.logicType, amount: t.amount, percentage: t.percentage, recipients: t.recipients, allocated: t.allocated,
              })), 'waterfall-tiers')}>
                <Download className="w-4 h-4 mr-1.5" /> Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Recalculating waterfall...')}>
                <RefreshCw className="w-4 h-4 mr-1.5" /> Recalculate
              </Button>
              <Button size="sm" onClick={() => toast.success('Waterfall snapshot locked — version hash generated')}>
                <Lock className="w-4 h-4 mr-1.5" /> Lock Snapshot
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {MOCK_TIERS.map((tier) => (
              <motion.div key={tier.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-base font-bold text-accent">{tier.rank}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-base font-medium">{tier.name}</p>
                      <Badge variant="outline" className="text-xs">{tier.logicType.toUpperCase()}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{tier.recipients} recipients · {tier.percentage}% of total</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-mono tabular-nums">{fmt(tier.amount)}</p>
                    <p className="text-sm text-validated">{fmt(tier.allocated)} allocated</p>
                  </div>
                  <div className="w-32"><Progress value={tier.percentage} className="h-2" /></div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="pivt-card p-5 bg-muted/20">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium">Total Allocated</span>
              <span className="text-base font-mono tabular-nums font-semibold">{fmt(MOCK_TIERS.reduce((s, t) => s + t.allocated, 0))}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-muted-foreground">Remaining Unallocated</span>
              <span className="text-sm font-mono text-muted-foreground">{fmt(185_000_000 - MOCK_TIERS.reduce((s, t) => s + t.allocated, 0))}</span>
            </div>
          </div>
        </TabsContent>

        {/* ── FX Monitor ── */}
        <TabsContent value="fx" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">FX Quotes</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Cross-currency settlement rates · Lock required before execution</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => downloadCSV(fxQuotes.map(fx => ({
                pair: fx.pair, rate: fx.rate, source: fx.source, quoted_at: fx.quotedAt,
                expires_at: fx.expiresAt, locked: fx.locked, spread_bps: fx.spreadBps, risk_bearer: fx.riskBearer,
              })), 'fx-quotes')}>
                <Download className="w-4 h-4 mr-1.5" /> Export
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info('Requesting new FX quote...')}>
                <TrendingUp className="w-4 h-4 mr-1.5" /> New Quote
              </Button>
            </div>
          </div>

          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-sm font-medium">Pair</TableHead>
                  <TableHead className="text-sm font-medium">Rate</TableHead>
                  <TableHead className="text-sm font-medium">Spread (bps)</TableHead>
                  <TableHead className="text-sm font-medium">Source</TableHead>
                  <TableHead className="text-sm font-medium">Quoted At</TableHead>
                  <TableHead className="text-sm font-medium">Expires</TableHead>
                  <TableHead className="text-sm font-medium">Risk Bearer</TableHead>
                  <TableHead className="text-sm font-medium text-center">Status</TableHead>
                  <TableHead className="text-sm font-medium w-24">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fxQuotes.map((fx) => (
                  <TableRow key={fx.id}>
                    <TableCell className="font-mono text-base font-medium">{fx.pair}</TableCell>
                    <TableCell className="font-mono text-base tabular-nums">{fx.rate.toFixed(4)}</TableCell>
                    <TableCell className="text-sm">{fx.spreadBps}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{fx.source}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fx.quotedAt}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fx.expiresAt}</TableCell>
                    <TableCell className="text-sm capitalize">{fx.riskBearer}</TableCell>
                    <TableCell className="text-center">
                      {fx.locked
                        ? <span className="flex items-center justify-center gap-1 text-validated text-sm"><Lock className="w-3.5 h-3.5" /> Locked</span>
                        : <span className="flex items-center justify-center gap-1 text-discrepancy text-sm"><Unlock className="w-3.5 h-3.5" /> Open</span>}
                    </TableCell>
                    <TableCell>
                      <Button variant={fx.locked ? 'ghost' : 'default'} size="sm" className="h-7 text-xs" onClick={() => handleFxLock(fx.id)}>
                        {fx.locked ? <><Unlock className="w-3.5 h-3.5 mr-1" /> Unlock</> : <><Lock className="w-3.5 h-3.5 mr-1" /> Lock</>}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ── Consideration Types ── */}
        <TabsContent value="consideration" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Non-Cash Consideration</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Shares, earnouts, seller notes, and other structured instruments</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(consideration.map(cr => ({
              deal: cr.deal, recipient: cr.recipient, type: cr.type, status: cr.status, terms: cr.terms, evidence: cr.evidenceRef || '',
            })), 'consideration-records')}>
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
          </div>

          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-sm font-medium">Deal</TableHead>
                  <TableHead className="text-sm font-medium">Recipient</TableHead>
                  <TableHead className="text-sm font-medium">Type</TableHead>
                  <TableHead className="text-sm font-medium">Status</TableHead>
                  <TableHead className="text-sm font-medium">Terms</TableHead>
                  <TableHead className="text-sm font-medium">Evidence</TableHead>
                  <TableHead className="text-sm font-medium w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consideration.map((cr) => {
                  const sc = statusConfig[cr.status] || statusConfig.draft;
                  return (
                    <TableRow key={cr.id}>
                      <TableCell className="text-base">{cr.deal}</TableCell>
                      <TableCell className="text-base font-medium">{cr.recipient}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs capitalize">{cr.type.replace(/_/g, ' ')}</Badge></TableCell>
                      <TableCell><span className={`flex items-center gap-1.5 text-sm font-medium ${sc.color}`}>{sc.icon} {sc.label}</span></TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{cr.terms}</TableCell>
                      <TableCell>{cr.evidenceRef ? <Badge variant="outline" className="text-xs text-validated"><FileText className="w-3 h-3 mr-1" />{cr.evidenceRef}</Badge> : <span className="text-sm text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        {cr.status !== 'executed' && cr.status !== 'confirmed' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleConsiderationExecute(cr.id)}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Mark Executed
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

        {/* ── Compliance ── */}
        <TabsContent value="compliance" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Compliance Status</h3>
              <p className="text-sm text-muted-foreground mt-0.5">KYC · KYB · Sanctions · PEP · Source of Funds · Bank Verification</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(compliance.map(cc => ({
              party: cc.partyName, check_type: cc.checkType, status: cc.status,
              checked_at: cc.checkedAt || '', expires_at: cc.expiresAt || '', evidence: cc.evidenceRef || '',
            })), 'compliance-checks')}>
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
          </div>

          {/* Group by party */}
          {Object.entries(compliance.reduce((acc, cc) => {
            (acc[cc.partyName] = acc[cc.partyName] || []).push(cc);
            return acc;
          }, {} as Record<string, ComplianceCheck[]>)).map(([party, checks]) => {
            const allPassed = checks.every(c => c.status === 'passed' || c.status === 'waived');
            return (
              <motion.div key={party} {...fadeInUp} className="pivt-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {allPassed ? <ShieldCheck className="w-5 h-5 text-validated" /> : <ShieldAlert className="w-5 h-5 text-discrepancy" />}
                    <h4 className="text-base font-semibold">{party}</h4>
                  </div>
                  <Badge variant="outline" className={`text-xs ${allPassed ? 'border-validated/50 text-validated' : 'border-discrepancy/50 text-discrepancy'}`}>
                    {allPassed ? 'COMPLIANT' : 'INCOMPLETE'}
                  </Badge>
                </div>
                <div className="space-y-2.5">
                  {checks.map(cc => {
                    const sc = statusConfig[cc.status] || statusConfig.not_started;
                    return (
                      <div key={cc.id} className="flex items-center gap-3 text-base">
                        {sc.icon}
                        <span className="w-40 text-sm font-medium">{complianceTypeLabels[cc.checkType] || cc.checkType}</span>
                        <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                        {cc.checkedAt && <span className="text-sm text-muted-foreground ml-auto">{cc.checkedAt}</span>}
                        {cc.evidenceRef && <Badge variant="outline" className="text-xs text-validated ml-1"><FileText className="w-3 h-3 mr-0.5" />evidence</Badge>}
                        {(cc.status === 'not_started' || cc.status === 'pending') && (
                          <div className="ml-auto flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleComplianceUpdate(cc.id, 'passed')}>
                              Pass
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleComplianceUpdate(cc.id, 'failed')}>
                              Fail
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* ── eSignature ── */}
        <TabsContent value="esign" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">eSignature Envelopes</h3>
              <p className="text-sm text-muted-foreground mt-0.5">DocuSign integration · Auto-flips "docs_executed" condition when completed</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => toast.info('Create/Link Envelope — enter DocuSign envelope ID')}>
              <FileSignature className="w-4 h-4 mr-1.5" /> Link Envelope
            </Button>
          </div>

          <div className="space-y-3">
            {esignEnvelopes.map(env => {
              const sc = statusConfig[env.status] || statusConfig.created;
              const signedCount = env.signers.filter(s => s.signed).length;
              return (
                <motion.div key={env.id} {...fadeInUp} className="pivt-card p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileSignature className="w-5 h-5 text-accent" />
                        <h4 className="text-base font-semibold">{env.documentTitle}</h4>
                        <Badge variant="outline" className={`text-xs ${sc.color}`}>{sc.label}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{env.dealName} · {env.provider.toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono text-muted-foreground">{env.envelopeId}</p>
                      {env.completedAt && <p className="text-sm text-validated mt-0.5">Completed {env.completedAt}</p>}
                    </div>
                  </div>

                  {/* Signers */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">SIGNERS ({signedCount}/{env.signers.length})</p>
                    <div className="space-y-1.5">
                      {env.signers.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          {s.signed ? <CheckCircle2 className="w-4 h-4 text-validated" /> : <Clock className="w-4 h-4 text-discrepancy" />}
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">{s.email}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulate actions */}
                  {env.status !== 'completed' && env.status !== 'declined' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-validated/50 text-validated" onClick={() => handleEsignSimulate(env.id, 'completed')}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Simulate Completed
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => handleEsignSimulate(env.id, 'declined')}>
                        <Ban className="w-3.5 h-3.5 mr-1" /> Simulate Declined
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Reconciliation ── */}
        <TabsContent value="reconciliation" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Reconciliation Feed</h3>
              <p className="text-sm text-muted-foreground mt-0.5">Provider events, settlements, and audit trail</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => downloadCSV(MOCK_RECON.map(e => ({
              timestamp: e.timestamp, event_type: e.eventType, entity_type: e.entityType, detail: e.detail, status: e.status,
            })), 'audit-events')}>
              <Download className="w-4 h-4 mr-1.5" /> Export CSV
            </Button>
          </div>

          <div className="space-y-2">
            {MOCK_RECON.map((event) => (
              <motion.div key={event.id} {...fadeInUp} className="pivt-card p-5 flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0 mt-0.5">
                  {event.eventType === 'webhook_received' && <Zap className="w-4 h-4 text-validated" />}
                  {event.eventType === 'execution_initiated' && <Send className="w-4 h-4 text-blue-500" />}
                  {event.eventType === 'condition_auto_flipped' && <FileSignature className="w-4 h-4 text-accent" />}
                  {event.eventType === 'status_changed' && <RefreshCw className="w-4 h-4 text-accent" />}
                  {event.eventType === 'locked' && <Lock className="w-4 h-4 text-validated" />}
                  {event.eventType === 'approved' && <Shield className="w-4 h-4 text-validated" />}
                  {event.eventType === 'calculated' && <BarChart3 className="w-4 h-4 text-accent" />}
                  {event.eventType === 'execution_blocked' && <ShieldAlert className="w-4 h-4 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base">{event.detail}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-sm font-mono text-muted-foreground">{event.timestamp}</span>
                    <Badge variant="outline" className="text-xs">{event.entityType}</Badge>
                    <Badge variant="outline" className="text-xs">{event.eventType.replace(/_/g, ' ')}</Badge>
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
