import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import {
  Briefcase, FileCheck, Users, Shield, Calculator, Clock, CheckCircle2,
  AlertTriangle, ArrowRight, Layers, BarChart3, Lock, CreditCard,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type WorkspaceTab = 'overview' | 'checklist' | 'timeline';

interface ChecklistItem {
  id: string;
  category: string;
  task: string;
  status: 'complete' | 'in-progress' | 'pending' | 'blocked';
  assignee: string;
  dueDate: string;
}

const CHECKLIST: ChecklistItem[] = [
  { id: 'c1', category: 'Legal', task: 'Merger agreement executed', status: 'complete', assignee: 'Seller Counsel', dueDate: '2026-01-15' },
  { id: 'c2', category: 'Legal', task: 'Board resolutions filed', status: 'complete', assignee: 'Corporate Secretary', dueDate: '2026-01-10' },
  { id: 'c3', category: 'Financial', task: 'Cap table reconciled', status: 'complete', assignee: 'Deal Admin', dueDate: '2026-01-20' },
  { id: 'c4', category: 'Financial', task: 'Waterfall schedule approved', status: 'in-progress', assignee: 'Buyer Counsel', dueDate: '2026-02-15' },
  { id: 'c5', category: 'Compliance', task: 'All KYC/KYB verified', status: 'in-progress', assignee: 'Compliance Team', dueDate: '2026-02-20' },
  { id: 'c6', category: 'Compliance', task: 'OFAC screening complete', status: 'complete', assignee: 'Compliance Team', dueDate: '2026-01-25' },
  { id: 'c7', category: 'Banking', task: 'Wire instructions validated', status: 'pending', assignee: 'Deal Admin', dueDate: '2026-02-25' },
  { id: 'c8', category: 'Banking', task: 'Escrow funded', status: 'complete', assignee: 'Escrow Agent', dueDate: '2026-01-15' },
  { id: 'c9', category: 'Execution', task: 'Dual-signature approvals', status: 'pending', assignee: 'All Parties', dueDate: '2026-03-01' },
  { id: 'c10', category: 'Execution', task: 'Funds disbursed', status: 'blocked', assignee: 'Paying Agent', dueDate: '2026-03-15' },
];

const TIMELINE = [
  { date: '2025-11-01', event: 'LOI Signed', status: 'complete' },
  { date: '2025-12-15', event: 'Due Diligence Started', status: 'complete' },
  { date: '2026-01-10', event: 'Definitive Agreement Executed', status: 'complete' },
  { date: '2026-01-15', event: 'Escrow Funded', status: 'complete' },
  { date: '2026-02-01', event: 'Regulatory Approvals Received', status: 'complete' },
  { date: '2026-02-14', event: 'KYC/KYB Verification (In Progress)', status: 'in-progress' },
  { date: '2026-02-28', event: 'Waterfall Finalization', status: 'pending' },
  { date: '2026-03-10', event: 'Dual-Signature Approval Window', status: 'pending' },
  { date: '2026-03-15', event: 'Closing & Disbursement', status: 'pending' },
];

const statusStyles: Record<string, string> = {
  complete: 'text-validated bg-validated/10',
  'in-progress': 'text-accent bg-accent/10',
  pending: 'text-muted-foreground bg-muted',
  blocked: 'text-blocking bg-blocking/10',
};

export const DealWorkspaceCover: React.FC = () => {
  const deal = useSelectedDeal();
  const { stakeholders, documents, waterfallTiers, setActiveSection } = usePIVTStore();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  const completedTasks = CHECKLIST.filter(c => c.status === 'complete').length;
  const totalTasks = CHECKLIST.length;

  const modules = [
    { label: 'Cap Table', icon: Users, section: 'cap-table' as const, stat: `${stakeholders.length} shareholders`, color: 'text-accent' },
    { label: 'Waterfall', icon: Calculator, section: 'waterfall' as const, stat: `${waterfallTiers.length} tiers`, color: 'text-accent' },
    { label: 'Documents', icon: FileCheck, section: 'documents' as const, stat: `${deal.documentsUploaded} uploaded`, color: 'text-validated' },
    { label: 'Escrow', icon: Lock, section: 'escrow' as const, stat: `$${(deal.consideration * 0.1 / 1e6).toFixed(0)}M held`, color: 'text-discrepancy' },
    { label: 'Approvals', icon: Shield, section: 'approvals' as const, stat: '5 pending', color: 'text-orange-400' },
    { label: 'Payments', icon: CreditCard, section: 'payments' as const, stat: `${deal.totalRecipients} recipients`, color: 'text-accent' },
  ];

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Deal Workspace</h1>
        <p className="text-muted-foreground mt-1">{deal.codeName} — {deal.buyerName} acquiring {deal.targetCompany}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        {(['overview', 'checklist', 'timeline'] as WorkspaceTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${activeTab === tab ? 'bg-background text-foreground shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
            {tab}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Progress */}
            <motion.div {...fadeInUp} className="pivt-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium">Closing Progress</h3>
                <span className="font-mono text-accent font-semibold">{completedTasks}/{totalTasks} tasks</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <motion.div className="bg-accent h-3 rounded-full" initial={{ width: 0 }} animate={{ width: `${(completedTasks / totalTasks) * 100}%` }} transition={{ duration: 1 }} />
              </div>
              <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                {Object.entries({ complete: 'Completed', 'in-progress': 'In Progress', pending: 'Pending', blocked: 'Blocked' }).map(([status, label]) => (
                  <div key={status} className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${status === 'complete' ? 'bg-validated' : status === 'in-progress' ? 'bg-accent' : status === 'blocked' ? 'bg-blocking' : 'bg-muted-foreground'}`} />
                    <span>{CHECKLIST.filter(c => c.status === status).length} {label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Module Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {modules.map(mod => (
                <motion.button key={mod.label} {...fadeInUp} onClick={() => setActiveSection(mod.section)} className="pivt-card p-5 text-left hover:border-accent/30 hover:shadow-md transition-all group">
                  <mod.icon className={`w-5 h-5 ${mod.color} mb-3`} />
                  <p className="font-medium group-hover:text-accent transition-colors">{mod.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{mod.stat}</p>
                  <ArrowRight className="w-3 h-3 text-muted-foreground mt-2 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'checklist' && (
          <motion.div key="checklist" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="pivt-card overflow-hidden">
              <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span className="col-span-2">Task</span>
                <span>Assignee</span>
                <span>Due</span>
                <span className="text-center">Status</span>
              </div>
              {CHECKLIST.map(item => (
                <div key={item.id} className="p-4 border-b border-border last:border-0 grid grid-cols-5 items-center hover:bg-muted/20 transition-colors">
                  <div className="col-span-2">
                    <p className="text-sm font-medium">{item.task}</p>
                    <p className="text-xs text-muted-foreground">{item.category}</p>
                  </div>
                  <span className="text-sm text-muted-foreground">{item.assignee}</span>
                  <span className="text-sm font-mono text-muted-foreground">{item.dueDate}</span>
                  <div className="flex justify-center">
                    <Badge className={`text-[10px] ${statusStyles[item.status]}`}>{item.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeTab === 'timeline' && (
          <motion.div key="timeline" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="pivt-card p-6">
              <div className="relative pl-6 space-y-6">
                <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                {TIMELINE.map((evt, i) => (
                  <div key={i} className="relative flex items-start gap-4">
                    <div className={`absolute left-[-16px] w-3 h-3 rounded-full border-2 ${evt.status === 'complete' ? 'bg-validated border-validated' : evt.status === 'in-progress' ? 'bg-accent border-accent' : 'bg-muted border-border'}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${evt.status === 'pending' ? 'text-muted-foreground' : ''}`}>{evt.event}</p>
                      <p className="text-xs text-muted-foreground font-mono">{evt.date}</p>
                    </div>
                    {evt.status === 'complete' && <CheckCircle2 className="w-4 h-4 text-validated shrink-0" />}
                    {evt.status === 'in-progress' && <Clock className="w-4 h-4 text-accent animate-pulse shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
