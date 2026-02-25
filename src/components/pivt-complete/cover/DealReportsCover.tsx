import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { useSelectedDeal, usePIVTStore } from '@/stores/pivtStore';
import { useReportStore } from '@/stores/reportStore';
import { downloadBlob } from '@/lib/reportGenerator';
import { FileText, Download, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GenerateReportModal } from './GenerateReportModal';
import { ReportsHistoryTable } from './ReportsHistoryTable';

const DEAL_REPORT_TYPES = [
  { id: 'deal-summary', name: 'Deal Summary Report', desc: 'Full deal overview including terms, parties, state, and outstanding blockers.', formats: ['PDF', 'CSV'] },
  { id: 'stakeholder-report', name: 'Stakeholder Report', desc: 'Complete stakeholder list with KYC status, ownership, and payout allocations.', formats: ['PDF', 'XLSX'] },
  { id: 'payment-schedule', name: 'Payment Schedule', desc: 'Wire transfer schedule with amounts, methods, and execution status.', formats: ['CSV', 'XLSX'] },
  { id: 'reconciliation-report', name: 'Reconciliation Report', desc: 'Discrepancy findings, resolution status, and financial variance analysis.', formats: ['PDF'] },
  { id: 'approval-log', name: 'Approval Log', desc: 'Complete approval chain with timestamps, actors, and governance status.', formats: ['PDF', 'CSV'] },
  { id: 'audit-trail', name: 'Audit Trail Export', desc: 'Immutable chronological log of all deal-level events and state changes.', formats: ['CSV', 'XLSX'] },
];

export const DealReportsCover: React.FC = () => {
  const deal = useSelectedDeal();
  const reportStore = useReportStore();
  const [scheduleEnabled, setScheduleEnabled] = useState<Record<string, boolean>>({});
  const [modalReport, setModalReport] = useState<typeof DEAL_REPORT_TYPES[0] | null>(null);

  const getLatestReady = (reportId: string) => {
    return reportStore.history.find((r) => r.reportTypeId === reportId && r.status === 'ready' && r.fileBlob);
  };

  const isGenerating = (reportId: string) => {
    return reportStore.history.some((r) => r.reportTypeId === reportId && r.status === 'generating');
  };

  return (
    <>
      <motion.div {...staggerChildren} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate structured reports for {deal.codeName}</p>
        </div>

        {/* Report metadata header */}
        <motion.div {...fadeInUp} className="pivt-card p-4 flex items-center gap-6 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">Deal:</span> {deal.codeName}</span>
          <span><span className="font-medium text-foreground">State:</span> {deal.workflowState.replace(/_/g, ' ')}</span>
          <span><span className="font-medium text-foreground">Blockers:</span> {deal.discrepanciesFound}</span>
          <span><span className="font-medium text-foreground">Approvals Pending:</span> {deal.pendingApprovals}</span>
          <span><span className="font-medium text-foreground">Reconciliation:</span> {deal.discrepanciesFound > 0 ? 'Outstanding' : 'Clear'}</span>
        </motion.div>

        {/* Report list */}
        <div className="space-y-3">
          {DEAL_REPORT_TYPES.map(report => {
            const generating = isGenerating(report.id);
            const latest = getLatestReady(report.id);
            return (
              <motion.div key={report.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <FileText className="w-5 h-5 text-accent" />
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
                  <div className="flex items-center gap-3 border-l border-border pl-3">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">Schedule</span>
                      <Switch
                        checked={scheduleEnabled[report.id] || false}
                        onCheckedChange={(v) => setScheduleEnabled(prev => ({ ...prev, [report.id]: v }))}
                      />
                    </div>
                    {latest && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadBlob(latest.fileBlob!, latest.fileName)}
                      >
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
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Reports History */}
        <ReportsHistoryTable />

        {/* Standardization note */}
        <motion.div {...fadeInUp} className="pivt-card p-4 bg-muted/20 border-dashed">
          <p className="text-xs text-muted-foreground">
            All reports include: Deal ID, timestamp, version, state at generation, outstanding blockers, financial reconciliation status, and approval status.
          </p>
        </motion.div>
      </motion.div>

      {modalReport && (
        <GenerateReportModal
          open={!!modalReport}
          onOpenChange={(v) => { if (!v) setModalReport(null); }}
          report={modalReport}
          scope="deal"
        />
      )}
    </>
  );
};
