import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { Banknote, Upload, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  expectedAmount: number;
  receivedAmount: number;
  confirmedBy: string | null;
  confirmedAt: string | null;
  isFunded: boolean;
  onMarkFunded: () => void;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const FundingConfirmation: React.FC<Props> = ({
  expectedAmount, receivedAmount, confirmedBy, confirmedAt, isFunded, onMarkFunded,
}) => {
  const [receiptUploaded, setReceiptUploaded] = useState(false);
  const variance = receivedAmount - expectedAmount;
  const hasVariance = Math.abs(variance) > 0 && isFunded;

  return (
    <motion.div {...fadeInUp} className="pivt-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-accent" />
        <h3 className="font-medium">Funding Confirmation</h3>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Admin</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Expected Amount</p>
          <p className="font-mono font-semibold mt-0.5">{fmt(expectedAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Received Amount</p>
          <p className={`font-mono font-semibold mt-0.5 ${isFunded ? 'text-validated' : 'text-muted-foreground'}`}>
            {isFunded ? fmt(receivedAmount) : '—'}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Confirmed By</p>
          <p className="text-sm mt-0.5">{confirmedBy || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Confirmed At</p>
          <p className="font-mono text-xs mt-0.5">{confirmedAt || '—'}</p>
        </div>
      </div>

      {hasVariance && (
        <div className="p-2.5 rounded-lg bg-discrepancy/10 border border-discrepancy/20 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-discrepancy shrink-0" />
          <p className="text-[11px] text-discrepancy">
            Variance detected: {fmt(variance)} ({variance > 0 ? 'over' : 'under'} expected). Review required.
          </p>
        </div>
      )}

      {!isFunded ? (
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => setReceiptUploaded(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted/50 text-muted-foreground hover:bg-muted transition-colors text-xs"
          >
            <Upload className="w-3.5 h-3.5" />
            {receiptUploaded ? 'Receipt Uploaded ✓' : 'Upload Receipt (Optional)'}
          </button>
          <button
            onClick={onMarkFunded}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-validated text-white text-sm font-medium hover:bg-validated/80 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            Mark as Funded
          </button>
        </div>
      ) : (
        <div className="p-3 rounded-lg bg-validated/10 border border-validated/20 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-validated" />
          <div>
            <p className="text-sm font-semibold text-validated">Escrow Funded</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Interest projection active • Ledger entry created
              {receiptUploaded && ' • Receipt on file'}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
