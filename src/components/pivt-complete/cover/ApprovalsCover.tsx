import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { AlertTriangle, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

export const ApprovalsCover: React.FC = () => {
  const { pendingApprovals } = usePIVTStore();
  const urgencyColors = { low: 'border-muted', medium: 'border-blue-500', high: 'border-discrepancy', critical: 'border-blocking' };
  const urgencyBg = { low: '', medium: 'bg-blue-500/5', high: 'bg-discrepancy/5', critical: 'bg-blocking/5' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Approvals</h2>
        <span className="text-sm text-discrepancy font-medium">{pendingApprovals.length} pending</span>
      </div>

      <div className="space-y-3">
        {pendingApprovals.map((approval) => (
          <motion.div
            key={approval.id}
            {...fadeInUp}
            className={`pivt-card p-5 border-l-4 ${urgencyColors[approval.urgency]} ${urgencyBg[approval.urgency]} cursor-pointer hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase text-muted-foreground">{approval.type}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    approval.urgency === 'critical' ? 'bg-blocking/10 text-blocking' : 'bg-discrepancy/10 text-discrepancy'
                  }`}>
                    {approval.urgency}
                  </span>
                </div>
                <p className="font-medium">{approval.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{approval.dealName} · Requested by {approval.requestedBy}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </motion.div>
        ))}
      </div>

      {pendingApprovals.length === 0 && (
        <div className="pivt-card p-12 text-center">
          <CheckCircle2 className="w-8 h-8 text-validated mx-auto mb-3" />
          <p className="text-muted-foreground">All approvals are up to date</p>
        </div>
      )}
    </div>
  );
};
