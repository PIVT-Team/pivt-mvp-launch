/**
 * Newton Action Service — Maps detected intents to real platform actions.
 * All actions write to the same Supabase tables used by manual UI.
 */
import { supabase } from "@/integrations/supabase/client";

export type NewtonActionType =
  | 'create_deal'
  | 'update_deal_metadata'
  | 'summarize_readiness'
  | 'list_blockers'
  | 'generate_kyc_requests'
  | 'generate_kyb_requests'
  | 'prepare_approval_package'
  | 'list_deals'
  | 'unsupported';

export interface NewtonIntent {
  action: NewtonActionType;
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

// ─── Intent Detection (client-side, fast) ───────────────────────

const INTENT_PATTERNS: { pattern: RegExp; action: NewtonActionType; requiresForm?: boolean; formType?: 'create_deal' }[] = [
  { pattern: /\b(create|new|start|set\s*up|open)\b.*\b(deal|transaction|project)\b/i, action: 'create_deal', requiresForm: true, formType: 'create_deal' },
  { pattern: /\b(what('?s| is)|show|summarize|check)\b.*\b(ready|readiness|status|progress)\b/i, action: 'summarize_readiness' },
  { pattern: /\b(what('?s| is)|show|list|find)\b.*\b(block|missing|incomplete|outstanding|needed|gaps)\b/i, action: 'list_blockers' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyc)\b/i, action: 'generate_kyc_requests' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyb)\b/i, action: 'generate_kyb_requests' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyc|kyb).*\b(request|check)\b/i, action: 'generate_kyc_requests' },
  { pattern: /\b(prepare|generate|create)\b.*\b(approval|sign.?off)\b.*\b(package|bundle)\b/i, action: 'prepare_approval_package' },
  { pattern: /\b(list|show|get)\b.*\b(deal|transaction)s\b/i, action: 'list_deals' },
  { pattern: /\b(update|change|modify|edit)\b.*\b(deal|transaction)\b.*\b(name|value|date|buyer|seller|status)\b/i, action: 'update_deal_metadata' },
];

export function detectIntent(message: string): NewtonIntent {
  for (const { pattern, action, requiresForm, formType } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      return { action, confidence: 0.85, params: {}, requiresForm, formType };
    }
  }
  return { action: 'unsupported', confidence: 0, params: {} };
}

// ─── Action Executors ───────────────────────────────────────────

export async function executeCreateDeal(
  params: {
    deal_name: string;
    deal_value: number;
    buyer?: string;
    seller?: string;
    target_company?: string;
    deal_type?: string;
    sector?: string;
    currency?: string;
    jurisdiction?: string;
    closing_date?: string;
    escrow_amount?: number;
  },
  userId: string,
): Promise<NewtonActionResult> {
  const { data, error } = await supabase
    .from("deals")
    .insert({
      deal_name: params.deal_name,
      deal_value: params.deal_value,
      buyer: params.buyer || null,
      seller: params.seller || null,
      target_company: params.target_company || null,
      deal_type: params.deal_type || null,
      sector: params.sector || null,
      currency: params.currency || 'USD',
      jurisdiction: params.jurisdiction || null,
      closing_date: params.closing_date || null,
      escrow_amount: params.escrow_amount || 0,
      created_by: userId,
      owner_id: userId,
      status: "draft",
      deal_number: "",
      deal_kind: "live" as any,
      visibility: "private",
      is_demo: false,
    } as any)
    .select()
    .single();

  if (error) {
    return { success: false, message: `Failed to create deal: ${error.message}` };
  }

  // Add creator as participant
  await supabase.from("deal_participants").insert({
    deal_id: data.id,
    user_id: userId,
    party_role: "admin",
  });

  // Create deal settings
  await supabase.from("deal_settings").insert({ deal_id: data.id });

  // Log to audit
  await logNewtonAction(data.id, userId, `Newton created deal: ${params.deal_name}`);

  const value = params.deal_value >= 1_000_000
    ? `$${(params.deal_value / 1_000_000).toFixed(1)}M`
    : `$${params.deal_value.toLocaleString()}`;

  return {
    success: true,
    message: `**${params.deal_name}** created successfully (${value}).\n\n**Recommended next steps:**\n- Upload stakeholders\n- Upload transaction documents\n- Generate KYC/KYB requests\n- Set up escrow account`,
    data: { deal_id: data.id, deal_name: data.deal_name, deal_number: (data as any).deal_number },
    navigateTo: 'deals',
    logEntry: `Newton created deal: ${params.deal_name}`,
  };
}

export async function executeSummarizeReadiness(dealId: string): Promise<NewtonActionResult> {
  const [condRes, appRes, docsRes, discRes, stakRes] = await Promise.all([
    supabase.from("conditions").select("status").eq("deal_id", dealId),
    supabase.from("deal_approvals").select("status").eq("deal_id", dealId),
    supabase.from("contract_documents").select("status").eq("deal_id", dealId),
    supabase.from("discrepancies").select("severity, status").eq("deal_id", dealId).neq("status", "resolved" as any),
    supabase.from("cap_table_entries").select("verification_status").eq("deal_id", dealId),
  ]);

  const conditions = condRes.data || [];
  const condMet = conditions.filter(c => ['MET', 'SATISFIED', 'WAIVED'].includes(c.status)).length;

  const approvals = appRes.data || [];
  const appDone = approvals.filter(a => ['approved', 'completed'].includes(a.status)).length;

  const docs = docsRes.data || [];
  const docsVerified = docs.filter(d => (d.status as string) === 'verified').length;

  const discrepancies = discRes.data || [];
  const critical = discrepancies.filter(d => (d.severity as string) === 'critical').length;

  const stakeholders = stakRes.data || [];
  const verified = stakeholders.filter(s => s.verification_status === 'verified').length;

  const total = conditions.length + approvals.length + docs.length + stakeholders.length;
  const done = condMet + appDone + docsVerified + verified;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    success: true,
    message: `**Closing Readiness: ${pct}%**\n\n` +
      `- **Conditions:** ${condMet}/${conditions.length} met\n` +
      `- **Approvals:** ${appDone}/${approvals.length} completed\n` +
      `- **Documents:** ${docsVerified}/${docs.length} verified\n` +
      `- **Stakeholder KYC:** ${verified}/${stakeholders.length} verified\n` +
      `- **Open Discrepancies:** ${discrepancies.length} (${critical} critical)\n\n` +
      (critical > 0 ? '⚠️ **Critical discrepancies must be resolved before closing.**' :
        pct >= 90 ? '✅ **Deal is approaching closing readiness.**' :
          '📋 **Continue resolving outstanding items.**'),
  };
}

export async function executeListBlockers(dealId: string): Promise<NewtonActionResult> {
  const [condRes, appRes, discRes, stakRes] = await Promise.all([
    supabase.from("conditions").select("title, status").eq("deal_id", dealId).neq("status", "MET" as any).neq("status", "SATISFIED" as any).neq("status", "WAIVED" as any),
    supabase.from("deal_approvals").select("approver_name, approval_type, status, blocker_reason").eq("deal_id", dealId).neq("status", "approved").neq("status", "completed"),
    supabase.from("discrepancies").select("message, severity, status").eq("deal_id", dealId).neq("status", "resolved" as any),
    supabase.from("cap_table_entries").select("shareholder_name, verification_status").eq("deal_id", dealId).neq("verification_status", "verified"),
  ]);

  const blockers: string[] = [];

  const critDisc = (discRes.data || []).filter(d => (d.severity as string) === 'critical');
  critDisc.forEach(d => blockers.push(`🔴 Critical discrepancy: ${d.message}`));

  const pendApp = (appRes.data || []).filter(a => a.status === 'pending' || a.status === 'sent');
  pendApp.forEach(a => blockers.push(`🟡 Pending approval: ${a.approval_type} from ${a.approver_name || 'Unknown'}`));

  const unmetCond = condRes.data || [];
  unmetCond.forEach(c => blockers.push(`🟠 Unmet condition: ${c.title}`));

  const unverified = (stakRes.data || []).filter(s => s.verification_status !== 'not_sent');
  unverified.forEach(s => blockers.push(`🟡 KYC pending: ${s.shareholder_name}`));

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
    .from("cap_table_entries")
    .select("id, shareholder_name, email, verification_status, stakeholder_type")
    .eq("deal_id", dealId)
    .in("verification_status", ["not_sent", "not_requested"]);

  const eligible = (stakeholders || []).filter(s => s.email);
  if (eligible.length === 0) {
    return { success: true, message: '**No eligible stakeholders for KYC requests.** Either all have been sent, or stakeholders are missing email addresses.' };
  }

  // Update status to 'requested'
  const ids = eligible.map(s => s.id);
  await supabase
    .from("cap_table_entries")
    .update({
      verification_status: "requested",
      verification_requested_at: new Date().toISOString(),
    })
    .in("id", ids);

  await logNewtonAction(dealId, userId, `Newton generated ${eligible.length} KYC/KYB verification requests`);

  const details = eligible.map(s => `- ${s.shareholder_name} (${s.stakeholder_type === 'organization' ? 'KYB' : 'KYC'}) → ${s.email}`).join('\n');

  return {
    success: true,
    message: `**${eligible.length} KYC/KYB requests generated:**\n\n${details}\n\n📧 Verification requests are now queued for delivery.`,
    logEntry: `Newton generated ${eligible.length} KYC/KYB requests`,
  };
}

export async function executePrepareApprovalPackage(dealId: string, userId: string): Promise<NewtonActionResult> {
  // Gather deal state for approval readiness
  const [dealRes, condRes, discRes, stakRes] = await Promise.all([
    supabase.from("deals").select("deal_name, deal_value, status, closing_date, buyer, seller").eq("id", dealId).single(),
    supabase.from("conditions").select("title, status").eq("deal_id", dealId),
    supabase.from("discrepancies").select("severity, status").eq("deal_id", dealId).neq("status", "resolved"),
    supabase.from("cap_table_entries").select("verification_status").eq("deal_id", dealId),
  ]);

  const deal = dealRes.data;
  if (!deal) return { success: false, message: 'Deal not found.' };

  const conditions = condRes.data || [];
  const condMet = conditions.filter(c => ['MET', 'SATISFIED', 'WAIVED'].includes(c.status)).length;
  const openDisc = (discRes.data || []).length;
  const criticalDisc = (discRes.data || []).filter(d => (d.severity as string) === 'critical').length;
  const totalStak = (stakRes.data || []).length;
  const verifiedStak = (stakRes.data || []).filter(s => s.verification_status === 'verified').length;

  const ready = criticalDisc === 0 && condMet === conditions.length;

  await logNewtonAction(dealId, userId, `Newton prepared approval package for ${deal.deal_name}`);

  return {
    success: true,
    message: `**Approval Package — ${deal.deal_name}**\n\n` +
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

export async function executeListDeals(userId: string): Promise<NewtonActionResult> {
  const { data: deals } = await (supabase.from("deals").select("deal_name, deal_number, deal_value, status, closing_date") as any)
    .neq("deal_kind", "template")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!deals || deals.length === 0) {
    return { success: true, message: 'No deals found. Would you like to create a new deal?' };
  }

  const rows = deals.map((d: any) =>
    `| ${d.deal_name} | ${d.deal_number} | $${(d.deal_value / 1e6).toFixed(1)}M | ${d.status} |`
  ).join('\n');

  return {
    success: true,
    message: `**Your Deals (${deals.length}):**\n\n| Name | Number | Value | Status |\n|---|---|---|---|\n${rows}`,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

async function logNewtonAction(dealId: string, userId: string, action: string) {
  try {
    await supabase.from("audit_log").insert({
      deal_id: dealId,
      user_id: userId,
      action: action,
      details: { source: 'newton', timestamp: new Date().toISOString() },
    });
  } catch (e) {
    console.error("Newton audit log error:", e);
  }
}

export const SUPPORTED_ACTIONS_TEXT = `I can help you with:
- **Create a new deal** — set up a transaction workspace
- **Summarize readiness** — closing readiness overview
- **List blockers** — what's missing before close
- **Generate KYC/KYB requests** — send verification requests
- **Prepare approval package** — pre-closing approval summary
- **List deals** — view your deal portfolio

Just ask me naturally!`;
