import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { usePIVTStore } from '@/stores/pivtStore';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { fadeInUp } from '@/lib/animations';
import {
  Send, CheckCircle2, Clock, XCircle, Filter, Shield, FileCheck,
  AlertTriangle, MessageSquare, RotateCw, FileText, DollarSign,
  AlertCircle, Download, Zap, Bell, Loader2,
} from 'lucide-react';
import {
  listDisbursementIntents, retryDisbursement, statusLabel,
  type DisbursementIntent, type DisbursementStatus,
} from '@/services/disbursementService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { ExecutionReadinessPanel } from './ExecutionReadinessPanel';

// Mock payment data generator
const generateMockPayments = () => {
  const recipients = [
    'Atlas Capital Fund', 'John Smith', 'Vertex Investments LLC', 'Morgan Equity Partners',
    'Sarah Johnson', 'BlueSky Investments', 'David Chen', 'Westbridge Capital', 'Emily Rodriguez',
    'Sterling Partners', 'Michael Wong', 'Redwood Advisors', 'Jennifer Lee', 'Cascade Fund',
    'Robert Taylor', 'Northstar Capital', 'Amanda White', 'Evergreen Holdings', 'Thomas Brown', 'Silverstone Partners',
  ];
  const banks = ['JPMorgan Chase', 'Wells Fargo', 'Bank of America', 'Citi', 'HSBC', 'Deutsche Bank', 'BNP Paribas', 'Barclays'];
  const deals = ['Project ATLAS', 'Project BEACON', 'Project CIPHER'];
  const statuses = ['completed', 'pending', 'failed', 'in-progress'];

  return Array.from({ length: 30 }, (_, i) => ({
    id: String(i + 1),
    recipient: recipients[i % recipients.length],
    amount: Math.floor(Math.random() * 4000000) + 100000,
    currency: 'USD',
    bank: banks[i % banks.length],
    status: statuses[i % statuses.length],
    attempts: Math.floor(Math.random() * 3) + 1,
    lastEvent: ['Wire confirmed', 'Awaiting counsel approval', 'Bank routing error', 'KYC verification'][i % 4],
    lastEventTime: `${Math.floor(Math.random() * 60)} min ago`,
    fraud: { score: parseFloat((Math.random() * 0.3).toFixed(2)), status: ['clear', 'review', 'flagged'][Math.floor(Math.random() * 3)] },
    approvedBy: i % 3 === 0 ? '-' : ['Sarah Chen', 'Michael Ross', 'David Kim'][i % 3],
    kycComplete: i % 4 !== 0,
    taxComplete: i % 5 !== 0,
    approvalComplete: i % 3 !== 0,
    deal: deals[i % deals.length],
    timeline: [
      { event: 'Payment initiated', time: `Feb 14, ${10 + (i % 3)}:15 AM`, user: 'System' },
      { event: 'Bank routing validated', time: `Feb 14, ${10 + (i % 3)}:16 AM`, user: 'System' },
      { event: 'Fraud check passed', time: `Feb 14, ${10 + (i % 3)}:17 AM`, user: 'Compliance' },
      { event: 'Wire sent', time: `Feb 14, ${10 + (i % 3)}:20 AM`, user: 'Finance Team' },
      { event: 'Wire confirmed', time: `Feb 14, ${10 + (i % 3)}:35 AM`, user: banks[i % banks.length] },
    ],
    messages: [
      { from: 'Sarah Chen', message: 'Payment approved. Proceed with wire.', time: `Feb 14, ${10 + (i % 3)}:14 AM` },
      { from: 'Finance Team', message: `Wire sent via ${banks[i % banks.length]}. Reference: WR-2026-${4420 + i}.`, time: `Feb 14, ${10 + (i % 3)}:20 AM` },
    ],
    details: {
      recipientEmail: `contact${i}@example.com`,
      iban: `US${89370400440532013000 + i}`,
      swiftBic: ['CHASUS33', 'WFBIUS6S', 'BOFAUS3N', 'CITIUS33'][i % 4],
      reference: `WR-2026-${4420 + i}`,
    },
  }));
};

const mockPayments = generateMockPayments();

const mockRecipientData = {
  totalReceived: 2125000,
  inFlight: 450000,
  pendingVerification: 125000,
  avgSettlementTime: 3.2,
  deals: [
    { id: '1', name: 'Project ATLAS', amount: 2400000, status: 'processing', expectedDate: 'Mar 20, 2026', settledDate: null },
    { id: '2', name: 'Project BEACON', amount: 125000, status: 'pending', expectedDate: 'Apr 15, 2026', settledDate: null },
    { id: '3', name: 'Project CIPHER', amount: 1200000, status: 'settled', expectedDate: 'Feb 1, 2026', settledDate: 'Feb 1, 2026' },
    { id: '4', name: 'NeuralPath AI', amount: 450000, status: 'in-flight', expectedDate: 'Feb 18, 2026', settledDate: null },
  ],
};

export const PaymentsCover: React.FC = () => {
  const { isDemoDeal, dealId } = useDealWorkspace();
  const { user } = useAuth();
  const { stakeholders } = usePIVTStore();
  const pendingKyc = isDemoDeal ? stakeholders.filter(s => s.kycStatus !== 'verified').length : 0;

  // Real disbursement intents for non-demo deals — populated by the
  // disbursementService.executeDisbursement() flow from the Wire Pack tab.
  const [intents, setIntents] = useState<DisbursementIntent[]>([]);
  const [intentsLoading, setIntentsLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const refreshIntents = useCallback(async () => {
    if (!dealId || isDemoDeal) return;
    setIntentsLoading(true);
    try {
      const rows = await listDisbursementIntents(dealId);
      setIntents(rows);
    } catch (err) {
      console.warn('Failed to load disbursement intents:', err);
    } finally {
      setIntentsLoading(false);
    }
  }, [dealId, isDemoDeal]);

  useEffect(() => { refreshIntents(); }, [refreshIntents]);

  const handleRetry = useCallback(async (intent: DisbursementIntent) => {
    setRetryingId(intent.id);
    try {
      await retryDisbursement(intent, user?.id ?? null);
      toast.success(`Retry succeeded for ${intent.bank_account_ref || 'recipient'}`);
      await refreshIntents();
    } catch (err: any) {
      toast.error(err?.message || 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  }, [user?.id, refreshIntents]);

  const [activeTab, setActiveTab] = useState('all-payments');
  const [selectedPayment, setSelectedPayment] = useState<typeof mockPayments[0] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [earlyPayoutAmount, setEarlyPayoutAmount] = useState([50]);
  const [earlyPayoutDialogOpen, setEarlyPayoutDialogOpen] = useState(false);
  const [dealFilter, setDealFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bankFilter, setBankFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [streamingUpdates, setStreamingUpdates] = useState<string[]>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const updates = [
        'Wire confirmed for Atlas Capital Fund',
        'KYC verification completed for John Smith',
        'Payment approved by Sarah Chen',
        'Fraud check passed for Vertex Investments',
      ];
      setStreamingUpdates([updates[Math.floor(Math.random() * updates.length)]]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // Non-demo: show real disbursement_intents written by the Execute
  // Disbursement flow on the Wire Pack tab. Each row shows the recipient,
  // amount, current pipeline status, and provider reference.
  if (!isDemoDeal) {
    const settledCount = intents.filter(i => i.status === 'settled' || i.status === 'reconciled').length;
    const executedCount = intents.filter(i => i.status === 'executed').length;
    const failedCount = intents.filter(i => i.status === 'failed').length;
    const totalAmount = intents.reduce((s, i) => s + Number(i.amount_original || 0), 0);

    const statusBadge = (s: DisbursementStatus) => {
      const colors: Record<DisbursementStatus, string> = {
        settled: 'bg-emerald-500/10 text-emerald-600',
        reconciled: 'bg-emerald-500/10 text-emerald-600',
        executed: 'bg-blue-500/10 text-blue-600',
        executing: 'bg-amber-500/10 text-amber-600',
        eligible: 'bg-muted text-muted-foreground',
        pending_approvals: 'bg-amber-500/10 text-amber-600',
        pending_conditions: 'bg-amber-500/10 text-amber-600',
        draft: 'bg-muted text-muted-foreground',
        failed: 'bg-destructive/10 text-destructive',
      };
      return (
        <Badge className={`text-[10px] gap-1 ${colors[s]}`}>
          {s === 'executing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
          {(s === 'settled' || s === 'reconciled' || s === 'executed') && <CheckCircle2 className="w-2.5 h-2.5" />}
          {s === 'failed' && <XCircle className="w-2.5 h-2.5" />}
          {statusLabel(s)}
        </Badge>
      );
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Disbursement Intents</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Payment execution and settlement operations. Use the Wire Pack tab to execute disbursements.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refreshIntents} disabled={intentsLoading} className="gap-1.5">
            {intentsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
        </div>

        {intents.length === 0 ? (
          <motion.div {...fadeInUp} className="pivt-card p-12 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <DollarSign className="w-6 h-6 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-base font-semibold">No disbursement intents</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Generate the Wire Pack on the Execution → Wire Pack tab and click <strong>Execute Disbursement</strong>. Intents will appear here.
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Intents', value: intents.length, color: 'text-foreground' },
                { label: 'Total Amount', value: `$${(totalAmount / 1000).toFixed(0)}K`, color: 'text-foreground' },
                { label: 'Settled', value: settledCount, color: 'text-emerald-600' },
                { label: failedCount > 0 ? 'Failed' : 'Executed', value: failedCount > 0 ? failedCount : executedCount, color: failedCount > 0 ? 'text-destructive' : 'text-blue-600' },
              ].map(s => (
                <Card key={s.label}>
                  <CardContent className="pt-5 pb-4 px-4">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
                    <p className={`text-xl font-semibold mt-1 font-mono ${s.color}`}>{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Intents table */}
            <motion.div {...fadeInUp} className="pivt-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Rail</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Provider Ref</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {intents.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.bank_account_ref || 'Unknown recipient'}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px] uppercase">{i.rail}</Badge></TableCell>
                      <TableCell className="text-right font-mono">
                        {new Intl.NumberFormat('en-US', { style: 'currency', currency: i.currency_original || 'USD', maximumFractionDigits: 0 }).format(Number(i.amount_original))}
                      </TableCell>
                      <TableCell>{statusBadge(i.status)}</TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{i.provider_ref || '—'}</TableCell>
                      <TableCell className="text-[10px] text-muted-foreground">{new Date(i.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</TableCell>
                      <TableCell className="text-right">
                        {i.status === 'failed' && (
                          <Button variant="outline" size="sm" onClick={() => handleRetry(i)} disabled={retryingId === i.id} className="h-7 text-[11px] gap-1">
                            {retryingId === i.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />}
                            Retry
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </motion.div>
          </>
        )}
      </div>
    );
  }

  const filteredPayments = mockPayments.filter((p) => {
    const matchesSearch = p.recipient.toLowerCase().includes(searchQuery.toLowerCase()) || p.details.reference.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDeal = dealFilter === 'all' || p.deal === dealFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesBank = bankFilter === 'all' || p.bank === bankFilter;
    const matchesRisk = riskFilter === 'all' || (riskFilter === 'high' && p.fraud.score > 0.1) || (riskFilter === 'low' && p.fraud.score <= 0.1);
    return matchesSearch && matchesDeal && matchesStatus && matchesBank && matchesRisk;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': case 'settled': return 'text-validated';
      case 'processing': case 'in-progress': case 'in-flight': return 'text-blue-500';
      case 'pending': return 'text-discrepancy';
      case 'failed': return 'text-blocking';
      default: return 'text-muted-foreground';
    }
  };

  const getFraudColor = (score: number) => score > 0.1 ? 'text-blocking' : score > 0.05 ? 'text-discrepancy' : 'text-validated';

  const earlyPayoutCalc = (() => {
    const requested = (mockRecipientData.inFlight * earlyPayoutAmount[0]) / 100;
    const fee = (requested * 3.5) / 100;
    return { requested, fee, receive: requested - fee };
  })();

  return (
    <div className="space-y-6">
      {/* KYC Gating Banner */}
      {pendingKyc > 0 && (
        <div className="p-4 rounded-lg border border-blocking/30 bg-blocking/5 flex items-center gap-3">
          <Shield className="w-5 h-5 text-blocking flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blocking">Cannot release payments — KYC required</p>
            <p className="text-xs text-muted-foreground mt-0.5">{pendingKyc} stakeholder KYC profile{pendingKyc > 1 ? 's' : ''} must be verified before funds can be disbursed.</p>
          </div>
        </div>
      )}

      {/* Execution Readiness */}
      <ExecutionReadinessPanel />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Payments</h2>
          <p className="text-sm text-muted-foreground mt-1">Wire transfer operations and tracking</p>
        </div>
        {streamingUpdates.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/5 border border-blue-500/20 rounded text-xs text-blue-500">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            {streamingUpdates[0]}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all-payments" className="text-xs">All Payments</TabsTrigger>
          <TabsTrigger value="my-payments" className="text-xs">My Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="all-payments" className="space-y-4 mt-4">
          {/* Filters */}
          <div className="grid grid-cols-5 gap-3">
            <Select value={dealFilter} onValueChange={setDealFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Deal" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Deals</SelectItem>
                <SelectItem value="Project ATLAS">ATLAS</SelectItem>
                <SelectItem value="Project BEACON">BEACON</SelectItem>
                <SelectItem value="Project CIPHER">CIPHER</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={bankFilter} onValueChange={setBankFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Bank" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Banks</SelectItem>
                <SelectItem value="JPMorgan Chase">JPMorgan</SelectItem>
                <SelectItem value="Wells Fargo">Wells Fargo</SelectItem>
                <SelectItem value="HSBC">HSBC</SelectItem>
              </SelectContent>
            </Select>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Risk" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 text-xs" />
          </div>

          {/* Table */}
          <div className="pivt-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-medium">Recipient</TableHead>
                  <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                  <TableHead className="text-xs font-medium">Bank</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                  <TableHead className="text-xs font-medium">Last Event</TableHead>
                  <TableHead className="text-xs font-medium text-center">Fraud</TableHead>
                  <TableHead className="text-xs font-medium">Approved By</TableHead>
                  <TableHead className="text-xs font-medium w-20"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.slice(0, 20).map((payment) => (
                  <TableRow key={payment.id} onClick={() => { setSelectedPayment(payment); setDrawerOpen(true); }} className="cursor-pointer hover:bg-muted/30 group">
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          {payment.kycComplete ? <CheckCircle2 className="w-3 h-3 text-validated" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                          {payment.taxComplete ? <FileCheck className="w-3 h-3 text-validated" /> : <XCircle className="w-3 h-3 text-muted-foreground" />}
                          {payment.approvalComplete ? <Shield className="w-3 h-3 text-validated" /> : <Clock className="w-3 h-3 text-discrepancy" />}
                        </div>
                        <span>{payment.recipient}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-mono text-right tabular-nums">${payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payment.bank}</TableCell>
                    <TableCell><span className={`text-xs font-medium ${getStatusColor(payment.status)}`}>{payment.status}</span></TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{payment.lastEvent}</div>
                        <div className="text-muted-foreground text-[10px] mt-0.5">{payment.lastEventTime}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center"><span className={`text-xs font-mono ${getFraudColor(payment.fraud.score)}`}>{(payment.fraud.score * 100).toFixed(1)}%</span></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{payment.approvedBy}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); toast.info('Opening audit trail...'); }}><FileText className="h-3 w-3" /></Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); toast.info('Opening messages...'); }}><MessageSquare className="h-3 w-3" /></Button>
                        {payment.status === 'failed' && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); toast.success('Retrying wire transfer...'); }}><RotateCw className="h-3 w-3" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {filteredPayments.length === 0 && <div className="text-center py-12 text-muted-foreground text-sm">No payments found</div>}
        </TabsContent>

        <TabsContent value="my-payments" className="space-y-6 mt-4">
          {/* Notification Banner */}
          <div className="p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
            <div className="flex items-start gap-3">
              <Bell className="w-4 h-4 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm">Funds scheduled for release tomorrow, 09:00 ET</p>
                <p className="text-xs text-muted-foreground mt-0.5">$2,400,000 from Project ATLAS will be wired to your account ending in 3421</p>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Total Received</CardTitle></CardHeader><CardContent><div className="text-2xl font-light tabular-nums">${(mockRecipientData.totalReceived / 1e6).toFixed(2)}M</div><div className="flex items-center gap-1 mt-2"><CheckCircle2 className="w-3 h-3 text-validated" /><span className="text-xs text-validated">All settled</span></div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">In Transit</CardTitle></CardHeader><CardContent><div className="text-2xl font-light tabular-nums">${(mockRecipientData.inFlight / 1e3).toLocaleString()}K</div><div className="flex items-center gap-1 mt-2"><Clock className="w-3 h-3 text-blue-500" /><span className="text-xs text-blue-500">Expected within 2 days</span></div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Pending Verification</CardTitle></CardHeader><CardContent><div className="text-2xl font-light tabular-nums">${(mockRecipientData.pendingVerification / 1e3).toLocaleString()}K</div><div className="flex items-center gap-1 mt-2"><AlertCircle className="w-3 h-3 text-discrepancy" /><span className="text-xs text-discrepancy">Awaiting approval</span></div></CardContent></Card>
            <Card><CardHeader className="pb-3"><CardTitle className="text-xs text-muted-foreground font-normal">Avg Settlement</CardTitle></CardHeader><CardContent><div className="flex items-baseline gap-2"><span className="text-2xl font-light tabular-nums">{mockRecipientData.avgSettlementTime}</span><span className="text-sm text-muted-foreground">days</span></div><div className="flex items-center gap-1 mt-2"><DollarSign className="w-3 h-3 text-validated" /><span className="text-xs text-validated">Faster than avg</span></div></CardContent></Card>
          </div>

          {/* My Deals Table */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">My Payment Details</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/30">
                    <TableHead className="text-xs">Deal</TableHead>
                    <TableHead className="text-xs text-right">Amount</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Expected Date</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockRecipientData.deals.map((deal) => (
                    <TableRow key={deal.id}>
                      <TableCell className="text-sm">{deal.name}</TableCell>
                      <TableCell className="text-sm font-mono text-right tabular-nums">${deal.amount.toLocaleString()}</TableCell>
                      <TableCell><Badge variant="outline" className={`text-xs ${getStatusColor(deal.status)}`}>{deal.status}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{deal.expectedDate}</TableCell>
                      <TableCell className="text-right">
                        {deal.status === 'settled' && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => toast.success(`Downloading receipt for ${deal.name}`)}><Download className="mr-1 h-3 w-3" />Receipt</Button>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Early Payout */}
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Zap className="w-4 h-4 text-discrepancy" />Early Payout Available</CardTitle></CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">Get up to ${mockRecipientData.inFlight.toLocaleString()} now instead of waiting for settlement.</p>
              <Dialog open={earlyPayoutDialogOpen} onOpenChange={setEarlyPayoutDialogOpen}>
                <Button onClick={() => setEarlyPayoutDialogOpen(true)} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white"><Zap className="mr-2 h-4 w-4" />Request Early Payout</Button>
                <DialogContent>
                  <DialogHeader><DialogTitle>Request Early Payout</DialogTitle><DialogDescription>Choose how much of your in-transit funds you'd like to receive early.</DialogDescription></DialogHeader>
                  <div className="space-y-6 py-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2"><span>Amount</span><span className="font-mono">{earlyPayoutAmount[0]}%</span></div>
                      <Slider value={earlyPayoutAmount} onValueChange={setEarlyPayoutAmount} max={100} step={5} />
                    </div>
                    <div className="space-y-2 p-4 bg-muted rounded-lg">
                      <div className="flex justify-between text-sm"><span>Requested</span><span className="font-mono">${earlyPayoutCalc.requested.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm text-muted-foreground"><span>Fee (3.5%)</span><span className="font-mono">-${earlyPayoutCalc.fee.toLocaleString()}</span></div>
                      <div className="flex justify-between text-sm font-medium pt-2 border-t"><span>You'll receive</span><span className="font-mono text-validated">${earlyPayoutCalc.receive.toLocaleString()}</span></div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEarlyPayoutDialogOpen(false)}>Cancel</Button>
                    <Button onClick={() => { toast.success(`Early payout request submitted.`); setEarlyPayoutDialogOpen(false); }}>Confirm</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Payment Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[600px] sm:w-[700px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl font-light">{selectedPayment?.recipient}</SheetTitle>
            <SheetDescription className="text-xs">{selectedPayment?.details.reference} · {selectedPayment?.deal}</SheetDescription>
          </SheetHeader>
          {selectedPayment && (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-3 gap-3">
                <div className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">Amount</div><div className="text-lg font-mono mt-1 tabular-nums">${selectedPayment.amount.toLocaleString()}</div></div>
                <div className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">Status</div><div className={`text-sm font-medium mt-1 ${getStatusColor(selectedPayment.status)}`}>{selectedPayment.status}</div></div>
                <div className="border rounded-lg p-3"><div className="text-xs text-muted-foreground">Fraud Score</div><div className={`text-sm font-mono mt-1 ${getFraudColor(selectedPayment.fraud.score)}`}>{(selectedPayment.fraud.score * 100).toFixed(1)}%</div></div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Banking Details</h3>
                <div className="border rounded-lg p-4 space-y-3 bg-muted/20">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-muted-foreground">Bank</div><div className="font-medium mt-1">{selectedPayment.bank}</div></div>
                    <div><div className="text-muted-foreground">SWIFT/BIC</div><div className="font-mono mt-1">{selectedPayment.details.swiftBic}</div></div>
                    <div className="col-span-2"><div className="text-muted-foreground">IBAN</div><div className="font-mono mt-1">{selectedPayment.details.iban}</div></div>
                    <div><div className="text-muted-foreground">Reference</div><div className="font-mono mt-1">{selectedPayment.details.reference}</div></div>
                    <div><div className="text-muted-foreground">Attempts</div><div className="font-medium mt-1">{selectedPayment.attempts}</div></div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Compliance Status</h3>
                <div className="space-y-2">
                  {[
                    { label: 'KYC Verification', done: selectedPayment.kycComplete, icon: CheckCircle2 },
                    { label: 'Tax Documentation', done: selectedPayment.taxComplete, icon: FileCheck },
                    { label: 'Counsel Approval', done: selectedPayment.approvalComplete, icon: Shield },
                  ].map(({ label, done, icon: Icon }) => (
                    <div key={label} className="flex items-center justify-between text-xs p-2 border rounded">
                      <div className="flex items-center gap-2">{done ? <Icon className="w-4 h-4 text-validated" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}<span>{label}</span></div>
                      <Badge variant="outline" className={done ? 'bg-validated/10 text-validated border-validated/20' : 'bg-muted text-muted-foreground'}>{done ? 'Complete' : 'Pending'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Event Timeline</h3>
                <div className="space-y-3">
                  {selectedPayment.timeline.map((item, i) => (
                    <div key={i} className="flex gap-3"><div className="w-2 h-2 rounded-full bg-accent mt-1.5" /><div className="flex-1"><div className="text-sm">{item.event}</div><div className="text-xs text-muted-foreground mt-0.5">{item.time} · {item.user}</div></div></div>
                  ))}
                </div>
              </div>
              {selectedPayment.messages.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Messages</h3>
                  <div className="space-y-2">{selectedPayment.messages.map((msg, i) => (
                    <div key={i} className="border rounded-lg p-3 bg-muted/20"><div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">{msg.from}</span><span className="text-xs text-muted-foreground">{msg.time}</span></div><div className="text-sm">{msg.message}</div></div>
                  ))}</div>
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t">
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toast.info('Opening audit trail...')}><FileText className="mr-2 h-3 w-3" />Audit Trail</Button>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => toast.info('Opening messages...')}><MessageSquare className="mr-2 h-3 w-3" />Message</Button>
                {selectedPayment.status === 'failed' && <Button size="sm" className="flex-1 text-xs" onClick={() => toast.success('Retrying wire transfer...')}><RotateCw className="mr-2 h-3 w-3" />Retry</Button>}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
