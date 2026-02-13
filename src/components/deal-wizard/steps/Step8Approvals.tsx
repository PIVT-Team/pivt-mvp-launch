import React from 'react';
import { CheckCircle2, Clock, Shield } from 'lucide-react';
import { useDealWizardStore } from '@/stores/dealWizardStore';

export const Step8Approvals: React.FC = () => {
  const { approvals, approveRole } = useDealWizardStore();
  const allApproved = approvals.every(a => a.status === 'approved');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Approvals</h2>
        <p className="text-sm text-white/40 mt-1">
          Sequential sign-off from all required parties
        </p>
      </div>

      <div className="space-y-3">
        {approvals.map((a, idx) => {
          const prevApproved = idx === 0 || approvals[idx - 1].status === 'approved';
          const isApproved = a.status === 'approved';
          const canApprove = prevApproved && !isApproved;

          return (
            <div key={a.id} className={`p-4 rounded-lg border transition-all ${
              isApproved
                ? 'bg-emerald-500/5 border-emerald-500/20'
                : canApprove
                  ? 'bg-[#2A2F3A] border-[#5B3DF5]/30'
                  : 'bg-[#2A2F3A]/50 border-white/5'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isApproved
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    : <Clock className={`w-5 h-5 ${canApprove ? 'text-[#5B3DF5]' : 'text-white/20'}`} />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${isApproved ? 'text-emerald-400' : canApprove ? 'text-white' : 'text-white/30'}`}>
                      {a.role}
                    </p>
                    {isApproved && a.signedAt && (
                      <p className="text-xs text-white/30 mt-0.5">
                        Signed {new Date(a.signedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                {canApprove && (
                  <button
                    onClick={() => approveRole(a.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#5B3DF5] text-white text-xs font-medium rounded-lg hover:bg-[#5B3DF5]/80 transition-all"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    Approve & Sign
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allApproved && (
        <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-center">
          <p className="text-sm font-semibold text-emerald-400">✓ All approvals complete — ready for execution</p>
        </div>
      )}
    </div>
  );
};
