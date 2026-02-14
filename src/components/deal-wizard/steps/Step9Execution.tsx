import React from 'react';
import { AlertTriangle, CheckCircle2, Shield, FileText, XCircle, Lock, Users, ClipboardList } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';
import { Badge } from '@/components/ui/badge';

export const Step9Execution: React.FC = () => {
  const {
    dealBasics, confirmationId, executeSimulated, escrowSetup,
    canExecute, beneficiaries, approvals, auditLog, discrepancies,
  } = useDealWizardStore();

  const { ready, blockers } = canExecute();

  const fmtCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Execution</h2>
        <p className="text-sm text-white/40 mt-1">Generate execution instruction packet for partner institution</p>
      </div>

      {/* Non-custody notice */}
      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 flex items-start gap-3">
        <Lock className="w-4 h-4 text-accent shrink-0 mt-0.5" />
        <p className="text-xs text-white/60">
          Execution instructions are sent to the partner institution. <strong className="text-white/80">PIVT does not hold or transmit funds.</strong>
        </p>
      </div>

      {!confirmationId ? (
        <>
          {/* Gate check */}
          {!ready && (
            <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-2">
              <div className="flex items-center gap-2">
                <XCircle className="w-4 h-4 text-destructive" />
                <p className="text-sm font-semibold text-destructive">Not Ready to Execute</p>
              </div>
              <ul className="space-y-1">
                {blockers.map((b, i) => (
                  <li key={i} className="text-xs text-white/40 flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-destructive" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Execution Instruction Packet Preview */}
          <div className="p-5 bg-[#2A2F3A] rounded-lg border border-white/5 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              <p className="text-sm font-semibold text-white">Execution Instruction Packet</p>
            </div>

            {/* Payout Summary */}
            <div className="space-y-2">
              <p className="text-xs text-white/50 uppercase tracking-wider">Final Payout Schedule</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/40 text-xs">Deal</p>
                  <p className="text-white font-medium">{dealBasics.dealName || '—'}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Transaction Value</p>
                  <p className="text-white font-mono">${dealBasics.transactionValue || '0'}</p>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Escrow Status</p>
                  <Badge variant="outline" className={escrowSetup.status === 'funded' ? 'border-validated/50 text-validated' : 'border-muted-foreground/50 text-muted-foreground'}>
                    {escrowSetup.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-white/40 text-xs">Reference Code</p>
                  <p className="text-white font-mono text-xs">{escrowSetup.referenceCode || '—'}</p>
                </div>
              </div>
            </div>

            {/* Beneficiary / Wire Instruction List */}
            {beneficiaries.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-accent" />
                  <p className="text-xs text-white/50 uppercase tracking-wider">Beneficiary Registry ({beneficiaries.length})</p>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {beneficiaries.map(b => (
                    <div key={b.id} className="flex items-center gap-3 text-xs py-1.5 px-2 rounded bg-white/[0.02]">
                      <span className={`w-1.5 h-1.5 rounded-full ${b.status === 'verified' ? 'bg-validated' : 'bg-amber-400'}`} />
                      <span className="flex-1 text-white/70">{b.name}</span>
                      <span className="font-mono text-white/50">{fmtCurrency(b.payoutAmount)}</span>
                      <span className="text-white/30">{b.bankDetailsMasked}</span>
                      {b.changeFlag && <span className="text-[9px] text-amber-400">CHANGED</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Approvals summary */}
            <div className="space-y-2 pt-3 border-t border-white/5">
              <p className="text-xs text-white/50 uppercase tracking-wider">Approvals Log</p>
              <div className="flex gap-2 flex-wrap">
                {approvals.map(a => (
                  <Badge key={a.id} variant="outline" className={a.status === 'approved' ? 'border-validated/50 text-validated' : 'border-muted-foreground/50 text-muted-foreground'}>
                    {a.role}: {a.status}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Discrepancy summary */}
            {discrepancies.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-white/5">
                <p className="text-xs text-white/50 uppercase tracking-wider">Discrepancy Summary</p>
                <div className="space-y-1">
                  {discrepancies.map(d => (
                    <div key={d.id} className="flex items-center gap-2 text-xs">
                      {d.resolved
                        ? <CheckCircle2 className="w-3 h-3 text-validated" />
                        : <AlertTriangle className="w-3 h-3 text-amber-400" />
                      }
                      <span className="text-white/50">{d.lineItem}</span>
                      <span className="font-mono text-white/30">{d.variance}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={executeSimulated}
            disabled={!ready}
            className={`w-full py-3 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 ${
              ready
                ? 'bg-accent text-accent-foreground hover:bg-accent/80'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            }`}
          >
            <Shield className="w-4 h-4" />
            {ready ? 'Send Execution Instruction to Partner Institution' : 'Complete All Requirements to Execute'}
          </button>
        </>
      ) : (
        <div className="space-y-5">
          <div className="text-center py-6 space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <div>
              <p className="text-xl font-bold text-white">Execution Instruction Sent</p>
              <p className="text-xs text-white/40 mt-1">Instruction sent to partner institution (Simulated)</p>
              <p className="font-mono text-lg text-accent font-bold mt-2">{confirmationId}</p>
            </div>
          </div>

          {/* Full Audit Trail */}
          <div className="p-4 bg-[#2A2F3A] rounded-lg border border-white/5 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-accent" />
              <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Complete Audit Trail</p>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {auditLog.map(entry => (
                <div key={entry.id} className="flex items-start gap-3 text-xs py-1">
                  <span className="font-mono text-white/30 w-36 shrink-0">{new Date(entry.timestamp).toLocaleString()}</span>
                  <span className="text-white/50">{entry.actor}</span>
                  <span className="text-white/70 flex-1">{entry.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
