import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, Clock, XCircle, Users } from 'lucide-react';

interface Stakeholder {
  id: string;
  shareholder_name: string;
  role: string;
  email: string | null;
  verification_status: string;
  ownership_pct: number;
  payout_amount: number;
}

const kycIcons = { verified: CheckCircle2, pending: Clock, failed: XCircle } as const;
const kycColors = { verified: 'text-validated', pending: 'text-discrepancy', failed: 'text-blocking' } as const;

function mapVerificationToKyc(status: string): 'verified' | 'pending' | 'failed' {
  if (status === 'verified') return 'verified';
  if (status === 'failed') return 'failed';
  return 'pending'; // not_sent, sent, in_progress, submitted, etc.
}

export const StakeholdersCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    supabase
      .from('cap_table_entries')
      .select('id, shareholder_name, role, email, verification_status, ownership_pct, payout_amount')
      .eq('deal_id', dealId)
      .order('ownership_pct', { ascending: false })
      .then(({ data }) => {
        setStakeholders((data as Stakeholder[]) || []);
        setLoading(false);
      });
  }, [dealId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const verified = stakeholders.filter(s => s.verification_status === 'verified').length;
  const pending = stakeholders.filter(s => mapVerificationToKyc(s.verification_status) === 'pending').length;
  const failed = stakeholders.filter(s => s.verification_status === 'failed').length;

  if (stakeholders.length === 0) {
    return (
      <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Users className="w-6 h-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-base font-semibold">No Stakeholders Yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Add stakeholders via Deal Parties, Cap Table, or document ingestion.
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Stakeholders</h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-validated">{verified} Verified</span>
          <span className="text-discrepancy">{pending} Pending</span>
          <span className="text-blocking">{failed} Failed</span>
        </div>
      </div>

      <div className="pivt-card overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/50">
          <div className="grid grid-cols-6 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span className="col-span-2">Stakeholder</span>
            <span>Role</span>
            <span className="text-right">Ownership</span>
            <span className="text-right">Payout</span>
            <span className="text-center">KYC</span>
          </div>
        </div>
        {stakeholders.map((s) => {
          const kyc = mapVerificationToKyc(s.verification_status);
          const Icon = kycIcons[kyc];
          return (
            <motion.div key={s.id} {...fadeInUp} className="p-4 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              <div className="grid grid-cols-6 items-center">
                <div className="col-span-2">
                  <p className="font-medium">{s.shareholder_name}</p>
                  <p className="text-xs text-muted-foreground">{s.email || '—'}</p>
                </div>
                <span className="text-sm text-muted-foreground">{s.role}</span>
                <span className="text-right font-mono">{s.ownership_pct > 0 ? `${s.ownership_pct}%` : '—'}</span>
                <span className="text-right font-mono">
                  {s.payout_amount > 0 ? `$${(s.payout_amount / 1e6).toFixed(1)}M` : '—'}
                </span>
                <div className="flex justify-center">
                  <Icon className={`w-4 h-4 ${kycColors[kyc]}`} />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
