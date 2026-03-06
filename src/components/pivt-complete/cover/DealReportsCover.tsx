import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useReportStore } from '@/stores/reportStore';
import { supabase } from '@/integrations/supabase/client';
import { downloadBlob } from '@/lib/reportGenerator';
import { FileText, Download, Clock, CheckCircle2, Calendar, Inbox, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GenerateReportModal } from './GenerateReportModal';
import { ReportsHistoryTable } from './ReportsHistoryTable';

interface ReportType {
  id: string;
  name: string;
  desc: string;
  formats: string[];
  /** Function that checks if source data exists for this report */
  checkKey: string;
}

const DEAL_REPORT_TYPES: ReportType[] = [
  { id: 'deal-summary', name: 'Deal Summary Report', desc: 'Full deal overview including terms, parties, state, and outstanding blockers.', formats: ['PDF', 'CSV'], checkKey: 'hasDeal' },
  { id: 'stakeholder-report', name: 'Stakeholder Report', desc: 'Complete stakeholder list with KYC status, ownership, and payout allocations.', formats: ['PDF', 'XLSX'], checkKey: 'hasStakeholders' },
  { id: 'payment-schedule', name: 'Payment Schedule', desc: 'Wire transfer schedule with amounts, methods, and execution status.', formats: ['CSV', 'XLSX'], checkKey: 'hasPayments' },
  { id: 'reconciliation-report', name: 'Reconciliation Report', desc: 'Discrepancy findings, resolution status, and financial variance analysis.', formats: ['PDF'], checkKey: 'hasDiscrepancies' },
  { id: 'approval-log', name: 'Approval Log', desc: 'Complete approval chain with timestamps, actors, and governance status.', formats: ['PDF', 'CSV'], checkKey: 'hasApprovals' },
  { id: 'audit-trail', name: 'Audit Trail Export', desc: 'Immutable chronological log of all deal-level events and state changes.', formats: ['CSV', 'XLSX'], checkKey: 'hasAudit' },
];

interface DataReadiness {
  hasDeal: boolean;
  hasStakeholders: boolean;
  hasPayments: boolean;
  hasDiscrepancies: boolean;
  hasApprovals: boolean;
  hasAudit: boolean;
}

export const DealReportsCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const reportStore = useReportStore();
  const [scheduleEnabled, setScheduleEnabled] = useState<Record<string, boolean>>({});
  const [modalReport, setModalReport] = useState<ReportType | null>(null);
  const [readiness, setReadiness] = useState<DataReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) return;
    setLoading(true);

    Promise.all([
      supabase.from('cap_table_entries').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('disbursement_intents').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('discrepancies').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('deal_approvals').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
      supabase.from('audit_log').select('id', { count: 'exact', head: true }).eq('deal_id', dealId),
    ]).then(([stakeholders, payments, discrepancies, approvals, audit]) => {
      setReadiness({
        hasDeal: true,
        hasStakeholders: (stakeholders.count || 0) > 0,
        hasPayments: (payments.count || 0) > 0,
        hasDiscrepancies: (discrepancies.count || 0) > 0,
        hasApprovals: (approvals.count || 0) > 0,
        hasAudit: (audit.count || 0) > 0,
      });
      setLoading(false);
    });
  }, [dealId]);

  const getLatestReady = (reportId: string) =>
    reportStore.history.find((r) => r.reportTypeId === reportId && r.status === 'ready' && r.fileBlob);

  const isGenerating = (reportId: string) =>
    reportStore.history.some((r) => r.reportTypeId === reportId && r.status === 'generating');

  const isAvailable = (report: ReportType): boolean => {
    if (!readiness) return false;
    return readiness[report.checkKey as keyof DataReadiness] || false;
  };

  if (loading) {
    return <div className="pivt-card p-12 text-center text-muted-foreground text-sm">Loading report availability…</div>;
  }

  const availableReports = DEAL_REPORT_TYPES.filter(r => isAvailable(r));
  const unavailableReports = DEAL_REPORT_TYPES.filter(r => !isAvailable(r));

  return (
    <>
      <motion.div {...staggerChildren} className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate structured reports from deal data</p>
        </div>

        {availableReports.length === 0 && unavailableReports.length === DEAL_REPORT_TYPES.length && (
          <div className="pivt-card p-12 text-center">
            <Inbox className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">No compliance reports available yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Reports will appear as deal data, approvals, and validations are completed.
            </p>
          </div>
        )}

        {/* Available reports */}
        {availableReports.length > 0 && (
          <div className="space-y-3">
            {availableReports.map(report => {
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
                        <h4 className="font-medium text-base">{report.name}</h4>
                        {latest && (
                          <Badge className="text-xs bg-validated/10 text-validated border-validated/20">
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Ready
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{report.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.formats.map(fmt => (
                        <Badge key={fmt} variant="outline" className="text-xs">{fmt}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 border-l border-border pl-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Schedule</span>
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
        )}

        {/* Unavailable reports */}
        {unavailableReports.length > 0 && availableReports.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Not Available</h3>
            {unavailableReports.map(report => (
              <motion.div key={report.id} {...fadeInUp} className="pivt-card p-5 opacity-50">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-base text-muted-foreground">{report.name}</h4>
                    <p className="text-sm text-muted-foreground mt-0.5">{report.desc}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Insufficient source data</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Reports History */}
        <ReportsHistoryTable />
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
