import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, springConfig } from '@/lib/animations';
import {
  Vault, Users, CreditCard, Building2, CheckCircle2,
  Clock, AlertTriangle, ArrowUpRight, Lock, Send,
  RefreshCw, FileCheck,
} from 'lucide-react';

type ClosingTab = 'wire-vault' | 'stakeholder-portal' | 'payment-batch' | 'reconciliation';

const tabs: { id: ClosingTab; label: string; icon: React.ElementType }[] = [
  { id: 'wire-vault', label: 'Wire Vault', icon: Lock },
  { id: 'stakeholder-portal', label: 'Stakeholder Portal', icon: Users },
  { id: 'payment-batch', label: 'Payment Batch', icon: CreditCard },
  { id: 'reconciliation', label: 'Bank Reconciliation', icon: Building2 },
];

const WIRE_INSTRUCTIONS = [
  { id: 'w1', recipient: 'Sarah Chen', bank: 'JPMorgan Chase', account: '****4821', amount: 24_500_000, verified: true },
  { id: 'w2', recipient: 'Marcus Williams', bank: 'Bank of America', account: '****7392', amount: 16_200_000, verified: true },
  { id: 'w3', recipient: 'Sequoia Capital Fund XIV', bank: 'Silicon Valley Bank', account: '****1056', amount: 12_800_000, verified: true },
  { id: 'w4', recipient: 'Andreessen Horowitz', bank: 'Morgan Stanley', account: '****8834', amount: 8_500_000, verified: false },
  { id: 'w5', recipient: 'Tiger Global Management', bank: 'Citibank', account: '****2210', amount: 6_800_000, verified: true },
  { id: 'w6', recipient: 'Employee Option Pool', bank: 'Pending', account: 'N/A', amount: 5_200_000, verified: false },
];

const PAYMENT_BATCHES = [
  { id: 'b1', name: 'Batch 1 — Founders', count: 2, total: 40_700_000, status: 'approved' as const },
  { id: 'b2', name: 'Batch 2 — Institutional', count: 3, total: 28_100_000, status: 'pending' as const },
  { id: 'b3', name: 'Batch 3 — ESOP & Other', count: 4, total: 5_200_000, status: 'draft' as const },
];

const RECON_ENTRIES = [
  { date: '2026-02-12', reference: 'WR-001', expected: 24_500_000, actual: 24_500_000, matched: true },
  { date: '2026-02-12', reference: 'WR-002', expected: 16_200_000, actual: 16_200_000, matched: true },
  { date: '2026-02-13', reference: 'WR-003', expected: 12_800_000, actual: 0, matched: false },
  { date: '2026-02-13', reference: 'WR-004', expected: 6_800_000, actual: 6_800_000, matched: true },
];

export const ClosingCenterCover: React.FC = () => {
  const deal = useSelectedDeal();
  const [activeTab, setActiveTab] = useState<ClosingTab>('wire-vault');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Closing Center</h2>
          <p className="text-sm text-muted-foreground">{deal.codeName} — ${(deal.consideration / 1e6).toFixed(1)}M</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-2 h-2 rounded-full bg-validated" />
          <span className="text-validated font-medium">4 of 6 wires verified</span>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'wire-vault' && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Recipient</span>
              <span>Bank</span>
              <span>Account</span>
              <span className="text-right">Amount</span>
              <span className="text-center">Verified</span>
            </div>
          </div>
          {WIRE_INSTRUCTIONS.map(wire => (
            <motion.div key={wire.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-6 items-center">
                <span className="col-span-2 font-medium text-sm">{wire.recipient}</span>
                <span className="text-sm text-muted-foreground">{wire.bank}</span>
                <span className="font-mono text-sm text-muted-foreground">{wire.account}</span>
                <span className="text-right font-mono text-sm">${(wire.amount / 1e6).toFixed(0)}M</span>
                <div className="flex justify-center">
                  {wire.verified ? (
                    <CheckCircle2 className="w-4 h-4 text-validated" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-discrepancy" />
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {activeTab === 'stakeholder-portal' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Stakeholders', value: '28', icon: Users },
              { label: 'KYC Complete', value: '24', icon: CheckCircle2 },
              { label: 'Action Required', value: '4', icon: AlertTriangle },
            ].map(stat => (
              <div key={stat.label} className="pivt-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <stat.icon className="w-4 h-4 text-accent" />
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
                <p className="pivt-stat">{stat.value}</p>
              </div>
            ))}
          </div>
          <div className="pivt-card p-5">
            <h3 className="font-medium mb-4">Stakeholder Status Overview</h3>
            <div className="space-y-3">
              {[
                { group: 'Founders', count: 2, ready: 2 },
                { group: 'Institutional Investors', count: 5, ready: 4 },
                { group: 'Employee Option Pool', count: 1, ready: 0 },
                { group: 'Other Shareholders', count: 20, ready: 18 },
              ].map(g => (
                <div key={g.group} className="flex items-center gap-4">
                  <span className="text-sm flex-1">{g.group}</span>
                  <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-accent rounded-full" style={{ width: `${(g.ready / g.count) * 100}%` }} />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground w-12 text-right">{g.ready}/{g.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payment-batch' && (
        <div className="space-y-4">
          {PAYMENT_BATCHES.map(batch => {
            const statusColors = {
              approved: 'text-validated bg-validated/10',
              pending: 'text-discrepancy bg-discrepancy/10',
              draft: 'text-muted-foreground bg-muted',
            };
            return (
              <motion.div key={batch.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{batch.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{batch.count} payments · ${(batch.total / 1e6).toFixed(1)}M</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColors[batch.status]}`}>
                      {batch.status}
                    </span>
                    {batch.status === 'approved' && (
                      <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium">
                        <Send className="w-3 h-3" /> Execute
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {activeTab === 'reconciliation' && (
        <div className="pivt-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
            <span className="text-sm font-medium">Bank Reconciliation</span>
            <button className="flex items-center gap-1.5 text-xs text-accent hover:underline">
              <RefreshCw className="w-3 h-3" /> Refresh
            </button>
          </div>
          <div className="p-4 border-b border-border bg-muted/30">
            <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span>Date</span>
              <span>Reference</span>
              <span className="text-right">Expected</span>
              <span className="text-right">Actual</span>
              <span className="text-right">Variance</span>
              <span className="text-center">Match</span>
            </div>
          </div>
          {RECON_ENTRIES.map((entry, i) => (
            <div key={i} className="p-4 border-b border-border last:border-0">
              <div className="grid grid-cols-6 items-center text-sm">
                <span className="font-mono text-xs">{entry.date}</span>
                <span className="font-mono text-xs">{entry.reference}</span>
                <span className="text-right font-mono">${(entry.expected / 1e6).toFixed(0)}M</span>
                <span className="text-right font-mono">{entry.actual > 0 ? `$${(entry.actual / 1e6).toFixed(0)}M` : '—'}</span>
                <span className={`text-right font-mono ${entry.matched ? 'text-validated' : 'text-blocking'}`}>
                  {entry.matched ? '$0' : `-$${(entry.expected / 1e6).toFixed(0)}M`}
                </span>
                <div className="flex justify-center">
                  {entry.matched ? (
                    <CheckCircle2 className="w-4 h-4 text-validated" />
                  ) : (
                    <Clock className="w-4 h-4 text-discrepancy" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
