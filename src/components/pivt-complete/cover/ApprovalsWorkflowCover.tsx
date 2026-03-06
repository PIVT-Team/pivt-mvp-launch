import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  CheckCircle2, Clock, XCircle, Send, Eye, Download, FileSignature,
  AlertTriangle, Shield, PenTool,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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

const MOCK_APPROVERS: Approver[] = [
  { id: 'ap1', name: 'James Morrison', role: 'Buyer Counsel', email: 'j.morrison@kirkland.com', status: 'signed', sentAt: '2026-02-10', signedAt: '2026-02-11', notes: 'Approved with no changes' },
  { id: 'ap2', name: 'Elena Rodriguez', role: 'Seller Counsel', email: 'e.rodriguez@wachtell.com', status: 'pending_signature', sentAt: '2026-02-10', signedAt: null, notes: '' },
  { id: 'ap3', name: 'David Chen', role: 'Buyer Signatory', email: 'd.chen@sequoia.com', status: 'viewed', sentAt: '2026-02-12', signedAt: null, notes: '' },
  { id: 'ap4', name: 'Sarah Chen', role: 'Seller Signatory', email: 's.chen@target.com', status: 'not_sent', sentAt: null, signedAt: null, notes: '' },
  { id: 'ap5', name: 'Robert Kim', role: 'Escrow Agent', email: 'r.kim@jpmorgan.com', status: 'sent', sentAt: '2026-02-13', signedAt: null, notes: '' },
];

interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  timestamp: string;
  details: string;
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: 'au1', action: 'Approval signed', actor: 'James Morrison', timestamp: '2026-02-11 14:32', details: 'Buyer Counsel approved funds flow memo' },
  { id: 'au2', action: 'Approval sent', actor: 'System', timestamp: '2026-02-12 09:00', details: 'DocuSign envelope sent to David Chen' },
  { id: 'au3', action: 'Approval viewed', actor: 'David Chen', timestamp: '2026-02-12 10:15', details: 'Opened envelope, no action yet' },
  { id: 'au4', action: 'Approval sent', actor: 'System', timestamp: '2026-02-13 08:00', details: 'DocuSign envelope sent to Robert Kim' },
];

export const ApprovalsWorkflowCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState('approvers');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedApprover, setSelectedApprover] = useState<Approver | null>(null);
  const [message, setMessage] = useState('');

  const signedCount = MOCK_APPROVERS.filter(a => a.status === 'signed' || a.status === 'completed').length;
  const pendingCount = MOCK_APPROVERS.filter(a => !['signed', 'completed', 'declined'].includes(a.status)).length;
  const totalCount = MOCK_APPROVERS.length;

  const allComplete = signedCount === totalCount;

  const handleSendApproval = (approver: Approver) => {
    setSelectedApprover(approver);
    setMessage('');
    setSendDialogOpen(true);
  };

  const confirmSend = () => {
    toast.success(`Approval request sent to ${selectedApprover?.name}`);
    setSendDialogOpen(false);
  };

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
        {allComplete && (
          <Badge variant="outline" className="text-validated border-validated/20 bg-validated/10 gap-1">
            <CheckCircle2 className="w-3 h-3" /> All Approvals Complete
          </Badge>
        )}
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
            <div className="flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3 text-validated" /><span className="text-xs text-validated">Complete</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Pending</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{pendingCount}</div>
            <div className="flex items-center gap-1 mt-1"><Clock className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-500">Awaiting</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Declined</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{MOCK_APPROVERS.filter(a => a.status === 'declined').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* DocuSign Integration Banner */}
      <motion.div {...fadeInUp} className="pivt-card p-4 border-l-4 border-accent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <PenTool className="w-4 h-4 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium">DocuSign Integration</p>
            <p className="text-xs text-muted-foreground">Send approval requests and track signing status via DocuSign</p>
          </div>
        </div>
        <Badge variant="outline" className="text-xs text-accent border-accent/20">Connected</Badge>
      </motion.div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="approvers" className="text-xs">Approvers ({totalCount})</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs">Audit Log ({MOCK_AUDIT.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="approvers" className="space-y-3 mt-4">
          {MOCK_APPROVERS.map(approver => {
            const cfg = STATUS_CONFIG[approver.status];
            const Icon = cfg.icon;
            return (
              <motion.div key={approver.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                      {approver.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{approver.name}</span>
                        <Badge variant="outline" className="text-[10px]">{approver.role}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{approver.email}</p>
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
          <div className="relative pl-5 space-y-4">
            <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-border/30" />
            {MOCK_AUDIT.map(entry => (
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
        </TabsContent>
      </Tabs>

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Approval Request</DialogTitle>
            <DialogDescription>Send via DocuSign to {selectedApprover?.name} ({selectedApprover?.email})</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Message (optional)</label>
              <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Add a personal note..." className="mt-2" />
            </div>
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <p>The following documents will be included:</p>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Funds Flow Memorandum</li>
                <li>Wire Authorization Letter</li>
                <li>Closing Statement</li>
              </ul>
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
    </div>
  );
};
