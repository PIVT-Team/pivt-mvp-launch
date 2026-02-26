import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { usePIVTStore } from '@/stores/pivtStore';
import { useReportStore } from '@/stores/reportStore';
import { downloadBlob } from '@/lib/reportGenerator';
import { Download, FileBarChart, Clock, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GenerateReportModal } from './GenerateReportModal';
import { ReportsHistoryTable } from './ReportsHistoryTable';

const PORTFOLIO_REPORTS = [
  { id: 'portfolio-summary', name: 'Portfolio Deal Summary', desc: 'Aggregated status of all active deals, closing timelines, and risk indicators.', formats: ['PDF', 'CSV'] },
  { id: 'audit-export', name: 'Audit Trail Export', desc: 'Complete immutable audit trail across all deals and system events.', formats: ['CSV', 'PDF'] },
  { id: 'compliance-summary', name: 'Stakeholder Compliance Summary', desc: 'Cross-deal KYC/KYB status for all stakeholders with verification gaps.', formats: ['PDF', 'CSV', 'XLSX'] },
  { id: 'payment-schedule', name: 'Payment Schedule Export', desc: 'Consolidated payment schedules across all active deals.', formats: ['CSV', 'XLSX'] },
  { id: 'kyc-weekly', name: 'Weekly KYC Status Report', desc: 'Rolling weekly summary of KYC completions, failures, and pending verifications.', formats: ['PDF'] },
];

export const GlobalReportsCover: React.FC = () => {
  const { deals } = usePIVTStore();
  const reportStore = useReportStore();
  const [modalReport, setModalReport] = useState<typeof PORTFOLIO_REPORTS[0] | null>(null);

  const isGenerating = (reportId: string) =>
    reportStore.history.some((r) => r.reportTypeId === reportId && r.status === 'generating');

  const getLatestReady = (reportId: string) =>
    reportStore.history.find((r) => r.reportTypeId === reportId && r.status === 'ready' && r.fileBlob);

  return (
    <>
      <motion.div {...staggerChildren} className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1">Portfolio-level reports across {deals.length} active deals</p>
        </div>

        {/* Summary stats — metric cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Active Deals', value: deals.length },
            { label: 'Total Value', value: `$${(deals.reduce((s, d) => s + d.consideration, 0) / 1e6).toFixed(0)}M` },
            { label: 'Reports Available', value: PORTFOLIO_REPORTS.length },
          ].map(s => (
            <motion.div key={s.label} {...fadeInUp} className="pivt-metric-card">
              <p className="pivt-metric-label">{s.label}</p>
              <p className="pivt-stat text-xl mt-2">{s.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Report list */}
        <div className="space-y-3">
          {PORTFOLIO_REPORTS.map(report => {
            const generating = isGenerating(report.id);
            const latest = getLatestReady(report.id);
            return (
              <motion.div key={report.id} {...fadeInUp} className="pivt-card p-5 flex items-center gap-4">
                <div className="pivt-icon-chip pivt-icon-purple">
                  <FileBarChart className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{report.name}</h4>
                    {latest && (
                      <Badge className="text-[9px] bg-validated/10 text-validated border-validated/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{report.desc}</p>
                </div>
                <div className="flex items-center gap-2">
                  {report.formats.map(fmt => (
                    <Badge key={fmt} variant="outline" className="text-[9px]">{fmt}</Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {latest && (
                    <Button variant="ghost" size="sm" onClick={() => downloadBlob(latest.fileBlob!, latest.fileName)}>
                      <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModalReport(report)}
                    disabled={generating}
                  >
                    {generating ? (
                      <><Clock className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
                    ) : (
                      <><Download className="w-3.5 h-3.5 mr-1.5" /> Generate</>
                    )}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Reports History */}
        <ReportsHistoryTable />
      </motion.div>

      {modalReport && (
        <GenerateReportModal
          open={!!modalReport}
          onOpenChange={(v) => { if (!v) setModalReport(null); }}
          report={modalReport}
          scope="portfolio"
        />
      )}
    </>
  );
};
