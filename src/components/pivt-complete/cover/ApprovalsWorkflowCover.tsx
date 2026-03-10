import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  CheckCircle2, Clock, XCircle, Send, Eye, Download, FileSignature,
  AlertTriangle, Shield, PenTool, Plus, Users, Lock, ArrowRight,
  RotateCcw, Ban, ExternalLink, Loader2,
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
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

/* ── Status types ── */
type RequestStatus =
  | 'not_created'
  | 'draft'
  | 'ready_to_send'
  | 'sent'
  | 'viewed'
  | 'completed'
  | 'declined'
  | 'expired'
  | 'blocked'
  | 'not_required';

type WorkflowStatus = 'not_started' | 'in_progress' | 'ready_for_execution' | 'complete';

const STATUS_CONFIG: Record<RequestStatus, { label: string; className: string; icon: React.ElementType }> = {
  not_created:   { label: 'Not Created',   className: 'bg-muted/60 text-muted-foreground',       icon: Clock },
  draft:         { label: 'Draft',         className: 'bg-muted/60 text-muted-foreground',       icon: Clock },
  ready_to_send: { label: 'Ready to Send', className: 'bg-blue-500/10 text-blue-500',            icon: Send },
  sent:          { label: 'Sent',          className: 'bg-amber-500/10 text-amber-600',           icon: Send },
  viewed:        { label: 'Viewed',        className: 'bg-amber-500/10 text-amber-600',           icon: Eye },
  completed:     { label: 'Completed',     className: 'bg-emerald-500/10 text-emerald-600',       icon: CheckCircle2 },
  declined:      { label: 'Declined',      className: 'bg-destructive/10 text-destructive',       icon: XCircle },
  expired:       { label: 'Expired',       className: 'bg-destructive/10 text-destructive',       icon: Clock },
  blocked:       { label: 'Blocked',       className: 'bg-destructive/10 text-destructive',       icon: Lock },
  not_required:  { label: 'Not Required',  className: 'bg-muted/40 text-muted-foreground',        icon: Ban },
};

/* ── Approval item shape ── */
interface ApprovalItem {
  id: string;
  approver_name: string;
  approver_role: string;
  approval_type: string;
  related_document: string;
  required: boolean;
  provider: string;
  request_status: RequestStatus;
  sent_at: string | null;
  completed_at: string | null;
  comment: string;
}

/* ── Map DB status → RequestStatus ── */
const mapDbStatus = (s: string): RequestStatus => {
  switch (s) {
    case 'approved': return 'completed';
    case 'rejected': return 'declined';
    case 'pending': return 'not_created';
    case 'sent': return 'sent';
    case 'viewed': return 'viewed';
    case 'completed': return 'completed';
    case 'declined': return 'declined';
    case 'expired': return 'expired';
    case 'blocked': return 'blocked';
    case 'not_required': return 'not_required';
    default: return 'not_created';
  }
};

export const ApprovalsWorkflowCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { user } = useAuth();
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ApprovalItem | null>(null);
  const [message, setMessage] = useState('');
  const [newApprover, setNewApprover] = useState({ name: '', role: '', email: '', type: 'Legal Sign-off' });

  /* ── Fetch approvals ── */
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
      approver_name: a.approval_side || 'Unknown',
      approver_role: a.comment?.startsWith('Role:') ? a.comment.slice(6).trim() : (a.approval_side || ''),
      approval_type: 'Legal Sign-off',
      related_document: '',
      required: true,
      provider: 'DocuSign',
      request_status: mapDbStatus(a.status),
      sent_at: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : null,
      completed_at: a.status === 'approved' ? new Date(a.updated_at).toISOString().slice(0, 10) : null,
      comment: a.comment || '',
    })));
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  /* ── Derived stats ── */
  const requiredItems = items.filter(i => i.required && i.request_status !== 'not_required');
  const completedCount = requiredItems.filter(i => i.request_status === 'completed').length;
  const pendingCount = requiredItems.filter(i => !['completed', 'not_required'].includes(i.request_status)).length;
  const declinedCount = items.filter(i => i.request_status === 'declined').length;
  const blockedCount = items.filter(i => i.request_status === 'blocked').length;
  const totalRequired = requiredItems.length;
  const allComplete = totalRequired > 0 && completedCount === totalRequired;

  const workflowStatus: WorkflowStatus =
    totalRequired === 0 ? 'not_started' :
    allComplete ? 'complete' :
    completedCount > 0 || items.some(i => ['sent', 'viewed'].includes(i.request_status)) ? 'in_progress' :
    'not_started';

  const executionReady = allComplete && declinedCount === 0 && blockedCount === 0;

  /* ── Readiness banner ── */
  const getBannerConfig = () => {
    if (totalRequired === 0) return { icon: Clock, text: 'No required approvals configured. Add approvers to begin the workflow.', className: 'border-border/30 bg-muted/20 text-muted-foreground' };
    if (executionReady) return { icon: CheckCircle2, text: 'Ready for execution: all required approvals are complete.', className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600' };
    if (declinedCount > 0) return { icon: XCircle, text: `Execution blocked: ${declinedCount} required approval${declinedCount > 1 ? 's' : ''} declined. Re-send or resolve before proceeding.`, className: 'border-destructive/30 bg-destructive/5 text-destructive' };
    if (blockedCount > 0) return { icon: Lock, text: `Execution blocked: ${blockedCount} approval${blockedCount > 1 ? 's' : ''} blocked due to missing prerequisites.`, className: 'border-destructive/30 bg-destructive/5 text-destructive' };
    return { icon: AlertTriangle, text: `Execution blocked: ${pendingCount} required approval${pendingCount > 1 ? 's' : ''} still pending.`, className: 'border-amber-500/30 bg-amber-500/5 text-amber-600' };
  };

  const banner = getBannerConfig();
  const BannerIcon = banner.icon;

  /* ── Actions ── */
  const handleAddApprover = async () => {
    if (!newApprover.name || !dealId || !user?.id) { toast.error('Name is required'); return; }
    const { error } = await supabase.from('deal_approvals').insert({
      deal_id: dealId,
      user_id: user.id,
      approval_side: newApprover.name,
      status: 'pending',
      comment: newApprover.role ? `Role: ${newApprover.role}` : null,
    });
    if (error) { toast.error('Failed to add approver'); return; }

    // Log audit event
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id,
      action: 'approval_created',
      details: { approver_name: newApprover.name, role: newApprover.role },
    });

    setNewApprover({ name: '', role: '', email: '', type: 'Legal Sign-off' });
    setAddDialogOpen(false);
    toast.success('Approver added');
    await fetchItems();
  };

  const handleSend = (item: ApprovalItem) => {
    setSelectedItem(item);
    setMessage('');
    setSendDialogOpen(true);
  };

  const confirmSend = async () => {
    if (!selectedItem || !dealId || !user?.id) return;
    // Update status to sent
    await supabase.from('deal_approvals').update({ status: 'sent' as any } as any).eq('id', selectedItem.id);
    // Audit log
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id,
      action: 'approval_sent',
      details: { approver_name: selectedItem.approver_name, message },
    });
    toast.success(`Approval request sent to ${selectedItem.approver_name}`);
    setSendDialogOpen(false);
    await fetchItems();
  };

  const handleResend = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id,
      action: 'approval_resent',
      details: { approver_name: item.approver_name },
    });
    toast.success(`Reminder sent to ${item.approver_name}`);
  };

  const handleMarkNotRequired = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    await supabase.from('deal_approvals').update({ status: 'not_required' as any } as any).eq('id', item.id);
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id,
      action: 'approval_marked_not_required',
      details: { approver_name: item.approver_name },
    });
    toast.success(`${item.approver_name} marked as not required`);
    await fetchItems();
  };

  const handleDelete = async (item: ApprovalItem) => {
    if (!dealId || !user?.id) return;
    await supabase.from('deal_approvals').delete().eq('id', item.id);
    await supabase.from('audit_log').insert({
      deal_id: dealId, user_id: user.id,
      action: 'approval_removed',
      details: { approver_name: item.approver_name },
    });
    toast.success('Approver removed');
    await fetchItems();
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2" style={{ letterSpacing: '-0.03em' }}>
            <FileSignature className="w-5 h-5 text-accent" />
            Approvals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage required sign-offs before execution. All activity is logged in Compliance.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Approver
        </Button>
      </div>

      {/* Readiness Banner */}
      <motion.div {...fadeInUp} className={`p-4 rounded-xl border flex items-center gap-3 ${banner.className}`}>
        <BannerIcon className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium flex-1">{banner.text}</p>
        {workflowStatus !== 'not_started' && (
          <Badge variant="outline" className="text-xs capitalize shrink-0">
            {workflowStatus.replace(/_/g, ' ')}
          </Badge>
        )}
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Required</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{totalRequired}</div>
            <div className="text-xs text-muted-foreground mt-1">approvals needed</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Completed</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{completedCount}</div>
            {completedCount > 0 && <div className="flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-xs text-emerald-500">Signed</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Pending</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{pendingCount}</div>
            {pendingCount > 0 && <div className="flex items-center gap-1 mt-1"><Clock className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-500">Awaiting</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground font-normal">Blocked</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{declinedCount + blockedCount}</div>
            {(declinedCount + blockedCount) > 0 && <div className="flex items-center gap-1 mt-1"><XCircle className="w-3 h-3 text-destructive" /><span className="text-xs text-destructive">Action needed</span></div>}
          </CardContent>
        </Card>
      </div>

      {/* Approval Items Table */}
      {items.length > 0 ? (
        <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30 bg-muted/20">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Approver</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Required</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Sent</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const cfg = STATUS_CONFIG[item.request_status];
                  const StatusIcon = cfg.icon;
                  return (
                    <tr key={item.id} className="border-b border-border/20 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium shrink-0">
                            {item.approver_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium">{item.approver_name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.approver_role && <Badge variant="outline" className="text-[10px]">{item.approver_role}</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${item.required ? 'text-foreground' : 'text-muted-foreground'}`}>
                          {item.required ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <PenTool className="w-2.5 h-2.5" /> {item.provider}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${cfg.className}`}>
                          <StatusIcon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.sent_at || '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{item.completed_at || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {item.request_status === 'not_created' && (
                            <Button size="sm" className="h-7 text-[11px] gap-1" onClick={() => handleSend(item)}>
                              <Send className="w-3 h-3" /> Send
                            </Button>
                          )}
                          {['sent', 'viewed'].includes(item.request_status) && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleResend(item)}>
                              <RotateCcw className="w-3 h-3" /> Resend
                            </Button>
                          )}
                          {item.request_status === 'completed' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => toast.info('Download started')}>
                              <Download className="w-3 h-3" /> Signed
                            </Button>
                          )}
                          {item.request_status === 'declined' && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => handleSend(item)}>
                              <RotateCcw className="w-3 h-3" /> Re-Send
                            </Button>
                          )}
                          {item.required && !['completed', 'not_required'].includes(item.request_status) && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-muted-foreground" onClick={() => handleMarkNotRequired(item)}>
                              <Ban className="w-3 h-3" />
                            </Button>
                          )}
                          {['not_created', 'draft', 'not_required'].includes(item.request_status) && (
                            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                          )}
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
          <Button onClick={() => setAddDialogOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Approver
          </Button>
        </motion.div>
      )}

      {/* Audit Log Link */}
      {items.length > 0 && (
        <div className="flex items-center justify-end">
          <Button variant="link" className="text-xs text-muted-foreground gap-1 h-auto p-0" onClick={() => {
            // Navigate to compliance audit log
            toast.info('Navigate to Compliance → Audit Log to view full approval history.');
          }}>
            <ExternalLink className="w-3 h-3" /> View full audit log in Compliance
          </Button>
        </div>
      )}

      {/* Proceed to Execution CTA */}
      <motion.div {...fadeInUp} className="pivt-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">Proceed to Execution</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {executionReady
                ? 'All required approvals are complete. You may proceed.'
                : totalRequired === 0
                  ? 'Add required approvers before proceeding to execution.'
                  : `${pendingCount} approval${pendingCount !== 1 ? 's' : ''} remaining before execution can begin.`}
            </p>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    disabled={!executionReady}
                    className="gap-2"
                    onClick={() => toast.success('Proceeding to Execution…')}
                  >
                    {executionReady ? (
                      <ArrowRight className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Proceed to Execution
                  </Button>
                </span>
              </TooltipTrigger>
              {!executionReady && (
                <TooltipContent side="top">
                  <p className="text-xs max-w-[200px]">
                    {totalRequired === 0
                      ? 'No approvers configured. Add at least one required approver.'
                      : declinedCount > 0
                        ? `${declinedCount} approval${declinedCount > 1 ? 's' : ''} declined. Re-send or resolve.`
                        : `${pendingCount} required approval${pendingCount > 1 ? 's' : ''} still pending.`}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </motion.div>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" /> Send Approval Request
            </DialogTitle>
            <DialogDescription>Send via DocuSign to {selectedItem?.approver_name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs text-muted-foreground">Message (optional)</Label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a personal note…" className="mt-1.5" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmSend} className="gap-1">
              <Send className="w-3 h-3" /> Send via DocuSign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Approver Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-accent" /> Add Approver
            </DialogTitle>
            <DialogDescription>Add a required signatory for this deal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-xs text-muted-foreground">Approver Name</Label>
              <Input className="mt-1.5" value={newApprover.name} onChange={e => setNewApprover(p => ({ ...p, name: e.target.value }))} placeholder="e.g. James Morrison" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Role</Label>
              <select className="w-full bg-muted/30 border border-border/50 rounded-lg px-3 py-2 text-sm mt-1.5 focus:outline-none focus:border-accent/40"
                value={newApprover.role} onChange={e => setNewApprover(p => ({ ...p, role: e.target.value }))}>
                <option value="">Select role…</option>
                <option value="Buyer Counsel">Buyer Counsel</option>
                <option value="Seller Counsel">Seller Counsel</option>
                <option value="Buyer Signatory">Buyer Signatory</option>
                <option value="Seller Signatory">Seller Signatory</option>
                <option value="Target Signatory">Target Signatory</option>
                <option value="Escrow Agent">Escrow Agent</option>
                <option value="Paying Agent">Paying Agent</option>
                <option value="Board Member">Board Member</option>
                <option value="Compliance Officer">Compliance Officer</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input className="mt-1.5" value={newApprover.email} onChange={e => setNewApprover(p => ({ ...p, email: e.target.value }))} placeholder="e.g. j.morrison@firm.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddApprover}>Add Approver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
