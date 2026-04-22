import React from 'react';
import { jsPDF } from 'jspdf';
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FileJson,
  FileText,
  Filter,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';

type AuditConsoleTab = 'timeline' | 'who-saw-what';
type EventCategory = 'state' | 'document' | 'ai' | 'approval' | 'other';

interface ParticipantOption {
  userId: string;
  label: string;
  role: string;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  code: string;
  category: EventCategory;
  description: string;
  recordType: string;
  recordId: string | null;
  recordLabel: string;
  payload: Record<string, unknown>;
  ipAddress: string | null;
}

interface VerifyAuditChainResponse {
  valid: boolean;
  total_events: number;
  first_event_at: string | null;
  last_event_at: string | null;
  broken_at_sequence?: number;
}

const categoryStyles: Record<EventCategory, string> = {
  state: 'border-l-validated',
  document: 'border-l-accent',
  ai: 'border-l-discrepancy',
  approval: 'border-l-primary',
  other: 'border-l-border',
};

const categoryLabels: Record<EventCategory, string> = {
  state: 'State changes',
  document: 'Documents',
  ai: 'AI actions',
  approval: 'Approvals',
  other: 'Other',
};

const categorySelectOptions: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'state', label: 'State changes' },
  { value: 'document', label: 'Documents' },
  { value: 'ai', label: 'AI actions' },
  { value: 'approval', label: 'Approvals' },
  { value: 'other', label: 'Other' },
];

const stringify = (value: unknown) => {
  if (value == null || value === '') return '—';
  return String(value);
};

const initialsFor = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const inferCategory = (code: string, recordType?: string) => {
  const normalized = `${code} ${recordType ?? ''}`.toLowerCase();
  if (normalized.includes('state') || normalized.includes('status') || normalized.includes('stage')) return 'state';
  if (normalized.includes('document') || normalized.includes('file') || normalized.includes('binder')) return 'document';
  if (normalized.includes('approval') || normalized.includes('sign') || normalized.includes('consent')) return 'approval';
  if (normalized.includes('ai') || normalized.includes('newton') || normalized.includes('agent') || normalized.includes('correction')) return 'ai';
  return 'other';
};

const humanizeCode = (code: string, payload: Record<string, unknown>) => {
  const normalized = code.replace(/[._]/g, ' ').replace(/-/g, ' ').toLowerCase();

  if (normalized.includes('deal state changed') || normalized.includes('state changed')) {
    return `Deal moved to ${stringify(payload.new_state ?? payload.after_state ?? payload.status)}`;
  }
  if (normalized.includes('document uploaded')) {
    return `Document uploaded: ${stringify(payload.file_name ?? payload.filename)}`;
  }
  if (normalized.includes('document viewed') || normalized.includes('opened document') || normalized.includes('document access')) {
    return `Document accessed: ${stringify(payload.file_name ?? payload.document_name ?? payload.document_id)}`;
  }
  if (normalized.includes('approval')) {
    return `Approval activity recorded for ${stringify(payload.approver_name ?? payload.approval_side ?? payload.approval_type)}`;
  }
  if (normalized.includes('field correction')) {
    return `Field ${stringify(payload.field_name)} updated to ${stringify(payload.human_correction)}`;
  }
  if (normalized.includes('newton') || normalized.includes('ai') || normalized.includes('agent')) {
    return `AI action: ${code.replace(/_/g, ' ')}`;
  }

  return code
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const deriveRecordLabel = (recordType: string, recordId: string | null, payload: Record<string, unknown>, documentMap: Map<string, string>) => {
  if (recordType.toLowerCase().includes('document') && recordId) {
    return documentMap.get(recordId) ?? stringify(payload.file_name ?? payload.filename ?? recordId);
  }

  return stringify(payload.field_name ?? payload.entity_type ?? payload.target_type ?? recordId ?? recordType);
};

const navigateToRecord = (recordType: string) => {
  const normalized = recordType.toLowerCase();
  if (normalized.includes('document')) {
    window.dispatchEvent(new CustomEvent('pivt:navigate-workspace', { detail: { step: 'deal-inputs', sub: 'contracts' } }));
    return;
  }
  if (normalized.includes('approval')) {
    window.dispatchEvent(new CustomEvent('pivt:navigate-workspace', { detail: { step: 'approvals' } }));
    return;
  }
  if (normalized.includes('payment') || normalized.includes('wire')) {
    window.dispatchEvent(new CustomEvent('pivt:navigate-workspace', { detail: { step: 'execution', sub: 'payments' } }));
    return;
  }
  window.dispatchEvent(new CustomEvent('pivt:navigate-workspace', { detail: { step: 'overview' } }));
};

export const AuditConsoleCover: React.FC = () => {
  const { dealId, realDeal } = useDealWorkspace();
  const [activeTab, setActiveTab] = React.useState<AuditConsoleTab>('timeline');
  const [loading, setLoading] = React.useState(true);
  const [events, setEvents] = React.useState<TimelineEvent[]>([]);
  const [participants, setParticipants] = React.useState<ParticipantOption[]>([]);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [actorFilter, setActorFilter] = React.useState<string>('all');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [chainStatus, setChainStatus] = React.useState<VerifyAuditChainResponse | null>(null);
  const [chainCheckedAt, setChainCheckedAt] = React.useState<Date | null>(null);
  const [chainError, setChainError] = React.useState<string | null>(null);
  const [verifyingChain, setVerifyingChain] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const loadAuditConsole = React.useCallback(async () => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const [auditEventsRes, auditLogRes, correctionsRes, membersRes, documentsRes] = await Promise.all([
      supabase
        .from('audit_events')
        .select('id, created_at, actor_id, entity_type, entity_id, event_type, before, after')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabase
        .from('audit_log')
        .select('id, created_at, action, user_id, details')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabase
        .from('field_corrections')
        .select('id, created_at, user_id, table_name, record_id, field_name, ai_output, human_correction, resolution_type')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false }),
      supabase
        .from('deal_members')
        .select('user_id, role')
        .eq('deal_id', dealId),
      supabase
        .from('deal_documents')
        .select('id, file_name')
        .eq('deal_id', dealId),
    ]);

    const memberRows = membersRes.data ?? [];
    const uniqueUserIds = Array.from(
      new Set(
        [
          ...memberRows.map((row) => row.user_id),
          ...(auditEventsRes.data ?? []).map((row) => row.actor_id).filter(Boolean),
          ...(auditLogRes.data ?? []).map((row) => row.user_id).filter(Boolean),
          ...(correctionsRes.data ?? []).map((row) => row.user_id).filter(Boolean),
        ].filter(Boolean),
      ),
    ) as string[];

    const { data: profileRows } = uniqueUserIds.length
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', uniqueUserIds)
      : { data: [] };

    const profilesByUserId = new Map((profileRows ?? []).map((row) => [row.user_id, row.full_name]));
    const documentMap = new Map((documentsRes.data ?? []).map((row) => [row.id, row.file_name]));
    const participantList = memberRows.map((row) => ({
      userId: row.user_id,
      label: profilesByUserId.get(row.user_id) ?? 'Deal participant',
      role: row.role,
    }));

    setParticipants(participantList.sort((a, b) => a.label.localeCompare(b.label)));

    const eventItems: TimelineEvent[] = [
      ...((auditEventsRes.data ?? []).map((row) => {
        const payload = {
          before_state: row.before,
          after_state: row.after,
          new_state: (row.after as Record<string, unknown> | null)?.status,
        } as Record<string, unknown>;
        const category = inferCategory(row.event_type, row.entity_type);
        return {
          id: `audit-events-${row.id}`,
          timestamp: row.created_at,
          actorId: row.actor_id,
          actorName: row.actor_id ? profilesByUserId.get(row.actor_id) ?? 'Deal participant' : 'System',
          actorRole: row.actor_id ? participantList.find((participant) => participant.userId === row.actor_id)?.role ?? 'Participant' : 'System',
          code: row.event_type,
          category,
          description: humanizeCode(row.event_type, payload),
          recordType: row.entity_type,
          recordId: row.entity_id,
          recordLabel: deriveRecordLabel(row.entity_type, row.entity_id, payload, documentMap),
          payload,
          ipAddress: null,
        };
      }) as TimelineEvent[]),
      ...((auditLogRes.data ?? []).map((row) => {
        const payload = (row.details ?? {}) as Record<string, unknown>;
        const recordType = stringify(payload.entity_type ?? payload.target_type ?? payload.table_name ?? 'record');
        const recordId = (payload.entity_id ?? payload.target_id ?? payload.record_id ?? null) as string | null;
        const category = inferCategory(row.action, recordType);
        return {
          id: `audit-log-${row.id}`,
          timestamp: row.created_at,
          actorId: row.user_id,
          actorName: row.user_id ? profilesByUserId.get(row.user_id) ?? 'Deal participant' : 'System',
          actorRole: row.user_id ? participantList.find((participant) => participant.userId === row.user_id)?.role ?? 'Participant' : 'System',
          code: row.action,
          category,
          description: humanizeCode(row.action, payload),
          recordType,
          recordId,
          recordLabel: deriveRecordLabel(recordType, recordId, payload, documentMap),
          payload,
          ipAddress: stringify(payload.ip_address ?? payload.ip_info ?? payload.ip),
        };
      }) as TimelineEvent[]),
      ...((correctionsRes.data ?? []).map((row) => {
        const payload = {
          table_name: row.table_name,
          record_id: row.record_id,
          field_name: row.field_name,
          ai_output: row.ai_output,
          human_correction: row.human_correction,
          resolution_type: row.resolution_type,
        } as Record<string, unknown>;
        return {
          id: `field-correction-${row.id}`,
          timestamp: row.created_at,
          actorId: row.user_id,
          actorName: profilesByUserId.get(row.user_id) ?? 'Deal participant',
          actorRole: participantList.find((participant) => participant.userId === row.user_id)?.role ?? 'Participant',
          code: 'field.correction.recorded',
          category: 'ai',
          description: `Field ${row.field_name} changed from ${stringify(row.ai_output)} to ${stringify(row.human_correction)}`,
          recordType: row.table_name,
          recordId: row.record_id,
          recordLabel: row.field_name,
          payload,
          ipAddress: null,
        };
      }) as TimelineEvent[]),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    setEvents(eventItems);
    setLoading(false);
  }, [dealId]);

  const verifyChain = React.useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!dealId) return;
    if (!silent) setVerifyingChain(true);

    const { data, error } = await supabase.functions.invoke('verify-audit-chain', {
      body: { deal_id: dealId },
    });

    if (error) {
      setChainError(error.message || 'Chain verification failed');
      setChainStatus(null);
      setChainCheckedAt(null);
      setVerifyingChain(false);
      return;
    }

    setChainStatus((data ?? null) as VerifyAuditChainResponse | null);
    setChainError(null);
    setChainCheckedAt(new Date());
    setVerifyingChain(false);
  }, [dealId]);

  React.useEffect(() => {
    void loadAuditConsole();
  }, [loadAuditConsole]);

  React.useEffect(() => {
    void verifyChain();
    const interval = window.setInterval(() => {
      void verifyChain({ silent: true });
    }, 60_000);
    return () => window.clearInterval(interval);
  }, [verifyChain]);

  const filteredEvents = React.useMemo(() => {
    return events.filter((event) => {
      if (categoryFilter !== 'all' && event.category !== categoryFilter) return false;
      if (actorFilter !== 'all' && event.actorId !== actorFilter) return false;
      if (startDate && new Date(event.timestamp) < new Date(`${startDate}T00:00:00`)) return false;
      if (endDate && new Date(event.timestamp) > new Date(`${endDate}T23:59:59`)) return false;
      return true;
    });
  }, [actorFilter, categoryFilter, endDate, events, startDate]);

  const whoSawWhatEvents = React.useMemo(
    () =>
      filteredEvents.filter((event) => {
        const normalized = `${event.code} ${event.description}`.toLowerCase();
        return event.recordType.toLowerCase().includes('document') && (normalized.includes('view') || normalized.includes('access') || normalized.includes('open') || normalized.includes('export'));
      }),
    [filteredEvents],
  );

  const aiAcceptedCount = React.useMemo(
    () => filteredEvents.filter((event) => String(event.payload.resolution_type ?? '').toLowerCase() === 'ai_accepted').length,
    [filteredEvents],
  );

  const verifiedAgoLabel = React.useMemo(() => {
    if (!chainCheckedAt) return 'just now';
    const diffMinutes = Math.max(0, Math.floor((Date.now() - chainCheckedAt.getTime()) / 60_000));
    return `${diffMinutes} min ago`;
  }, [chainCheckedAt]);

  const handleExport = React.useCallback(async () => {
    if (!dealId) return;
    setExporting(true);

    const { data, error } = await supabase.functions.invoke('export-audit-chain', {
      body: { deal_id: dealId },
    });

    if (error) {
      toast.error(error.message || 'Failed to export audit chain');
      setExporting(false);
      return;
    }

    const exportDate = new Date().toISOString().slice(0, 10);
    const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    const jsonLink = document.createElement('a');
    jsonLink.href = jsonUrl;
    jsonLink.download = `deal-${dealId}-audit-${exportDate}.json`;
    document.body.appendChild(jsonLink);
    jsonLink.click();
    document.body.removeChild(jsonLink);
    URL.revokeObjectURL(jsonUrl);

    const doc = new jsPDF({ orientation: 'portrait' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 18;
    const writeFooter = () => {
      doc.setFontSize(9);
      doc.text('This audit chain can be independently verified at verify.pivt.tools', pageWidth / 2, pageHeight - 10, { align: 'center' });
    };
    const addRow = (label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 58, y);
      y += 8;
    };

    doc.setFontSize(18);
    doc.text('PIVT Audit Console — Regulator Export', 14, y);
    y += 10;
    doc.setFontSize(11);
    addRow('Deal ID', dealId);
    addRow('Deal name', realDeal?.deal_name ?? 'Current deal');
    addRow('Total events', String((data?.events ?? []).length));
    addRow('Date range', `${data?.verification_summary?.first_event_at ?? '—'} to ${data?.verification_summary?.last_event_at ?? '—'}`);
    addRow('Participants', participants.map((participant) => participant.label).join(', ') || '—');
    addRow('Chain root hash', data?.chain_root_hash ?? '—');
    addRow('Verification', data?.verification_summary?.valid ? 'Chain intact' : 'Verification failed');
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.text('Verification instructions', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    const instructionLines = doc.splitTextToSize(String(data?.verification_instructions ?? '—'), pageWidth - 28);
    doc.text(instructionLines, 14, y);
    y += instructionLines.length * 6 + 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Event summary', 14, y);
    y += 8;
    doc.setFont('helvetica', 'normal');

    const exportEvents = (data?.events ?? []) as Array<Record<string, unknown>>;
    exportEvents.slice(0, 30).forEach((event, index) => {
      if (y > pageHeight - 24) {
        writeFooter();
        doc.addPage();
        y = 18;
      }
      const line = `${index + 1}. ${stringify(event.event_type ?? event.action)} — ${stringify(event.created_at)}`;
      const wrapped = doc.splitTextToSize(line, pageWidth - 28);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 5 + 3;
    });

    writeFooter();
    doc.save(`deal-${dealId}-audit-${exportDate}.pdf`);
    toast.success('Regulator export ready');
    setExporting(false);
  }, [dealId, participants, realDeal?.deal_name]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading audit console…
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 border-primary/20 bg-primary/5 text-primary">
                <Sparkles className="h-3 w-3" /> Compliance feature
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Audit Console</h2>
              <p className="text-sm text-muted-foreground">
                Full deal audit trail, attributable document access, chain verification, and regulator-ready exports.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {chainError || chainStatus?.valid === false ? (
              <div className="flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
                <ShieldAlert className="h-4 w-4" /> ⚠ Chain integrity check failed
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-validated/20 bg-validated/10 px-3 py-1.5 text-sm text-validated">
                {verifyingChain ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                ✓ Chain intact — verified {verifiedAgoLabel}
              </div>
            )}

            <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Regulator Export
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Timeline events</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{filteredEvents.length}</p>
            <p className="text-xs text-muted-foreground">Latest first across audit events, logs, and field corrections</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">AI actions</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{filteredEvents.filter((event) => event.category === 'ai').length}</p>
            <p className="text-xs text-muted-foreground">{aiAcceptedCount} AI-accepted corrections in current filter scope</p>
          </div>
          <div className="rounded-xl border border-border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Document access</p>
            <p className="mt-2 text-2xl font-semibold text-foreground">{whoSawWhatEvents.length}</p>
            <p className="text-xs text-muted-foreground">Buyer access to sensitive documents is logged and attributable</p>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr,1fr,0.9fr,0.9fr]">
          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground"><Filter className="h-3.5 w-3.5" /> Event category</span>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categorySelectOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground"><User className="h-3.5 w-3.5" /> Actor</span>
            <select className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
              <option value="all">All deal participants</option>
              {participants.map((participant) => (
                <option key={participant.userId} value={participant.userId}>{participant.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> From</span>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>

          <label className="space-y-1 text-sm">
            <span className="flex items-center gap-1 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" /> To</span>
            <input className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
        </div>
      </div>

      {(chainError || chainStatus?.valid === false) && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {chainError ?? `Mismatch detected at sequence ${chainStatus?.broken_at_sequence ?? 'unknown'}.`}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AuditConsoleTab)}>
        <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40">
          <TabsTrigger value="timeline">Event timeline</TabsTrigger>
          <TabsTrigger value="who-saw-what">Who saw what</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <p className="text-base font-medium text-foreground">No audit events match the current filters</p>
              <p className="mt-1 text-sm text-muted-foreground">Adjust the category, actor, or date range to broaden the compliance timeline.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredEvents.map((event) => {
                const isExpanded = expandedId === event.id;
                return (
                  <div key={event.id} className={`overflow-hidden rounded-2xl border border-border bg-card border-l-4 ${categoryStyles[event.category]}`}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-4 px-5 py-4 text-left"
                      onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/40 text-xs font-semibold text-foreground">
                        {initialsFor(event.actorName)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</span>
                          <Badge variant="outline" className="text-[10px]">{categoryLabels[event.category]}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">{event.actorName}</span>
                          <span>{event.actorRole}</span>
                        </div>
                        <p className="text-sm text-foreground">{event.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <button type="button" className="rounded-md bg-muted px-2 py-1 hover:bg-muted/80" onClick={(e) => { e.stopPropagation(); navigateToRecord(event.recordType); }}>
                            {event.recordLabel}
                          </button>
                          <span>{event.code}</span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground" /> : <ChevronRight className="mt-1 h-4 w-4 text-muted-foreground" />}
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-border bg-muted/10 px-5 py-4">
                        <pre className="overflow-x-auto rounded-xl bg-muted/40 p-4 text-xs text-foreground">
                          {JSON.stringify(event.payload, null, 2)}
                        </pre>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="who-saw-what">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document name</TableHead>
                  <TableHead>Who accessed it</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>From which IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {whoSawWhatEvents.length > 0 ? (
                  whoSawWhatEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium text-foreground">{event.recordLabel}</TableCell>
                      <TableCell>{event.actorName}</TableCell>
                      <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{event.ipAddress ?? 'Not captured'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                      No document access events match the current filter set yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Eye className="mt-0.5 h-4 w-4 text-accent" />
              <p>
                Prospects can see that sensitive document access is attributable to a specific participant, time, and network footprint whenever those fields are present in the audit payload.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
};