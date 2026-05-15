import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerChildren } from '@/lib/animations';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReportStore } from '@/stores/reportStore';
import { supabase } from '@/integrations/supabase/client';
import { downloadBlob } from '@/lib/reportGenerator';
import { toast } from 'sonner';
import {
  FileText, Download, Clock, CheckCircle2, Calendar, Inbox, AlertCircle, RefreshCw, Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GenerateReportModal } from './GenerateReportModal';
import { ReportsHistoryTable } from './ReportsHistoryTable';
import {
  listPersistedReports,
  listReportSchedules,
  saveReportSchedule,
  getReportDownloadUrl,
  isScheduleOverdue,
  type PersistedReport,
  type ReportSchedule,
  type ReportFrequency,
} from '@/services/reportPersistenceService';

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
  const { user } = useAuth();
  const reportStore = useReportStore();
  const [modalReport, setModalReport] = useState<ReportType | null>(null);
  const [readiness, setReadiness] = useState<DataReadiness | null>(null);
  const [loading, setLoading] = useState(true);

  // Persisted reports + schedules — the durable, cross-session source of truth.
  const [persisted, setPersisted] = useState<PersistedReport[]>([]);
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const refreshPersisted = useCallback(async () => {
    if (!dealId) return;
    try {
      const [rep, sched] = await Promise.all([
        listPersistedReports(dealId),
        listReportSchedules(dealId),
      ]);
      setPersisted(rep);
      setSchedules(sched);
    } catch (err: any) {
      console.warn('Failed to load persisted reports/schedules:', err?.message);
    }
  }, [dealId]);

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

    refreshPersisted();
  }, [dealId, refreshPersisted]);

  // Re-fetch persisted list whenever a modal-driven generation finishes, so
  // the row's "Ready" badge flips without a manual reload.
  const inflightSentinel = reportStore.history.filter(h => h.status === 'ready').length;
  useEffect(() => { refreshPersisted(); }, [inflightSentinel, refreshPersisted]);

  // Helpers for "what's the latest ready/in-flight per report type?"
  const persistedByType = useMemo(() => {
    const map = new Map<string, PersistedReport>();
    for (const r of persisted) {
      if (r.status !== 'ready') continue;
      if (!map.has(r.report_type_id)) map.set(r.report_type_id, r);
    }
    return map;
  }, [persisted]);

  const schedulesByKey = useMemo(() => {
    const map = new Map<string, ReportSchedule>();
    for (const s of schedules) map.set(`${s.report_type_id}|${s.format}`, s);
    return map;
  }, [schedules]);

  const isGenerating = (reportId: string) =>
    reportStore.history.some(r => r.reportTypeId === reportId && r.status === 'generating');

  const isAvailable = (report: ReportType): boolean => {
    if (!readiness) return false;
    return readiness[report.checkKey as keyof DataReadiness] || false;
  };

  const handleDownload = async (report: ReportType) => {
    const persistedRow = persistedByType.get(report.id);
    if (persistedRow) {
      setDownloadingId(report.id);
      try {
        const url = await getReportDownloadUrl(persistedRow.storage_path);
        window.open(url, '_blank', 'noopener');
      } catch (err: any) {
        toast.error(err?.message || 'Could not download report');
      } finally {
        setDownloadingId(null);
      }
      return;
    }
    // Fallback: same-session local blob from reportStore.
    const local = reportStore.history.find(r => r.reportTypeId === report.id && r.status === 'ready' && r.fileBlob);
    if (local?.fileBlob) {
      downloadBlob(local.fileBlob, local.fileName);
    } else {
      toast.error('No report available to download. Generate one first.');
    }
  };

  const handleToggleSchedule = async (
    report: ReportType,
    format: string,
    enabled: boolean,
    frequency: ReportFrequency,
  ) => {
    const key = `${report.id}|${format}`;
    setSavingScheduleId(key);
    try {
      await saveReportSchedule({
        dealId,
        userId: user?.id ?? null,
        reportTypeId: report.id,
        format: format as any,
        frequency,
        enabled,
      });
      await refreshPersisted();
      toast.success(enabled ? `Scheduled ${report.name} (${frequency})` : `Schedule paused for ${report.name}`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save schedule');
    } finally {
      setSavingScheduleId(null);
    }
  };

  // Schedules that are "due now" — surfaced as a banner so the user can
  // trigger generation by clicking. There's no server cron, so this
  // opportunistic prompt is the honest substitute.
  const overdue = useMemo(
    () => schedules.filter(isScheduleOverdue),
    [schedules],
  );

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
          <p className="text-sm text-muted-foreground">Generate structured reports from deal data. Files are saved to the deal so they're downloadable later from any device.</p>
        </div>

        {/* Overdue-schedule banner — there's no server cron, so the prompt only
            fires when the user opens this tab. Honest, opportunistic. */}
        {overdue.length > 0 && (
          <motion.div {...fadeInUp} className="pivt-card p-4 bg-amber-500/5 border-amber-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {overdue.length} scheduled report{overdue.length !== 1 ? 's are' : ' is'} due
                </p>
                <p className="text-xs text-muted-foreground">
                  {overdue.map(o => o.report_type_id).join(', ')} — click Generate on the corresponding row to run.
                </p>
              </div>
            </div>
          </motion.div>
        )}

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
              const hasPersisted = persistedByType.has(report.id);
              const defaultFormat = report.formats[0];
              const scheduleKey = `${report.id}|${defaultFormat}`;
              const schedule = schedulesByKey.get(scheduleKey);
              const scheduleEnabled = !!schedule?.enabled;
              const scheduleFrequency: ReportFrequency = schedule?.frequency ?? 'weekly';
              const isSavingSchedule = savingScheduleId === scheduleKey;
              return (
                <motion.div key={report.id} {...fadeInUp} className="pivt-card p-5">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-muted/50">
                      <FileText className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-base">{report.name}</h4>
                        {hasPersisted && (
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
                      {/* Schedule controls — toggle persists to audit_log; the
                          frequency picker only appears when scheduling is on. */}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Schedule</span>
                        <Switch
                          checked={scheduleEnabled}
                          disabled={isSavingSchedule}
                          onCheckedChange={(v) => handleToggleSchedule(report, defaultFormat, v, scheduleFrequency)}
                        />
                        {scheduleEnabled && (
                          <Select
                            value={scheduleFrequency}
                            onValueChange={(v: ReportFrequency) => handleToggleSchedule(report, defaultFormat, true, v)}
                          >
                            <SelectTrigger className="h-7 w-[100px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      {hasPersisted && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(report)}
                          disabled={downloadingId === report.id}
                        >
                          {downloadingId === report.id ? (
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                          )}
                          Download
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
          onOpenChange={(v) => { if (!v) { setModalReport(null); refreshPersisted(); } }}
          report={modalReport}
          scope="deal"
        />
      )}
    </>
  );
};
