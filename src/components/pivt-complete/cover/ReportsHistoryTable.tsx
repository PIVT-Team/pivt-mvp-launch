import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { useReportStore } from '@/stores/reportStore';
import { downloadBlob } from '@/lib/reportGenerator';
import { useAuditStore } from '@/stores/auditStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader2, CheckCircle2, AlertCircle, Clock, ServerCrash } from 'lucide-react';
import { toast } from 'sonner';
import {
  listPersistedReports,
  getReportDownloadUrl,
  deletePersistedReport,
  type PersistedReport,
} from '@/services/reportPersistenceService';

// Unified row shape used by the table — backed by either a Storage-persisted
// report (the durable source of truth) or an in-flight reportStore entry
// (in-memory only, used while a generation is still running).
type Row =
  | (PersistedReport & { source: 'persisted' })
  | {
      source: 'inflight';
      id: string;
      reportName: string;
      scopeLabel: string;
      format: string;
      fileName: string;
      status: 'generating' | 'failed';
      generatedAt: string;
      error?: string;
      fileBlob?: Blob;
    };

export const ReportsHistoryTable: React.FC = () => {
  // Try to read a deal-scope from the surrounding workspace. The same table
  // is used on portfolio-level Reports pages where there's no provider, so
  // failure to read context just means "show portfolio reports."
  let dealId: string | null = null;
  try {
    dealId = useDealWorkspace().dealId ?? null;
  } catch {
    dealId = null;
  }

  const { user } = useAuth();
  const { history, removeReport } = useReportStore();
  const auditStore = useAuditStore();
  const [persisted, setPersisted] = useState<PersistedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listPersistedReports(dealId);
      setPersisted(rows);
    } catch (err: any) {
      // Failing to load is a soft error — the local in-flight rows still show.
      console.warn('Report history fetch failed:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Refresh whenever a new report finishes generating (reportStore changes).
  // We track length + the most recent entry's status to avoid polling.
  const sentinel = `${history.length}:${history[0]?.status ?? ''}`;
  useEffect(() => { refresh(); }, [sentinel, refresh]);

  const rows: Row[] = [
    // In-flight rows that the deal owner has kicked off this session and
    // that aren't yet (or never made it) into Storage.
    ...history
      .filter(h => h.status === 'generating' || (h.status === 'failed' && !persisted.some(p => p.id === h.id)))
      .map<Row>(h => ({
        source: 'inflight',
        id: h.id,
        reportName: h.reportName,
        scopeLabel: h.scopeLabel,
        format: h.format,
        fileName: h.fileName,
        status: h.status as 'generating' | 'failed',
        generatedAt: h.generatedAt,
        error: h.error,
        fileBlob: h.fileBlob,
      })),
    ...persisted.map<Row>(p => ({ ...p, source: 'persisted' })),
  ];

  if (rows.length === 0 && !loading) return null;

  const handleDownload = async (r: Row) => {
    if (r.source === 'inflight') {
      // No persisted blob — but we may still have it in memory for this session.
      if (r.fileBlob) {
        downloadBlob(r.fileBlob, r.fileName);
      } else {
        toast.error('This report could not be downloaded. Try regenerating.');
      }
      return;
    }
    setBusyId(r.id);
    try {
      const url = await getReportDownloadUrl(r.storage_path);
      window.open(url, '_blank', 'noopener');
      auditStore.addEvent({
        deal_id: r.deal_id,
        actor_type: 'User',
        actor_id: user?.id ?? 'u-001',
        actor_display_name: user?.email ?? 'Current user',
        actor_role: 'Admin',
        action: 'REPORT_DOWNLOADED',
        object_type: 'Report',
        object_id: r.id,
        severity: 'info',
        summary: `Downloaded: ${r.file_name}`,
        before_state: null,
        after_state: null,
        source: 'UI',
        ip_address: null,
        user_agent: null,
        correlation_id: null,
        category: 'user',
      });
    } catch (err: any) {
      toast.error(err?.message || 'Could not download report');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (r: Row) => {
    if (r.source === 'inflight') {
      removeReport(r.id);
      return;
    }
    setBusyId(r.id);
    try {
      await deletePersistedReport(r, user?.id ?? null);
      toast.success('Report removed');
      setPersisted(prev => prev.filter(p => p.id !== r.id));
    } catch (err: any) {
      toast.error(err?.message || 'Could not delete report');
    } finally {
      setBusyId(null);
    }
  };

  // Display helpers — both Row variants need the same surface fields.
  const rowName = (r: Row) => r.source === 'persisted' ? r.report_name : r.reportName;
  const rowScope = (r: Row) => r.source === 'persisted' ? r.scope_label : r.scopeLabel;
  const rowFormat = (r: Row) => r.format;
  const rowGeneratedAt = (r: Row) => r.source === 'persisted' ? r.generated_at : r.generatedAt;

  return (
    <motion.div {...fadeInUp} className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Generated Reports</h3>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="pivt-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Report</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Scope</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Format</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Status</th>
              <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Generated</th>
              <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.source}-${r.id}`} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{rowName(r)}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{rowScope(r)}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-xs">{rowFormat(r)}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  {r.source === 'inflight' && r.status === 'generating' && (
                    <span className="flex items-center gap-1 text-accent"><Loader2 className="w-3 h-3 animate-spin" /> Generating</span>
                  )}
                  {r.source === 'inflight' && r.status === 'failed' && (
                    <span className="flex items-center gap-1 text-destructive" title={r.error || ''}><AlertCircle className="w-3 h-3" /> Failed</span>
                  )}
                  {r.source === 'persisted' && r.status === 'ready' && (
                    <span className="flex items-center gap-1 text-validated"><CheckCircle2 className="w-3 h-3" /> Ready</span>
                  )}
                  {r.source === 'persisted' && r.status === 'failed' && (
                    <span className="flex items-center gap-1 text-destructive" title={r.error || ''}><ServerCrash className="w-3 h-3" /> Failed</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(rowGeneratedAt(r)).toLocaleString()}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {((r.source === 'persisted' && r.status === 'ready') || (r.source === 'inflight' && r.fileBlob)) && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownload(r)} disabled={busyId === r.id}>
                        {busyId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(r)} disabled={busyId === r.id}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
};
