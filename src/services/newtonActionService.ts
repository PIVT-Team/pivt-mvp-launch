/**
 * Newton Action Service — Maps detected intents to real platform actions.
 * All actions write to the same data tables used by manual UI.
 */
import { supabase } from "@/integrations/supabase/client";

export type NewtonActionType =
  | 'create_deal'
  | 'update_deal_metadata'
  | 'upload_stakeholders'
  | 'parse_stakeholders'
  | 'upload_documents'
  | 'review_documents'
  | 'open_wire_instructions'
  | 'open_tax_forms'
  | 'open_approvals'
  | 'start_new_closing'
  | 'summarize_readiness'
  | 'list_blockers'
  | 'generate_kyc_requests'
  | 'generate_kyb_requests'
  | 'prepare_approval_package'
  | 'list_deals'
  | 'unsupported';

export type NewtonIntentScope = 'global' | 'deal' | 'info';

export interface NewtonCreateDealParams {
  deal_name: string;
  deal_value?: number;
  buyer?: string;
  seller?: string;
  target_company?: string;
  deal_type?: string;
  sector?: string;
  currency?: string;
  jurisdiction?: string;
  closing_date?: string;
  escrow_amount?: number;
  internal_reference?: string;
  primary_deal_owner?: string;
}

export interface NewtonIntent {
  action: NewtonActionType;
  scope: NewtonIntentScope;
  confidence: number;
  params: Record<string, any>;
  requiresForm?: boolean;
  formType?: 'create_deal';
}

export interface NewtonActionResult {
  success: boolean;
  message: string;
  data?: any;
  navigateTo?: string;
  logEntry?: string;
}

type IntentPattern = {
  pattern: RegExp;
  action: NewtonActionType;
  scope: NewtonIntentScope;
  requiresForm?: boolean;
  formType?: 'create_deal';
};

// ─── Intent Detection (client-side, fast) ───────────────────────

const INTENT_PATTERNS: IntentPattern[] = [
  { pattern: /\b(create|new|start|set\s*up|open)\b.*\b(deal|transaction|project|closing)\b/i, action: 'create_deal', scope: 'global', requiresForm: true, formType: 'create_deal' },
  { pattern: /\b(show|list|get|view)\b.*\b(all\s+)?(deals|transactions|projects)\b/i, action: 'list_deals', scope: 'global' },
  { pattern: /\b(import|upload|add)\b.*\b(stakeholder|cap\s*table|investor)\b.*\b(list|sheet|spreadsheet|csv|xlsx)?\b/i, action: 'upload_stakeholders', scope: 'global' },
  { pattern: /\b(parse|extract|ingest)\b.*\b(stakeholder|cap\s*table)\b/i, action: 'parse_stakeholders', scope: 'deal' },
  { pattern: /\b(upload|add|import)\b.*\b(document|agreement|contract|doc)\b/i, action: 'upload_documents', scope: 'deal' },
  { pattern: /\b(review|check|analy[sz]e)\b.*\b(document|agreement|contract|doc)\b/i, action: 'review_documents', scope: 'deal' },
  { pattern: /\b(upload|review|match|verify)\b.*\b(wire|bank\s*instruction)\b/i, action: 'open_wire_instructions', scope: 'deal' },
  { pattern: /\b(review|check)\b.*\b(tax\s*form|tax)\b/i, action: 'open_tax_forms', scope: 'deal' },
  { pattern: /\b(send|review|prepare|track)\b.*\b(approval|docusign|signature)\b/i, action: 'open_approvals', scope: 'deal' },
  { pattern: /\b(start|prepare|init)\b.*\b(new\s+closing|closing)\b/i, action: 'start_new_closing', scope: 'global' },
  { pattern: /\b(what('?s| is)|show|summarize|check)\b.*\b(ready|readiness|status|progress|missing\s+for\s+closing)\b/i, action: 'summarize_readiness', scope: 'info' },
  { pattern: /\b(what('?s| is)|show|list|find|identify|who)\b.*\b(block|missing|incomplete|outstanding|needed|gaps|unverified|documents\s+outstanding|blockers?)\b/i, action: 'list_blockers', scope: 'info' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyc)\b/i, action: 'generate_kyc_requests', scope: 'deal' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyb)\b/i, action: 'generate_kyb_requests', scope: 'deal' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyc|kyb).*(request|check|verification)\b/i, action: 'generate_kyc_requests', scope: 'deal' },
  { pattern: /\b(prepare|generate|create)\b.*\b(approval|sign.?off)\b.*\b(package|bundle)\b/i, action: 'prepare_approval_package', scope: 'deal' },
  { pattern: /\b(update|change|modify|edit)\b.*\b(deal|transaction)\b.*\b(name|value|date|buyer|seller|status)\b/i, action: 'update_deal_metadata', scope: 'deal' },
];

function cleanCapture(value?: string | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value.trim().replace(/^["']|["']$/g, '').replace(/[.,]$/, '').trim();
  return cleaned || undefined;
}

function parseScaledNumber(value: string, scale?: string): number | undefined {
  const numeric = Number(value.replace(/,/g, '').trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  if (!scale) return numeric;

  const s = scale.toLowerCase();
  if (['b', 'bn', 'billion'].includes(s)) return numeric * 1_000_000_000;
  if (['m', 'mn', 'million'].includes(s)) return numeric * 1_000_000;
  return numeric;
}

function normalizeDateInput(value?: string): string | undefined {
  const v = cleanCapture(value);
  if (!v) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

export function parseCreateDealPrefill(message: string): Partial<NewtonCreateDealParams> {
  const parsed: Partial<NewtonCreateDealParams> = {};

  const nameMatch =
    message.match(/(?:called|named)\s+["“]?([^"\n,]+?)["”]?(?=(?:\s+(?:for|with|buyer|seller|target|acquiring|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i)
    || message.match(/create(?:\s+a|\s+new)?\s+(?:deal|transaction|project)\s+["“]?([^"\n,]+?)["”]?(?=(?:\s+(?:for|with|buyer|seller|target|acquiring|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);

  const buyerMatch = message.match(/(?:for\s+buyer|buyer)\s+([^,\n]+?)(?=(?:\s+(?:acquiring|acquire|seller|target|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);
  const sellerMatch = message.match(/seller\s+([^,\n]+?)(?=(?:\s+(?:target|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);
  const targetMatch = message.match(/(?:acquiring|acquire|target(?:\s+company)?|targeting)\s+([^,\n]+?)(?=(?:\s+(?:seller|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);
  const typeMatch = message.match(/(?:deal\s*type|type)\s*[:\-]?\s*([^,\n]+?)(?=(?:\s+(?:buyer|seller|target|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);
  const closeMatch = message.match(/(?:target\s*close|target\s*closing|closing\s*date|close|closing)\s*(?:on\s*)?([a-zA-Z]+\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  const valueMatch = message.match(/(?:deal\s*size|deal\s*value|valued\s*at|worth|for)\s*\$?\s*([\d,.]+(?:\.\d+)?)\s*(billion|bn|b|million|mn|m)?/i);
  const matterMatch = message.match(/(?:matter\s*id|matter|internal(?:\s+reference|\s+ref)?|reference)\s*[:#\-]?\s*([a-zA-Z0-9_-]+)/i);
  const ownerMatch = message.match(/(?:primary\s*deal\s*owner|primary\s*owner|owner)\s*[:\-]?\s*([a-zA-Z][a-zA-Z\s'.-]{1,80})/i);
  const jurisdictionMatch = message.match(/jurisdiction\s*[:\-]?\s*([a-zA-Z][a-zA-Z\s-]{1,40})/i);

  const name = cleanCapture(nameMatch?.[1]);
  const buyer = cleanCapture(buyerMatch?.[1]);
  const seller = cleanCapture(sellerMatch?.[1]);
  const target = cleanCapture(targetMatch?.[1]);
  const dealType = cleanCapture(typeMatch?.[1]);
  const closeDate = normalizeDateInput(closeMatch?.[1]);
  const dealValue = valueMatch ? parseScaledNumber(valueMatch[1], valueMatch[2]) : undefined;
  const matter = cleanCapture(matterMatch?.[1]);
  const owner = cleanCapture(ownerMatch?.[1]);
  const jurisdiction = cleanCapture(jurisdictionMatch?.[1]);

  if (name) parsed.deal_name = name;
  if (buyer) parsed.buyer = buyer;
  if (seller) parsed.seller = seller;
  if (target) parsed.target_company = target;
  if (dealType) parsed.deal_type = dealType;
  if (closeDate) parsed.closing_date = closeDate;
  if (dealValue != null) parsed.deal_value = dealValue;
  if (matter) parsed.internal_reference = matter;
  if (owner) parsed.primary_deal_owner = owner;
  if (jurisdiction) parsed.jurisdiction = jurisdiction;

  return parsed;
}

export function detectIntent(message: string): NewtonIntent {
  for (const { pattern, action, scope, requiresForm, formType } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      return {
        action,
        scope,
        confidence: 0.86,
        params: action === 'create_deal' ? parseCreateDealPrefill(message) : {},
        requiresForm,
        formType,
      };
    }
  }

  return {
    action: 'unsupported',
    scope: 'info',
    confidence: 0,
    params: {},
  };
}

// ─── Action Executors ───────────────────────────────────────────

export async function executeCreateDeal(
  params: NewtonCreateDealParams,
  userId: string,
): Promise<NewtonActionResult> {
  const safeCloseDate = normalizeDateInput(params.closing_date) || null;

  const { data, error } = await supabase
    .from('deals')
    .insert({
      deal_name: params.deal_name,
      deal_value: params.deal_value ?? 0,
      buyer: params.buyer || null,
      seller: params.seller || null,
      target_company: params.target_company || null,
      deal_type: params.deal_type || null,
      sector: params.sector || null,
      currency: params.currency || 'USD',
      jurisdiction: params.jurisdiction || null,
      closing_date: safeCloseDate,
      escrow_amount: params.escrow_amount || 0,
      created_by: userId,
      owner_id: userId,
      status: 'draft',
      deal_number: '',
      deal_kind: 'live' as any,
      visibility: 'private',
      is_demo: false,
      seed_key: params.internal_reference || null,
    } as any)
    .select()
    .single();

  if (error) {
    return { success: false, message: `Failed to create deal: ${error.message}` };
  }

  const defaultConditions = [
    'Stakeholder data imported',
    'Documents uploaded',
    'KYC/KYB requests generated',
    'Approval package prepared',
  ];

  await Promise.all([
    supabase.from('deal_participants').insert({
      deal_id: data.id,
      user_id: userId,
      party_role: 'admin',
    }),
    supabase.from('deal_settings').insert({ deal_id: data.id }),
    supabase.from('conditions').insert(defaultConditions.map((title) => ({ deal_id: data.id, title } as any))),
    supabase.from('deal_events').insert({
      deal_id: data.id,
      actor_id: userId,
      event_type: 'state_transition',
      previous_state: null,
      new_state: 'draft',
      payload: {
        source: 'newton',
        action: 'create_deal',
        internal_reference: params.internal_reference || null,
        primary_deal_owner: params.primary_deal_owner || null,
      },
    } as any),
  ]).catch(() => {
    // Non-blocking setup inserts should not fail overall deal creation UX.
  });

  await logNewtonAction(
    data.id,
    userId,
    `Newton created deal: ${params.deal_name}`,
    {
      internal_reference: params.internal_reference || null,
      primary_deal_owner: params.primary_deal_owner || null,
    }
  );

  const dealNumber = (data as any).deal_number || data.id;

  return {
    success: true,
    message:
      `**${params.deal_name}** created successfully.\n\n` +
      `- **Matter ID:** ${dealNumber}\n` +
      `- **Readiness:** Initialized in draft state\n\n` +
      `**Next recommended actions:**\n` +
      `- Upload stakeholder list\n` +
      `- Upload deal documents\n` +
      `- Generate KYC/KYB requests`,
    data: {
      deal_id: data.id,
      deal_name: data.deal_name,
      deal_number: dealNumber,
      readiness_initialized: true,
    },
    navigateTo: 'workspace',
    logEntry: `Newton created deal: ${params.deal_name}`,
  };
}

export async function executeSummarizeReadiness(dealId: string): Promise<NewtonActionResult> {
  const [condRes, appRes, docsRes, discRes, stakRes] = await Promise.all([
    supabase.from('conditions').select('status').eq('deal_id', dealId),
    supabase.from('deal_approvals').select('status').eq('deal_id', dealId),
    supabase.from('contract_documents').select('status').eq('deal_id', dealId),
    supabase.from('discrepancies').select('severity, status').eq('deal_id', dealId).neq('status', 'resolved' as any),
    supabase.from('cap_table_entries').select('verification_status').eq('deal_id', dealId),
  ]);

  const conditions = condRes.data || [];
  const condMet = conditions.filter((c) => ['MET', 'SATISFIED', 'WAIVED'].includes(c.status)).length;

  const approvals = appRes.data || [];
  const appDone = approvals.filter((a) => ['approved', 'completed'].includes(a.status)).length;

  const docs = docsRes.data || [];
  const docsVerified = docs.filter((d) => (d.status as string) === 'verified').length;

  const discrepancies = discRes.data || [];
  const critical = discrepancies.filter((d) => (d.severity as string) === 'critical').length;

  const stakeholders = stakRes.data || [];
  const verified = stakeholders.filter((s) => s.verification_status === 'verified').length;

  const total = conditions.length + approvals.length + docs.length + stakeholders.length;
  const done = condMet + appDone + docsVerified + verified;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    success: true,
    message:
      `**Closing Readiness: ${pct}%**\n\n` +
      `- **Conditions:** ${condMet}/${conditions.length} met\n` +
      `- **Approvals:** ${appDone}/${approvals.length} completed\n` +
      `- **Documents:** ${docsVerified}/${docs.length} verified\n` +
      `- **Stakeholder KYC:** ${verified}/${stakeholders.length} verified\n` +
      `- **Open Discrepancies:** ${discrepancies.length} (${critical} critical)\n\n` +
      (critical > 0
        ? '⚠️ **Critical discrepancies must be resolved before closing.**'
        : pct >= 90
          ? '✅ **Deal is approaching closing readiness.**'
          : '📋 **Continue resolving outstanding items.**'),
  };
}

export async function executeListBlockers(dealId: string): Promise<NewtonActionResult> {
  const [condRes, appRes, discRes, stakRes, docsRes] = await Promise.all([
    supabase.from('conditions').select('title, status').eq('deal_id', dealId).neq('status', 'MET' as any).neq('status', 'SATISFIED' as any).neq('status', 'WAIVED' as any),
    supabase.from('deal_approvals').select('approver_name, approval_type, status').eq('deal_id', dealId).neq('status', 'approved').neq('status', 'completed'),
    supabase.from('discrepancies').select('message, severity, status').eq('deal_id', dealId).neq('status', 'resolved' as any),
    supabase.from('cap_table_entries').select('shareholder_name, verification_status').eq('deal_id', dealId).neq('verification_status', 'verified'),
    supabase.from('contract_documents').select('filename, status').eq('deal_id', dealId).neq('status', 'verified' as any),
  ]);

  const blockers: string[] = [];

  const critDisc = (discRes.data || []).filter((d) => (d.severity as string) === 'critical');
  critDisc.forEach((d) => blockers.push(`🔴 Critical discrepancy: ${d.message}`));

  const pendApp = (appRes.data || []).filter((a) => a.status === 'pending' || a.status === 'sent');
  pendApp.forEach((a) => blockers.push(`🟡 Pending approval: ${a.approval_type || 'Approval'} from ${a.approver_name || 'Unknown'}`));

  const unmetCond = condRes.data || [];
  unmetCond.forEach((c) => blockers.push(`🟠 Unmet condition: ${c.title}`));

  const unverified = (stakRes.data || []).filter((s) => s.verification_status !== 'not_sent');
  unverified.forEach((s) => blockers.push(`🟡 KYC pending: ${s.shareholder_name}`));

  const unverifiedDocs = docsRes.data || [];
  unverifiedDocs.forEach((d) => blockers.push(`🟠 Document pending review: ${d.filename}`));

  if (blockers.length === 0) {
    return { success: true, message: '✅ **No blockers identified.** Deal appears ready to progress.' };
  }

  return {
    success: true,
    message: `**${blockers.length} Blocker${blockers.length > 1 ? 's' : ''} Identified:**\n\n${blockers.join('\n')}\n\n**Recommended:** Resolve critical items first.`,
  };
}

export async function executeGenerateKycRequests(dealId: string, userId: string): Promise<NewtonActionResult> {
  const { data: stakeholders } = await supabase
    .from('cap_table_entries')
    .select('id, shareholder_name, email, verification_status, stakeholder_type')
    .eq('deal_id', dealId)
    .in('verification_status', ['not_sent', 'not_requested']);

  const eligible = (stakeholders || []).filter((s) => s.email);
  if (eligible.length === 0) {
    return {
      success: true,
      message: '**No eligible stakeholders for KYC requests.** Either all have been sent, or stakeholders are missing email addresses.',
    };
  }

  const ids = eligible.map((s) => s.id);
  await supabase
    .from('cap_table_entries')
    .update({
      verification_status: 'requested',
      verification_requested_at: new Date().toISOString(),
      verification_last_sent_at: new Date().toISOString(),
    })
    .in('id', ids);

  await logNewtonAction(dealId, userId, `Newton generated ${eligible.length} KYC/KYB verification requests`);

  const details = eligible
    .map((s) => `- ${s.shareholder_name} (${s.stakeholder_type === 'organization' ? 'KYB' : 'KYC'}) → ${s.email}`)
    .join('\n');

  return {
    success: true,
    message: `**${eligible.length} KYC/KYB requests generated:**\n\n${details}\n\n📧 Verification requests are now queued for delivery.`,
    logEntry: `Newton generated ${eligible.length} KYC/KYB requests`,
  };
}

export async function executePrepareApprovalPackage(dealId: string, userId: string): Promise<NewtonActionResult> {
  const [dealRes, condRes, discRes, stakRes] = await Promise.all([
    supabase.from('deals').select('deal_name, deal_value, status, closing_date, buyer, seller').eq('id', dealId).single(),
    supabase.from('conditions').select('title, status').eq('deal_id', dealId),
    supabase.from('discrepancies').select('severity, status').eq('deal_id', dealId).neq('status', 'resolved'),
    supabase.from('cap_table_entries').select('verification_status').eq('deal_id', dealId),
  ]);

  const deal = dealRes.data;
  if (!deal) return { success: false, message: 'Deal not found.' };

  const conditions = condRes.data || [];
  const condMet = conditions.filter((c) => ['MET', 'SATISFIED', 'WAIVED'].includes(c.status)).length;
  const openDisc = (discRes.data || []).length;
  const criticalDisc = (discRes.data || []).filter((d) => (d.severity as string) === 'critical').length;
  const totalStak = (stakRes.data || []).length;
  const verifiedStak = (stakRes.data || []).filter((s) => s.verification_status === 'verified').length;

  const ready = criticalDisc === 0 && condMet === conditions.length;

  await logNewtonAction(dealId, userId, `Newton prepared approval package for ${deal.deal_name}`);

  return {
    success: true,
    message:
      `**Approval Package — ${deal.deal_name}**\n\n` +
      `| Item | Status |\n|---|---|\n` +
      `| Conditions | ${condMet}/${conditions.length} met |\n` +
      `| Discrepancies | ${openDisc} open (${criticalDisc} critical) |\n` +
      `| Stakeholder KYC | ${verifiedStak}/${totalStak} verified |\n` +
      `| Deal Value | $${(deal.deal_value / 1e6).toFixed(1)}M |\n\n` +
      (ready
        ? '✅ **Package is ready for approval submission.**'
        : `⚠️ **Package is NOT ready.** ${criticalDisc > 0 ? 'Resolve critical discrepancies.' : 'Complete outstanding conditions.'}`),
    logEntry: `Newton prepared approval package for ${deal.deal_name}`,
  };
}

export async function executeListDeals(_userId: string): Promise<NewtonActionResult> {
  const { data: deals } = await (supabase.from('deals').select('id, deal_name, deal_number, deal_value, status, closing_date') as any)
    .neq('deal_kind', 'template')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!deals || deals.length === 0) {
    return { success: true, message: 'No deals found yet. Would you like me to create one now?' };
  }

  const rows = deals
    .map((d: any) => `| ${d.deal_name} | ${d.deal_number} | $${(d.deal_value / 1e6).toFixed(1)}M | ${d.status} |`)
    .join('\n');

  return {
    success: true,
    message: `**Your Deals (${deals.length}):**\n\n| Name | Matter ID | Value | Status |\n|---|---|---|---|\n${rows}`,
    navigateTo: 'deals',
  };
}

// ─── Helpers ────────────────────────────────────────────────────

async function logNewtonAction(dealId: string, userId: string, action: string, details?: Record<string, any>) {
  try {
    await supabase.from('audit_log').insert({
      deal_id: dealId,
      user_id: userId,
      action,
      details: {
        source: 'newton',
        timestamp: new Date().toISOString(),
        ...details,
      },
    });
  } catch (e) {
    console.error('Newton audit log error:', e);
  }
}

export const SUPPORTED_ACTIONS_TEXT = `I can’t complete that yet. I can help you with:
- **Create a new deal**
- **Show all deals**
- **Import or parse stakeholders**
- **Upload/review deal documents**
- **Summarize readiness**
- **List blockers**
- **Generate KYC/KYB requests**
- **Prepare approval package**`;

