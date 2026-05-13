import React from 'react';
import { Shield, CheckCircle2, Clock, AlertTriangle, FileText, Users, CreditCard, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useDealMetrics } from '@/hooks/useDealMetrics';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

export const ExecutionReadinessPanel: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { metrics, loading } = useDealMetrics(dealId || undefined);
  const readiness = {
    stakeholdersConfigured: metrics?.gates.stakeholdersConfigured ?? false,
    sellerVerified: metrics?.gates.sellerVerified ?? false,
    buyerVerified: metrics?.gates.buyerVerified ?? false,
    spaUploaded: metrics?.gates.spaUploaded ?? false,
    wireInstructionsUploaded: metrics?.gates.wireInstructionsUploaded ?? false,
    paymentApproved: metrics?.gates.paymentsApproved ?? false,
    approvalsComplete: metrics?.gates.approvalsComplete ?? false,
    loading,
  };

  if (readiness.loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const m = metrics;
  // Each check carries the workspace step/sub it's satisfied by, so a clicking
  // the card jumps the user straight there instead of leaving them to hunt for it.
  const checks = [
    { label: 'Stakeholders Configured', passed: readiness.stakeholdersConfigured, icon: Users, detail: m ? `${m.totalStakeholders} total · ${m.buyerSideStakeholders} buyer / ${m.sellerSideStakeholders} seller` : '', step: 'stakeholders', sub: 'contacts' },
    { label: 'Seller Verified', passed: readiness.sellerVerified, icon: Shield, detail: m ? `${m.sellerSideStakeholders} seller-side` : '', step: 'stakeholders', sub: 'kyc' },
    { label: 'Buyer Verified', passed: readiness.buyerVerified, icon: Shield, detail: m ? `${m.buyerSideStakeholders} buyer-side` : '', step: 'stakeholders', sub: 'kyc' },
    { label: 'SPA / Agreement Uploaded', passed: readiness.spaUploaded, icon: FileText, detail: m ? `${m.totalUploadedDocuments} docs uploaded` : '', step: 'deal-inputs', sub: 'contracts' },
    { label: 'Wire Instructions Uploaded', passed: readiness.wireInstructionsUploaded, icon: FileText, detail: m ? `${m.totalWireInstructions} on file` : '', step: 'deal-inputs', sub: 'wires' },
    { label: 'Payments Approved', passed: readiness.paymentApproved, icon: CreditCard, detail: m ? `${m.verifiedWireInstructions}/${m.totalWireInstructions} verified` : '', step: 'verification', sub: undefined },
    { label: 'Approvals Complete', passed: readiness.approvalsComplete, icon: ClipboardCheck, detail: m ? `${m.grantedRequiredApprovals}/${m.requiredApprovals} required approved` : '', step: 'approvals', sub: undefined },
  ];

  const handleCheckClick = (step: string, sub?: string) => {
    window.dispatchEvent(new CustomEvent('pivt:navigate-workspace', { detail: { step, sub } }));
  };

  const passedCount = checks.filter(c => c.passed).length;
  const allPassed = passedCount === checks.length;
  const blockedCount = checks.length - passedCount;

  // True empty state: nothing has been done yet
  const nothingDone = passedCount === 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Execution Readiness</h3>
        </div>
        {allPassed ? (
          <Badge className="bg-validated/10 text-validated border-validated/20 text-xs">All Checks Passed</Badge>
        ) : (
          <Badge className="bg-muted/60 text-muted-foreground text-xs">{passedCount}/{checks.length} Complete</Badge>
        )}
      </div>

      {nothingDone && (
        <div className="p-4 rounded-lg border border-border/50 bg-muted/20 text-center space-y-2">
          <p className="text-sm font-medium">No execution prerequisites have been completed yet.</p>
          <p className="text-xs text-muted-foreground">
            Complete Stakeholders, Deal Inputs, Verification, and Approvals to prepare for execution.
          </p>
        </div>
      )}

      {!nothingDone && !allPassed && (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs font-medium text-amber-600">
            {blockedCount} prerequisite{blockedCount > 1 ? 's' : ''} remaining before execution can proceed.
          </p>
        </div>
      )}

      {!nothingDone && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {checks.map((check) => {
            const Icon = check.icon;
            return (
              <button
                key={check.label}
                type="button"
                onClick={() => handleCheckClick(check.step, check.sub)}
                className={`pivt-card p-4 flex flex-col items-center text-center gap-2 border transition-colors ${
                  check.passed ? 'border-validated/20' : 'border-border/30 hover:border-accent/40 hover:bg-muted/30'
                }`}
                aria-label={`${check.label} — ${check.passed ? 'Complete' : 'Pending — click to go to ' + check.step}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  check.passed ? 'bg-validated/10' : 'bg-muted/40'
                }`}>
                  <Icon className={`w-5 h-5 ${check.passed ? 'text-validated' : 'text-muted-foreground'}`} />
                </div>
                <p className="text-xs font-medium leading-tight">{check.label}</p>
                {check.detail && (
                  <p className="text-[10px] text-muted-foreground font-mono leading-tight">{check.detail}</p>
                )}
                <div className="flex items-center gap-1">
                  {check.passed ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-validated" />
                      <span className="text-[11px] font-medium text-validated">Complete</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground">Pending — open</span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
