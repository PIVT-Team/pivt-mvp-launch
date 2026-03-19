/**
 * Demo workspace — shows the evolving deal state alongside Newton.
 */
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, CheckCircle2, AlertTriangle, Clock, Send,
  Eye, PenTool, Download, Shield, ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DEMO_DEAL, DEMO_DOCUMENTS, DEMO_OBLIGATIONS,
  DEMO_DISCREPANCIES, DEMO_APPROVALS, type DemoApproval,
} from './demoData';

type DemoStep = 'intro' | 'create' | 'upload' | 'obligations' | 'discrepancies' | 'approvals' | 'wirepack' | 'outro';

interface Props {
  step: DemoStep;
  progress: number; // 0-1 within current step
  resolvedDiscrepancies: Set<string>;
  approvalStatuses: Record<string, DemoApproval['status']>;
}

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const StepItem: React.FC<{ delay: number; children: React.ReactNode }> = ({ delay, children }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.3 }}
  >
    {children}
  </motion.div>
);

export const DemoWorkspace: React.FC<Props> = ({ step, progress, resolvedDiscrepancies, approvalStatuses }) => {
  if (step === 'intro' || step === 'outro') return null;

  return (
    <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)] pr-1">
      {/* Deal header — always visible after create */}
      {step !== 'create' || progress > 0.6 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-semibold">{DEMO_DEAL.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{DEMO_DEAL.type} · {DEMO_DEAL.jurisdiction}</p>
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full bg-accent/10 text-accent font-medium">Active</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-[10px] text-muted-foreground">Enterprise Value</p>
              <p className="text-sm font-semibold">{formatCurrency(DEMO_DEAL.value)}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-[10px] text-muted-foreground">Buyer</p>
              <p className="text-sm font-medium truncate">{DEMO_DEAL.buyer}</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-2.5">
              <p className="text-[10px] text-muted-foreground">Seller</p>
              <p className="text-sm font-medium truncate">{DEMO_DEAL.seller}</p>
            </div>
          </div>
        </motion.div>
      ) : null}

      {/* Documents */}
      {(step === 'upload' || step === 'obligations' || step === 'discrepancies' || step === 'approvals' || step === 'wirepack') && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" /> Documents
          </h4>
          <div className="space-y-2">
            {DEMO_DOCUMENTS.map((doc, i) => {
              const visible = step === 'upload' ? progress > (i / DEMO_DOCUMENTS.length) : true;
              if (!visible) return null;
              return (
                <StepItem key={doc.name} delay={step === 'upload' ? i * 0.3 : 0}>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/30">
                    <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{doc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{doc.type} · {doc.pages} pages · {doc.size}</p>
                    </div>
                    <CheckCircle2 className="w-3.5 h-3.5 text-validated shrink-0" />
                  </div>
                </StepItem>
              );
            })}
          </div>
        </div>
      )}

      {/* Obligations */}
      {(step === 'obligations' || step === 'discrepancies' || step === 'approvals' || step === 'wirepack') && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" /> Payment Obligations
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {DEMO_OBLIGATIONS.length} items · {formatCurrency(DEMO_DEAL.value)}
            </span>
          </h4>
          <div className="space-y-1.5">
            {DEMO_OBLIGATIONS.map((obl, i) => (
              <StepItem key={obl.recipient} delay={i * 0.15}>
                <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/20 text-xs">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{obl.recipient}</p>
                    <p className="text-[10px] text-muted-foreground">{obl.condition} · {obl.source}</p>
                  </div>
                  <span className="font-semibold shrink-0">{formatCurrency(obl.amount)}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{obl.timing}</span>
                </div>
              </StepItem>
            ))}
          </div>
        </motion.div>
      )}

      {/* Discrepancies */}
      {(step === 'discrepancies' || step === 'approvals' || step === 'wirepack') && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-blocking" /> Discrepancy Analysis
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-validated/10 text-validated font-medium">
              {resolvedDiscrepancies.size}/{DEMO_DISCREPANCIES.length} resolved
            </span>
          </h4>
          {DEMO_DISCREPANCIES.map((d, i) => {
            const resolved = resolvedDiscrepancies.has(d.id);
            const severityColor = d.severity === 'critical' ? 'border-blocking/30 bg-blocking/5' : d.severity === 'high' ? 'border-accent/30 bg-accent/5' : 'border-discrepancy/30 bg-discrepancy/5';
            const badgeColor = d.severity === 'critical' ? 'bg-blocking/10 text-blocking' : d.severity === 'high' ? 'bg-accent/10 text-accent' : 'bg-discrepancy/10 text-discrepancy';
            return (
              <StepItem key={d.id} delay={i * 0.2}>
                <div className={cn('rounded-xl border p-3.5 transition-all', resolved ? 'border-validated/20 bg-validated/5 opacity-60' : severityColor)}>
                  <div className="flex items-start gap-2 mb-2">
                    {resolved ? <CheckCircle2 className="w-4 h-4 text-validated mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-blocking mt-0.5 shrink-0" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{d.title}</span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded-full font-medium', resolved ? 'bg-validated/10 text-validated' : badgeColor)}>
                          {resolved ? 'resolved' : d.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!resolved && (
                    <div className="grid grid-cols-2 gap-2 ml-6">
                      <div className="rounded-lg bg-validated/5 border border-validated/10 p-2">
                        <p className="text-[9px] font-medium text-validated mb-0.5">Expected</p>
                        <p className="text-[11px] font-mono">{d.expected}</p>
                      </div>
                      <div className="rounded-lg bg-destructive/5 border border-destructive/10 p-2">
                        <p className="text-[9px] font-medium text-destructive mb-0.5">Actual</p>
                        <p className="text-[11px] font-mono">{d.actual}</p>
                      </div>
                    </div>
                  )}
                </div>
              </StepItem>
            );
          })}
        </motion.div>
      )}

      {/* Approvals */}
      {(step === 'approvals' || step === 'wirepack') && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <PenTool className="w-4 h-4 text-accent" /> Approval Status
          </h4>
          {DEMO_APPROVALS.map((a, i) => {
            const status = approvalStatuses[a.recipient] || a.status;
            const statusConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
              pending: { icon: Clock, color: 'text-muted-foreground', label: 'Pending' },
              sent: { icon: Send, color: 'text-accent', label: 'Sent' },
              viewed: { icon: Eye, color: 'text-discrepancy', label: 'Viewed' },
              signed: { icon: CheckCircle2, color: 'text-validated', label: 'Signed' },
            };
            const cfg = statusConfig[status];
            return (
              <StepItem key={a.recipient} delay={i * 0.15}>
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/20">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                    {a.recipient.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-medium">{a.recipient}</p>
                    <p className="text-[10px] text-muted-foreground">{a.role}</p>
                  </div>
                  <div className={cn('flex items-center gap-1', cfg.color)}>
                    <cfg.icon className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-medium">{cfg.label}</span>
                  </div>
                </div>
              </StepItem>
            );
          })}
        </motion.div>
      )}

      {/* Wire Pack */}
      {step === 'wirepack' && progress > 0.5 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl border-2 border-validated/30 bg-gradient-to-br from-validated/5 to-card p-6 space-y-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-validated/10 flex items-center justify-center">
              <Download className="w-5 h-5 text-validated" />
            </div>
            <div>
              <h4 className="text-base font-semibold">Wire Pack Ready</h4>
              <p className="text-xs text-muted-foreground">Project Atlas · {formatCurrency(DEMO_DEAL.value)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              '6 verified wire instructions',
              'All discrepancies resolved',
              '4/4 approvals complete',
              'Compliance checks passed',
            ].map(item => (
              <div key={item} className="flex items-center gap-1.5 text-xs text-validated">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {['PDF', 'CSV', 'JSON'].map(fmt => (
              <div key={fmt} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/40 text-xs font-medium cursor-default">
                <Download className="w-3 h-3" /> {fmt}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
