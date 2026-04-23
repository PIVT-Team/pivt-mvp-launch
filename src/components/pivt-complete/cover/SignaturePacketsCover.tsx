/**
 * SignaturePacketsCover — Closing-binder signature packets.
 *
 * Matches the existing PIVT card grid + status badge language used by
 * ClosingChecklistCover and ConditionsPrecedentCover. No new colors or shadows.
 *
 * Capabilities:
 *  - "Generate Signature Packets from Agreements" AI button
 *  - List of packets in card/grid format mirroring deal cards
 *  - DocuSign send + status polling with live badges
 *  - Auto-link to checklist items / CPs (DB trigger marks them satisfied on completion)
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  CheckCircle2, Circle, Clock, FileSignature, Loader2, Mail, RefreshCcw, Send,
  Sparkles, XCircle, Eye, Link2, Ban, FileText, Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { usePIVTStore } from '@/stores/pivtStore';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ApprovalRow = Tables<'deal_approvals'> & {
  packet_name?: string | null;
  packet_type?: string | null;
  source_document_id?: string | null;
  linked_checklist_item_id?: string | null;
  linked_condition_id?: string | null;
  ai_generated?: boolean | null;
  ai_confidence?: number | null;
};
type ChecklistRow = Tables<'closing_checklist_items'>;
type ConditionRow = Tables<'conditions'>;

type PacketStatus =
  | 'draft' | 'sent' | 'viewed' | 'completed' | 'declined' | 'expired';

const STATUS_META: Record<PacketStatus, { label: string; badge: string; icon: React.ElementType }> = {
  draft:     { label: 'Draft',     badge: 'bg-muted text-muted-foreground border-transparent',  icon: Circle },
  sent:      { label: 'Sent',      badge: 'bg-accent/10 text-accent border-accent/20',          icon: Send },
  viewed:    { label: 'Viewed',    badge: 'bg-accent/10 text-accent border-accent/20',          icon: Eye },
  completed: { label: 'Completed', badge: 'bg-validated/10 text-validated border-validated/20', icon: CheckCircle2 },
  declined:  { label: 'Declined',  badge: 'bg-blocking/10 text-blocking border-blocking/20',    icon: XCircle },
  expired:   { label: 'Expired',   badge: 'bg-blocking/10 text-blocking border-blocking/20',    icon: Ban },
};

const DEMO_ID_MAP: Record<string, string> = {
  atlas:  'a0000000-0000-0000-0000-000000000001',
  beacon: 'b0000000-0000-0000-0000-000000000002',
  cipher: 'c0000000-0000-0000-0000-000000000003',
};

const TERMINAL_STATUSES: PacketStatus[] = ['completed', 'declined', 'expired'];

const isUuid = (s: string | null | undefined): s is string =>
  !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export const SignaturePacketsCover: React.FC = () => {
  const { selectedDealId } = usePIVTStore();
  const { user } = useAuth();

  const dealId = useMemo(() => {
    if (!selectedDealId) return null;
    return DEMO_ID_MAP[selectedDealId] ?? (isUuid(selectedDealId) ? selectedDealId : null);
  }, [selectedDealId]);

  const [packets, setPackets] = useState<ApprovalRow[]>([]);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [pollingId, setPollingId] = useState<string | null>(null);
  const [linkPacket, setLinkPacket] = useState<ApprovalRow | null>(null);

  // ── Load + realtime ──
  const load = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    const [pktRes, chkRes, condRes] = await Promise.all([
      supabase
        .from('deal_approvals')
        .select('*')
        .eq('deal_id', dealId)
        .not('packet_name', 'is', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('closing_checklist_items')
        .select('id, title, status, deal_id')
        .eq('deal_id', dealId),
      supabase
        .from('conditions')
        .select('id, title, status, deal_id')
        .eq('deal_id', dealId),
    ]);
    if (pktRes.data) setPackets(pktRes.data as ApprovalRow[]);
    if (chkRes.data) setChecklist(chkRes.data as ChecklistRow[]);
    if (condRes.data) setConditions(condRes.data as ConditionRow[]);
    setLoading(false);
  }, [dealId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!dealId) return;
    const ch = supabase
      .channel(`sig-packets-${dealId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'deal_approvals', filter: `deal_id=eq.${dealId}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [dealId, load]);

  // ── Stats ──
  const stats = useMemo(() => {
    const total = packets.length;
    const completed = packets.filter(p => p.status === 'completed').length;
    const inFlight = packets.filter(p => ['sent', 'viewed'].includes(p.status as string)).length;
    const blocked  = packets.filter(p => ['declined', 'expired'].includes(p.status as string)).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inFlight, blocked, pct };
  }, [packets]);

  // ── AI Generation ──
  const handleGenerate = async () => {
    if (!dealId) {
      toast.error('Select a deal first');
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-signature-packets', {
        body: { deal_id: dealId, user_id: user?.id },
      });
      if (error) throw error;
      toast.success(`Generated ${data?.inserted ?? 0} signature packets`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Manual add ──
  const handleAddBlank = async () => {
    if (!dealId) return;
    const { error } = await supabase.from('deal_approvals').insert({
      deal_id: dealId,
      user_id: user?.id ?? null,
      approval_side: 'buyer',
      packet_name: 'Untitled Signature Packet',
      packet_type: 'agreement',
      status: 'draft',
      required: true,
      delivery_method: 'docusign',
      ai_generated: false,
    } as any);
    if (error) toast.error(error.message); else load();
  };

  // ── DocuSign send ──
  const handleSend = async (p: ApprovalRow) => {
    if (!p.approver_email || !p.approver_name) {
      toast.error('Add approver name & email before sending');
      return;
    }
    setSendingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke('docusign-envelope', {
        body: {
          action: 'send_envelope',
          user_id: user?.id,
          deal_id: dealId,
          approval_id: p.id,
          approver_name: p.approver_name,
          approver_email: p.approver_email,
          message: `Please sign: ${p.packet_name}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Envelope sent to ${p.approver_name}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setSendingId(null);
    }
  };

  const handlePoll = async (p: ApprovalRow) => {
    setPollingId(p.id);
    try {
      const { data, error } = await supabase.functions.invoke('docusign-envelope', {
        body: { action: 'check_status', user_id: user?.id, approval_id: p.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Status: ${data?.status ?? 'unchanged'}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Status check failed');
    } finally {
      setPollingId(null);
    }
  };

  const updatePacket = async (id: string, patch: Partial<ApprovalRow>) => {
    const { error } = await supabase.from('deal_approvals').update(patch as any).eq('id', id);
    if (error) toast.error(error.message);
  };

  // ── Background polling for in-flight envelopes (every 30s) ──
  useEffect(() => {
    const inFlight = packets.filter(p => ['sent', 'viewed'].includes(p.status as string) && p.envelope_id);
    if (inFlight.length === 0) return;
    const t = setInterval(() => {
      inFlight.forEach((p) => {
        supabase.functions.invoke('docusign-envelope', {
          body: { action: 'check_status', user_id: user?.id, approval_id: p.id },
        }).catch(() => { /* silent */ });
      });
    }, 30000);
    return () => clearInterval(t);
  }, [packets, user?.id]);

  if (!dealId) {
    return (
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Signature Packets</h1>
          <p className="text-sm text-muted-foreground mt-1">Select a deal to manage signature packets.</p>
        </header>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-accent" />
            Signature Packets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Closing-binder execution. Auto-updates checklist items and conditions on completion.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleAddBlank} className="h-8 text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Packet
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="h-8 text-xs gap-1.5 text-white"
            style={{ background: 'var(--pivt-gradient-primary)' }}
          >
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate from Agreements
          </Button>
        </div>
      </header>

      {/* Progress */}
      <div className="rounded-lg border border-border/40 bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground/60">Execution Readiness</span>
            <Badge variant="outline" className="text-[10px]">
              {stats.completed}/{stats.total} signed
            </Badge>
          </div>
          <span className="text-2xl font-semibold tabular-nums">{stats.pct}%</span>
        </div>
        <Progress value={stats.pct} className="h-1.5" />
        <div className="flex items-center gap-4 mt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-validated" /> {stats.completed} completed</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-accent" /> {stats.inFlight} in-flight</span>
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blocking" /> {stats.blocked} blocked</span>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading packets…
        </div>
      ) : packets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/40 bg-card/50 p-12 text-center">
          <FileSignature className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">No signature packets yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Generate them from the executed purchase agreement, or add manually.
          </p>
          <Button size="sm" onClick={handleGenerate} disabled={generating} className="text-xs gap-1.5 text-white"
            style={{ background: 'var(--pivt-gradient-primary)' }}>
            {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Generate from Agreements
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AnimatePresence>
            {packets.map((p) => (
              <PacketCard
                key={p.id}
                packet={p}
                checklist={checklist}
                conditions={conditions}
                sending={sendingId === p.id}
                polling={pollingId === p.id}
                onSend={() => handleSend(p)}
                onPoll={() => handlePoll(p)}
                onUpdate={(patch) => updatePacket(p.id, patch)}
                onLink={() => setLinkPacket(p)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <LinkDialog
        packet={linkPacket}
        checklist={checklist}
        conditions={conditions}
        onClose={() => setLinkPacket(null)}
        onSave={async (patch) => {
          if (!linkPacket) return;
          await updatePacket(linkPacket.id, patch);
          setLinkPacket(null);
          load();
        }}
      />
    </div>
  );
};

// ───────────────────────────── Card ─────────────────────────────
interface CardProps {
  packet: ApprovalRow;
  checklist: ChecklistRow[];
  conditions: ConditionRow[];
  sending: boolean;
  polling: boolean;
  onSend: () => void;
  onPoll: () => void;
  onUpdate: (patch: Partial<ApprovalRow>) => void;
  onLink: () => void;
}

const PacketCard: React.FC<CardProps> = ({
  packet, checklist, conditions, sending, polling, onSend, onPoll, onUpdate, onLink,
}) => {
  const status = (packet.status ?? 'draft') as PacketStatus;
  const meta = STATUS_META[status] ?? STATUS_META.draft;
  const Icon = meta.icon;

  const linkedChecklist = checklist.find(c => c.id === packet.linked_checklist_item_id);
  const linkedCondition = conditions.find(c => c.id === packet.linked_condition_id);

  const isTerminal = TERMINAL_STATUSES.includes(status);
  const canEditMeta = status === 'draft';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="rounded-lg border border-border/40 bg-card p-4 hover:border-border/70 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          {canEditMeta ? (
            <Input
              value={packet.packet_name ?? ''}
              onChange={(e) => onUpdate({ packet_name: e.target.value })}
              placeholder="Packet name"
              className="h-7 text-sm font-medium border-transparent hover:border-border/40 focus:border-border px-1 -mx-1 bg-transparent"
            />
          ) : (
            <h3 className="text-sm font-medium truncate">{packet.packet_name ?? 'Untitled'}</h3>
          )}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {packet.packet_type ?? 'agreement'}
            </span>
            {packet.ai_generated && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1 border-accent/30 text-accent">
                <Sparkles className="w-2.5 h-2.5" /> AI
                {typeof packet.ai_confidence === 'number' && ` ${Math.round(packet.ai_confidence * 100)}%`}
              </Badge>
            )}
          </div>
        </div>
        <Badge className={cn('text-[10px] h-5 gap-1 border', meta.badge)}>
          <Icon className="w-2.5 h-2.5" />
          {meta.label}
        </Badge>
      </div>

      {/* Approver */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Input
          value={packet.approver_name ?? ''}
          onChange={(e) => onUpdate({ approver_name: e.target.value })}
          placeholder="Approver name"
          disabled={!canEditMeta}
          className="h-7 text-xs"
        />
        <Input
          value={packet.approver_email ?? ''}
          onChange={(e) => onUpdate({ approver_email: e.target.value })}
          placeholder="email@example.com"
          disabled={!canEditMeta}
          className="h-7 text-xs"
        />
      </div>

      {/* Linked items */}
      {(linkedChecklist || linkedCondition) && (
        <div className="flex items-center gap-1.5 flex-wrap mb-3">
          {linkedChecklist && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Link2 className="w-2.5 h-2.5" /> Checklist: {linkedChecklist.title}
            </Badge>
          )}
          {linkedCondition && (
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Link2 className="w-2.5 h-2.5" /> CP: {linkedCondition.title}
            </Badge>
          )}
        </div>
      )}

      {/* Status timestamps */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 mb-3">
        {packet.sent_at && <span>Sent {formatDistanceToNow(new Date(packet.sent_at), { addSuffix: true })}</span>}
        {packet.viewed_at && <span>· Viewed {formatDistanceToNow(new Date(packet.viewed_at), { addSuffix: true })}</span>}
        {packet.completed_at && <span>· Signed {formatDistanceToNow(new Date(packet.completed_at), { addSuffix: true })}</span>}
        {!packet.sent_at && <span>Created {formatDistanceToNow(new Date(packet.created_at), { addSuffix: true })}</span>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 pt-3 border-t border-border/30">
        {status === 'draft' ? (
          <Button size="sm" onClick={onSend} disabled={sending} className="h-7 text-xs gap-1 text-white"
            style={{ background: 'var(--pivt-gradient-primary)' }}>
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            Send via DocuSign
          </Button>
        ) : !isTerminal ? (
          <Button size="sm" variant="outline" onClick={onPoll} disabled={polling} className="h-7 text-xs gap-1">
            {polling ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
            Refresh status
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Final
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={onLink} className="h-7 text-xs gap-1 ml-auto">
          <Link2 className="w-3 h-3" /> Link
        </Button>
      </div>
    </motion.div>
  );
};

// ───────────────────────────── Link Dialog ─────────────────────────────
interface LinkProps {
  packet: ApprovalRow | null;
  checklist: ChecklistRow[];
  conditions: ConditionRow[];
  onClose: () => void;
  onSave: (patch: Partial<ApprovalRow>) => void;
}

const LinkDialog: React.FC<LinkProps> = ({ packet, checklist, conditions, onClose, onSave }) => {
  const [chk, setChk] = useState<string | null>(null);
  const [cond, setCond] = useState<string | null>(null);

  useEffect(() => {
    if (packet) {
      setChk(packet.linked_checklist_item_id ?? null);
      setCond(packet.linked_condition_id ?? null);
    }
  }, [packet]);

  if (!packet) return null;

  return (
    <Dialog open={!!packet} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Link packet to workflow</DialogTitle>
          <DialogDescription className="text-xs">
            When this packet is signed, the linked items will auto-mark as satisfied.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1 block">
              Closing checklist item
            </label>
            <Select value={chk ?? '__none'} onValueChange={(v) => setChk(v === '__none' ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none" className="text-xs">None</SelectItem>
                {checklist.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground/70 mb-1 block">
              Condition precedent
            </label>
            <Select value={cond ?? '__none'} onValueChange={(v) => setCond(v === '__none' ? null : v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none" className="text-xs">None</SelectItem>
                {conditions.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose} className="h-8 text-xs">Cancel</Button>
          <Button size="sm" className="h-8 text-xs" onClick={() => onSave({
            linked_checklist_item_id: chk,
            linked_condition_id: cond,
          })}>Save links</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
