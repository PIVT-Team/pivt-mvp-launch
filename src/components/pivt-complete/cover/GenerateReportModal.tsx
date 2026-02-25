import React, { useState } from 'react';
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
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, Download, FileText } from 'lucide-react';
import { useReportStore, type ReportFormat, type ReportScope, type GeneratedReport } from '@/stores/reportStore';
import { usePIVTStore, useSelectedDeal } from '@/stores/pivtStore';
import { useAuditStore } from '@/stores/auditStore';
import { generateReport, downloadBlob, type ReportDataContext } from '@/lib/reportGenerator';

interface ReportDef {
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

export const GenerateReportModal: React.FC<Props> = ({ open, onOpenChange, report, scope }) => {
  const deal = useSelectedDeal();
  const { deals, stakeholders, payments, waterfallTiers } = usePIVTStore();
  const auditStore = useAuditStore();
  const reportStore = useReportStore();

  const [format, setFormat] = useState<ReportFormat>(report.formats[0] as ReportFormat);
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
    const scopeLabel = scope === 'deal' ? deal.codeName : `All ${deals.length} deals`;
    const fileName = `${report.name.replace(/\s+/g, '_')}.${format.toLowerCase()}`;

    const entry: GeneratedReport = {
      id,
      reportTypeId: report.id,
      reportName: report.name,
      scope,
      scopeLabel,
      format,
      status: 'generating',
      generatedAt: new Date().toISOString(),
      fileName,
      dateRange: dateStart && dateEnd ? { start: dateStart, end: dateEnd } : undefined,
    };
    reportStore.addReport(entry);

    // Audit: requested
    auditStore.addEvent({
      deal_id: scope === 'deal' ? deal.id : null,
      actor_type: 'User',
      actor_id: 'u-001',
      actor_display_name: 'Alexandra Reed',
      actor_role: 'Admin',
      action: 'REPORT_REQUESTED',
      object_type: 'Report',
      object_id: id,
      severity: 'info',
      summary: `Report generation requested: ${report.name} (${format})`,
      before_state: null,
      after_state: { reportType: report.id, format, scope: scopeLabel },
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
        selectedDeal: scope === 'deal' ? deal : undefined,
      };

      const result = await generateReport(report.id, format, ctx);
      reportStore.updateReport(id, { status: 'ready', fileBlob: result.blob, fileName: result.fileName });
      setGeneratedId(id);
      setPhase('success');

      // Audit: success
      auditStore.addEvent({
        deal_id: scope === 'deal' ? deal.id : null,
        actor_type: 'System',
        actor_id: null,
        actor_display_name: 'Report Engine',
        actor_role: 'System',
        action: 'REPORT_GENERATED',
        object_type: 'Report',
        object_id: id,
        severity: 'info',
        summary: `${report.name} generated successfully (${format})`,
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
        deal_id: scope === 'deal' ? deal.id : null,
        actor_type: 'System',
        actor_id: null,
        actor_display_name: 'Report Engine',
        actor_role: 'System',
        action: 'REPORT_FAILED',
        object_type: 'Report',
        object_id: id,
        severity: 'error',
        summary: `${report.name} generation failed: ${err?.message}`,
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
      // Audit: downloaded
      auditStore.addEvent({
        deal_id: scope === 'deal' ? deal.id : null,
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

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent" />
            Generate Report
          </DialogTitle>
          <DialogDescription>{report.name}</DialogDescription>
        </DialogHeader>

        {phase === 'config' && (
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Report</Label>
              <p className="text-sm font-medium">{report.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{report.desc}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Scope</Label>
              <p className="text-sm font-medium">
                {scope === 'deal' ? `Deal: ${deal.codeName}` : `All active deals (${deals.length})`}
              </p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ReportFormat)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {report.formats.map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
