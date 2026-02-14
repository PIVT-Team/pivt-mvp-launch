import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Wallet, CheckCircle2, Clock, FileCheck, Shield, Download,
  Eye, EyeOff, AlertTriangle, ArrowRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const RecipientDashboardCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents } = usePIVTStore();
  const [showAmounts, setShowAmounts] = useState(true);
  const [selectedRecipient, setSelectedRecipient] = useState(stakeholders[0]?.id || '');

  const recipient = stakeholders.find(s => s.id === selectedRecipient) || stakeholders[0];
  if (!recipient) return null;

  const escrow = recipient.payoutAmount * 0.1;
  const fees = recipient.payoutAmount * 0.005;
  const net = recipient.payoutAmount - escrow - fees;

  const milestones = [
    { label: 'KYC Verified', done: recipient.kycStatus === 'verified', icon: Shield },
    { label: 'Documents Signed', done: true, icon: FileCheck },
    { label: 'Wire Instructions Confirmed', done: recipient.kycStatus === 'verified', icon: CheckCircle2 },
    { label: 'Payout Approved', done: false, icon: Clock },
    { label: 'Funds Received', done: false, icon: Wallet },
  ];

  const formatAmount = (n: number) => showAmounts ? `$${(n / 1e6).toFixed(1)}M` : '••••••';

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Recipient Dashboard</h1>
          <p className="text-muted-foreground mt-1">{deal.codeName} — Your payout status and documents</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowAmounts(!showAmounts)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted/50 transition-colors">
            {showAmounts ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showAmounts ? 'Hide' : 'Show'} Amounts
          </button>
          <select value={selectedRecipient} onChange={e => setSelectedRecipient(e.target.value)} className="bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none">
            {stakeholders.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Payout Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Gross Payout', value: formatAmount(recipient.payoutAmount), icon: Wallet, color: 'text-accent' },
          { label: 'Escrow Holdback', value: formatAmount(escrow), icon: Clock, color: 'text-discrepancy' },
          { label: 'Fees & Expenses', value: formatAmount(fees), icon: AlertTriangle, color: 'text-muted-foreground' },
          { label: 'Net Proceeds', value: formatAmount(net), icon: CheckCircle2, color: 'text-validated' },
        ].map(stat => (
          <motion.div key={stat.label} {...fadeInUp} className="pivt-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            </div>
            <p className="pivt-stat text-xl">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Progress Milestones */}
      <motion.div {...fadeInUp} className="pivt-card p-6">
        <h3 className="font-medium mb-4">Payout Progress</h3>
        <div className="flex items-center gap-2">
          {milestones.map((m, i) => (
            <React.Fragment key={m.label}>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${m.done ? 'bg-validated/10 text-validated' : 'bg-muted/50 text-muted-foreground'}`}>
                {m.done ? <CheckCircle2 className="w-4 h-4" /> : <m.icon className="w-4 h-4" />}
                <span className="hidden md:inline text-xs">{m.label}</span>
              </div>
              {i < milestones.length - 1 && <ArrowRight className={`w-3 h-3 ${m.done ? 'text-validated' : 'text-muted-foreground/30'}`} />}
            </React.Fragment>
          ))}
        </div>
      </motion.div>

      {/* Recipient Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="font-medium mb-4">Your Information</h3>
          <div className="space-y-3">
            {[
              { label: 'Name', value: recipient.name },
              { label: 'Role', value: recipient.role },
              { label: 'Email', value: recipient.email },
              { label: 'Ownership', value: `${recipient.ownershipPct}%` },
              { label: 'KYC Status', value: recipient.kycStatus },
            ].map(field => (
              <div key={field.label} className="flex justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm text-muted-foreground">{field.label}</span>
                <span className="text-sm font-medium">{field.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div {...fadeInUp} className="pivt-card p-5">
          <h3 className="font-medium mb-4">Your Documents</h3>
          <div className="space-y-2">
            {[
              { name: 'Joinder Agreement', status: 'signed' },
              { name: 'W-9 Tax Form', status: 'uploaded' },
              { name: 'Wire Instructions', status: recipient.kycStatus === 'verified' ? 'verified' : 'pending' },
              { name: 'Payout Letter', status: 'pending' },
            ].map(doc => (
              <div key={doc.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <FileCheck className="w-4 h-4 text-muted-foreground" />
                <span className="flex-1 text-sm">{doc.name}</span>
                <Badge variant="outline" className={`text-[10px] ${doc.status === 'signed' || doc.status === 'verified' || doc.status === 'uploaded' ? 'border-validated/50 text-validated' : 'border-muted-foreground/50 text-muted-foreground'}`}>
                  {doc.status}
                </Badge>
                {(doc.status === 'signed' || doc.status === 'uploaded') && <Download className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-accent" />}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
