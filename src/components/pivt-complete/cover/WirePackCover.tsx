import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { fadeInUp } from '@/lib/animations';
import { WirePackSuccessCard } from '@/components/wirepack/WirePackSuccessCard';
import {
  ShieldCheck, AlertTriangle, FileText, Download, CheckCircle2,
  Clock, XCircle, Loader2, RefreshCw, FileJson, FileSpreadsheet,
  Zap, Send,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { SimulationNotice } from './SimulationNotice';
import {
  executeDisbursement, listDisbursementIntents, statusLabel,
  type DisbursementIntent, type DisbursementStatus,
} from '@/services/disbursementService';

interface WirePack {
  deal_id: string;
  deal_name: string;
  deal_number: string;
  deal_value: number;
  currency: string;
  generated_at: string;
  is_ready: boolean;
  status: 'ready' | 'pending_approvals' | 'not_ready';
  readiness: {
    wires_uploaded: boolean;
    wires_verified: boolean;
    critical_discrepancies_resolved: boolean;
    approvals_complete: boolean;
    pending_approval_count: number;
    unverified_wire_count: number;
    open_critical_count: number;
  };
  summary: {
    total_wires: number;
    total_amount: number;
    verified_count: number;
    discrepancies_total: number;
    discrepancies_open: number;
    approvals_total: number;
    approvals_complete: number;
  };
  wire_summary: Array<{
    id: string;
    beneficiary: string;
    bank_name: string;
    account_last4: string;
    routing_swift: string;
    amount: number;
    currency: string;
    payment_type: string;
    reference: string;
    verification_status: string;
  }>;
  source_mapping: Array<{
    wire_id: string;
    payee: string;
    funds_flow_entry: { document: string; doc_type: string } | null;
    stakeholder_match: { name: string; role: string; payout: number } | null;
  }>;
  discrepancy_log: Array<{
    id: string;
    rule: string;
    severity: string;
    message: string;
    status: string;
    resolved_at: string | null;
  }>;
  approval_record: Array<{
    id: string;
    approver: string;
    email: string | null;
    role: string | null;
    side: string;
    status: string;
    method: string;
    completed_at: string | null;
    required: boolean;
  }>;
}

const STATUS_CONFIG = {
  ready: { label: 'Ready to Execute', icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  pending_approvals: { label: 'Pending Approvals', icon: Clock, className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  not_ready: { label: 'Not Ready', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const fmtCurrency = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

export const WirePackCover: React.FC = () => {
  const { dealId } = useDealWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();
  const [pack, setPack] = useState<WirePack | null>(null);
  const [loading, setLoading] = useState(false);

  // Disbursement state — null until user clicks Execute. Once execution
  // begins, we surface live progress per intent so the operator sees the
  // pipeline rather than a spinner.
  const [intents, setIntents] = useState<DisbursementIntent[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [liveStatus, setLiveStatus] = useState<Record<string, DisbursementStatus>>({});

  // Always show what's already been executed for this deal on mount. Lets
  // users come back to the tab later and see prior closing artifacts.
  useEffect(() => {
    if (!dealId) return;
    listDisbursementIntents(dealId).then(setIntents).catch(() => undefined);
  }, [dealId]);

  const allSettled = intents.length > 0 && intents.every(i => i.status === 'settled' || i.status === 'reconciled');
  const anyExecuted = intents.some(i => i.status === 'executed' || i.status === 'settled' || i.status === 'reconciled' || i.status === 'executing');

  const generatePack = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-wire-pack', {
        body: { deal_id: dealId },
      });
      if (error) throw error;
      if (data?.pack) {
        setPack(data.pack);
        toast({ title: 'Wire Pack generated', description: `Status: ${data.pack.status}` });
      }
    } catch (e) {
      toast({ title: 'Generation failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [dealId, toast]);

  // The actual "close the deal" action. Creates disbursement_intents from
  // the verified wires + runs the mock-provider simulator (executing →
  // executed → settled) with live UI updates per intent. Audit log gets a
  // row at each transition so the Audit tab tells the whole closing story.
  const handleExecute = useCallback(async () => {
    if (!dealId) return;
    setExecuting(true);
    setLiveStatus({});
    setConfirmOpen(false);
    try {
      const result = await executeDisbursement({
        dealId,
        userId: user?.id ?? null,
        onProgress: ({ intentId, status }) => {
          setLiveStatus((prev) => ({ ...prev, [intentId]: status }));
        },
      });
      setIntents(result.intents);
      if (result.created === 0) {
        toast({ title: 'Nothing to disburse', description: 'All verified wires already have disbursement intents.' });
      } else {
        toast({
          title: 'Disbursement complete',
          description: `${result.executed} of ${result.created} wires settled${result.failed > 0 ? `, ${result.failed} failed` : ''}.`,
        });
      }
    } catch (e) {
      toast({
        title: 'Execution failed',
        description: (e as Error).message,
        variant: 'destructive',
      });
    } finally {
      setExecuting(false);
    }
  }, [dealId, user?.id, toast]);

  // Pull the latest status from the live map first (covers the few seconds
  // between an audit-log update and the next refetch), then fall back to the
  // stored row.
  const visibleStatus = (intent: DisbursementIntent): DisbursementStatus =>
    liveStatus[intent.id] || intent.status;

  const exportPDF = useCallback(() => {
    if (!pack) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(18);
    doc.setTextColor(20, 20, 40);
    doc.text('PIVT', 14, 18);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text('Ready-to-Execute Wire Pack', 14, 23);

    doc.setFontSize(12);
    doc.setTextColor(20, 20, 40);
    doc.text(`${pack.deal_name} (${pack.deal_number})`, 14, 36);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Generated: ${new Date(pack.generated_at).toLocaleString()}`, 14, 43);
    doc.text(`Total: ${fmtCurrency(pack.summary.total_amount, pack.currency)} • ${pack.summary.total_wires} wires`, 14, 49);

    let y = 58;
    doc.setFontSize(10);
    doc.setTextColor(20);
    const headers = ['Beneficiary', 'Bank', 'Acct', 'Routing/SWIFT', 'Amount', 'Currency', 'Type'];
    const colX = [14, 60, 110, 140, 185, 220, 245];
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 6;
    doc.setDrawColor(200);
    doc.line(14, y, pw - 14, y);
    y += 4;

    doc.setFontSize(8);
    pack.wire_summary.forEach((w) => {
      if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
      const row = [w.beneficiary, w.bank_name, w.account_last4, w.routing_swift, fmtCurrency(w.amount), w.currency, w.payment_type];
      row.forEach((v, i) => doc.text(String(v).slice(0, 30), colX[i], y));
      y += 5;
    });

    if (pack.is_ready) {
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(16, 120, 60);
      doc.text('✓ This wire pack has been reconciled across all sources and approved for execution.', 14, y);
    }

    doc.save(`Wire-Pack-${pack.deal_number}.pdf`);
    toast({ title: 'PDF exported' });
  }, [pack, toast]);

  const exportCSV = useCallback(() => {
    if (!pack) return;
    const headers = ['Beneficiary', 'Bank', 'Account (last 4)', 'Routing/SWIFT', 'Amount', 'Currency', 'Payment Type', 'Reference', 'Status'];
    const rows = pack.wire_summary.map(w => [w.beneficiary, w.bank_name, w.account_last4, w.routing_swift, String(w.amount), w.currency, w.payment_type, w.reference, w.verification_status]);
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Wire-Pack-${pack.deal_number}.csv`;
    a.click();
    toast({ title: 'CSV exported' });
  }, [pack, toast]);

  const exportJSON = useCallback(() => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Wire-Pack-${pack.deal_number}.json`;
    a.click();
    toast({ title: 'JSON exported' });
  }, [pack, toast]);

  const statusConfig = pack ? STATUS_CONFIG[pack.status] : STATUS_CONFIG.not_ready;
  const StatusIcon = statusConfig.icon;

  return (
    <motion.div {...fadeInUp} className="space-y-6">
      <SimulationNotice className="mb-4" />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Wire Pack</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Ready-to-execute wire instruction package</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className={`${statusConfig.className} border px-3 py-1`}>
            <StatusIcon className="w-3.5 h-3.5 mr-1.5" />
            {statusConfig.label}
          </Badge>
          <Button onClick={generatePack} disabled={loading || executing} variant="outline" className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {pack ? 'Refresh Wire Pack' : 'Generate Wire Pack'}
          </Button>
          {/* Execute Disbursement — the "actually close the deal" button.
              Visibility is gated on having verified wires (the only hard
              requirement — the service skips unverified ones). Soft gates
              (approvals complete, discrepancies resolved) get surfaced in
              the confirmation dialog so the user can override with a
              warning rather than be silently blocked. */}
          {pack && pack.summary.verified_count > 0 && !allSettled && (
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={executing}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {executing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {executing ? 'Executing…' : anyExecuted ? 'Resume Disbursement' : 'Execute Disbursement'}
            </Button>
          )}
        </div>
      </div>

      {/* Disbursement Progress — appears once execution starts OR once any
          intent has been created for this deal. Shows each wire moving
          through the eligible → executing → executed → settled pipeline. */}
      {(executing || intents.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Send className="w-4 h-4 text-accent" />
              Disbursement {allSettled ? 'Complete' : executing ? 'In Progress' : 'History'}
            </CardTitle>
            <CardDescription className="text-xs">
              {allSettled
                ? `${intents.length} wire${intents.length !== 1 ? 's' : ''} settled via mock provider. Full audit trail in the Audit tab.`
                : executing
                  ? 'Mock provider is processing wires. Each transition is recorded in the audit log.'
                  : `${intents.length} disbursement intent${intents.length !== 1 ? 's' : ''} on record.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recipient</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Provider Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intents.map((i) => {
                  const status = visibleStatus(i);
                  const statusColor =
                    status === 'settled' || status === 'reconciled' ? 'bg-emerald-500/10 text-emerald-600' :
                    status === 'executed' ? 'bg-blue-500/10 text-blue-600' :
                    status === 'executing' ? 'bg-amber-500/10 text-amber-600' :
                    status === 'failed' ? 'bg-destructive/10 text-destructive' :
                    'bg-muted text-muted-foreground';
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.bank_account_ref || 'Unknown recipient'}</TableCell>
                      <TableCell className="text-right font-mono">{fmtCurrency(Number(i.amount_original), i.currency_original)}</TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${statusColor} gap-1`}>
                          {status === 'executing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                          {(status === 'settled' || status === 'executed' || status === 'reconciled') && <CheckCircle2 className="w-2.5 h-2.5" />}
                          {status === 'failed' && <XCircle className="w-2.5 h-2.5" />}
                          {statusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-muted-foreground">{i.provider_ref || '—'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Confirmation — this writes mock-provider transactions, but the
          intents and audit entries are real DB rows. Worth a pause. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Execute disbursement?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates a disbursement intent for each verified wire on this deal and runs the mock partner-bank provider, transitioning each through eligible → executing → executed → settled. Audit-log entries are written at every step.
              <br /><br />
              {pack && (
                <span>
                  <strong>{pack.summary.verified_count}</strong> verified wire{pack.summary.verified_count !== 1 ? 's' : ''} totaling <strong>{fmtCurrency(pack.summary.total_amount, pack.currency)}</strong> will be disbursed.
                </span>
              )}
              {pack && !pack.is_ready && (
                <span className="block mt-3 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-amber-700 text-xs">
                  <strong>Heads up:</strong> some readiness gates aren't passed yet
                  {pack.readiness.pending_approval_count > 0 && ` (${pack.readiness.pending_approval_count} pending approval)`}
                  {pack.readiness.unverified_wire_count > 0 && ` (${pack.readiness.unverified_wire_count} unverified wire — will be skipped)`}
                  {pack.readiness.open_critical_count > 0 && ` (${pack.readiness.open_critical_count} open critical discrepancy)`}
                  . You're choosing to proceed anyway — this is logged in the audit trail.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleExecute} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Execute now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!pack && !loading && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
            <h3 className="text-base font-medium text-foreground mb-2">No Wire Pack Generated</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Generate a wire pack to compile all wire instructions, source mappings, discrepancy logs, and approval records into a single exportable package.
            </p>
            <Button onClick={generatePack} className="gap-2">
              <ShieldCheck className="w-4 h-4" />
              Generate Wire Pack
            </Button>
          </CardContent>
        </Card>
      )}

      {loading && !pack && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-accent animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Assembling wire pack…</p>
          </CardContent>
        </Card>
      )}

      {pack && (
        <>
          {/* Premium Success Card */}
          {pack.is_ready && (
            <WirePackSuccessCard
              dealName={pack.deal_name}
              totalAmount={fmtCurrency(pack.summary.total_amount, pack.currency)}
              wireCount={pack.summary.total_wires}
              timestamp={pack.generated_at}
              onViewWirePack={() => {}}
              onDownloadPDF={exportPDF}
            />
          )}

          {/* Readiness Gates */}
          {!pack.is_ready && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Readiness Gates</CardTitle>
                <CardDescription className="text-xs">All gates must pass before the wire pack can be executed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {[
                  { label: 'Wires uploaded', ok: pack.readiness.wires_uploaded },
                  { label: 'All wires verified', ok: pack.readiness.wires_verified, detail: pack.readiness.unverified_wire_count > 0 ? `${pack.readiness.unverified_wire_count} unverified` : undefined },
                  { label: 'Critical discrepancies resolved', ok: pack.readiness.critical_discrepancies_resolved, detail: pack.readiness.open_critical_count > 0 ? `${pack.readiness.open_critical_count} open` : undefined },
                  { label: 'Required approvals complete', ok: pack.readiness.approvals_complete, detail: pack.readiness.pending_approval_count > 0 ? `${pack.readiness.pending_approval_count} pending` : undefined },
                ].map((gate) => (
                  <div key={gate.label} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
                    {gate.ok ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className="text-sm text-foreground flex-1">{gate.label}</span>
                    {gate.detail && <span className="text-xs text-muted-foreground">{gate.detail}</span>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Wires', value: pack.summary.total_wires },
              { label: 'Total Amount', value: fmtCurrency(pack.summary.total_amount, pack.currency) },
              { label: 'Verified', value: `${pack.summary.verified_count}/${pack.summary.total_wires}` },
              { label: 'Discrepancies', value: `${pack.summary.discrepancies_open} open / ${pack.summary.discrepancies_total}` },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-5 pb-4 px-4">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</p>
                  <p className="text-xl font-semibold text-foreground mt-1 font-mono">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tabbed Detail View */}
          <Tabs defaultValue="wires" className="w-full">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="wires">Wire Summary</TabsTrigger>
                <TabsTrigger value="sources">Source Mapping</TabsTrigger>
                <TabsTrigger value="discrepancies">Discrepancy Log</TabsTrigger>
                <TabsTrigger value="approvals">Approval Record</TabsTrigger>
              </TabsList>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5 text-xs">
                  <FileText className="w-3.5 h-3.5" /> PDF
                </Button>
                <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5 text-xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportJSON} className="gap-1.5 text-xs">
                  <FileJson className="w-3.5 h-3.5" /> JSON
                </Button>
              </div>
            </div>

            <TabsContent value="wires">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beneficiary</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Routing/SWIFT</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Currency</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pack.wire_summary.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No wire instructions found</TableCell></TableRow>
                    ) : pack.wire_summary.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="font-medium">{w.beneficiary}</TableCell>
                        <TableCell>{w.bank_name}</TableCell>
                        <TableCell className="font-mono text-xs">{w.account_last4}</TableCell>
                        <TableCell className="font-mono text-xs">{w.routing_swift}</TableCell>
                        <TableCell className="text-right font-mono">{fmtCurrency(w.amount, w.currency)}</TableCell>
                        <TableCell>{w.currency}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-[10px]">{w.payment_type}</Badge></TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${w.verification_status === 'verified' || w.verification_status === 'confirmed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {w.verification_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="sources">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payee</TableHead>
                      <TableHead>Source Document</TableHead>
                      <TableHead>Stakeholder Match</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pack.source_mapping.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No source mappings</TableCell></TableRow>
                    ) : pack.source_mapping.map((m) => (
                      <TableRow key={m.wire_id}>
                        <TableCell className="font-medium">{m.payee}</TableCell>
                        <TableCell>{m.funds_flow_entry ? <span className="text-xs">{m.funds_flow_entry.document}</span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                        <TableCell>{m.stakeholder_match ? m.stakeholder_match.name : <span className="text-amber-500 text-xs">No match</span>}</TableCell>
                        <TableCell>{m.stakeholder_match?.role || '—'}</TableCell>
                        <TableCell className="text-right font-mono">{m.stakeholder_match ? fmtCurrency(m.stakeholder_match.payout) : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="discrepancies">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Severity</TableHead>
                      <TableHead>Rule</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Resolved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pack.discrepancy_log.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No discrepancies recorded</TableCell></TableRow>
                    ) : pack.discrepancy_log.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Badge className={`text-[10px] ${d.severity === 'critical' ? 'bg-destructive/10 text-destructive' : d.severity === 'high' ? 'bg-amber-500/10 text-amber-600' : 'bg-muted text-muted-foreground'}`}>
                            {d.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.rule}</TableCell>
                        <TableCell className="text-sm">{d.message}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${d.status === 'resolved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {d.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.resolved_at ? new Date(d.resolved_at).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            <TabsContent value="approvals">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Approver</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Side</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Completed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pack.approval_record.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No approvals recorded</TableCell></TableRow>
                    ) : pack.approval_record.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.approver}</TableCell>
                        <TableCell>{a.role || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{a.side}</Badge></TableCell>
                        <TableCell className="text-xs">{a.method}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.completed_at ? new Date(a.completed_at).toLocaleString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </motion.div>
  );
};
