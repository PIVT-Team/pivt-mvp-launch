import React from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import { useReportStore } from '@/stores/reportStore';
import { downloadBlob } from '@/lib/reportGenerator';
import { useAuditStore } from '@/stores/auditStore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Trash2, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';

export const ReportsHistoryTable: React.FC = () => {
  const { history, removeReport } = useReportStore();
  const auditStore = useAuditStore();

  if (history.length === 0) return null;

  const handleDownload = (r: typeof history[0]) => {
    if (r.fileBlob) {
      downloadBlob(r.fileBlob, r.fileName);
      auditStore.addEvent({
        deal_id: null,
        actor_type: 'User', actor_id: 'u-001', actor_display_name: 'Alexandra Reed',
        actor_role: 'Admin', action: 'REPORT_DOWNLOADED', object_type: 'Report',
        object_id: r.id, severity: 'info',
        summary: `Downloaded: ${r.fileName}`,
        before_state: null, after_state: null,
        source: 'UI', ip_address: null, user_agent: null, correlation_id: null, category: 'user',
      });
    }
  };

  return (
    <motion.div {...fadeInUp} className="space-y-3">
      <h3 className="text-base font-semibold text-foreground">Generated Reports</h3>
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
            {history.map((r) => (
              <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20">
                <td className="px-4 py-2.5 font-medium">{r.reportName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.scopeLabel}</td>
                <td className="px-4 py-2.5">
                  <Badge variant="outline" className="text-xs">{r.format}</Badge>
                </td>
                <td className="px-4 py-2.5">
                  {r.status === 'generating' && (
                    <span className="flex items-center gap-1 text-accent"><Loader2 className="w-3 h-3 animate-spin" /> Generating</span>
                  )}
                  {r.status === 'ready' && (
                    <span className="flex items-center gap-1 text-validated"><CheckCircle2 className="w-3 h-3" /> Ready</span>
                  )}
                  {r.status === 'failed' && (
                    <span className="flex items-center gap-1 text-destructive"><AlertCircle className="w-3 h-3" /> Failed</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(r.generatedAt).toLocaleString()}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {r.status === 'ready' && r.fileBlob && (
                      <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => handleDownload(r)}>
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground hover:text-destructive" onClick={() => removeReport(r.id)}>
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
