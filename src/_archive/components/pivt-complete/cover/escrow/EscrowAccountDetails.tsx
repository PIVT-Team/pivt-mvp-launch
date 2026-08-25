import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Building2, Shield, Key, Calendar, Copy, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

interface Props {
  institutionName: string;
  accountType: string;
  referenceCode: string;
  status: string;
  openedAt: string;
  maskedAccount: string;
  maskedRouting: string;
  fundedAt?: string;
}

export const EscrowAccountDetails: React.FC<Props> = ({
  institutionName, accountType, referenceCode, status, openedAt, maskedAccount, maskedRouting, fundedAt,
}) => {
  const [copied, setCopied] = useState(false);
  const copyRef = () => {
    navigator.clipboard.writeText(referenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div {...fadeInUp} className="pivt-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          <h3 className="font-medium">Escrow Account Details</h3>
        </div>
        <Badge variant="outline" className={
          status === 'funded' ? 'border-validated/50 text-validated' :
          status === 'active' ? 'border-accent/50 text-accent' :
          'border-muted-foreground/50 text-muted-foreground'
        }>
          {status.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Partner Institution</p>
          <p className="font-medium mt-0.5">{institutionName}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Account Type</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Shield className="w-3 h-3 text-accent" />
            <p className="font-medium">{accountType}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Routing (Masked)</p>
          <p className="font-mono mt-0.5">{maskedRouting}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Account (Masked)</p>
          <p className="font-mono mt-0.5">{maskedAccount}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Reference Code</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <code className="text-accent font-mono text-xs">{referenceCode}</code>
            <button onClick={copyRef} className="text-muted-foreground hover:text-accent transition-colors">
              {copied ? <CheckCircle2 className="w-3 h-3 text-validated" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Opened</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <p className="font-mono text-xs">{openedAt}</p>
          </div>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Funding Confirmed</p>
          <p className="font-mono text-xs mt-0.5">{fundedAt || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Custodian</p>
          <p className="text-xs text-muted-foreground mt-0.5 italic">Partner institution (not PIVT)</p>
        </div>
      </div>
    </motion.div>
  );
};
