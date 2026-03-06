import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp } from '@/lib/animations';
import {
  Shield, CheckCircle2, Clock, AlertTriangle, Landmark, ArrowRightLeft,
  Search, FileWarning, RefreshCw, Plus, Loader2,
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

type VerificationStatus = 'not_started' | 'in_review' | 'discrepancies_found' | 'pending_resolution' | 'verified';

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; icon: React.ElementType }> = {
  not_started: { label: 'Not Started', color: 'text-muted-foreground', icon: Clock },
  in_review: { label: 'In Review', color: 'text-amber-500', icon: Search },
  discrepancies_found: { label: 'Discrepancies Found', color: 'text-destructive', icon: FileWarning },
  pending_resolution: { label: 'Pending Resolution', color: 'text-amber-500', icon: RefreshCw },
  verified: { label: 'Verified', color: 'text-validated', icon: CheckCircle2 },
};

interface WireInstruction {
  id: string;
  party: string;
  side: 'buyer' | 'seller';
  bankName: string;
  accountHolder: string;
  accountLast4: string;
  routingNumber: string;
  swiftBic: string;
  iban: string;
  currency: string;
  status: VerificationStatus;
  discrepancies: string[];
}

interface PaymentAllocation {
  id: string;
  recipient: string;
  amount: number;
  currency: string;
  wireRef: string;
  status: 'matched' | 'unmatched' | 'partial';
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
  const [loading, setLoading] = useState(true);

  // Fetch deal-scoped data from DB
  useEffect(() => {
    if (!dealId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);

      // Fetch cap_table_entries that have verification data (wire-like info)
      // and payment_instructions if that table exists
      // For now, wire instructions come from cap_table_entries with bank info
      const { data: capEntries } = await supabase
        .from('cap_table_entries')
        .select('*')
        .eq('deal_id', dealId);

      // No auto-population — wire instructions start empty
      // Only show entries that have actual verification data
      setWireInstructions([]);
      setAllocations([]);
      setLoading(false);
    };

    fetchData();
  }, [dealId]);

  const verifiedCount = wireInstructions.filter(w => w.status === 'verified').length;
  const discrepancyCount = wireInstructions.filter(w => w.status === 'discrepancies_found').length;
  const totalCount = wireInstructions.length;

  const handleResolve = (wire: WireInstruction) => {
    setSelectedWire(wire);
    setResolutionNote('');
    setResolveDialogOpen(true);
  };

  const confirmResolve = () => {
    toast.success(`Discrepancies resolved for ${selectedWire?.party}`);
    setResolveDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Empty state — no wire instructions or allocations
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
              Add wire instructions in Deal Inputs → Wire Instructions first. Once added, they will appear here for verification.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-accent" />
            Payment Verification
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Wire instructions, bank details & payment allocation verification</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Total Instructions</CardTitle></CardHeader>
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
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Discrepancies</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{discrepancyCount}</div>
            {discrepancyCount > 0 && <div className="flex items-center gap-1 mt-1"><AlertTriangle className="w-3 h-3 text-destructive" /><span className="text-xs text-destructive">Needs attention</span></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Pending Review</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-light">{totalCount - verifiedCount - discrepancyCount}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="wire-instructions" className="text-xs">Wire Instructions ({totalCount})</TabsTrigger>
          <TabsTrigger value="allocations" className="text-xs">Payment Allocations ({allocations.length})</TabsTrigger>
          <TabsTrigger value="discrepancies" className="text-xs">
            Discrepancies {discrepancyCount > 0 && <Badge variant="destructive" className="ml-1 text-[9px] h-4 px-1">{discrepancyCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wire-instructions" className="space-y-3 mt-4">
          {wireInstructions.length === 0 ? (
            <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
              No wire instructions added yet.
            </div>
          ) : (
            ['buyer', 'seller'].map(side => {
              const sideInstructions = wireInstructions.filter(w => w.side === side);
              if (sideInstructions.length === 0) return null;
              return (
                <div key={side} className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{side} Side</h3>
                  {sideInstructions.map(wire => {
                    const cfg = STATUS_CONFIG[wire.status];
                    const Icon = cfg.icon;
                    return (
                      <motion.div key={wire.id} {...fadeInUp} className="pivt-card p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{wire.party}</span>
                              <Badge variant="outline" className={`text-xs gap-1 ${cfg.color}`}>
                                <Icon className="w-3 h-3" /> {cfg.label}
                              </Badge>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                              <div><span className="text-muted-foreground">Bank</span><p className="font-medium mt-0.5">{wire.bankName}</p></div>
                              <div><span className="text-muted-foreground">Account</span><p className="font-medium mt-0.5">••••{wire.accountLast4}</p></div>
                              <div><span className="text-muted-foreground">Routing</span><p className="font-medium mt-0.5 font-mono">{wire.routingNumber || '—'}</p></div>
                              <div><span className="text-muted-foreground">SWIFT</span><p className="font-medium mt-0.5 font-mono">{wire.swiftBic}</p></div>
                            </div>
                            {wire.discrepancies.length > 0 && (
                              <div className="space-y-1 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                                {wire.discrepancies.map((d, i) => (
                                  <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                                    <AlertTriangle className="w-3 h-3 shrink-0" /> {d}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            {wire.status === 'discrepancies_found' && (
                              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleResolve(wire)}>
                                Resolve
                              </Button>
                            )}
                            {wire.status !== 'verified' && (
                              <Button size="sm" className="text-xs h-8" onClick={() => toast.success(`${wire.party} verified`)}>
                                <CheckCircle2 className="w-3 h-3 mr-1" /> Verify
                              </Button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="allocations" className="space-y-3 mt-4">
          {allocations.length === 0 ? (
            <div className="pivt-card p-12 text-center text-muted-foreground text-sm">
              No payment allocations yet.
            </div>
          ) : (
            allocations.map(alloc => (
              <motion.div key={alloc.id} {...fadeInUp} className="pivt-card p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{alloc.recipient}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatCurrency(alloc.amount)} · {alloc.currency}</p>
                </div>
                <Badge variant="outline" className={`text-xs ${
                  alloc.status === 'matched' ? 'text-validated border-validated/20' :
                  alloc.status === 'unmatched' ? 'text-destructive border-destructive/20' :
                  'text-amber-500 border-amber-500/20'
                }`}>
                  {alloc.status === 'matched' ? '✓ Matched' : alloc.status === 'unmatched' ? '✗ No wire' : '⚠ Partial'}
                </Badge>
              </motion.div>
            ))
          )}
        </TabsContent>

        <TabsContent value="discrepancies" className="space-y-3 mt-4">
          {wireInstructions.filter(w => w.discrepancies.length > 0).length === 0 ? (
            <div className="pivt-card p-12 text-center">
              <CheckCircle2 className="w-8 h-8 text-validated mx-auto mb-3" />
              <p className="text-muted-foreground">No discrepancies found</p>
            </div>
          ) : (
            wireInstructions.filter(w => w.discrepancies.length > 0).map(wire => (
              <motion.div key={wire.id} {...fadeInUp} className="pivt-card p-5 border-l-4 border-destructive">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{wire.party}</p>
                    <div className="space-y-1 mt-2">
                      {wire.discrepancies.map((d, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> {d}
                        </p>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => handleResolve(wire)}>
                    Resolve
                  </Button>
                </div>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Discrepancies</DialogTitle>
            <DialogDescription>{selectedWire?.party} — {selectedWire?.discrepancies.length} issue(s)</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedWire?.discrepancies.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {d}
              </div>
            ))}
            <div>
              <label className="text-sm font-medium">Resolution Note</label>
              <Textarea value={resolutionNote} onChange={e => setResolutionNote(e.target.value)} placeholder="Describe how this was resolved..." className="mt-2" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmResolve}>Mark Resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
