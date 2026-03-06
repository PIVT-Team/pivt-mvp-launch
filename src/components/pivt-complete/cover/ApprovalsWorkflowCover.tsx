import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  CheckCircle2, Clock, XCircle, Send, Eye, Download, FileSignature,
  AlertTriangle, Shield, PenTool, Plus, Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';

type ApprovalStatus = 'not_sent' | 'sent' | 'viewed' | 'pending_signature' | 'signed' | 'declined' | 'completed';

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; icon: React.ElementType }> = {
  not_sent: { label: 'Not Sent', color: 'text-muted-foreground', icon: Clock },
  sent: { label: 'Sent', color: 'text-blue-500', icon: Send },
  viewed: { label: 'Viewed', color: 'text-amber-500', icon: Eye },
  pending_signature: { label: 'Pending Signature', color: 'text-amber-500', icon: PenTool },
  signed: { label: 'Signed', color: 'text-validated', icon: CheckCircle2 },
  declined: { label: 'Declined', color: 'text-destructive', icon: XCircle },
  completed: { label: 'Completed', color: 'text-validated', icon: Shield },
};

interface Approver {
  id: string;
  name: string;
  role: string;
  email: string;
  status: ApprovalStatus;
  sentAt: string | null;
  signedAt: string | null;
  notes: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

export const ApprovalsWorkflowCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('approvers');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [addApproverOpen, setAddApproverOpen] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState<Approver | null>(null);
  const [message, setMessage] = useState('');
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newApprover, setNewApprover] = useState({ name: '', role: '', email: '' });

  // Fetch deal-scoped approvals and audit log from database
  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      const [approvalsRes, auditRes] = await Promise.all([
        supabase
          .from('deal_approvals')
          .select('*')
          .eq('deal_id', dealId)
          .order('created_at'),
        supabase
          .from('audit_log')
          .select('*')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      // Map deal_approvals to Approver shape
      const mappedApprovers: Approver[] = (approvalsRes.data || []).map((a: any) => ({
        id: a.id,
        name: a.approval_side, // We use approval_side to store name for now
        role: a.approval_side,
        email: '',
        status: mapDbStatusToApprovalStatus(a.status),
        sentAt: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : null,
        signedAt: a.status === 'approved' ? new Date(a.updated_at).toISOString().slice(0, 10) : null,
        notes: a.comment || '',
      }));

      // Map audit_log entries
      const mappedAudit: AuditEntry[] = (auditRes.data || []).map((e: any) => ({
        id: e.id,
        action: e.action,
        actor: 'System',
        timestamp: new Date(e.created_at).toLocaleString(),
        details: typeof e.details === 'object' ? JSON.stringify(e.details) : String(e.details || ''),
      }));

      setApprovers(mappedApprovers);
      setAuditLog(mappedAudit);
      setLoading(false);
    };

    fetchData();
  }, [dealId]);

  const mapDbStatusToApprovalStatus = (dbStatus: string): ApprovalStatus => {
    switch (dbStatus) {
      case 'approved': return 'signed';
      case 'rejected': return 'declined';
      case 'pending': return 'not_sent';
      default: return 'not_sent';
    }
  };

  const signedCount = approvers.filter(a => a.status === 'signed' || a.status === 'completed').length;
  const pendingCount = approvers.filter(a => !['signed', 'completed', 'declined'].includes(a.status)).length;
  const totalCount = approvers.length;
  const allComplete = totalCount > 0 && signedCount === totalCount;

  const handleSendApproval = (approver: Approver) => {
    setSelectedApprover(approver);
    setMessage('');
    setSendDialogOpen(true);
  };

  const confirmSend = () => {
    toast.success(`Approval request sent to ${selectedApprover?.name}`);
    setSendDialogOpen(false);
  };

  const handleAddApprover = async () => {
    if (!newApprover.name || !dealId || !user?.id) {
      toast.error('Name is required');
      return;
    }
    const { error } = await supabase.from('deal_approvals').insert({
      deal_id: dealId,
      user_id: user.id,
      approval_side: newApprover.name,
      status: 'pending',
      comment: newApprover.role ? `Role: ${newApprover.role}` : null,
    });
    if (error) {
      toast.error('Failed to add approver');
      return;
    }
    // Refetch
    const { data } = await supabase
      .from('deal_approvals')
      .select('*')
      .eq('deal_id', dealId)
      .order('created_at');
    setApprovers((data || []).map((a: any) => ({
      id: a.id,
      name: a.approval_side,
      role: a.approval_side,
      email: '',
      status: mapDbStatusToApprovalStatus(a.status),
      sentAt: a.created_at ? new Date(a.created_at).toISOString().slice(0, 10) : null,
      signedAt: a.status === 'approved' ? new Date(a.updated_at).toISOString().slice(0, 10) : null,
      notes: a.comment || '',
    })));
    setNewApprover({ name: '', role: '', email: '' });
    setAddApproverOpen(false);
    toast.success('Approver added');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state — no approvers configured
  if (totalCount === 0 && auditLog.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-accent" />
            Approvals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Legal sign-off & document execution workflow</p>
        </div>

        <div className="pivt-card p-12 text-center space-y-4">
          <Users className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium">No approvers configured</p>
            <p className="text-sm text-muted-foreground mt-1">Add approvers who need to sign off on this deal before execution can proceed.</p>
          </div>
          <Button onClick={() => setAddApproverOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Approver
          </Button>
        </div>

        {/* Add Approver Dialog */}
        <Dialog open={addApproverOpen} onOpenChange={setAddApproverOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Add Approver</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div><Label className="text-xs text-muted-foreground">Name</Label><Input className="mt-1.5" value={newApprover.name} onChange={e => setNewApprover(p => ({ ...p, name: e.target.value }))} placeholder="e.g. James Morrison" /></div>
              <div><Label className="text-xs text-muted-foreground">Role</Label><Input className="mt-1.5" value={newApprover.role} onChange={e => setNewApprover(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Buyer Counsel" /></div>
              <div><Label className="text-xs text-muted-foreground">Email</Label><Input className="mt-1.5" value={newApprover.email} onChange={e => setNewApprover(p => ({ ...p, email: e.target.value }))} placeholder="e.g. j.morrison@firm.com" /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddApproverOpen(false)}>Cancel</Button>
              <Button onClick={handleAddApprover}>Add Approver</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-accent" />
            Approvals
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Legal sign-off & document execution workflow</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddApproverOpen(true)} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Approver
          </Button>
          {allComplete && (
            <Badge variant="outline" className="text-validated border-validated/20 bg-validated/10 gap-1">
              <CheckCircle2 className="w-3 h-3" /> All Approvals Complete
            </Badge>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Total Approvers</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-light">{totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Signed</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{signedCount}</div>
            {signedCount > 0 && <div className="flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3 text-validated" /><span className="text-xs text-validated">Complete</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Pending</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{pendingCount}</div>
            {pendingCount > 0 && <div className="flex items-center gap-1 mt-1"><Clock className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-500">Awaiting</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Declined</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{approvers.filter(a => a.status === 'declined').length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="approvers" className="text-xs">Approvers ({totalCount})</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs">Audit Log ({auditLog.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="approvers" className="space-y-3 mt-4">
          {approvers.map(approver => {
            const cfg = STATUS_CONFIG[approver.status];
            const Icon = cfg.icon;
            return (
              <motion.div key={approver.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {approver.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{approver.name}</span>
                        {approver.role && <Badge variant="outline" className="text-[10px]">{approver.role}</Badge>}
                      </div>
                      {approver.email && <p className="text-xs text-muted-foreground mt-0.5">{approver.email}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {approver.sentAt && <span>Sent: {approver.sentAt}</span>}
                        {approver.signedAt && <span className="text-validated">Signed: {approver.signedAt}</span>}
                        {approver.notes && <span className="italic">"{approver.notes}"</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </Badge>
                    <div className="flex gap-2">
                      {approver.status === 'not_sent' && (
                        <Button size="sm" className="text-xs h-8 gap-1" onClick={() => handleSendApproval(approver)}>
                          <Send className="w-3 h-3" /> Send via DocuSign
                        </Button>
                      )}
                      {['sent', 'viewed'].includes(approver.status) && (
                        <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => {
                          toast.success(`Reminder sent to ${approver.name}`);
                        }}>
                          <Send className="w-3 h-3" /> Resend
                        </Button>
                      )}
                      {(approver.status === 'signed' || approver.status === 'completed') && (
                        <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => toast.info('Download started')}>
                          <Download className="w-3 h-3" /> Download
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="audit" className="space-y-3 mt-4">
          {auditLog.length === 0 ? (
            <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
              No approval activity recorded yet.
            </div>
          ) : (
            <div className="relative pl-5 space-y-4">
              <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-border/30" />
              {auditLog.map(entry => (
                <div key={entry.id} className="relative flex items-start gap-3">
                  <div className="absolute left-[-14px] w-2.5 h-2.5 rounded-full bg-accent mt-1.5" />
                  <div className="flex-1 pivt-card p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{entry.action}</span>
                      <span className="text-xs font-mono text-muted-foreground">{entry.timestamp}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">By: {entry.actor}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Approval Request</DialogTitle>
            <DialogDescription>Send via DocuSign to {selectedApprover?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Message (optional)</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a personal note..." className="mt-2" />
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
      <Dialog open={addApproverOpen} onOpenChange={setAddApproverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Approver</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label className="text-xs text-muted-foreground">Name</Label><Input className="mt-1.5" value={newApprover.name} onChange={e => setNewApprover(p => ({ ...p, name: e.target.value }))} placeholder="e.g. James Morrison" /></div>
            <div><Label className="text-xs text-muted-foreground">Role</Label><Input className="mt-1.5" value={newApprover.role} onChange={e => setNewApprover(p => ({ ...p, role: e.target.value }))} placeholder="e.g. Buyer Counsel" /></div>
            <div><Label className="text-xs text-muted-foreground">Email</Label><Input className="mt-1.5" value={newApprover.email} onChange={e => setNewApprover(p => ({ ...p, email: e.target.value }))} placeholder="e.g. j.morrison@firm.com" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddApproverOpen(false)}>Cancel</Button>
            <Button onClick={handleAddApprover}>Add Approver</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
