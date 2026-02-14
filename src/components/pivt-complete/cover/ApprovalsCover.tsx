import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { fadeInUp } from '@/lib/animations';
import { CheckCircle2, Clock, ChevronRight, XCircle, Shield, FileCheck, AlertTriangle, Send, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

// Extended approval data
const MOCK_APPROVALS = [
  { id: 'a1', type: 'Payout Execution', dealName: 'Project ATLAS', description: 'Execute $840M wire to Sarah Chen', requestedBy: 'Deal Admin', urgency: 'critical' as const, createdAt: '2026-02-12', buyerApproved: true, sellerApproved: false },
  { id: 'a2', type: 'Document Review', dealName: 'Project ATLAS', description: 'Approve Waterfall Schedule v3', requestedBy: 'Seller Counsel', urgency: 'high' as const, createdAt: '2026-02-11', buyerApproved: false, sellerApproved: false },
  { id: 'a3', type: 'KYC Override', dealName: 'Project BEACON', description: 'Override KYC for GIC Private Limited', requestedBy: 'Compliance', urgency: 'medium' as const, createdAt: '2026-02-10', buyerApproved: true, sellerApproved: true },
  { id: 'a4', type: 'Escrow Release', dealName: 'Project CIPHER', description: 'Release $280M escrow holdback', requestedBy: 'Buyer Counsel', urgency: 'high' as const, createdAt: '2026-02-09', buyerApproved: true, sellerApproved: false },
  { id: 'a5', type: 'Wire Change', dealName: 'Project ATLAS', description: 'Updated wire instructions for Tiger Global', requestedBy: 'Tiger Global Ops', urgency: 'critical' as const, createdAt: '2026-02-13', buyerApproved: false, sellerApproved: false },
];

const APPROVAL_HISTORY = [
  { id: 'h1', type: 'Payout Execution', dealName: 'Project CIPHER', description: 'Wire $560M to Marcus Williams', resolvedBy: 'Admin', resolvedAt: '2026-02-08', resolution: 'approved' },
  { id: 'h2', type: 'Document Review', dealName: 'Project BEACON', description: 'Cap Table v2 review', resolvedBy: 'Buyer Counsel', resolvedAt: '2026-02-07', resolution: 'approved' },
  { id: 'h3', type: 'KYC Override', dealName: 'Project ATLAS', description: 'Override KYC for Employee Option Pool', resolvedBy: 'Compliance', resolvedAt: '2026-02-06', resolution: 'rejected' },
  { id: 'h4', type: 'Wire Change', dealName: 'Project CIPHER', description: 'Updated IBAN for Index Ventures', resolvedBy: 'Admin', resolvedAt: '2026-02-05', resolution: 'approved' },
];

const urgencyColors = { low: 'border-muted', medium: 'border-blue-500', high: 'border-discrepancy', critical: 'border-blocking' };
const urgencyBg = { low: '', medium: 'bg-blue-500/5', high: 'bg-discrepancy/5', critical: 'bg-blocking/5' };

export const ApprovalsCover: React.FC = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedApproval, setSelectedApproval] = useState<typeof MOCK_APPROVALS[0] | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [comment, setComment] = useState('');

  const pendingCount = MOCK_APPROVALS.filter(a => !(a.buyerApproved && a.sellerApproved)).length;
  const criticalCount = MOCK_APPROVALS.filter(a => a.urgency === 'critical').length;

  const handleAction = (approval: typeof MOCK_APPROVALS[0], type: 'approve' | 'reject') => {
    setSelectedApproval(approval);
    setActionType(type);
    setComment('');
    setActionDialogOpen(true);
  };

  const confirmAction = () => {
    toast.success(`${actionType === 'approve' ? 'Approved' : 'Rejected'}: ${selectedApproval?.description}`);
    setActionDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Approvals</h2>
          <p className="text-sm text-muted-foreground mt-1">Dual-signature approval workflow</p>
        </div>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <Badge variant="outline" className="bg-blocking/10 text-blocking border-blocking/20">
              {criticalCount} critical
            </Badge>
          )}
          <Badge variant="outline" className="bg-discrepancy/10 text-discrepancy border-discrepancy/20">
            {pendingCount} pending
          </Badge>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Pending</CardTitle></CardHeader><CardContent><div className="text-2xl font-light">{pendingCount}</div><div className="flex items-center gap-1 mt-2"><Clock className="w-3 h-3 text-discrepancy" /><span className="text-xs text-discrepancy">Awaiting action</span></div></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Buyer Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-light">{MOCK_APPROVALS.filter(a => a.buyerApproved).length}</div><div className="flex items-center gap-1 mt-2"><CheckCircle2 className="w-3 h-3 text-validated" /><span className="text-xs text-validated">Signed</span></div></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Seller Approved</CardTitle></CardHeader><CardContent><div className="text-2xl font-light">{MOCK_APPROVALS.filter(a => a.sellerApproved).length}</div><div className="flex items-center gap-1 mt-2"><CheckCircle2 className="w-3 h-3 text-validated" /><span className="text-xs text-validated">Signed</span></div></CardContent></Card>
        <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Fully Executed</CardTitle></CardHeader><CardContent><div className="text-2xl font-light">{MOCK_APPROVALS.filter(a => a.buyerApproved && a.sellerApproved).length}</div><div className="flex items-center gap-1 mt-2"><Shield className="w-3 h-3 text-blue-500" /><span className="text-xs text-blue-500">Both parties</span></div></CardContent></Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="pending" className="text-xs">Pending ({pendingCount})</TabsTrigger>
          <TabsTrigger value="history" className="text-xs">History ({APPROVAL_HISTORY.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {MOCK_APPROVALS.map((approval) => (
            <motion.div key={approval.id} {...fadeInUp} className={`pivt-card p-5 border-l-4 ${urgencyColors[approval.urgency]} ${urgencyBg[approval.urgency]}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium uppercase text-muted-foreground">{approval.type}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                      approval.urgency === 'critical' ? 'bg-blocking/10 text-blocking' : approval.urgency === 'high' ? 'bg-discrepancy/10 text-discrepancy' : 'bg-blue-500/10 text-blue-500'
                    }`}>{approval.urgency}</span>
                  </div>
                  <p className="font-medium">{approval.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">{approval.dealName} · Requested by {approval.requestedBy} · {approval.createdAt}</p>

                  {/* Dual-signature status */}
                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      {approval.buyerApproved ? <CheckCircle2 className="w-3.5 h-3.5 text-validated" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className={approval.buyerApproved ? 'text-validated' : 'text-muted-foreground'}>Buyer {approval.buyerApproved ? 'Approved' : 'Pending'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      {approval.sellerApproved ? <CheckCircle2 className="w-3.5 h-3.5 text-validated" /> : <Clock className="w-3.5 h-3.5 text-muted-foreground" />}
                      <span className={approval.sellerApproved ? 'text-validated' : 'text-muted-foreground'}>Seller {approval.sellerApproved ? 'Approved' : 'Pending'}</span>
                    </div>
                    {approval.buyerApproved && approval.sellerApproved && (
                      <Badge variant="outline" className="bg-validated/10 text-validated border-validated/20 text-xs">Ready to Execute</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleAction(approval, 'reject')}>
                    <XCircle className="mr-1 h-3 w-3" />Reject
                  </Button>
                  <Button size="sm" className="h-8 text-xs" onClick={() => handleAction(approval, 'approve')}>
                    <CheckCircle2 className="mr-1 h-3 w-3" />Approve
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}

          {pendingCount === 0 && (
            <div className="pivt-card p-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-validated mx-auto mb-3" />
              <p className="text-muted-foreground">All approvals are up to date</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-4">
          {APPROVAL_HISTORY.map((item) => (
            <motion.div key={item.id} {...fadeInUp} className="pivt-card p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium uppercase text-muted-foreground">{item.type}</span>
                  <Badge variant="outline" className={`text-xs ${item.resolution === 'approved' ? 'bg-validated/10 text-validated border-validated/20' : 'bg-blocking/10 text-blocking border-blocking/20'}`}>
                    {item.resolution}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{item.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.dealName} · Resolved by {item.resolvedBy} · {item.resolvedAt}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'approve' ? 'Approve' : 'Reject'} Request</DialogTitle>
            <DialogDescription>{selectedApproval?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Comment (optional)</label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note..." className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmAction} variant={actionType === 'reject' ? 'destructive' : 'default'}>
              {actionType === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
