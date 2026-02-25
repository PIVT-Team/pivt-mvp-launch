import React, { useState } from 'react';
import { Shield, CheckCircle2, Clock, XCircle, AlertTriangle, Fingerprint, Building2, Landmark, Vault, RotateCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

type VerificationStatus = 'verified' | 'pending' | 'failed';

interface VerificationCheck {
  id: string;
  label: string;
  status: VerificationStatus;
  icon: React.ElementType;
  details: Record<string, string>;
}

const MOCK_CHECKS: VerificationCheck[] = [
  {
    id: 'identity',
    label: 'Identity Verified',
    status: 'verified',
    icon: Fingerprint,
    details: {
      'Full Name Match': '98.7%',
      'Document Type': 'Passport',
      'Document Number': '•••• •••• 4821',
      'Issuing Country': 'United States',
      'Expiration Date': 'Mar 15, 2029',
      'Liveness Check': 'Passed',
      'Fraud Score': '0.02 (Low)',
    },
  },
  {
    id: 'compliance',
    label: 'Compliance Cleared',
    status: 'verified',
    icon: Shield,
    details: {
      'AML Check': 'Cleared',
      'PEP Status': 'Not a PEP',
      'Sanctions List': 'No matches',
      'Adverse Media': 'None detected',
      'Risk Rating': 'Low',
      'Last Screened': 'Feb 24, 2026 09:14 AM',
    },
  },
  {
    id: 'bank',
    label: 'Bank Authenticated',
    status: 'pending',
    icon: Landmark,
    details: {
      'Account Holder Match': 'Pending verification',
      'Bank Name': 'JPMorgan Chase',
      'Verification Method': 'Micro-deposit',
      'Status': 'Awaiting confirmation',
      'Timestamp': '—',
    },
  },
  {
    id: 'funds',
    label: 'Funds Reserved',
    status: 'verified',
    icon: Vault,
    details: {
      'Reserved Amount': '$2,800,000,000',
      'Source Account': 'FBO ••••7742',
      'Reservation ID': 'RSV-2026-00412',
      'Hold Type': 'Full Escrow Hold',
      'Expiration': 'Mar 15, 2026',
      'Ledger Balance': '$2,800,000,000',
    },
  },
];

const statusConfig: Record<VerificationStatus, { color: string; bg: string; border: string; icon: React.ElementType; label: string }> = {
  verified: { color: 'text-validated', bg: 'bg-validated/10', border: 'border-validated/20', icon: CheckCircle2, label: 'Verified' },
  pending: { color: 'text-discrepancy', bg: 'bg-discrepancy/10', border: 'border-discrepancy/20', icon: Clock, label: 'Pending' },
  failed: { color: 'text-blocking', bg: 'bg-blocking/10', border: 'border-blocking/20', icon: XCircle, label: 'Failed' },
};

export const ExecutionReadinessPanel: React.FC = () => {
  const [checks] = useState<VerificationCheck[]>(MOCK_CHECKS);
  const [openModal, setOpenModal] = useState<string | null>(null);

  const allVerified = checks.every(c => c.status === 'verified');
  const blockedCount = checks.filter(c => c.status !== 'verified').length;
  const activeCheck = checks.find(c => c.id === openModal);

  const handleReverify = (checkId: string) => {
    toast.success(`Re-verification initiated for ${checks.find(c => c.id === checkId)?.label}`);
    setOpenModal(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold tracking-wide uppercase">Execution Readiness</h3>
        </div>
        {allVerified ? (
          <Badge className="bg-validated/10 text-validated border-validated/20 text-xs">All Checks Passed</Badge>
        ) : (
          <Badge className="bg-blocking/10 text-blocking border-blocking/20 text-xs">{blockedCount} Blocking</Badge>
        )}
      </div>

      {/* Blocking Banner */}
      {!allVerified && (
        <div className="p-3 rounded-lg border border-blocking/30 bg-blocking/5 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-blocking flex-shrink-0" />
          <p className="text-xs font-medium text-blocking">
            Execution Blocked — {blockedCount} verification{blockedCount > 1 ? 's' : ''} required before payments can be confirmed.
          </p>
        </div>
      )}

      {/* 4 Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {checks.map((check) => {
          const cfg = statusConfig[check.status];
          const StatusIcon = cfg.icon;
          const CheckIcon = check.icon;
          return (
            <Card
              key={check.id}
              className={`cursor-pointer transition-all hover:shadow-md border ${cfg.border}`}
              onClick={() => setOpenModal(check.id)}
            >
              <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                <div className={`w-10 h-10 rounded-full ${cfg.bg} flex items-center justify-center`}>
                  <CheckIcon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <p className="text-xs font-medium leading-tight">{check.label}</p>
                <div className="flex items-center gap-1">
                  <StatusIcon className={`w-3 h-3 ${cfg.color}`} />
                  <span className={`text-[11px] font-medium ${cfg.color}`}>{cfg.label}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Modal */}
      <Dialog open={!!openModal} onOpenChange={(open) => !open && setOpenModal(null)}>
        {activeCheck && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <activeCheck.icon className={`w-5 h-5 ${statusConfig[activeCheck.status].color}`} />
                {activeCheck.label}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Detailed verification status and provider data
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 mt-2">
              {/* Status badge */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge className={`${statusConfig[activeCheck.status].bg} ${statusConfig[activeCheck.status].color} ${statusConfig[activeCheck.status].border} text-xs`}>
                  {statusConfig[activeCheck.status].label}
                </Badge>
              </div>

              {/* Detail rows */}
              <div className="border rounded-lg divide-y bg-muted/20">
                {Object.entries(activeCheck.details).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-muted-foreground">{key}</span>
                    <span className="text-xs font-medium font-mono">{value}</span>
                  </div>
                ))}
              </div>

              {/* Re-verify button */}
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => handleReverify(activeCheck.id)}
              >
                <RotateCw className="mr-2 h-3 w-3" />
                Re-verify
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
};
