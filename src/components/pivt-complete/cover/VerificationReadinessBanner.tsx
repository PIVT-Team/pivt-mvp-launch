import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { Shield, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useEffect, useState } from 'react';

interface Stakeholder {
  id: string;
  shareholder_name: string;
  role: string;
  verification_status: string;
}

export const VerificationReadinessBanner: React.FC = () => {
  const { dealId, isDemoDeal } = useDealWorkspace();
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoDeal || !dealId) { setLoading(false); return; }
    supabase
      .from('cap_table_entries')
      .select('id, shareholder_name, role, verification_status')
      .eq('deal_id', dealId)
      .then(({ data }) => {
        setStakeholders((data as Stakeholder[]) || []);
        setLoading(false);
      });
  }, [dealId, isDemoDeal]);

  if (loading || isDemoDeal || stakeholders.length === 0) return null;

  const requiredRoles = ['Buyer', 'Seller', 'Target', 'Merger Sub'];
  const requiredStakeholders = stakeholders.filter(s => requiredRoles.includes(s.role));
  const unverified = requiredStakeholders.filter(s => s.verification_status !== 'verified');
  const allVerified = unverified.length === 0 && requiredStakeholders.length > 0;
  const totalVerified = stakeholders.filter(s => s.verification_status === 'verified').length;

  return (
    <motion.div {...fadeInUp} className={`pivt-card p-4 border ${
      allVerified ? 'border-validated/20 bg-validated/5' : 'border-discrepancy/20 bg-discrepancy/5'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allVerified ? (
            <CheckCircle2 className="w-5 h-5 text-validated" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-discrepancy" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {allVerified ? 'Verification Complete' : 'Verification Incomplete'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalVerified}/{stakeholders.length} stakeholders verified
              {!allVerified && unverified.length > 0 && (
                <> · Missing: {unverified.map(s => s.shareholder_name).join(', ')}</>
              )}
            </p>
          </div>
        </div>
        <Badge className={allVerified ? 'bg-validated/10 text-validated' : 'bg-discrepancy/10 text-discrepancy'}>
          {allVerified ? 'Ready' : 'Blocked'}
        </Badge>
      </div>
    </motion.div>
  );
};
