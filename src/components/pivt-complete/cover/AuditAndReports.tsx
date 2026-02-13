import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { History, FileText, BarChart3 } from 'lucide-react';

export const AuditCover: React.FC = () => {
  const events = [
    { time: '2 min ago', user: 'Admin', action: 'Approved payout for Sarah Chen', type: 'approval' },
    { time: '15 min ago', user: 'System', action: 'Validation passed for Waterfall Schedule v3', type: 'validation' },
    { time: '1 hr ago', user: 'Seller Counsel', action: 'Uploaded Escrow Agreement amendment', type: 'document' },
    { time: '2 hr ago', user: 'System', action: 'KYC verification failed for GIC Private Limited', type: 'alert' },
    { time: '3 hr ago', user: 'Admin', action: 'Created new deal: Project CIPHER', type: 'deal' },
    { time: '5 hr ago', user: 'Buyer Counsel', action: 'Submitted buyer-side approval', type: 'approval' },
    { time: '1 day ago', user: 'System', action: 'Escrow funded: $280M deposited', type: 'escrow' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Audit Trail</h2>
      <div className="pivt-card divide-y divide-border">
        {events.map((evt, i) => (
          <motion.div key={i} {...fadeInUp} className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors">
            <History className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm"><span className="font-medium">{evt.user}</span> · {evt.action}</p>
            </div>
            <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">{evt.time}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export const ReportsCover: React.FC = () => (
  <div className="space-y-6">
    <h2 className="text-xl font-semibold">Reports</h2>
    <div className="grid grid-cols-2 gap-4">
      {['Deal Summary', 'Waterfall Report', 'Compliance Report', 'Audit Export'].map(name => (
        <div key={name} className="pivt-card p-5 cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-2">
            {name.includes('Audit') ? <FileText className="w-5 h-5 text-accent" /> : <BarChart3 className="w-5 h-5 text-accent" />}
            <span className="font-medium">{name}</span>
          </div>
          <p className="text-xs text-muted-foreground">Generate and download PDF</p>
        </div>
      ))}
    </div>
  </div>
);
