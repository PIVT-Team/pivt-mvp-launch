import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Download, FileText } from 'lucide-react';
import { useReportStore, type ReportFormat, type ReportScope, type GeneratedReport } from '@/stores/reportStore';
import { usePIVTStore, useSelectedDeal, type DemoDeal } from '@/stores/pivtStore';
import { useAuditStore } from '@/stores/auditStore';
import { generateReport, downloadBlob, type ReportDataContext } from '@/lib/reportGenerator';

export interface ReportDef {
  id: string;
  name: string;
  desc: string;
  formats: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ReportDef;
  scope: ReportScope;
}

export const GenerateReportModal: React.FC<Props> = ({ open, onOpenChange, report: initialReport, scope: initialScope }) => {
  const deal = useSelectedDeal();
  const { deals, stakeholders, payments, waterfallTiers } = usePIVTStore();
  const auditStore = useAuditStore();
  const reportStore = useReportStore();

  // Report type selection
  const REPORT_TYPES: ReportDef[] = useMemo(() => [
    { id: 'portfolio-summary', name: 'Portfolio Deal Summary', desc: 'Aggregated status of all active deals, closing timelines, and risk indicators.', formats: ['PDF', 'CSV'] },
    { id: 'audit-export', name: 'Audit Trail Export', desc: 'Complete immutable audit trail with actor, action, and timestamp data.', formats: ['CSV', 'PDF'] },
    { id: 'compliance-summary', name: 'Stakeholder Compliance Summary', desc: 'Cross-deal KYC/KYB status for all stakeholders.', formats: ['PDF', 'CSV', 'XLSX'] },
    { id: 'payment-schedule', name: 'Payment Schedule Export', desc: 'Consolidated payment schedules across deals.', formats: ['CSV', 'XLSX'] },
  ], []);

  const [selectedReportId, setSelectedReportId] = useState(initialReport.id);
  const activeReport = REPORT_TYPES.find(r => r.id === selectedReportId) || initialReport;

  // Scope: 'all' or a specific deal id
  const [scopeValue, setScopeValue] = useState<string>(initialScope === 'deal' ? (deal?.id || 'all') : 'all');
  const selectedDealForScope: DemoDeal | undefined = scopeValue === 'all' ? undefined : deals.find(d => d.id === scopeValue);
  const effectiveScope: ReportScope = scopeValue === 'all' ? 'portfolio' : 'deal';

  // Format
  const [format, setFormat] = useState<ReportFormat>(activeReport.formats[0] as ReportFormat);

  // Reset format when report type changes
  const handleReportTypeChange = (id: string) => {
    setSelectedReportId(id);
    const r = REPORT_TYPES.find(rt => rt.id === id);
    if (r && !r.formats.includes(format)) {
      setFormat(r.formats[0] as ReportFormat);
    }
  };

  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [phase, setPhase] = useState<'config' | 'generating' | 'success' | 'error'>('config');
  const [progressText, setProgressText] = useState('');
  const [generatedId, setGeneratedId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const reset = () => {
    setPhase('config');
    setProgressText('');
    setGeneratedId(null);
    setErrorMsg('');
  };

  const handleGenerate = async () => {
    setPhase('generating');
    setProgressText('Compiling data…');

    const id = crypto.randomUUID();
    const scopeLabel = effectiveScope === 'deal' && selectedDealForScope
      ? selectedDealForScope.codeName
      : `All ${deals.length} deals`;
    const fileName = `${activeReport.name.replace(/\s+/g, '_')}.${format.toLowerCase()}`;

    const entry: GeneratedReport = {
      id,
      reportTypeId: activeReport.id,
      reportName: activeReport.name,
      scope: effectiveScope,
      scopeLabel,
      format,
      status: 'generating',
      generatedAt: new Date().toISOString(),
      fileName,
      dateRange: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined,
    };
    reportStore.addReport(entry);

    auditStore.addEvent({
      deal_id: effectiveScope === 'deal' && selectedDealForScope ? selectedDealForScope.id : null,
      actor_type: 'User',
      actor_id: 'u-001',
      actor_display_name: 'Alexandra Reed',
      actor_role: 'Admin',
      action: 'REPORT_REQUESTED',
      object_type: 'Report',
      object_id: id,
      severity: 'info',
      summary: `Report generation requested: ${activeReport.name} (${format})`,
      before_state: null,
      after_state: { reportType: activeReport.id, format, scope: scopeLabel },
      source: 'UI',
      ip_address: null,
      user_agent: null,
      correlation_id: null,
      category: 'user',
    });

    try {
      setProgressText('Rendering file…');
      const ctx: ReportDataContext = {
        deals,
        stakeholders,
        payments,
        waterfallTiers,
        auditEvents: auditStore.events,
        selectedDeal: selectedDealForScope,
      };

      const result = await generateReport(activeReport.id, format, ctx);
      reportStore.updateReport(id, { status: 'ready', fileBlob: result.blob, fileName: result.fileName });
      setGeneratedId(id);
      setPhase('success');

      auditStore.addEvent({
        deal_id: effectiveScope === 'deal' && selectedDealForScope ? selectedDealForScope.id : null,
        actor_type: 'System',
        actor_id: null,
        actor_display_name: 'Report Engine',
        actor_role: 'System',
        action: 'REPORT_GENERATED',
        object_type: 'Report',
        object_id: id,
        severity: 'info',
        summary: `${activeReport.name} generated successfully (${format})`,
        before_state: null,
        after_state: { fileName: result.fileName, format },
        source: 'Automation',
        ip_address: null,
        user_agent: null,
        correlation_id: null,
        category: 'system',
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to generate report');
      reportStore.updateReport(id, { status: 'failed', error: err?.message });
      setPhase('error');

      auditStore.addEvent({
        deal_id: effectiveScope === 'deal' && selectedDealForScope ? selectedDealForScope.id : null,
        actor_type: 'System',
        actor_id: null,
        actor_display_name: 'Report Engine',
        actor_role: 'System',
        action: 'REPORT_FAILED',
        object_type: 'Report',
        object_id: id,
        severity: 'error',
        summary: `${activeReport.name} generation failed: ${err?.message}`,
        before_state: null,
        after_state: { error: err?.message },
        source: 'Automation',
        ip_address: null,
        user_agent: null,
        correlation_id: null,
        category: 'system',
      });
    }
  };

  const handleDownload = () => {
    if (!generatedId) return;
    const r = reportStore.history.find((h) => h.id === generatedId);
    if (r?.fileBlob) {
      downloadBlob(r.fileBlob, r.fileName);
      auditStore.addEvent({
        deal_id: effectiveScope === 'deal' && selectedDealForScope ? selectedDealForScope.id : null,
        actor_type: 'User',
        actor_id: 'u-001',
        actor_display_name: 'Alexandra Reed',
        actor_role: 'Admin',
        action: 'REPORT_DOWNLOADED',
        object_type: 'Report',
        object_id: generatedId,
        severity: 'info',
        summary: `Downloaded: ${r.fileName}`,
        before_state: null,
        after_state: null,
        source: 'UI',
        ip_address: null,
        user_agent: null,
        correlation_id: null,
        category: 'user',
      });
    }
  };

  const statusDot = (status: string) => {
    const colors: Record<string, string> = {
      drafting: 'bg-muted-foreground',
      diligence: 'bg-accent',
      signing: 'bg-chart-4',
      closing: 'bg-chart-2',
      completed: 'bg-validated',
    };
    return <span className={`inline-block w-2 h-2 rounded-full ${colors[status] || 'bg-muted-foreground'}`} />;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Generate Report
          </DialogTitle>
          <DialogDescription>Configure and export your report</DialogDescription>
        </DialogHeader>

        {phase === 'config' && (
          <div className="space-y-4">
            {/* Report Type */}
            <div>
              <Label className="text-xs text-muted-foreground">Report Type</Label>
              <Select value={selectedReportId} onValueChange={handleReportTypeChange}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">{activeReport.desc}</p>
            </div>

            {/* Scope */}
            <div>
              <Label className="text-xs text-muted-foreground">Scope</Label>
              <Select value={scopeValue} onValueChange={setScopeValue}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    All active deals ({deals.length})
                  </SelectItem>
                  <SelectSeparator />
                  {deals.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <span className="flex items-center gap-2">
                        {statusDot(d.status)}
                        <span>{d.codeName}</span>
                        <span className="text-muted-foreground text-[10px] ml-1">
                          ${(d.consideration / 1e6).toFixed(0)}M · {d.readyToPayPercent}%
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {scopeValue === 'all'
                  ? 'All active deals generates a portfolio-level report.'
                  : 'Generates a deal-specific report for the selected deal.'}
              </p>
            </div>

            {/* Format */}
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {activeReport.formats.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Start Date (optional)</Label>
                <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">End Date (optional)</Label>
                <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
        )}

        {phase === 'generating' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
            <p className="text-sm font-medium">{progressText}</p>
            <p className="text-xs text-muted-foreground">This may take a moment…</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="w-8 h-8 text-validated" />
            <p className="text-sm font-medium">Report generated successfully</p>
            <Badge variant="outline" className="text-xs">{format}</Badge>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm font-medium">Generation failed</p>
            <p className="text-xs text-muted-foreground">{errorMsg}</p>
          </div>
        )}

        <DialogFooter>
          {phase === 'config' && (
            <Button onClick={handleGenerate}>Generate</Button>
          )}
          {phase === 'success' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={handleDownload}>
                <Download className="w-4 h-4 mr-1.5" /> Download
              </Button>
            </div>
          )}
          {phase === 'error' && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={() => { reset(); handleGenerate(); }}>Retry</Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
