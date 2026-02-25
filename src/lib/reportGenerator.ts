/**
 * Report Generation Engine
 * Produces real downloadable CSV, XLSX, and PDF files from demo data.
 */
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import type { ReportFormat } from '@/stores/reportStore';
import type { DemoDeal, DemoStakeholder, DemoPayment, WaterfallTier } from '@/stores/pivtStore';
import type { AuditEvent } from '@/stores/auditStore';

// ── helpers ──────────────────────────────────────────────────────
function fmtMoney(n: number) {
  return `$${(n / 1e6).toFixed(2)}M`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function csvToBlob(headers: string[], rows: string[][]): Blob {
  const csv = [headers.join(','), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
  return new Blob([csv], { type: 'text/csv' });
}

function xlsxToBlob(headers: string[], rows: string[][]): Blob {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

function pdfFromTable(title: string, headers: string[], rows: string[][], subtitle?: string): Blob {
  const doc = new jsPDF({ orientation: rows[0]?.length > 6 ? 'landscape' : 'portrait' });
  const pageW = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(18);
  doc.setTextColor(20, 20, 40);
  doc.text('PIVT', 14, 18);
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Mid-Market M&A Platform', 14, 23);

  doc.setFontSize(14);
  doc.setTextColor(20, 20, 40);
  doc.text(title, 14, 36);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(subtitle, 14, 43);
  }

  doc.setFontSize(7);
  doc.setTextColor(150);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 60, 18);

  // Table
  const startY = subtitle ? 50 : 44;
  const colW = (pageW - 28) / headers.length;
  const rowH = 7;

  // Header row
  doc.setFillColor(30, 30, 50);
  doc.rect(14, startY, pageW - 28, rowH, 'F');
  doc.setFontSize(7);
  doc.setTextColor(255);
  headers.forEach((h, i) => doc.text(h, 16 + i * colW, startY + 5));

  // Data rows
  doc.setTextColor(40);
  rows.forEach((row, ri) => {
    const y = startY + rowH + ri * rowH;
    if (y > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
    }
    if (ri % 2 === 0) {
      doc.setFillColor(245, 245, 250);
      doc.rect(14, y, pageW - 28, rowH, 'F');
    }
    row.forEach((cell, ci) => {
      const text = String(cell).substring(0, 40);
      doc.text(text, 16 + ci * colW, y + 5);
    });
  });

  return doc.output('blob');
}

// ── Report generators ────────────────────────────────────────────

export interface ReportDataContext {
  deals: DemoDeal[];
  stakeholders: DemoStakeholder[];
  payments: DemoPayment[];
  waterfallTiers: WaterfallTier[];
  auditEvents: AuditEvent[];
  selectedDeal?: DemoDeal;
}

type GeneratorFn = (ctx: ReportDataContext, format: ReportFormat) => { blob: Blob; fileName: string };

const generators: Record<string, GeneratorFn> = {
  // ── Portfolio reports ──
  'portfolio-summary': (ctx, fmt) => {
    const headers = ['Deal', 'Code', 'Value', 'Status', 'Closing Date', 'Ready %', 'Blockers', 'Pending Approvals'];
    const rows = ctx.deals.map((d) => [d.name, d.codeName, fmtMoney(d.consideration), d.status, d.closingDate, `${d.readyToPayPercent}%`, String(d.discrepanciesFound), String(d.pendingApprovals)]);
    const ext = fmt.toLowerCase();
    const fileName = `Portfolio_Deal_Summary_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    if (fmt === 'XLSX') return { blob: xlsxToBlob(headers, rows), fileName };
    return { blob: pdfFromTable('Portfolio Deal Summary', headers, rows, `${ctx.deals.length} active deals · Total: ${fmtMoney(ctx.deals.reduce((s, d) => s + d.consideration, 0))}`), fileName };
  },

  'compliance-summary': (ctx, fmt) => {
    const headers = ['Stakeholder', 'Role', 'KYC Status', 'Payout', 'Ownership %', 'Email'];
    const rows = ctx.stakeholders.map((s) => [s.name, s.role, s.kycStatus, fmtMoney(s.payoutAmount), `${s.ownershipPct}%`, s.email]);
    const ext = fmt.toLowerCase();
    const fileName = `Stakeholder_Compliance_Summary_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'XLSX') return { blob: xlsxToBlob(headers, rows), fileName };
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    return { blob: pdfFromTable('Stakeholder Compliance Summary', headers, rows), fileName };
  },

  'payment-schedule': (ctx, fmt) => {
    const headers = ['Recipient', 'Amount', 'Status', 'Method', 'Currency'];
    const rows = ctx.payments.map((p) => [p.recipientName, fmtMoney(p.amount), p.status, p.method, 'USD']);
    const ext = fmt.toLowerCase();
    const fileName = `Payment_Schedule_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    if (fmt === 'XLSX') return { blob: xlsxToBlob(headers, rows), fileName };
    return { blob: pdfFromTable('Payment Schedule Export', headers, rows), fileName };
  },

  'kyc-weekly': (ctx, fmt) => {
    const verified = ctx.stakeholders.filter((s) => s.kycStatus === 'verified').length;
    const pending = ctx.stakeholders.filter((s) => s.kycStatus === 'pending').length;
    const failed = ctx.stakeholders.filter((s) => s.kycStatus === 'failed').length;
    const headers = ['Metric', 'Count'];
    const rows = [['Verified', String(verified)], ['Pending', String(pending)], ['Failed', String(failed)], ['Total', String(ctx.stakeholders.length)]];
    const ext = fmt.toLowerCase();
    const fileName = `Weekly_KYC_Status_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    return { blob: pdfFromTable('Weekly KYC Status Report', headers, rows, `Week of ${new Date().toLocaleDateString()}`), fileName };
  },

  'audit-export': (ctx, fmt) => {
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Object Type', 'Summary', 'Severity'];
    const rows = ctx.auditEvents.map((e) => [new Date(e.timestamp).toLocaleString(), e.actor_display_name, e.actor_role, e.action, e.object_type, e.summary, e.severity]);
    const ext = fmt.toLowerCase();
    const fileName = `Global_Audit_Export_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    if (fmt === 'XLSX') return { blob: xlsxToBlob(headers, rows), fileName };
    return { blob: pdfFromTable('Global Audit Trail Export', headers, rows, `${ctx.auditEvents.length} events`), fileName };
  },

  // ── Deal-scoped reports ──
  'deal-summary': (ctx, fmt) => {
    const d = ctx.selectedDeal || ctx.deals[0];
    const headers = ['Field', 'Value'];
    const rows = [
      ['Deal Name', d.name], ['Code Name', d.codeName], ['Value', fmtMoney(d.consideration)],
      ['Buyer', d.buyerName], ['Target', d.targetCompany], ['Sector', d.sector],
      ['Status', d.status], ['Workflow State', d.workflowState.replace(/_/g, ' ')],
      ['Closing Date', d.closingDate], ['Recipients', String(d.totalRecipients)],
      ['Documents', String(d.documentsUploaded)], ['Discrepancies', String(d.discrepanciesFound)],
      ['Ready to Pay', `${d.readyToPayPercent}%`], ['Pending Approvals', String(d.pendingApprovals)],
    ];
    const ext = fmt.toLowerCase();
    const fileName = `Deal_Summary_${d.codeName}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    return { blob: pdfFromTable(`Deal Summary — ${d.codeName}`, headers, rows, `${d.buyerName} acquiring ${d.targetCompany}`), fileName };
  },

  'stakeholder-report': (ctx, fmt) => {
    const d = ctx.selectedDeal || ctx.deals[0];
    const headers = ['Stakeholder', 'Role', 'KYC Status', 'Payout', 'Ownership %'];
    const rows = ctx.stakeholders.map((s) => [s.name, s.role, s.kycStatus, fmtMoney(s.payoutAmount), `${s.ownershipPct}%`]);
    const ext = fmt.toLowerCase();
    const fileName = `Stakeholder_Report_${d.codeName}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'XLSX') return { blob: xlsxToBlob(headers, rows), fileName };
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    return { blob: pdfFromTable(`Stakeholder Report — ${d.codeName}`, headers, rows), fileName };
  },

  'reconciliation-report': (ctx, fmt) => {
    const d = ctx.selectedDeal || ctx.deals[0];
    const headers = ['Check', 'Status', 'Details'];
    const rows = [
      ['Total distribution matches purchase price', d.discrepanciesFound === 0 ? 'Pass' : 'Discrepancy', fmtMoney(d.consideration)],
      ['All recipients KYC verified', ctx.stakeholders.every((s) => s.kycStatus === 'verified') ? 'Pass' : 'Pending', `${ctx.stakeholders.filter((s) => s.kycStatus === 'verified').length}/${ctx.stakeholders.length}`],
      ['Wire instructions collected', 'Partial', `${ctx.payments.filter((p) => p.status !== 'pending').length}/${ctx.payments.length}`],
      ['Approval chain complete', d.pendingApprovals === 0 ? 'Pass' : 'Pending', `${d.pendingApprovals} pending`],
    ];
    const ext = fmt.toLowerCase();
    const fileName = `Reconciliation_Report_${d.codeName}_${new Date().toISOString().slice(0, 10)}.${ext}`;
    return { blob: pdfFromTable(`Reconciliation Report — ${d.codeName}`, headers, rows), fileName };
  },

  'approval-log': (ctx, fmt) => {
    const approvalEvents = ctx.auditEvents.filter((e) => e.object_type === 'Approval' || e.action.includes('APPROV'));
    const headers = ['Timestamp', 'Actor', 'Action', 'Summary'];
    const rows = approvalEvents.length > 0
      ? approvalEvents.map((e) => [new Date(e.timestamp).toLocaleString(), e.actor_display_name, e.action, e.summary])
      : [['—', '—', 'No approval events recorded', '—']];
    const ext = fmt.toLowerCase();
    const fileName = `Approval_Log_${new Date().toISOString().slice(0, 10)}.${ext}`;
    if (fmt === 'CSV') return { blob: csvToBlob(headers, rows), fileName };
    return { blob: pdfFromTable('Approval Log', headers, rows), fileName };
  },

  'audit-trail': (ctx, fmt) => {
    // Same as audit-export but deal-scoped
    return generators['audit-export'](ctx, fmt);
  },
};

export async function generateReport(
  reportTypeId: string,
  format: ReportFormat,
  ctx: ReportDataContext
): Promise<{ blob: Blob; fileName: string }> {
  const gen = generators[reportTypeId];
  if (!gen) throw new Error(`Unknown report type: ${reportTypeId}`);
  // Simulate generation delay
  await new Promise((r) => setTimeout(r, 1200 + Math.random() * 800));
  return gen(ctx, format);
}

export { downloadBlob };
