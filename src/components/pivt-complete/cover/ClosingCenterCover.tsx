import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2, Circle, Lock, Shield, FileText, CreditCard, Users,
  AlertTriangle, Rocket, ClipboardCheck,
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useDealMetrics } from '@/hooks/useDealMetrics';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { dealStateMachineService } from '@/services/dealStateMachineService';
import { fadeInUp } from '@/lib/animations';
import { toast } from 'sonner';

interface GateItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  passed: boolean;
  detail?: string;
}

export const ClosingCenterCover: React.FC = () => {
  const { dealId, realDeal } = useDealWorkspace();
  const readiness = useClosingReadiness(dealId || undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [executing, setExecuting] = useState(false);

  const gates: GateItem[] = [
    {
      id: 'stakeholders-configured',
      label: 'Stakeholders Configured',
      description: 'At least one buyer and one seller have been added to the deal',
      icon: Users,
      passed: readiness.stakeholdersConfigured,
      detail: `${readiness.stakeholdersTotal} stakeholders`,
    },
    {
      id: 'seller-verified',
      label: 'Seller Verified',
      description: 'All seller-side stakeholders have completed KYC/KYB verification',
      icon: Users,
      passed: readiness.sellerVerified,
    },
    {
      id: 'buyer-verified',
      label: 'Buyer Verified',
      description: 'All buyer-side stakeholders have completed KYC/KYB verification',
      icon: Users,
      passed: readiness.buyerVerified,
    },
    {
      id: 'spa-uploaded',
      label: 'SPA / Agreement Uploaded',
      description: 'Primary transaction agreement has been uploaded and processed',
      icon: FileText,
      passed: readiness.spaUploaded,
      detail: `${readiness.documentsUploaded} documents`,
    },
    {
      id: 'wire-uploaded',
      label: 'Wire Instructions Uploaded',
      description: 'Banking and wire transfer instructions are on file',
      icon: FileText,
      passed: readiness.wireInstructionsUploaded,
    },
    {
      id: 'payment-approved',
      label: 'Payments Approved',
      description: 'All payment instructions have been confirmed and authorized',
      icon: CreditCard,
      passed: readiness.paymentApproved,
      detail: readiness.paymentsTotal > 0 ? `${readiness.paymentsConfigured}/${readiness.paymentsTotal}` : undefined,
    },
    {
      id: 'approvals-complete',
      label: 'Approvals Complete',
      description: 'All required approvals from buyer and seller counsel have been granted',
      icon: ClipboardCheck,
      passed: readiness.approvalsComplete,
      detail: readiness.approvalsTotal > 0 ? `${readiness.approvalsGranted}/${readiness.approvalsTotal}` : undefined,
    },
  ];

  const passedCount = gates.filter(g => g.passed).length;
  const progressPct = Math.round((passedCount / gates.length) * 100);

  const handleExecute = async () => {
    if (!dealId) return;
    setExecuting(true);
    try {
      await dealStateMachineService.applyEvent(dealId, 'EXECUTION_STARTED', {
        notes: confirmNotes,
        triggered_at: new Date().toISOString(),
      });
      toast.success('Closing execution initiated successfully');
    } catch (err) {
      toast.error('Failed to initiate closing execution');
    } finally {
      setExecuting(false);
      setConfirmOpen(false);
      setConfirmNotes('');
    }
  };

  if (readiness.loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <motion.div {...fadeInUp} className="pivt-card border border-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Closing Readiness</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {readiness.readyToClose
                  ? 'All gates clear — ready for execution'
                  : `${gates.length - passedCount} item${gates.length - passedCount !== 1 ? 's' : ''} remaining`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`text-xs font-mono px-3 py-1 ${
              readiness.readyToClose
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : progressPct >= 60
                ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              {readiness.readyToClose ? 'Ready' : progressPct >= 60 ? 'In Progress' : 'Blocked'}
            </Badge>
            <span className={`text-3xl font-bold font-mono ${
              readiness.readyToClose ? 'text-emerald-500' : progressPct >= 60 ? 'text-amber-500' : 'text-red-500'
            }`}>
              {progressPct}%
            </span>
          </div>
        </div>
        <Progress value={progressPct} className={`h-2 ${
          readiness.readyToClose ? '[&>div]:bg-emerald-500'
            : progressPct >= 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
        }`} />
      </motion.div>

      {/* Visual Progress Steps */}
      <motion.div {...fadeInUp} className="pivt-card border border-border/50 p-6">
        <h3 className="text-sm font-semibold mb-5 text-muted-foreground uppercase tracking-wider">Deal Progress</h3>
        <div className="space-y-0">
          {gates.map((gate, index) => {
            const isLast = index === gates.length - 1;
            const Icon = gate.icon;
            return (
              <div key={gate.id} className="flex items-stretch gap-4">
                <div className="flex flex-col items-center w-8">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    gate.passed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/60 text-muted-foreground'
                  }`}>
                    {gate.passed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[24px] ${gate.passed ? 'bg-emerald-500/30' : 'bg-border/40'}`} />
                  )}
                </div>
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${gate.passed ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${gate.passed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {gate.label}
                    </span>
                    {gate.detail && (
                      <span className="text-[10px] text-muted-foreground font-mono">{gate.detail}</span>
                    )}
                    <Badge className={`text-[9px] ml-auto ${
                      gate.passed
                        ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    }`}>
                      {gate.passed ? 'Complete' : 'Pending'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-5">{gate.description}</p>
                </div>
              </div>
            );
          })}

          {/* Execute Closing row */}
          <div className="flex items-stretch gap-4 pt-2">
            <div className="flex flex-col items-center w-8">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                readiness.readyToClose ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-muted-foreground/50'
              }`}>
                {readiness.readyToClose ? <Rocket className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${readiness.readyToClose ? 'text-foreground' : 'text-muted-foreground/60'}`}>
                  Execute Closing
                </span>
                <Badge className={`text-[9px] ml-auto ${
                  readiness.readyToClose
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-muted/60 text-muted-foreground/60'
                }`}>
                  {readiness.readyToClose ? 'Unlocked' : <><Lock className="w-2.5 h-2.5 mr-1 inline" /> Locked</>}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {readiness.readyToClose
                  ? 'All prerequisites met — you may proceed with closing execution.'
                  : 'Complete all verification, documents, and approvals before executing payments.'}
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Execute Button */}
      <motion.div {...fadeInUp}>
        <Button
          size="lg"
          disabled={!readiness.readyToClose}
          onClick={() => setConfirmOpen(true)}
          className="w-full gap-2 text-sm font-semibold h-12"
        >
          {readiness.readyToClose ? (
            <><Rocket className="w-4 h-4" /> Execute Closing</>
          ) : (
            <><Lock className="w-4 h-4" /> Execute Closing (Locked)</>
          )}
        </Button>
        {!readiness.readyToClose && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            Complete all verification, documents, and approvals before executing payments.
          </p>
        )}
      </motion.div>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Confirm Closing Execution
            </DialogTitle>
            <DialogDescription>
              This action will initiate deal closing and trigger payment disbursements. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {realDeal && (
              <div className="space-y-1.5 text-sm bg-muted/30 rounded-lg p-3">
                <div className="flex justify-between"><span className="text-muted-foreground">Deal</span><span className="font-medium">{realDeal.deal_name}</span></div>
                {realDeal.seller && <div className="flex justify-between"><span className="text-muted-foreground">Seller</span><span>{realDeal.seller}</span></div>}
                {realDeal.buyer && <div className="flex justify-between"><span className="text-muted-foreground">Buyer</span><span>{realDeal.buyer}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Value</span><span className="font-mono">${realDeal.deal_value?.toLocaleString()}</span></div>
              </div>
            )}
            <div className="space-y-2">
              {gates.map(gate => (
                <div key={gate.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>{gate.label}</span>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Execution notes (optional)</label>
              <Textarea
                placeholder="Add any closing notes..."
                value={confirmNotes}
                onChange={e => setConfirmNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button
              onClick={handleExecute}
              disabled={executing}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              {executing ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Executing...</>
              ) : (
                <><Rocket className="w-4 h-4" /> Confirm & Execute</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
