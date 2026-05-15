import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  CheckCircle2, Clock, XCircle, Send, Eye, Download, FileSignature,
  AlertTriangle, Shield, PenTool, Plus, Users, Lock, ArrowRight,
  RotateCcw, Ban, ExternalLink, Loader2, Link2, Unlink, RefreshCw,
  ChevronDown, ChevronUp, MoreHorizontal, Mail, Bell, Trash2,
  Info, History, Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Status types ─── */
type RequestStatus =
  | 'not_created' | 'draft' | 'ready_to_send' | 'sent' | 'viewed'
  | 'completed' | 'declined' | 'expired' | 'blocked' | 'not_required'
  | 'failed_delivery' | 'overdue';

type DeliveryMethod = 'docusign' | 'manual' | 'internal';

const STATUS_CONFIG: Record<RequestStatus, { label: string; className: string; icon: React.ElementType }> = {
  not_created:    { label: 'Not Created',     className: 'bg-muted/60 text-muted-foreground',       icon: Clock },
  draft:          { label: 'Draft',           className: 'bg-muted/60 text-muted-foreground',       icon: Clock },
  ready_to_send:  { label: 'Ready to Send',   className: 'bg-blue-500/10 text-blue-500',            icon: Send },
  sent:           { label: 'Sent',            className: 'bg-amber-500/10 text-amber-600',           icon: Send },
  viewed:         { label: 'Viewed',          className: 'bg-amber-500/10 text-amber-600',           icon: Eye },
  completed:      { label: 'Completed',       className: 'bg-emerald-500/10 text-emerald-600',       icon: CheckCircle2 },
  declined:       { label: 'Declined',        className: 'bg-destructive/10 text-destructive',       icon: XCircle },
  expired:        { label: 'Expired',         className: 'bg-destructive/10 text-destructive',       icon: Clock },
  blocked:        { label: 'Blocked',         className: 'bg-destructive/10 text-destructive',       icon: Lock },
  not_required:   { label: 'Not Required',    className: 'bg-muted/40 text-muted-foreground',        icon: Ban },
  failed_delivery:{ label: 'Failed',          className: 'bg-destructive/10 text-destructive',       icon: AlertTriangle },
  overdue:        { label: 'Overdue',         className: 'bg-destructive/10 text-destructive',       icon: AlertTriangle },
};

const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  docusign: 'DocuSign',
  manual: 'Manual',
  internal: 'Internal',
};

/* ─── Approval item ─── */
interface ApprovalItem {
  id: string;
  approver_name: string;
  approver_email: string;
  approver_role: string;
  approval_type: string;
  required: boolean;
  delivery_method: DeliveryMethod;
  request_status: RequestStatus;
  envelope_id: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  completed_at: string | null;
  declined_at: string | null;
  expired_at: string | null;
  signed_document_url: string | null;
  reminder_count: number;
  last_reminder_at: string | null;
  blocker_reason: string | null;
  comment: string;
  created_at: string;
}

interface DocuSignConnection {
  connected: boolean;
  email: string | null;
  account_name: string | null;
  loading: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  details: any;
  created_at: string;
}

/* ─── Map DB status ─── */
const mapDbStatus = (s: string): RequestStatus => {
  const map: Record<string, RequestStatus> = {
    approved: 'completed', rejected: 'declined', pending: 'not_created',
    sent: 'sent', viewed: 'viewed', completed: 'completed',
    declined: 'declined', expired: 'expired', blocked: 'blocked',
    not_required: 'not_required', failed_delivery: 'failed_delivery',
    overdue: 'overdue', draft: 'draft', ready_to_send: 'ready_to_send',
  };
  return map[s] || 'not_created';
};

const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
const formatDateTime = (d: string) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

/* ═══════════════════════════════════════════════ */
export const ApprovalsWorkflowCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { user } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [message, setMessage] = useState('');
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [dsConnection, setDsConnection] = useState<DocuSignConnection>({ connected: false, email: null, account_name: null, loading: true });
  const [connectingDs, setConnectingDs] = useState(false);
  const [newApprover, setNewApprover] = useState({
    name: '', email: '', role: '', type: 'Legal Sign-off',
    delivery_method: 'docusign' as DeliveryMethod, required: true,
  });

  /* ─── Fetch approvals ─── */
  const fetchItems = useCallback(async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('deal_approvals')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at');

    setItems((data || []).map((a: any) => ({
      id: a.id,
      approver_name: a.approver_name || a.approval_side || 'Unknown',
      approver_email: a.approver_email || '',
      approver_role: a.approver_role || a.comment?.replace('Role: ', '') || '',
      approval_type: a.approval_type || 'Legal Sign-off',
      required: a.required ?? true,
      delivery_method: (a.delivery_method as DeliveryMethod) || 'docusign',
      request_status: mapDbStatus(a.status),
      envelope_id: a.envelope_id || null,
      sent_at: a.sent_at || null,
      viewed_at: a.viewed_at || null,
      completed_at: a.completed_at || null,
      declined_at: a.declined_at || null,
      expired_at: a.expired_at || null,
      signed_document_url: a.signed_document_url || null,
      reminder_count: a.reminder_count || 0,
      last_reminder_at: a.last_reminder_at || null,
      blocker_reason: a.blocker_reason || null,
      comment: a.comment || '',
      created_at: a.created_at,
    })));
    setLoading(false);
  }, [dealId]);

  /* ─── Fetch DocuSign connection ─── */
  const fetchDsConnection = useCallback(async () => {
    if (!user?.id) return;
    setDsConnection(prev => ({ ...prev, loading: true }));
    try {
      const { data } = await supabase
        .from('docusign_connections')
        .select('status, email, account_name')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .maybeSingle();
      setDsConnection({
        connected: !!data,
        email: data?.email || null,
        account_name: data?.account_name || null,
        loading: false,
      });
    } catch {
      setDsConnection({ connected: false, email: null, account_name: null, loading: false });
    }
  }, [user?.id]);

  /* ─── Fetch audit entries ─── */
  const fetchAuditEntries = useCallback(async () => {
    if (!dealId) return;
    const { data } = await supabase
      .from('audit_log')
      .select('id, action, details, created_at')
      .eq('deal_id', dealId)
      .like('action', 'approval_%')
      .order('created_at', { ascending: false })
      .limit(20);
    setAuditEntries(data || []);
  }, [dealId]);

  useEffect(() => { fetchItems(); fetchDsConnection(); fetchAuditEntries(); }, [fetchItems, fetchDsConnection, fetchAuditEntries]);

  /* ─── Derived stats ─── */
  const requiredItems = items.filter(i => i.required && i.request_status !== 'not_required');
  const completedCount = requiredItems.filter(i => i.request_status === 'completed').length;
  const sentCount = items.filter(i => ['sent', 'viewed'].includes(i.request_status)).length;
  const pendingCount = requiredItems.filter(i => !['completed', 'not_required'].includes(i.request_status)).length;
  const declinedCount = items.filter(i => i.request_status === 'declined').length;
  const blockedCount = items.filter(i => ['blocked', 'expired', 'failed_delivery'].includes(i.request_status)).length;
  const overdueCount = items.filter(i => i.request_status === 'overdue').length;
  const totalRequired = requiredItems.length;
  const allComplete = totalRequired > 0 && completedCount === totalRequired;
  const executionReady = allComplete && declinedCount === 0 && blockedCount === 0;

  /* ─── Banner ─── */
  const getBannerConfig = () => {
    if (totalRequired === 0) return { icon: Clock, text: 'No required approvals configured. Add approvers to begin the workflow.', className: 'border-border/30 bg-muted/20 text-muted-foreground' };
    if (executionReady) return { icon: CheckCircle2, text: 'Ready for execution: all required approvals are complete.', className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' };
    if (declinedCount > 0) return { icon: XCircle, text: `Execution blocked: ${declinedCount} required approval${declinedCount > 1 ? 's' : ''} declined.`, className: 'border-destructive/30 bg-destructive/5 text-destructive' };
    if (blockedCount > 0) return { icon: Lock, text: `Execution blocked: ${blockedCount} approval${blockedCount > 1 ? 's' : ''} blocked or expired.`, className: 'border-destructive/30 bg-destructive/5 text-destructive' };
    const unsent = requiredItems.filter(i => ['not_created', 'draft', 'ready_to_send'].includes(i.request_status)).length;
    if (unsent > 0) return { icon: AlertTriangle, text: `Execution blocked: ${unsent} approval request${unsent > 1 ? 's' : ''} not yet sent.`, className: 'border-amber-500/30 bg-amber-500/5 text-amber-600' };
    return { icon: AlertTriangle, text: `Execution blocked: ${pendingCount} required approval${pendingCount > 1 ? 's' : ''} still pending.`, className: 'border-amber-500/30 bg-amber-500/5 text-amber-600' };
  };
  const banner = getBannerConfig();
  const BannerIcon = banner.icon;

  /* ─── DocuSign Actions ─── */
  const handleConnectDocuSign = async () => {
    setConnectingDs(true);
    try {
      const { data, error } = await supabase.functions.invoke('docusign-oauth', {
        body: { action: 'get_auth_url', user_id: user?.id },
      });
      if (error || !data?.auth_url) {
        toast.error(data?.error || 'Failed to get DocuSign auth URL. Please ensure DocuSign credentials are configured.');
        return;
      }
      // Open OAuth popup
      const popup = window.open(data.auth_url, 'docusign_oauth', 'width=600,height=700');
      // Poll for completion
      const interval = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(interval);
          await fetchDsConnection();
          setConnectingDs(false);
        }
      }, 1000);
    } catch {
      toast.error('Failed to initiate DocuSign connection');
      setConnectingDs(false);
    }
  };

  const handleDisconnectDocuSign = async () => {
    await supabase.functions.invoke('docusign-oauth', {
      body: { action: 'disconnect', user_id: user?.id },
    });
    setDsConnection({ connected: false, email: null, account_name: null, loading: false });
    toast.success('DocuSign disconnected');
  };

  /* ─── Approval Actions ─── */
  // The deal_approvals table has CHECK (approval_side IN ('buyer', 'seller')).
  // The UI lets the user pick from richer roles like "Seller Counsel" or
  // "Target Signatory" — map those down to the binary side the DB requires.
  const sideFromRole = (role: string): 'buyer' | 'seller' => {
    const r = role.toLowerCase();
    if (r.includes('seller') || r.includes('target')) return 'seller';
    return 'buyer';
  };
  const handleAddApprover = async () => {
    if (!newApprover.name || !dealId || !user?.id) { toast.error('Name is required'); return; }
    const { error } = await supabase.from('deal_approvals').insert({
      deal_id: dealId,
      user_id: user.id,
      approval_side: sideFromRole(newApprover.role),
      approver_name: newApprover.name,
      approver_email: newApprover.email,
      approver_role: newApprover.role,
      approval_type: newApprover.type,
      delivery_method: newApprover.delivery_method,
      required: newApprover.required,
      status: 'pending',
    });
    if (error) {
      // Surface the real DB error so future failures are diagnosable instead
      // of always showing the same opaque toast.
      toast.error(`Failed to add approver: ${error.message}`);
      return;
    }
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id, action: 'approval_created',
      details: { approver_name: newApprover.name, role: newApprover.role, type: newApprover.type },
    });
    setNewApprover({ name: '', email: '', role: '', type: 'Legal Sign-off', delivery_method: 'docusign', required: true });
    setAddDialogOpen(false);
    toast.success('Approver added');
    await fetchItems();
    await fetchAuditEntries();
  };

  const handleSendRequest = (item: ApprovalItem) => {
    if (item.delivery_method === 'docusign' && !dsConnection.connected) {
      toast.error('Connect DocuSign first to send approval requests');
      return;
    }
    setSelectedItem(item);
    setMessage('');
    setSendDialogOpen(true);
  };

  const confirmSend = async () => {
    if (!selectedItem || !dealId || !user?.id) return;

    if (selectedItem.delivery_method === 'docusign' && dsConnection.connected) {
      // Send via DocuSign edge function
      const { data, error } = await supabase.functions.invoke('docusign-envelope', {
        body: {
          action: 'send_envelope',
          user_id: user.id,
          deal_id: dealId,
          approval_id: selectedItem.id,
          approver_name: selectedItem.approver_name,
          approver_email: selectedItem.approver_email,
          message,
        },
      });
      if (error || data?.error) {
        toast.error(data?.error || 'Failed to send DocuSign envelope');
        // Update status to failed
        await supabase.from('deal_approvals').update({ status: 'failed_delivery' as any }).eq('id', selectedItem.id);
        await fetchItems();
        setSendDialogOpen(false);
        return;
      }
      toast.success(`Approval request sent to ${selectedItem.approver_name} via DocuSign`);
    } else {
      // Manual/internal send
      await supabase.from('deal_approvals').update({
        status: 'sent', sent_at: new Date().toISOString(),
      } as any).eq('id', selectedItem.id);
      await supabase.from('audit_log').insert({
        deal_id: dealId, user_id: user.id, action: 'approval_sent',
        details: { approver_name: selectedItem.approver_name, method: selectedItem.delivery_method },
      });
      toast.success(`Approval request sent to ${selectedItem.approver_name}`);
    }
    setSendDialogOpen(false);
    await fetchItems();
    await fetchAuditEntries();
  };

  const handleResend = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    if (item.delivery_method === 'docusign' && dsConnection.connected && item.envelope_id) {
      await supabase.functions.invoke('docusign-envelope', {
        body: { action: 'resend', user_id: user.id, deal_id: dealId, approval_id: item.id, approver_name: item.approver_name },
      });
    } else {
      await supabase.from('deal_approvals').update({
        reminder_count: item.reminder_count + 1,
        last_reminder_at: new Date().toISOString(),
      } as any).eq('id', item.id);
      await supabase.from('audit_log').insert({
        deal_id: dealId, user_id: user.id, action: 'approval_reminder_sent',
        details: { approver_name: item.approver_name },
      });
    }
    toast.success(`Reminder sent to ${item.approver_name}`);
    await fetchItems();
    await fetchAuditEntries();
  };

  const handleRefreshStatus = async (item: ApprovalItem) => {
    if (!item.envelope_id || !user?.id) return;
    const { data } = await supabase.functions.invoke('docusign-envelope', {
      body: { action: 'check_status', user_id: user.id, deal_id: dealId, approval_id: item.id },
    });
    if (data?.status) {
      toast.success(`Status updated: ${data.status}`);
      await fetchItems();
    }
  };

  const handleMarkNotRequired = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    await supabase.from('deal_approvals').update({ status: 'not_required', required: false } as any).eq('id', item.id);
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id, action: 'approval_marked_not_required',
      details: { approver_name: item.approver_name },
    });
    toast.success(`${item.approver_name} marked as not required`);
    await fetchItems();
    await fetchAuditEntries();
  };

  const handleDelete = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    await supabase.from('deal_approvals').delete().eq('id', item.id);
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id, action: 'approval_removed',
      details: { approver_name: item.approver_name },
    });
    toast.success('Approver removed');
    await fetchItems();
    await fetchAuditEntries();
  };

  /* ─── Manual approve / decline ───
     The deal owner often needs to record an approval that happened
     out-of-band (verbal sign-off, email, paper signature, etc.) without
     going through the DocuSign pipeline. These two handlers flip the row
     directly. We write the two values the schema's CHECK constraint
     guarantees are valid — 'approved' and 'rejected' — and let
     mapDbStatus() translate them to the UI's 'completed' / 'declined'
     badges. The completion trigger (sync_signature_packet_completion)
     fires only on 'completed', so it stays a no-op here, which is the
     right behavior for a manual record. */
  const handleManualApprove = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('deal_approvals')
      .update({ status: 'approved' as any, completed_at: now } as any)
      .eq('id', item.id);
    if (error) {
      toast.error(`Failed to approve: ${error.message}`);
      return;
    }
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id, action: 'approval_manually_approved',
      details: { approver_name: item.approver_name, role: item.approver_role },
    });
    toast.success(`${item.approver_name} marked approved`);
    await fetchItems();
    await fetchAuditEntries();
  };

  const [declineTarget, setDeclineTarget] = useState<ApprovalItem | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const openDecline = (item: ApprovalItem) => {
    setDeclineTarget(item);
    setDeclineReason('');
  };

  const confirmDecline = async () => {
    if (!declineTarget || !dealId || !user?.id) return;
    if (!declineReason.trim()) {
      toast.error('Provide a reason for declining');
      return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('deal_approvals')
      .update({
        status: 'rejected' as any,
        declined_at: now,
        blocker_reason: declineReason.trim(),
      } as any)
      .eq('id', declineTarget.id);
    if (error) {
      toast.error(`Failed to decline: ${error.message}`);
      return;
    }
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id, action: 'approval_manually_declined',
      details: { approver_name: declineTarget.approver_name, reason: declineReason.trim() },
    });
    toast.success(`${declineTarget.approver_name} marked declined`);
    setDeclineTarget(null);
    setDeclineReason('');
    await fetchItems();
    await fetchAuditEntries();
  };

  const openDetail = (item: ApprovalItem) => {
    setSelectedItem(item);
    setDetailDrawerOpen(true);
  };

  /* ─── Loading ─── */
  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ═══ Header ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ letterSpacing: '-0.03em' }}>
            <FileSignature className="w-5 h-5 text-accent" />
            Approvals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sign-off requests and track completion before execution.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Approver
        </Button>
      </div>

      {/* ═══ DocuSign Integration Card ═══ */}
      <motion.div {...fadeInUp}>
        <Card className="border-border/50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#4C00FF]/10 flex items-center justify-center">
                  <PenTool className="w-5 h-5 text-[#4C00FF]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">DocuSign Integration</p>
                    {dsConnection.loading ? (
                      <Badge variant="outline" className="text-[10px]"><Loader2 className="w-2.5 h-2.5 animate-spin mr-1" />Checking…</Badge>
                    ) : dsConnection.connected ? (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Connected</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground">Not Connected</Badge>
                    )}
                  </div>
                  {dsConnection.connected ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connected as <span className="font-medium text-foreground">{dsConnection.email}</span>
                      {dsConnection.account_name && <span> · {dsConnection.account_name}</span>}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connect DocuSign to send approval requests electronically.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {dsConnection.connected ? (
                  <>
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => window.open('https://app.docusign.com', '_blank')}>
                      <ExternalLink className="w-3 h-3" /> Open DocuSign
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleConnectDocuSign}>
                          <RefreshCw className="w-3.5 h-3.5 mr-2" /> Reconnect Account
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDisconnectDocuSign} className="text-destructive">
                          <Unlink className="w-3.5 h-3.5 mr-2" /> Disconnect
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                ) : (
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={handleConnectDocuSign} disabled={connectingDs}>
                    {connectingDs ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                    Connect DocuSign
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ═══ Readiness Banner ═══ */}
      <motion.div {...fadeInUp} className={`p-4 rounded-xl border flex items-center gap-3 ${banner.className}`}>
        <BannerIcon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{banner.text}</p>
      </motion.div>

      {/* ═══ Summary Cards ═══ */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Required', value: totalRequired, sub: 'approvals needed', icon: Shield, color: '' },
          { label: 'Sent', value: sentCount, sub: 'in transit', icon: Send, color: sentCount > 0 ? 'text-blue-500' : '' },
          { label: 'Completed', value: completedCount, sub: 'signed', icon: CheckCircle2, color: completedCount > 0 ? 'text-emerald-500' : '' },
          { label: 'Pending', value: pendingCount, sub: 'awaiting', icon: Clock, color: pendingCount > 0 ? 'text-amber-500' : '' },
          { label: 'Blocked', value: declinedCount + blockedCount + overdueCount, sub: 'action needed', icon: XCircle, color: (declinedCount + blockedCount) > 0 ? 'text-destructive' : '' },
        ].map(card => (
          <Card key={card.label}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">{card.label}</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-light">{card.value}</div>
              {card.value > 0 && card.color && (
                <div className="flex items-center gap-1 mt-1">
                  <card.icon className={`w-3 h-3 ${card.color}`} />
                  <span className={`text-xs ${card.color}`}>{card.sub}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ Approvers Table ═══ */}
      {items.length > 0 ? (
        <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  {['Approver', 'Role', 'Type', 'Required', 'Method', 'Status', 'Sent', 'Completed', 'Actions'].map(h => (
                    <th key={h} className={`${h === 'Actions' ? 'text-right' : 'text-left'} px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const cfg = STATUS_CONFIG[item.request_status];
                  const StatusIcon = cfg.icon;
                  const canSend = ['not_created', 'draft', 'ready_to_send', 'failed_delivery'].includes(item.request_status);
                  const canResend = ['sent', 'viewed', 'overdue'].includes(item.request_status);
                  const canDelete = ['not_created', 'draft', 'not_required'].includes(item.request_status);

                  return (
                    <tr key={item.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => openDetail(item)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                            {item.approver_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium block">{item.approver_name}</span>
                            {item.approver_email && <span className="text-[10px] text-muted-foreground">{item.approver_email}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.approver_role && <Badge variant="outline" className="text-[10px]">{item.approver_role}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.approval_type}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${item.required ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {item.required ? 'Yes' : 'Optional'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {item.delivery_method === 'docusign' && <PenTool className="w-2.5 h-2.5" />}
                          {item.delivery_method === 'manual' && <Mail className="w-2.5 h-2.5" />}
                          {item.delivery_method === 'internal' && <Shield className="w-2.5 h-2.5" />}
                          {DELIVERY_LABELS[item.delivery_method]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(item.sent_at)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(item.completed_at)}</td>
                      <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                        <div className="inline-flex items-center gap-1">
                          {/* Manual Approve / Decline — available on any row
                              that isn't already completed/declined/not-required.
                              Lets a deal owner record an out-of-band sign-off
                              without forcing the DocuSign flow. */}
                          {!['completed', 'declined', 'not_required'].includes(item.request_status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                                onClick={() => handleManualApprove(item)}
                              >
                                <CheckCircle2 className="w-3 h-3" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px] gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                                onClick={() => openDecline(item)}
                              >
                                <XCircle className="w-3 h-3" /> Decline
                              </Button>
                            </>
                          )}
                          {canSend && (
                            <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => handleSendRequest(item)}>
                              <Send className="w-3 h-3" /> Send
                            </Button>
                          )}
                          {canResend && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleResend(item)}>
                              <Bell className="w-3 h-3" /> Remind
                            </Button>
                          )}
                          {item.request_status === 'completed' && item.signed_document_url && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => window.open(item.signed_document_url!, '_blank')}>
                              <Download className="w-3 h-3" /> Signed
                            </Button>
                          )}
                          {item.request_status === 'declined' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleSendRequest(item)}>
                              <RotateCcw className="w-3 h-3" /> Re-Send
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => openDetail(item)}>
                                <Info className="w-3.5 h-3.5 mr-2" /> View Details
                              </DropdownMenuItem>
                              {item.envelope_id && (
                                <DropdownMenuItem onClick={() => handleRefreshStatus(item)}>
                                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Refresh Status
                                </DropdownMenuItem>
                              )}
                              {item.envelope_id && dsConnection.connected && (
                                <DropdownMenuItem onClick={() => window.open('https://app.docusign.com', '_blank')}>
                                  <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open in DocuSign
                                </DropdownMenuItem>
                              )}
                              {item.required && !['completed', 'not_required'].includes(item.request_status) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleMarkNotRequired(item)}>
                                    <Ban className="w-3.5 h-3.5 mr-2" /> Mark Not Required
                                  </DropdownMenuItem>
                                </>
                              )}
                              {canDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(item)} className="text-destructive">
                                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove Approver
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <div>
            <p className="font-medium">No approvers configured</p>
            <p className="text-sm text-muted-foreground mt-1">Add approvers who need to sign off on this deal before execution can proceed.</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Approver
            </Button>
            {!dsConnection.connected && !dsConnection.loading && (
              <Button variant="outline" onClick={handleConnectDocuSign} className="gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Connect DocuSign
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* ═══ Inline Approval Activity Log ═══ */}
      {items.length > 0 && (
        <motion.div {...fadeInUp}>
          <Card>
            <CardHeader className="pb-3 cursor-pointer" onClick={() => setShowAudit(!showAudit)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Approval Activity
                  {auditEntries.length > 0 && (
                    <Badge variant="outline" className="text-[10px] ml-1">{auditEntries.length}</Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="link" className="text-xs text-muted-foreground gap-1 h-auto p-0" onClick={(e) => {
                    e.stopPropagation();
                    toast.info('Navigate to Compliance → Audit Log to view full approval history.');
                  }}>
                    <ExternalLink className="w-3 h-3" /> Full audit log
                  </Button>
                  {showAudit ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>
            {showAudit && (
              <CardContent className="pt-0">
                {auditEntries.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {auditEntries.map(entry => (
                      <div key={entry.id} className="flex items-start gap-3 text-xs py-2 border-b border-border/20 last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">
                            {entry.action.replace(/_/g, ' ').replace('approval ', '')}
                          </span>
                          {entry.details?.approver_name && (
                            <span className="text-muted-foreground"> · {entry.details.approver_name}</span>
                          )}
                          {entry.details?.source === 'docusign_webhook' && (
                            <Badge variant="outline" className="text-[9px] ml-1.5 py-0">DocuSign</Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground shrink-0">{formatDateTime(entry.created_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No approval activity recorded yet.</p>
                )}
              </CardContent>
            )}
          </Card>
        </motion.div>
      )}

      {/* ═══ Proceed to Execution ═══ */}
      <motion.div {...fadeInUp} className="pivt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Proceed to Execution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {executionReady
                ? 'All required approvals are complete. You may proceed.'
                : totalRequired === 0
                  ? 'Add required approvers before proceeding to execution.'
                  : pendingCount > 0
                    ? `${pendingCount} approval${pendingCount !== 1 ? 's' : ''} remaining before execution can begin.`
                    : declinedCount > 0
                      ? `${declinedCount} approval${declinedCount > 1 ? 's' : ''} declined. Re-send or resolve before proceeding.`
                      : 'Resolve all blockers before proceeding.'}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button disabled={!executionReady} className="gap-2" onClick={() => toast.success('Proceeding to Execution…')}>
                    {executionReady ? <ArrowRight className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    Proceed to Execution
                  </Button>
                </span>
              </TooltipTrigger>
              {!executionReady && (
                <TooltipContent side="top">
                  <p className="text-xs max-w-[220px]">
                    {totalRequired === 0 ? 'No approvers configured.' :
                     declinedCount > 0 ? `${declinedCount} declined — re-send or resolve.` :
                     `${pendingCount} required approval${pendingCount > 1 ? 's' : ''} pending.`}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>

      {/* ═══ Detail Drawer ═══ */}
      <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
                    {selectedItem.approver_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  {selectedItem.approver_name}
                </SheetTitle>
                <SheetDescription>{selectedItem.approver_role || 'Approver'} · {selectedItem.approval_type}</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status */}
                <div>
                  <Label className="text-xs text-muted-foreground">Current Status</Label>
                  <div className="mt-1.5">
                    {(() => { const cfg = STATUS_CONFIG[selectedItem.request_status]; const I = cfg.icon; return (
                      <span className={`inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full ${cfg.className}`}>
                        <I className="w-3.5 h-3.5" /> {cfg.label}
                      </span>
                    ); })()}
                  </div>
                </div>

                <Separator />

                {/* Detail fields */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Email', value: selectedItem.approver_email || '—' },
                    { label: 'Required', value: selectedItem.required ? 'Yes' : 'Optional' },
                    { label: 'Delivery Method', value: DELIVERY_LABELS[selectedItem.delivery_method] },
                    { label: 'Approval Type', value: selectedItem.approval_type },
                    { label: 'Date Sent', value: formatDate(selectedItem.sent_at) },
                    { label: 'Date Viewed', value: formatDate(selectedItem.viewed_at) },
                    { label: 'Date Completed', value: formatDate(selectedItem.completed_at) },
                    { label: 'Date Declined', value: formatDate(selectedItem.declined_at) },
                    { label: 'Reminders Sent', value: String(selectedItem.reminder_count) },
                    { label: 'Last Reminder', value: formatDate(selectedItem.last_reminder_at) },
                  ].map(f => (
                    <div key={f.label}>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.label}</Label>
                      <p className="text-sm mt-0.5">{f.value}</p>
                    </div>
                  ))}
                </div>

                {/* DocuSign info */}
                {selectedItem.envelope_id && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">DocuSign Reference</Label>
                      <div className="mt-1.5 p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-mono text-muted-foreground break-all">{selectedItem.envelope_id}</p>
                        <div className="flex gap-2 mt-2">
                          <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleRefreshStatus(selectedItem)}>
                            <RefreshCw className="w-3 h-3" /> Refresh Status
                          </Button>
                          {dsConnection.connected && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => window.open('https://app.docusign.com', '_blank')}>
                              <ExternalLink className="w-3 h-3" /> Open in DocuSign
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {selectedItem.blocker_reason && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-xs text-muted-foreground">Blocker Reason</Label>
                      <p className="text-sm mt-1.5 text-destructive">{selectedItem.blocker_reason}</p>
                    </div>
                  </>
                )}

                {/* Actions */}
                <Separator />
                <div className="flex flex-wrap gap-2">
                  {['not_created', 'draft', 'ready_to_send', 'failed_delivery'].includes(selectedItem.request_status) && (
                    <Button size="sm" className="gap-1" onClick={() => { setDetailDrawerOpen(false); handleSendRequest(selectedItem); }}>
                      <Send className="w-3 h-3" /> Send Request
                    </Button>
                  )}
                  {['sent', 'viewed', 'overdue'].includes(selectedItem.request_status) && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleResend(selectedItem)}>
                        <RotateCcw className="w-3 h-3" /> Re-send
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => handleResend(selectedItem)}>
                        <Bell className="w-3 h-3" /> Send Reminder
                      </Button>
                    </>
                  )}
                  {selectedItem.request_status === 'declined' && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => { setDetailDrawerOpen(false); handleSendRequest(selectedItem); }}>
                      <RotateCcw className="w-3 h-3" /> Re-Send
                    </Button>
                  )}
                  {selectedItem.required && !['completed', 'not_required'].includes(selectedItem.request_status) && (
                    <Button size="sm" variant="ghost" className="gap-1 text-muted-foreground" onClick={() => { handleMarkNotRequired(selectedItem); setDetailDrawerOpen(false); }}>
                      <Ban className="w-3 h-3" /> Mark Optional
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Send Dialog ═══ */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" /> Send Approval Request
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.delivery_method === 'docusign' && dsConnection.connected
                ? `Send via DocuSign to ${selectedItem?.approver_name} (${selectedItem?.approver_email || 'no email'})`
                : `Send approval request to ${selectedItem?.approver_name}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedItem?.delivery_method === 'docusign' && !dsConnection.connected && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <p className="text-xs text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  DocuSign not connected. Request will be recorded but not sent electronically.
                </p>
              </div>
            )}
            {selectedItem?.delivery_method === 'docusign' && dsConnection.connected && !selectedItem?.approver_email && (
              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <p className="text-xs text-amber-600 flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  No email address configured for this approver. Add an email to send via DocuSign.
                </p>
              </div>
            )}
            <div>
              <Label className="text-xs text-muted-foreground">Message (optional)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a personal note…" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSend} className="gap-1">
              {selectedItem?.delivery_method === 'docusign' && dsConnection.connected ? (
                <><PenTool className="w-3 h-3" /> Send via DocuSign</>
              ) : (
                <><Send className="w-3 h-3" /> Send Request</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Add Approver Dialog ═══ */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" /> Add Approver
            </DialogTitle>
            <DialogDescription>Add a signatory required for deal execution.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Approver Name *</Label>
                <Input className="mt-1.5" value={newApprover.name} onChange={e => setNewApprover(p => ({ ...p, name: e.target.value }))} placeholder="e.g. James Morrison" />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input className="mt-1.5" type="email" value={newApprover.email} onChange={e => setNewApprover(p => ({ ...p, email: e.target.value }))} placeholder="james@firm.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Role</Label>
                <Select value={newApprover.role} onValueChange={v => setNewApprover(p => ({ ...p, role: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select role…" /></SelectTrigger>
                  <SelectContent>
                    {['Buyer Counsel', 'Seller Counsel', 'Buyer Signatory', 'Seller Signatory', 'Target Signatory', 'Escrow Agent', 'Paying Agent', 'Board Member', 'Compliance Officer', 'Deal Lead', 'Finance Approver'].map(r => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Approval Type</Label>
                <Select value={newApprover.type} onValueChange={v => setNewApprover(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['Legal Sign-off', 'Finance Approval', 'Board Approval', 'Wire Release Authorization', 'Closing Approval', 'Internal Review'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Delivery Method</Label>
                <Select value={newApprover.delivery_method} onValueChange={v => setNewApprover(p => ({ ...p, delivery_method: v as DeliveryMethod }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="docusign">DocuSign</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="internal">Internal PIVT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3 pb-1">
                <div className="flex items-center gap-2">
                  <Switch checked={newApprover.required} onCheckedChange={v => setNewApprover(p => ({ ...p, required: v }))} />
                  <Label className="text-xs">Required for execution</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddApprover}>Add Approver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decline reason dialog. Reason is required so audit trail captures
          why this approver declined — gets surfaced on the row's blocker
          tooltip and feeds the execution-blocker count. */}
      <Dialog open={!!declineTarget} onOpenChange={(open) => { if (!open) { setDeclineTarget(null); setDeclineReason(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline approval — {declineTarget?.approver_name}</DialogTitle>
            <DialogDescription>
              Record this approver as having declined. Provide a reason so
              the deal team knows why this approval was blocked.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="e.g. Could not confirm fund flow; needs revised SPA section 4.2"
            rows={4}
            className="bg-muted/40"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeclineTarget(null); setDeclineReason(''); }}>Cancel</Button>
            <Button
              onClick={confirmDecline}
              disabled={!declineReason.trim()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Decline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
