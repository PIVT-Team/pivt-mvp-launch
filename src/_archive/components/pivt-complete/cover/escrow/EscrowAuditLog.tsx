import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { FileText } from 'lucide-react';

interface AuditEntry {
  timestamp: string;
  actor: string;
  action: string;
  dealRef: string;
}

interface Props {
  entries: AuditEntry[];
}

export const EscrowAuditLog: React.FC<Props> = ({ entries }) => {
  return (
    <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
      <div className="p-4 border-b border-border bg-muted/30 flex items-center gap-2">
        <FileText className="w-4 h-4 text-accent" />
        <h3 className="font-medium">Escrow Audit Trail</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">{entries.length} entries</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto">
        {entries.map((entry, i) => (
          <div key={i} className="px-4 py-3 border-b border-border last:border-0 hover:bg-muted/20 transition-colors flex items-start gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm">{entry.action}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{entry.actor} • {entry.dealRef}</p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{entry.timestamp}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
