import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, List, LayoutGrid, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react';
import { usePIVTStore, DemoDeal, DealWorkflowState } from '@/stores/pivtStore';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { useKycStore } from '@/stores/kycStore';
import { fadeInUp } from '@/lib/animations';
import { KycGateModal } from '@/components/deal-wizard/KycGateModal';
import { Badge } from '@/components/ui/badge';

type DealsView = 'list' | 'portfolio';

const WORKFLOW_LABELS: Record<DealWorkflowState, string> = {
  draft: 'Draft',
  data_uploaded: 'Data Uploaded',
  reconciliation: 'Reconciliation',
  awaiting_approval: 'Awaiting Approval',
  approved: 'Approved',
  closed: 'Closed',
};

const workflowColor = (state: DealWorkflowState) => {
  switch (state) {
    case 'closed': return 'bg-validated text-white';
    case 'approved': return 'bg-validated text-white';
    case 'awaiting_approval': return 'bg-accent text-accent-foreground';
    case 'reconciliation': return 'bg-discrepancy text-white';
    case 'data_uploaded': return 'bg-accent/70 text-accent-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

export const DealsCover: React.FC = () => {
  const { deals, setSelectedDealId, setActiveSection } = usePIVTStore();
  const { openWizard, setWizardMode, prefillDemo } = useDealWizardStore();
  const { userKyc, orgKyb, fetchKycData } = useKycStore();
  const [showGate, setShowGate] = useState(false);
  const [view, setView] = useState<DealsView>('list');

  useEffect(() => { fetchKycData(); }, []);

  const handleNewDeal = () => {
    const kycApproved = userKyc?.status === 'approved';
    const kybApproved = orgKyb?.status === 'approved';
    if (!kycApproved || !kybApproved) {
      setShowGate(true);
    } else {
      openWizard();
    }
  };

  const openDeal = (deal: DemoDeal) => {
    setSelectedDealId(deal.id);
    setActiveSection('workspace');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Deals</h2>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <List className="w-3.5 h-3.5" />
              List View
            </button>
            <button
              onClick={() => setView('portfolio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${view === 'portfolio' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
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

      {view === 'list' ? (
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
                    <h3 className="font-semibold text-lg">{deal.codeName}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium ${workflowColor(deal.workflowState)}`}>
                      {WORKFLOW_LABELS[deal.workflowState]}
                    </span>
                    {deal.hasBlocker && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blocking/10 text-blocking">
                        <Ban className="w-3 h-3" /> Blocked
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] text-accent/70 bg-muted px-1.5 py-0.5 rounded">{deal.dealNumber}</span>
                    <span className="text-sm text-muted-foreground">{deal.buyerName} → {deal.targetCompany}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{deal.sector} · Closing {deal.closingDate}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-lg font-semibold">${(deal.consideration / 1e6).toFixed(1)}M</p>
                  <p className="text-xs text-muted-foreground mt-1">{deal.totalRecipients} recipients</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
                <span>{deal.documentsUploaded} docs</span>
                <span className={deal.discrepanciesFound > 0 ? 'text-discrepancy font-medium' : 'text-validated'}>
                  {deal.discrepanciesFound} discrepancies
                </span>
                <span>{deal.pendingApprovals} pending approvals</span>
                <div className="flex-1" />
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full pivt-progress-gradient" style={{ width: `${deal.readyToPayPercent}%` }} />
                  </div>
                  <span className="font-mono">{deal.readyToPayPercent}%</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* Portfolio View */
        <div className="space-y-4">
          <div className="pivt-card overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <span className="col-span-2">Deal</span>
              <span>State</span>
              <span className="text-center">% Complete</span>
              <span className="text-center">Discrepancies</span>
              <span className="text-center">Status</span>
            </div>
            {deals.map(deal => (
              <div
                key={deal.id}
                onClick={() => openDeal(deal)}
                className="p-4 border-b border-border last:border-0 grid grid-cols-6 items-center hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <div className="col-span-2">
                  <p className="text-sm font-semibold">{deal.codeName}</p>
                  <span className="font-mono text-[10px] text-accent/70">{deal.dealNumber}</span>
                  <p className="text-[11px] text-muted-foreground">{deal.buyerName} → {deal.targetCompany}</p>
                </div>
                <Badge className={`text-[10px] w-fit ${workflowColor(deal.workflowState)}`}>
                  {WORKFLOW_LABELS[deal.workflowState]}
                </Badge>
                <div className="flex flex-col items-center gap-1">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full pivt-progress-gradient" style={{ width: `${deal.readyToPayPercent}%` }} />
                  </div>
                  <span className="text-[11px] font-mono">{deal.readyToPayPercent}%</span>
                </div>
                <div className="flex justify-center">
                  <span className={`text-sm font-mono font-medium ${deal.discrepanciesFound > 0 ? 'text-discrepancy' : 'text-validated'}`}>
                    {deal.discrepanciesFound}
                  </span>
                </div>
                <div className="flex justify-center gap-2">
                  {deal.pendingApprovals > 0 && (
                    <span className="text-[10px] text-discrepancy flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {deal.pendingApprovals} approvals
                    </span>
                  )}
                  {deal.hasBlocker && (
                    <span className="text-[10px] text-blocking flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Blocker
                    </span>
                  )}
                  {!deal.hasBlocker && deal.pendingApprovals === 0 && (
                    <span className="text-[10px] text-validated flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> On track
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <KycGateModal
        open={showGate}
        onClose={() => setShowGate(false)}
        onGoToVerification={() => { setShowGate(false); setActiveSection('verification'); }}
        onCreateDemo={() => { setShowGate(false); setWizardMode('demo'); prefillDemo(); openWizard(); }}
      />
    </div>
  );
};
