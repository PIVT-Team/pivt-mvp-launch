import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Stamp, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Approver {
  name: string;
  role: string;
  status: 'approved' | 'pending' | 'rejected';
  timestamp?: string;
}

interface Props {
  approvers: Approver[];
  allApproved: boolean;
}

export const ExecutionAuthSnapshot: React.FC<Props> = ({ approvers, allApproved }) => {
  return (
    <motion.div {...fadeInUp} className="pivt-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stamp className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Execution Authorization</h3>
        </div>
        <Badge variant="outline" className={allApproved ? 'border-validated/50 text-validated' : 'border-discrepancy/50 text-discrepancy'}>
          {allApproved ? 'AUTHORIZED' : 'PENDING'}
        </Badge>
      </div>
      <div className="space-y-2">
        {approvers.map((a, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30">
            {a.status === 'approved' ? <CheckCircle2 className="w-3.5 h-3.5 text-validated" /> :
             a.status === 'rejected' ? <XCircle className="w-3.5 h-3.5 text-destructive" /> :
             <Clock className="w-3.5 h-3.5 text-discrepancy" />}
            <div className="flex-1">
              <p className="text-sm font-medium">{a.name}</p>
              <p className="text-[10px] text-muted-foreground">{a.role}</p>
            </div>
            {a.timestamp && <span className="text-[10px] font-mono text-muted-foreground">{a.timestamp}</span>}
          </div>
        ))}
      </div>
    </motion.div>
  );
};
