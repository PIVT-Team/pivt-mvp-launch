import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Shield, CheckCircle2, Clock, AlertTriangle, ArrowRightLeft,
  Search, FileWarning, Loader2, FileText, Link2,
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
import { supabase } from '@/integrations/supabase/client';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

type VerificationStatus = 'pending' | 'in_review' | 'verified' | 'rejected';

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'text-muted-foreground', icon: Clock },
  in_review: { label: 'In Review', color: 'text-amber-500', icon: Search },
  verified: { label: 'Verified', color: 'text-validated', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-destructive', icon: FileWarning },
};

interface WireInstruction {
  id: string;
  payee_entity: string;
  payer_entity: string | null;
  bank_name: string | null;
  account_holder: string | null;
  account_number_last4: string | null;
  routing_number: string | null;
  swift_bic: string | null;
  currency: string;
  amount: number;
  payment_type: string;
  verification_status: VerificationStatus;
  source_document_id: string | null;
  created_at: string;
}

interface PaymentAllocation {
  id: string;
  recipient: string;
  amount: number;
  currency: string;
  allocation_type: string;
  status: string;
  source_document_id: string | null;
  source_wire_id: string | null;
}

interface SourceDoc {
  id: string;
  filename: string;
  doc_type: string;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

export const PaymentVerificationCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const [activeTab, setActiveTab] = useState('wire-instructions');
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedWire, setSelectedWire] = useState<WireInstruction | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [wireInstructions, setWireInstructions] = useState<WireInstruction[]>([]);
  const [allocations, setAllocations] = useState<PaymentAllocation[]>([]);
  const [sourceDocs, setSourceDocs] = useState<Map<string, SourceDoc>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }

    const fetchData = async () => {
      setLoading(true);

      const [wiresRes, allocsRes] = await Promise.all([
        supabase
          .from('wire_instructions')
          .select('id, payee_entity, payer_entity, bank_name, account_holder, account_number_last4, routing_number, swift_bic, currency, amount, payment_type, verification_status, source_document_id, created_at')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: true }),
        supabase
          .from('payment_allocations')
          .select('id, recipient, amount, currency, allocation_type, status, source_document_id, source_wire_id')
          .eq('deal_id', dealId)
          .order('created_at', { ascending: true }),
      ]);

      const wires = (wiresRes.data || []) as WireInstruction[];
      const allocs = (allocsRes.data || []) as PaymentAllocation[];
      setWireInstructions(wires);
      setAllocations(allocs);

      // Fetch source documents for provenance
      const docIds = new Set<string>();
      wires.forEach(w => { if (w.source_document_id) docIds.add(w.source_document_id); });
      allocs.forEach(a => { if (a.source_document_id) docIds.add(a.source_document_id); });

      if (docIds.size > 0) {
        const { data: docs } = await supabase
          .from('contract_documents')
          .select('id, filename, doc_type')
          .in('id', Array.from(docIds));
        const docMap = new Map<string, SourceDoc>();
        (docs || []).forEach((d: any) => docMap.set(d.id, d));
        setSourceDocs(docMap);
      }

      setLoading(false);
    };

    fetchData();
  }, [dealId]);

  const verifiedCount = wireInstructions.filter(w => w.verification_status === 'verified').length;
  const pendingCount = wireInstructions.filter(w => w.verification_status === 'pending' || w.verification_status === 'in_review').length;
  const rejectedCount = wireInstructions.filter(w => w.verification_status === 'rejected').length;
  const totalCount = wireInstructions.length;

  const handleVerify = async (wire: WireInstruction) => {
    const { error } = await supabase
      .from('wire_instructions')
      .update({ verification_status: 'verified', verified_at: new Date().toISOString() } as any)
      .eq('id', wire.id);
    if (error) { toast.error('Failed to verify'); return; }
    toast.success(`${wire.payee_entity} verified`);
    setWireInstructions(prev => prev.map(w => w.id === wire.id ? { ...w, verification_status: 'verified' as VerificationStatus } : w));

    if (dealId) {
      await supabase.from('audit_log').insert({
        deal_id: dealId,
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'wire_instruction_verified',
        details: { wire_id: wire.id, payee: wire.payee_entity, amount: wire.amount },
      });
    }
  };

  const handleReject = (wire: WireInstruction) => {
    setSelectedWire(wire);
    setResolutionNote('');
    setResolveDialogOpen(true);
  };

  const confirmReject = async () => {
    if (!selectedWire) return;
    await supabase
      .from('wire_instructions')
      .update({ verification_status: 'rejected' } as any)
      .eq('id', selectedWire.id);
    toast.success(`${selectedWire.payee_entity} flagged for review`);
    setWireInstructions(prev => prev.map(w => w.id === selectedWire.id ? { ...w, verification_status: 'rejected' as VerificationStatus } : w));
    setResolveDialogOpen(false);
  };

  const renderProvenance = (docId: string | null) => {
    if (!docId) return null;
    const doc = sourceDocs.get(docId);
    if (!doc) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1">
        <Link2 className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground">
          Source: <span className="text-foreground/70">{doc.filename}</span>
        </span>
        <Badge variant="outline" className="text-[9px] px-1 py-0">{doc.doc_type.replace(/_/g, ' ')}</Badge>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (totalCount === 0 && allocations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent" />
            Payment Verification
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Wire instructions, bank details & payment allocation verification</p>
        </div>
        <div className="pivt-card p-12 text-center space-y-4">
          <Shield className="w-10 h-10 text-muted-foreground mx-auto" />
          <div>
            <p className="font-medium">No wire instructions to verify</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload a Funds Flow Memo in Deal Inputs → Wire Instructions. The orchestrator will automatically parse and populate wire records here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-accent" />
          Payment Verification
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Graph-derived wire instructions and payment allocations for verification</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Total Wires</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-light">{totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Verified</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{verifiedCount}</div>
            {verifiedCount > 0 && <div className="flex items-center gap-1 mt-1"><CheckCircle2 className="w-3 h-3 text-validated" /><span className="text-xs text-validated">Confirmed</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Pending</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{pendingCount}</div>
            {pendingCount > 0 && <div className="flex items-center gap-1 mt-1"><Clock className="w-3 h-3 text-amber-500" /><span className="text-xs text-amber-500">Awaiting review</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Flagged</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{rejectedCount}</div>
            {rejectedCount > 0 && <div className="flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-xs text-destructive">Needs attention</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Allocations</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-light">{allocations.length}</div></CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="wire-instructions" className="text-xs">Wire Instructions ({totalCount})</TabsTrigger>
          <TabsTrigger value="allocations" className="text-xs">Payment Allocations ({allocations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="wire-instructions" className="space-y-3 mt-4">
          {wireInstructions.map(wire => {
            const cfg = STATUS_CONFIG[wire.verification_status] || STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <motion.div key={wire.id} {...fadeInUp} className="pivt-card p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{wire.payee_entity}</span>
                      <Badge variant="outline" className="text-xs">{wire.payment_type}</Badge>
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-muted-foreground">Amount</span><p className="font-medium mt-0.5">{formatCurrency(wire.amount)}</p></div>
                      <div><span className="text-muted-foreground">Bank</span><p className="font-medium mt-0.5">{wire.bank_name || '—'}</p></div>
                      <div><span className="text-muted-foreground">Account</span><p className="font-medium mt-0.5">{wire.account_number_last4 ? `••••${wire.account_number_last4}` : '—'}</p></div>
                      <div><span className="text-muted-foreground">Routing / SWIFT</span><p className="font-medium mt-0.5 font-mono">{wire.routing_number || wire.swift_bic || '—'}</p></div>
                    </div>
                    {renderProvenance(wire.source_document_id)}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {wire.verification_status !== 'verified' && (
                      <>
                        <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleReject(wire)}>
                          <AlertTriangle className="w-3 h-3 mr-1" /> Flag
                        </Button>
                        <Button size="sm" className="text-xs h-8" onClick={() => handleVerify(wire)}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Verify
                        </Button>
                      </>
                    )}
                    {wire.verification_status === 'verified' && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                      </Badge>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        <TabsContent value="allocations" className="space-y-3 mt-4">
          {allocations.length === 0 ? (
            <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
              No payment allocations yet. Upload a Funds Flow Memo to generate allocations.
            </div>
          ) : (
            allocations.map(alloc => (
              <motion.div key={alloc.id} {...fadeInUp} className="pivt-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{alloc.recipient}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(alloc.amount)} · {alloc.currency} · {alloc.allocation_type.replace(/_/g, ' ')}</p>
                    {renderProvenance(alloc.source_document_id)}
                  </div>
                  <Badge variant="outline" className={`text-xs ${
                    alloc.status === 'matched' ? 'text-validated border-validated/20' :
                    alloc.status === 'unmatched' ? 'text-amber-500 border-amber-500/20' :
                    'text-muted-foreground border-border'
                  }`}>
                    {alloc.status === 'matched' ? '✓ Matched' : alloc.status === 'unmatched' ? '⏳ Pending Match' : alloc.status}
                  </Badge>
                </div>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Reject/Flag Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Wire Instruction</DialogTitle>
            <DialogDescription>{selectedWire?.payee_entity} — {formatCurrency(selectedWire?.amount || 0)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium">Reason for flagging</label>
              <Textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} placeholder="Describe the issue with this wire instruction..." className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmReject}>Flag for Review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
