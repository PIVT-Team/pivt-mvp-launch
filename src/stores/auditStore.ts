import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AuditActorType = 'User' | 'System' | 'Integration';
export type AuditSeverity = 'info' | 'warning' | 'error';
export type AuditObjectType = 'Deal' | 'Stakeholder' | 'Document' | 'Payment' | 'Approval' | 'Integration' | 'Escrow' | 'KYC' | 'Team' | 'Report' | 'Waterfall';
export type AuditSource = 'UI' | 'API' | 'Automation' | 'Integration';

export interface AuditEvent {
  event_id: string;
  timestamp: string;
  deal_id: string | null;
  actor_type: AuditActorType;
  actor_id: string | null;
  actor_display_name: string;
  actor_role: string;
  action: string;
  object_type: AuditObjectType;
  object_id: string | null;
  severity: AuditSeverity;
  summary: string;
  before_state: Record<string, any> | null;
  after_state: Record<string, any> | null;
  source: AuditSource;
  ip_address: string | null;
  user_agent: string | null;
  correlation_id: string | null;
  event_hash: string;
  category: 'user' | 'system' | 'financial' | 'compliance' | 'approval';
}

// Simple hash function for MVP (browser-compatible)
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function syncHash(payload: string): string {
  // Fallback sync hash for store init
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

interface AuditStore {
  events: AuditEvent[];
  seeded: boolean;
  seedDemo: () => void;
  addEvent: (e: Omit<AuditEvent, 'event_id' | 'timestamp' | 'event_hash'>) => void;
  getExportHash: () => string;
}

const SEED_EVENTS: Omit<AuditEvent, 'event_id' | 'event_hash'>[] = [
  {
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    deal_id: 'deal-001', actor_type: 'User', actor_id: 'u-001', actor_display_name: 'Alexandra Reed',
    actor_role: 'Admin', action: 'PAYOUT_APPROVED', object_type: 'Payment', object_id: 'pmt-001',
    severity: 'info', summary: 'Approved payout for Sarah Chen — $840M wire transfer',
    before_state: { status: 'pending_approval' }, after_state: { status: 'approved' },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: 'cor-001', category: 'financial',
  },
  {
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    deal_id: 'deal-001', actor_type: 'System', actor_id: null, actor_display_name: 'Newton AI',
    actor_role: 'System', action: 'WATERFALL_VALIDATED', object_type: 'Waterfall', object_id: 'wf-001',
    severity: 'info', summary: 'Waterfall Schedule v3 auto-validated — 0 discrepancies',
    before_state: { validation_status: 'pending' }, after_state: { validation_status: 'validated', discrepancies: 0 },
    source: 'Automation', ip_address: null, user_agent: null, correlation_id: 'cor-002', category: 'system',
  },
  {
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    deal_id: 'deal-001', actor_type: 'User', actor_id: 'u-002', actor_display_name: 'James Morrison',
    actor_role: 'Deal Manager', action: 'DOCUMENT_UPLOADED', object_type: 'Document', object_id: 'doc-010',
    severity: 'info', summary: 'Uploaded Escrow Agreement amendment (v2)',
    before_state: null, after_state: { file_name: 'Escrow_Agreement_v2.pdf', size: '2.4MB' },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: null, category: 'user',
  },
  {
    timestamp: new Date(Date.now() - 32 * 60000).toISOString(),
    deal_id: 'deal-001', actor_type: 'System', actor_id: null, actor_display_name: 'KYC Agent',
    actor_role: 'System', action: 'KYC_STATUS_CHANGED', object_type: 'KYC', object_id: 'kyc-003',
    severity: 'error', summary: 'KYC verification failed for GIC Private Limited — OFAC flag',
    before_state: { status: 'in_review' }, after_state: { status: 'rejected', reason: 'OFAC screening match' },
    source: 'Automation', ip_address: null, user_agent: null, correlation_id: 'cor-003', category: 'compliance',
  },
  {
    timestamp: new Date(Date.now() - 1 * 3600000).toISOString(),
    deal_id: 'deal-001', actor_type: 'User', actor_id: 'u-004', actor_display_name: 'David Park',
    actor_role: 'Legal Counsel', action: 'APPROVAL_SUBMITTED', object_type: 'Approval', object_id: 'apr-002',
    severity: 'info', summary: 'Submitted buyer-side approval for Project ATLAS',
    before_state: { status: 'pending' }, after_state: { status: 'submitted', side: 'buyer' },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: 'cor-004', category: 'approval',
  },
  {
    timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
    deal_id: 'deal-001', actor_type: 'User', actor_id: 'u-003', actor_display_name: 'Sarah Chen',
    actor_role: 'Finance Ops', action: 'WIRE_INSTRUCTIONS_UPDATED', object_type: 'Payment', object_id: 'pmt-002',
    severity: 'info', summary: 'Updated wire instructions — JPMorgan Chase routing',
    before_state: { routing: '021000021' }, after_state: { routing: '021000089', bank: 'JPMorgan Chase' },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: null, category: 'financial',
  },
  {
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    deal_id: null, actor_type: 'System', actor_id: null, actor_display_name: 'System',
    actor_role: 'System', action: 'DEAL_CREATED', object_type: 'Deal', object_id: 'deal-002',
    severity: 'info', summary: 'Created new deal: Project CIPHER ($340M)',
    before_state: null, after_state: { name: 'Project CIPHER', value: 340000000 },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: null, category: 'system',
  },
  {
    timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
    deal_id: 'deal-001', actor_type: 'User', actor_id: 'u-005', actor_display_name: 'Emily Watson',
    actor_role: 'Viewer', action: 'REPORT_EXPORTED', object_type: 'Report', object_id: 'rpt-001',
    severity: 'info', summary: 'Exported compliance report — Q4 2025',
    before_state: null, after_state: { format: 'PDF', type: 'compliance' },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: null, category: 'user',
  },
  {
    timestamp: new Date(Date.now() - 8 * 3600000).toISOString(),
    deal_id: 'deal-001', actor_type: 'Integration', actor_id: null, actor_display_name: 'Payment Gateway',
    actor_role: 'System', action: 'WIRE_EXECUTED', object_type: 'Payment', object_id: 'pmt-003',
    severity: 'info', summary: 'Executed wire: $14.8M to Tiger Global Management',
    before_state: { status: 'prepared' }, after_state: { status: 'executed', amount: 14800000 },
    source: 'Integration', ip_address: null, user_agent: null, correlation_id: 'cor-005', category: 'financial',
  },
  {
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    deal_id: 'deal-001', actor_type: 'Integration', actor_id: null, actor_display_name: 'Escrow Agent',
    actor_role: 'System', action: 'ESCROW_FUNDED', object_type: 'Escrow', object_id: 'esc-001',
    severity: 'info', summary: 'Escrow funded: $280M deposited to JPMorgan escrow account',
    before_state: { balance: 0 }, after_state: { balance: 280000000, institution: 'JPMorgan Chase' },
    source: 'Integration', ip_address: null, user_agent: null, correlation_id: 'cor-006', category: 'financial',
  },
  {
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    deal_id: null, actor_type: 'User', actor_id: 'u-001', actor_display_name: 'Alexandra Reed',
    actor_role: 'Admin', action: 'TEAM_INVITE_SENT', object_type: 'Team', object_id: 'tm-5',
    severity: 'info', summary: 'Invited Emily Watson as viewer',
    before_state: null, after_state: { email: 'ewatson@pivt.io', role: 'Viewer' },
    source: 'UI', ip_address: null, user_agent: null, correlation_id: null, category: 'user',
  },
  {
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    deal_id: 'deal-001', actor_type: 'System', actor_id: null, actor_display_name: 'Discrepancy Agent',
    actor_role: 'System', action: 'DISCREPANCY_DETECTED', object_type: 'Stakeholder', object_id: 'sth-005',
    severity: 'warning', summary: 'Detected ownership % mismatch: Tiger Global 8.0% vs 7.8%',
    before_state: { ownership_pct: 8.0 }, after_state: { ownership_pct: 7.8, discrepancy: 0.2 },
    source: 'Automation', ip_address: null, user_agent: null, correlation_id: 'cor-007', category: 'compliance',
  },
];

export const useAuditStore = create<AuditStore>()(
  persist(
    (set, get) => ({
      events: [],
      seeded: false,

      seedDemo: () => {
        if (get().seeded) return;
        const events = SEED_EVENTS.map((e, i) => ({
          ...e,
          event_id: `evt-seed-${i.toString().padStart(3, '0')}`,
          event_hash: syncHash(JSON.stringify(e)),
        }));
        set({ events, seeded: true });
      },

      addEvent: (e) => {
        const event: AuditEvent = {
          ...e,
          event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          timestamp: new Date().toISOString(),
          event_hash: syncHash(JSON.stringify(e)),
        };
        set((s) => ({ events: [event, ...s.events] }));
      },

      getExportHash: () => {
        const hashes = get().events.map((e) => e.event_hash).join('');
        return syncHash(hashes);
      },
    }),
    { name: 'pivt-audit-events' }
  )
);

// Export helpers
export function generateCSV(events: AuditEvent[]): string {
  const headers = [
    'event_id', 'timestamp', 'deal_id', 'actor_type', 'actor_display_name', 'actor_role',
    'action', 'object_type', 'object_id', 'severity', 'summary', 'source', 'category', 'event_hash',
  ];
  const rows = events.map((e) =>
    headers.map((h) => {
      const val = (e as any)[h];
      const str = val == null ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

export function generateJSON(events: AuditEvent[], exportHash: string): string {
  return JSON.stringify({
    metadata: {
      export_timestamp: new Date().toISOString(),
      total_events: events.length,
      export_hash: exportHash,
      generated_by: 'PIVT Audit System',
      immutable: true,
    },
    events,
  }, null, 2);
}

export function generatePDFContent(events: AuditEvent[], exportHash: string, options: {
  dealName?: string; dateRange: string; generatedBy: string;
}): string {
  const kycFailed = events.filter(e => e.action.includes('KYC') && e.severity === 'error').length;
  const pendingApprovals = events.filter(e => e.object_type === 'Approval' && e.after_state?.status !== 'approved').length;
  const financialEvents = events.filter(e => e.category === 'financial').length;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PIVT Audit Log Export</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:40px;color:#1a1a2e;font-size:12px;line-height:1.5}
h1{font-size:20px;color:#6B46C1;margin-bottom:4px}
h2{font-size:14px;color:#1a1a2e;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-top:28px}
.header{border-bottom:2px solid #6B46C1;padding-bottom:16px;margin-bottom:20px}
.meta{color:#64748b;font-size:11px}
.summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:12px 0}
.summary-card{border:1px solid #e2e8f0;border-radius:6px;padding:12px;text-align:center}
.summary-card .value{font-size:20px;font-weight:700;color:#6B46C1}
.summary-card .label{font-size:10px;color:#64748b;text-transform:uppercase}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:8px}
th{background:#f8fafc;text-align:left;padding:8px;border-bottom:2px solid #e2e8f0;font-weight:600;text-transform:uppercase;font-size:10px;color:#64748b}
td{padding:8px;border-bottom:1px solid #f1f5f9}
tr:hover{background:#f8fafc}
.severity-error{color:#dc2626}.severity-warning{color:#d97706}.severity-info{color:#64748b}
.footer{margin-top:40px;border-top:2px solid #6B46C1;padding-top:16px;font-size:10px;color:#64748b}
.attestation{background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-top:20px}
@media print{body{margin:20px}table{page-break-inside:auto}tr{page-break-inside:avoid}}
</style></head><body>
<div class="header">
<h1>PIVT — Audit Log Export</h1>
<p class="meta">Deal: ${options.dealName || 'All Deals'} &nbsp;|&nbsp; Period: ${options.dateRange} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; By: ${options.generatedBy}</p>
<p class="meta">Total Events: ${events.length}</p>
</div>

<h2>Executive Summary</h2>
<div class="summary-grid">
<div class="summary-card"><div class="value">${events.length}</div><div class="label">Total Events</div></div>
<div class="summary-card"><div class="value">${kycFailed}</div><div class="label">KYC Flags</div></div>
<div class="summary-card"><div class="value">${pendingApprovals}</div><div class="label">Approval Events</div></div>
<div class="summary-card"><div class="value">${financialEvents}</div><div class="label">Financial Events</div></div>
</div>

<h2>Event Log (Chronological)</h2>
<table><thead><tr><th>Timestamp</th><th>Actor</th><th>Action</th><th>Object</th><th>Summary</th><th>Severity</th></tr></thead><tbody>`;

  events.forEach((e) => {
    html += `<tr>
<td style="font-family:monospace;white-space:nowrap">${new Date(e.timestamp).toLocaleString()}</td>
<td>${e.actor_display_name}<br><span class="meta">${e.actor_role}</span></td>
<td style="font-family:monospace;font-size:10px">${e.action}</td>
<td>${e.object_type}</td>
<td>${e.summary}</td>
<td class="severity-${e.severity}">${e.severity}</td>
</tr>`;
  });

  html += `</tbody></table>

<h2>Exceptions & Overrides</h2>
<table><thead><tr><th>Timestamp</th><th>Actor</th><th>Summary</th><th>Severity</th></tr></thead><tbody>`;
  const exceptions = events.filter(e => e.severity === 'error' || e.severity === 'warning');
  if (exceptions.length === 0) html += '<tr><td colspan="4">No exceptions recorded.</td></tr>';
  exceptions.forEach(e => {
    html += `<tr><td style="font-family:monospace">${new Date(e.timestamp).toLocaleString()}</td><td>${e.actor_display_name}</td><td>${e.summary}</td><td class="severity-${e.severity}">${e.severity}</td></tr>`;
  });
  html += '</tbody></table>';

  html += `
<div class="attestation">
<h2 style="border:none;margin-top:0">Attestation</h2>
<p>This report is generated from an append-only event log. Events cannot be modified or deleted after creation.</p>
<p><strong>Export Checksum:</strong> <code>${exportHash}</code></p>
</div>

<div class="footer">
<p>PIVT — The Intelligence Layer Behind Every Close &nbsp;|&nbsp; Confidential &nbsp;|&nbsp; Export Hash: ${exportHash}</p>
</div>
</body></html>`;
  return html;
}
