import React from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, Clock, XCircle, FileText } from 'lucide-react';

export const DocumentsCover: React.FC = () => {
  const { documents } = usePIVTStore();
  const statusIcons = { verified: CheckCircle2, pending: Clock, rejected: XCircle };
  const statusColors = { verified: 'text-validated', pending: 'text-discrepancy', rejected: 'text-blocking' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Documents</h2>
        <span className="text-sm text-muted-foreground">{documents.length} total</span>
      </div>
      <div className="grid gap-3">
        {documents.map((doc) => {
          const Icon = statusIcons[doc.status];
          return (
            <motion.div key={doc.id} {...fadeInUp} className="pivt-card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
              <FileText className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{doc.type} · {doc.uploadedAt}</p>
              </div>
              <Icon className={`w-5 h-5 ${statusColors[doc.status]}`} />
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
