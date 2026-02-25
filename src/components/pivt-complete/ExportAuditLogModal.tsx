import React, { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuditStore, generateCSV, generateJSON, generatePDFContent } from '@/stores/auditStore';
import { toast } from 'sonner';
import { Loader2, Download } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportFormat = 'pdf' | 'csv' | 'json';
type ExportScope = 'current-deal' | 'all-deals';
type DateRange = '7d' | '30d' | 'all';
type EventFilter = 'all' | 'user' | 'system' | 'financial' | 'compliance' | 'approval';

export const ExportAuditLogModal: React.FC<Props> = ({ open, onOpenChange }) => {
  const { events, getExportHash, addEvent } = useAuditStore();
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [scope, setScope] = useState<ExportScope>('current-deal');
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [exporting, setExporting] = useState(false);

  const getFilteredEvents = () => {
    let filtered = [...events];

    // Scope
    if (scope === 'current-deal') {
      filtered = filtered.filter((e) => e.deal_id === 'deal-001' || e.deal_id === null);
    }

    // Date range
    const now = Date.now();
    if (dateRange === '7d') filtered = filtered.filter((e) => now - new Date(e.timestamp).getTime() < 7 * 86400000);
    else if (dateRange === '30d') filtered = filtered.filter((e) => now - new Date(e.timestamp).getTime() < 30 * 86400000);

    // Category
    if (eventFilter !== 'all') filtered = filtered.filter((e) => e.category === eventFilter);

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    setExporting(true);
    await new Promise((r) => setTimeout(r, 1000));

    const filtered = getFilteredEvents();
    const exportHash = getExportHash();
    const dateLabel = dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : 'All time';
    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === 'csv') {
      downloadFile(generateCSV(filtered), `pivt_audit_log_${timestamp}.csv`, 'text/csv');
    } else if (format === 'json') {
      downloadFile(generateJSON(filtered, exportHash), `pivt_audit_log_${timestamp}.json`, 'application/json');
    } else {
      const html = generatePDFContent(filtered, exportHash, {
        dealName: scope === 'current-deal' ? 'Project ATLAS' : 'All Deals',
        dateRange: dateLabel,
        generatedBy: 'JW (Admin)',
      });
      // Open as printable HTML (user can print to PDF)
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        // Auto-trigger print dialog after load
        win.onload = () => win.print();
      }
    }

    // Log the export itself
    addEvent({
      deal_id: scope === 'current-deal' ? 'deal-001' : null,
      actor_type: 'User', actor_id: 'u-current', actor_display_name: 'JW',
      actor_role: 'Admin', action: 'AUDIT_LOG_EXPORTED', object_type: 'Report',
      object_id: null, severity: 'info',
      summary: `Exported audit log (${format.toUpperCase()}, ${dateLabel}, ${filtered.length} events)`,
      before_state: null, after_state: { format, dateRange, eventCount: filtered.length, exportHash },
      source: 'UI', ip_address: null, user_agent: null, correlation_id: null,
      category: 'user',
    });

    toast.success('Audit log exported.');
    setExporting(false);
    onOpenChange(false);
  };

  const previewCount = getFilteredEvents().length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" style={{ background: 'hsl(var(--card))' }}>
        <DialogHeader>
          <DialogTitle style={{ color: 'hsl(var(--foreground))' }}>Export Audit Log</DialogTitle>
          <DialogDescription>
            Download a regulator-grade audit trail with integrity checksums.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Export Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as ExportScope)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current-deal">Current Deal</SelectItem>
                  <SelectItem value="all-deals">All Deals (Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Date Range</Label>
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF (Print-ready)</SelectItem>
                  <SelectItem value="csv">CSV (Machine-readable)</SelectItem>
                  <SelectItem value="json">JSON (System export)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Filter Events</Label>
              <Select value={eventFilter} onValueChange={(v) => setEventFilter(v as EventFilter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All events</SelectItem>
                  <SelectItem value="user">User actions only</SelectItem>
                  <SelectItem value="system">System events only</SelectItem>
                  <SelectItem value="financial">Financial events only</SelectItem>
                  <SelectItem value="compliance">Compliance/KYC only</SelectItem>
                  <SelectItem value="approval">Approvals only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg bg-muted/50 border border-border p-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{previewCount}</span> events match your criteria.
            Export will include integrity checksum for verification.
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={exporting || previewCount === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
