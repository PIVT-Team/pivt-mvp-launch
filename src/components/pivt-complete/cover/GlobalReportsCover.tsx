import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { usePIVTStore } from '@/stores/pivtStore';
import { FileText, Download, FileBarChart, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const PORTFOLIO_REPORTS = [
  { id: 'portfolio-summary', name: 'Portfolio Deal Summary', desc: 'Aggregated status of all active deals, closing timelines, and risk indicators.', formats: ['PDF', 'CSV'] },
  { id: 'compliance-summary', name: 'Stakeholder Compliance Summary', desc: 'Cross-deal KYC/KYB status for all stakeholders with verification gaps.', formats: ['PDF', 'XLSX'] },
  { id: 'payment-schedule', name: 'Payment Schedule Export', desc: 'Consolidated payment schedules across all active deals.', formats: ['CSV', 'XLSX'] },
  { id: 'kyc-weekly', name: 'Weekly KYC Status Report', desc: 'Rolling weekly summary of KYC completions, failures, and pending verifications.', formats: ['PDF'] },
  { id: 'audit-export', name: 'Global Audit Export', desc: 'Complete immutable audit trail across all deals and system events.', formats: ['CSV', 'XLSX'] },
];

export const GlobalReportsCover: React.FC = () => {
  const { deals } = usePIVTStore();
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = (reportId: string) => {
    setGenerating(reportId);
    setTimeout(() => setGenerating(null), 2000);
  };

  return (
    <motion.div {...staggerChildren} className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <p className="text-muted-foreground mt-1">Portfolio-level reports across {deals.length} active deals</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Deals', value: deals.length },
          { label: 'Total Value', value: `$${(deals.reduce((s, d) => s + d.consideration, 0) / 1e6).toFixed(0)}M` },
          { label: 'Reports Available', value: PORTFOLIO_REPORTS.length },
        ].map(s => (
          <motion.div key={s.label} {...fadeInUp} className="pivt-card p-4">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className="pivt-stat text-xl mt-1">{s.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Report list */}
      <div className="space-y-3">
        {PORTFOLIO_REPORTS.map(report => (
          <motion.div key={report.id} {...fadeInUp} className="pivt-card p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-lg bg-muted/50">
              <FileBarChart className="w-5 h-5 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm">{report.name}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">{report.desc}</p>
            </div>
            <div className="flex items-center gap-2">
              {report.formats.map(fmt => (
                <Badge key={fmt} variant="outline" className="text-[9px]">{fmt}</Badge>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleGenerate(report.id)}
              disabled={generating === report.id}
            >
              {generating === report.id ? (
                <><Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating...</>
              ) : (
                <><Download className="w-3.5 h-3.5 mr-1.5" /> Generate</>
              )}
            </Button>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};
