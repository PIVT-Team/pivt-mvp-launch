import React from 'react';
import { AlertTriangle, CheckCircle2, Shield, FileText } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

export const Step9Execution: React.FC = () => {
  const { dealBasics, confirmationId, executeSimulated } = useDealWizardStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Execution</h2>
        <p className="text-sm text-white/40 mt-1">Finalize and record the transaction</p>
      </div>

      <div className="p-4 rounded-lg bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-300">
          <strong>Simulated execution.</strong> No funds are transmitted. This generates a confirmation ID and audit log entry for demo purposes.
        </p>
      </div>

      {!confirmationId ? (
        <>
          <div className="p-5 bg-[#2A2F3A] rounded-lg border border-white/5 space-y-3">
            <p className="text-sm font-semibold text-white">Payout Summary</p>
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
                <p className="text-white/40 text-xs">Currency</p>
                <p className="text-white">{dealBasics.currency}</p>
              </div>
              <div>
                <p className="text-white/40 text-xs">Target Close</p>
                <p className="text-white">{dealBasics.targetCloseDate || '—'}</p>
              </div>
            </div>
          </div>

          <button
            onClick={executeSimulated}
            className="w-full py-3 rounded-lg bg-[#5B3DF5] text-white font-semibold hover:bg-[#5B3DF5]/80 transition-all flex items-center justify-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Execute (Simulated)
          </button>
        </>
      ) : (
        <div className="text-center py-8 space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
          <div>
            <p className="text-xl font-bold text-white">Deal Complete</p>
            <p className="text-sm text-white/40 mt-1">Confirmation ID</p>
            <p className="font-mono text-lg text-[#5B3DF5] font-bold mt-1">{confirmationId}</p>
          </div>
          <div className="p-4 bg-[#2A2F3A] rounded-lg border border-white/5 text-left space-y-2">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Audit Log</p>
            <div className="space-y-1 text-xs text-white/40">
              <p>• KYC verification completed</p>
              <p>• Deal created: {dealBasics.dealName}</p>
              <p>• Documents uploaded and validated</p>
              <p>• Discrepancies reviewed and resolved</p>
              <p>• All approvals obtained</p>
              <p>• Simulated execution at {new Date().toLocaleString()}</p>
              <p>• Confirmation ID: {confirmationId}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
