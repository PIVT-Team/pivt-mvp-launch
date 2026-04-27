import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, CheckCircle2, Circle, AlertTriangle, Users, FileText, CreditCard,
  ClipboardCheck, ShieldCheck, Loader2, ArrowRight, Rocket, Lock,
  FileSpreadsheet, FileJson, Download, RefreshCw, ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';

import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { fadeInUp } from '@/lib/animations';
import { jsPDF } from 'jspdf';

/* ── Types ── */

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

const fmtCurrency = (n: number, c = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: c, maximumFractionDigits: 0 }).format(n);

/* ── Navigation helper ── */
const navigateToSection = (step: string, sub?: string) => {
  window.dispatchEvent(new CustomEvent('pivt:navigate-workspace', { detail: { step, sub } }));
};

/* ── Component ── */

export const ExecutionPrepCover: React.FC = () => {
  const { dealId, metrics, metricsLoading, workflow } = useDealWorkspace();
  const { toast } = useToast();
  const loading = metricsLoading;

  const [pack, setPack] = useState<WirePack | null>(null);
  const [generating, setGenerating] = useState(false);

  /* Build checklist from live metrics */
  const gates = metrics?.gates;
  const checklist = [
    {
      id: 'stakeholders',
      label: 'Stakeholders Added',
      description: 'Add buyer, seller, and target parties with contacts',
      icon: Users,
      passed: gates?.stakeholdersConfigured ?? false,
      detail: metrics ? `${metrics.totalStakeholders} total` : '',
      action: () => navigateToSection('stakeholders', 'deal-parties'),
    },
    {
      id: 'kyc',
      label: 'KYC / KYB Complete',
      description: 'Verify identity for all required stakeholders',
      icon: Shield,
      passed: (gates?.sellerVerified ?? false) && (gates?.buyerVerified ?? false),
      detail: metrics ? `Seller: ${gates?.sellerVerified ? '✓' : '✗'} · Buyer: ${gates?.buyerVerified ? '✓' : '✗'}` : '',
      action: () => navigateToSection('stakeholders', 'kyc'),
    },
    {
      id: 'documents',
      label: 'Required Documents Uploaded',
      description: 'Upload SPA, Funds Flow Memo, and other required agreements',
      icon: FileText,
      passed: gates?.spaUploaded ?? false,
      detail: metrics ? `${metrics.totalUploadedDocuments} uploaded · ${metrics.completedRequiredDocuments}/${metrics.requiredDocuments} required` : '',
      action: () => navigateToSection('deal-inputs', 'contracts'),
    },
    {
      id: 'wires',
      label: 'Wire Instructions Uploaded',
      description: 'Add buyer and seller wire transfer instructions',
      icon: CreditCard,
      passed: gates?.wireInstructionsUploaded ?? false,
      detail: metrics ? `${metrics.totalWireInstructions} on file` : '',
      action: () => navigateToSection('deal-inputs', 'wires'),
    },
    {
      id: 'tax',
      label: 'Tax Forms Complete',
      description: 'Upload required W-9 / W-8BEN forms for applicable stakeholders',
      icon: FileSpreadsheet,
      passed: false, // No totalTaxForms in metrics yet; always shows as actionable
      detail: '',
      action: () => navigateToSection('deal-inputs', 'tax'),
    },
    {
      id: 'obligations',
      label: 'Payment Obligations Reviewed',
      description: 'Review extracted payment obligations from agreements',
      icon: FileText,
      passed: (metrics?.totalObligations ?? 0) > 0,
      detail: metrics ? `${metrics.totalObligations ?? 0} obligations` : '',
      action: () => navigateToSection('deal-inputs', 'obligations'),
    },
    {
      id: 'discrepancies',
      label: 'Discrepancies Resolved',
      description: 'Resolve all critical discrepancies across wire instructions and funds flow',
      icon: AlertTriangle,
      passed: (metrics?.reconciliationIssues ?? []).filter(i => i.severity === 'error').length === 0,
      detail: metrics ? `${(metrics.reconciliationIssues ?? []).filter(i => i.severity === 'error').length} blocking` : '',
      action: () => navigateToSection('execution', 'discrepancies'),
    },
    {
      id: 'approvals',
      label: 'Approvals Completed',
      description: 'Obtain all required approvals from buyer and seller counsel',
      icon: ClipboardCheck,
      passed: gates?.approvalsComplete ?? false,
      detail: metrics ? `${metrics.grantedRequiredApprovals}/${metrics.requiredApprovals} required` : '',
      action: () => navigateToSection('approvals'),
    },
  ];

  const passedCount = checklist.filter(c => c.passed).length;
  const progressPct = checklist.length > 0 ? Math.round((passedCount / checklist.length) * 100) : 0;
  const allPassed = passedCount === checklist.length;

  /* Generate wire pack */
  const generatePack = useCallback(async () => {
    if (!dealId) return;
    setGenerating(true);
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
      setGenerating(false);
    }
  }, [dealId, toast]);

  /* Exports */
  const exportPDF = useCallback(() => {
    if (!pack) return;
    const doc = new jsPDF({ orientation: 'landscape' });
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(18); doc.setTextColor(20, 20, 40); doc.text('PIVT', 14, 18);
    doc.setFontSize(8); doc.setTextColor(120); doc.text('Ready-to-Execute Wire Pack', 14, 23);
    doc.setFontSize(12); doc.setTextColor(20, 20, 40);
    doc.text(`${pack.deal_name} (${pack.deal_number})`, 14, 36);
    doc.setFontSize(9); doc.setTextColor(80);
    doc.text(`Generated: ${new Date(pack.generated_at).toLocaleString()}`, 14, 43);
    doc.text(`Total: ${fmtCurrency(pack.summary.total_amount, pack.currency)} · ${pack.summary.total_wires} wires`, 14, 49);
    let y = 58;
    doc.setFontSize(10); doc.setTextColor(20);
    const headers = ['Beneficiary', 'Bank', 'Acct', 'Routing/SWIFT', 'Amount', 'Currency', 'Type'];
    const colX = [14, 60, 110, 140, 185, 220, 245];
    headers.forEach((h, i) => doc.text(h, colX[i], y));
    y += 6; doc.setDrawColor(200); doc.line(14, y, pw - 14, y); y += 4;
    doc.setFontSize(8);
    pack.wire_summary.forEach((w) => {
      if (y > doc.internal.pageSize.getHeight() - 20) { doc.addPage(); y = 20; }
      const row = [w.beneficiary, w.bank_name, w.account_last4, w.routing_swift, fmtCurrency(w.amount), w.currency, w.payment_type];
      row.forEach((v, i) => doc.text(String(v).slice(0, 30), colX[i], y));
      y += 5;
    });
    if (pack.is_ready) {
      y += 8; doc.setFontSize(9); doc.setTextColor(16, 120, 60);
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Wire-Pack-${pack.deal_number}.csv`; a.click();
    toast({ title: 'CSV exported' });
  }, [pack, toast]);

  const exportJSON = useCallback(() => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Wire-Pack-${pack.deal_number}.json`; a.click();
    toast({ title: 'JSON exported' });
  }, [pack, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <motion.div {...fadeInUp} className="pivt-card border border-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Rocket className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Execution Prep</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Complete all prerequisites, then generate your wire pack for execution.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`text-xs font-mono px-3 py-1 ${
              allPassed ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                : progressPct >= 50 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
            }`}>
              {allPassed ? 'Ready' : `${passedCount}/${checklist.length} Complete`}
            </Badge>
            <span className={`text-3xl font-bold font-mono ${
              allPassed ? 'text-emerald-500' : progressPct >= 50 ? 'text-amber-500' : 'text-red-500'
            }`}>
              {progressPct}%
            </span>
          </div>
        </div>
        <Progress value={progressPct} className={`h-2 ${
          allPassed ? '[&>div]:bg-emerald-500'
            : progressPct >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
        }`} />
      </motion.div>

      {/* ── Checklist ── */}
      <motion.div {...fadeInUp} className="pivt-card border border-border/50 p-6">
        <h3 className="text-sm font-semibold mb-5 text-muted-foreground uppercase tracking-wider">Wire Readiness Checklist</h3>
        <div className="space-y-0">
          {checklist.map((item, index) => {
            const isLast = index === checklist.length - 1;
            const Icon = item.icon;
            return (
              <div key={item.id} className="flex items-stretch gap-4">
                <div className="flex flex-col items-center w-8">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    item.passed ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted/60 text-muted-foreground'
                  }`}>
                    {item.passed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                  </div>
                  {!isLast && (
                    <div className={`w-0.5 flex-1 min-h-[24px] ${item.passed ? 'bg-emerald-500/30' : 'bg-border/40'}`} />
                  )}
                </div>
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                  <div className="flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${item.passed ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                    <span className={`text-sm font-medium ${item.passed ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {item.label}
                    </span>
                    {item.detail && (
                      <span className="text-[10px] text-muted-foreground font-mono">{item.detail}</span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <Badge className={`text-[9px] ${
                        item.passed
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}>
                        {item.passed ? 'Complete' : 'Pending'}
                      </Badge>
                      {!item.passed && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-accent hover:text-accent"
                          onClick={item.action}
                        >
                          Fix <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 ml-5">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Generate Wire Pack ── */}
      <motion.div {...fadeInUp} className="pivt-card border border-border/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${allPassed ? 'bg-emerald-500/10' : 'bg-muted/60'}`}>
              <ShieldCheck className={`w-5 h-5 ${allPassed ? 'text-emerald-500' : 'text-muted-foreground'}`} />
            </div>
            <div>
              <h3 className="text-base font-semibold">Generate Wire Pack</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allPassed
                  ? 'All prerequisites met — ready to generate.'
                  : `${checklist.length - passedCount} item${checklist.length - passedCount !== 1 ? 's' : ''} remaining before generation.`}
              </p>
            </div>
          </div>
          <Button onClick={generatePack} disabled={generating} className="gap-2">
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {pack ? 'Regenerate' : 'Generate Wire Pack'}
          </Button>
        </div>

        {!allPassed && !pack && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-600">
              Wire pack can still be generated for preview, but will show incomplete readiness until all items above are resolved.
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Wire Pack Output ── */}
      {generating && !pack && (
        <Card>
          <CardContent className="py-16 text-center">
            <Loader2 className="w-8 h-8 mx-auto text-accent animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">Assembling wire pack…</p>
          </CardContent>
        </Card>
      )}

      {pack && (
        <>
          {/* Trust Banner */}
          {pack.is_ready && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 px-5 py-3.5 rounded-xl border"
              style={{ background: 'hsl(var(--validated) / 0.06)', borderColor: 'hsl(var(--validated) / 0.15)' }}
            >
              <ShieldCheck className="w-5 h-5 shrink-0" style={{ color: 'hsl(var(--validated))' }} />
              <span className="text-sm font-medium" style={{ color: 'hsl(var(--validated))' }}>
                This wire pack has been reconciled across all sources and approved for execution.
              </span>
            </motion.div>
          )}

          {/* Status Card */}
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

          {/* Detail Tabs + Export */}
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
                          <Badge className={`text-[10px] ${d.severity === 'high' || d.severity === 'critical' ? 'bg-red-500/10 text-red-500' : d.severity === 'medium' ? 'bg-amber-500/10 text-amber-600' : 'bg-blue-500/10 text-blue-500'}`}>
                            {d.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{d.rule}</TableCell>
                        <TableCell className="text-sm">{d.message}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{d.status}</Badge></TableCell>
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
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No approval records</TableCell></TableRow>
                    ) : pack.approval_record.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.approver}</TableCell>
                        <TableCell className="text-xs">{a.role || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{a.side}</Badge></TableCell>
                        <TableCell className="text-xs">{a.method}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
                            {a.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{a.completed_at ? new Date(a.completed_at).toLocaleDateString() : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};
