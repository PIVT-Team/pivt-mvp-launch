/**
 * Newton Action Service — Maps detected intents to real platform actions.
 * All actions are executed via the newton-action edge function (service role)
 * so they work regardless of client auth state.
 */

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/newton-action`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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
  | 'open_deal'
  | 'next_steps'
  | 'execute_deal'
  | 'show_demo'
  | 'query_state'
  | 'parse_funds_flow'
  | 'run_discrepancy_check'
  | 'generate_wire_pack'
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
  // ── Navigation / Deal Opening ──
  { pattern: /\b(open|go\s*to|switch\s*to|navigate\s*to|show\s*me)\b\s+(?:deal\s+)?(?:[""]([^""]+)[""]|([A-Z][a-zA-Z\s]+(?:Holdings|Corp|Capital|Partners|Group|Inc|LLC|Ltd|Deal|Project|Fund)?))\b/i, action: 'open_deal', scope: 'global' },
  { pattern: /\bopen\s+(project|deal)\s+(\w[\w\s]*\w)/i, action: 'open_deal', scope: 'global' },
  // ── Deal Creation ──
  { pattern: /\b(create|new|start|set\s*up)\b.*\b(deal|transaction|project|closing)\b/i, action: 'create_deal', scope: 'global', requiresForm: true, formType: 'create_deal' },
  // ── Funds Flow & Wire Parsing ──
  { pattern: /\b(parse|analy[sz]e|process|review|check)\b.*\b(funds?\s*flow|wire\s*instruction|payment\s*schedule|disbursement)\b/i, action: 'parse_funds_flow', scope: 'deal' },
  { pattern: /\b(upload|import)\b.*\b(funds?\s*flow|wire\s*instruction|wire\s*schedule|payment)\b/i, action: 'parse_funds_flow', scope: 'deal' },
  { pattern: /\b(run|check|detect|find|identify)\b.*\b(discrepanc|mismatch|inconsistenc|reconcil)\b/i, action: 'run_discrepancy_check', scope: 'deal' },
  { pattern: /\b(compare|cross.?check|validate)\b.*\b(wire|fund|payment|bank)\b/i, action: 'run_discrepancy_check', scope: 'deal' },
  // ── Portfolio ──
  { pattern: /\b(show|list|get|view)\b.*\b(all\s+)?(deals|transactions|projects)\b/i, action: 'list_deals', scope: 'global' },
  // ── Next Steps / Co-pilot ──
  { pattern: /\b(what\s+should\s+I|what\s*('?s|are)\s+(the\s+)?next|recommend|suggest|advise|guide)\b/i, action: 'next_steps', scope: 'deal' },
  { pattern: /\bwhat\s+do\s+I\s+(need|have)\s+to\s+do/i, action: 'next_steps', scope: 'deal' },
  // ── Execute / Close ──
  { pattern: /\b(execute|close|finalize|settle)\b.*\b(deal|transaction|this)\b/i, action: 'execute_deal', scope: 'deal' },
  { pattern: /\b(prepare|get\s+ready)\b.*\b(for\s+closing|to\s+close)\b/i, action: 'execute_deal', scope: 'deal' },
  // ── Demo / Tour ──
  { pattern: /\b(show\s+me\s+how|walk\s+me|demo|tour|guided)\b/i, action: 'show_demo', scope: 'deal' },
  // ── State Queries ──
  { pattern: /\bhow\s+many\b.*\b(stakeholder|investor|shareholder|verified|unverified)\b/i, action: 'query_state', scope: 'info' },
  { pattern: /\bhow\s+many\b.*\b(document|approval|wire|discrepanc)\b/i, action: 'query_state', scope: 'info' },
  // ── Stakeholders ──
  { pattern: /\b(import|upload|add)\b.*\b(stakeholder|cap\s*table|investor)\b.*\b(list|sheet|spreadsheet|csv|xlsx)?\b/i, action: 'upload_stakeholders', scope: 'global' },
  { pattern: /\b(parse|extract|ingest)\b.*\b(stakeholder|cap\s*table)\b/i, action: 'parse_stakeholders', scope: 'deal' },
  // ── Documents ──
  { pattern: /\b(upload|add|import)\b.*\b(document|agreement|contract|doc)\b/i, action: 'upload_documents', scope: 'deal' },
  { pattern: /\b(review|check|analy[sz]e)\b.*\b(document|agreement|contract|doc)\b/i, action: 'review_documents', scope: 'deal' },
  // ── Wire / Tax / Approvals ──
  { pattern: /\b(upload|review|match|verify)\b.*\b(wire|bank\s*instruction)\b/i, action: 'open_wire_instructions', scope: 'deal' },
  { pattern: /\b(review|check)\b.*\b(tax\s*form|tax)\b/i, action: 'open_tax_forms', scope: 'deal' },
  { pattern: /\b(send|review|prepare|track)\b.*\b(approval|docusign|signature)\b/i, action: 'open_approvals', scope: 'deal' },
  { pattern: /\b(start|prepare|init)\b.*\b(new\s+closing|closing)\b/i, action: 'start_new_closing', scope: 'global' },
  // ── Intelligence ──
  { pattern: /\b(what('?s| is)|show|summarize|check)\b.*\b(ready|readiness|status|progress|missing\s+for\s+closing)\b/i, action: 'summarize_readiness', scope: 'info' },
  { pattern: /\b(what('?s| is)|show|list|find|identify|who)\b.*\b(block|missing|incomplete|outstanding|needed|gaps|unverified|documents\s+outstanding|blockers?)\b/i, action: 'list_blockers', scope: 'info' },
  // ── KYC/KYB ──
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyc)\b/i, action: 'generate_kyc_requests', scope: 'deal' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyb)\b/i, action: 'generate_kyb_requests', scope: 'deal' },
  { pattern: /\b(generate|create|send|prepare)\b.*\b(kyc|kyb).*(request|check|verification)\b/i, action: 'generate_kyc_requests', scope: 'deal' },
  // ── Approval Package ──
  { pattern: /\b(prepare|generate|create)\b.*\b(approval|sign.?off)\b.*\b(package|bundle)\b/i, action: 'prepare_approval_package', scope: 'deal' },
  // ── Metadata ──
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

  // Enhanced: "$45M acquisition of Acme Corp by Nova Holdings"
  const acquisitionMatch = message.match(/(?:acquisition|purchase|buyout|takeover)\s+(?:of\s+)?[""]?([^""]+?)[""]?\s+by\s+[""]?([^""]+?)[""]?(?=\s+(?:closing|close|worth|valued|for|\$)|$)/i);
  if (acquisitionMatch) {
    parsed.target_company = cleanCapture(acquisitionMatch[1]);
    parsed.buyer = cleanCapture(acquisitionMatch[2]);
  }

  const nameMatch =
    message.match(/(?:called|named)\s+[""]?([^"\n,]+?)[""]?(?=(?:\s+(?:for|with|buyer|seller|target|acquiring|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i)
    || message.match(/create(?:\s+a|\s+new)?\s+(?:deal|transaction|project)\s+[""]?([^"\n,]+?)[""]?(?=(?:\s+(?:for|with|buyer|seller|target|acquiring|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);

  const buyerMatch = !parsed.buyer ? message.match(/(?:for\s+buyer|buyer)\s+([^,\n]+?)(?=(?:\s+(?:acquiring|acquire|seller|target|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i) : null;
  const sellerMatch = message.match(/seller\s+([^,\n]+?)(?=(?:\s+(?:target|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i);
  const targetMatch = !parsed.target_company ? message.match(/(?:acquiring|acquire|target(?:\s+company)?|targeting)\s+([^,\n]+?)(?=(?:\s+(?:seller|close|closing|deal\s*size|deal\s*value|worth|matter|owner|jurisdiction)\b|$))/i) : null;
  const closeMatch = message.match(/(?:target\s*close|target\s*closing|closing\s*date|close|closing)\s*(?:on\s*)?([a-zA-Z]+\s+\d{1,2}(?:,?\s*\d{4})?|\d{4}-\d{2}-\d{2})/i);
  // Enhanced: "$45M" anywhere
  const valueMatch = message.match(/\$\s*([\d,.]+(?:\.\d+)?)\s*(billion|bn|b|million|mn|m)?/i)
    || message.match(/(?:deal\s*size|deal\s*value|valued\s*at|worth|for)\s*\$?\s*([\d,.]+(?:\.\d+)?)\s*(billion|bn|b|million|mn|m)?/i);
  const jurisdictionMatch = message.match(/jurisdiction\s*[:\-]?\s*([a-zA-Z][a-zA-Z\s-]{1,40})/i);
  // Enhanced: detect deal type from keywords
  const typeMatch = message.match(/\b(acquisition|merger|buyout|leveraged\s*buyout|growth\s*equity|asset\s*acquisition)\b/i);

  const name = cleanCapture(nameMatch?.[1]);
  const buyer = parsed.buyer || cleanCapture(buyerMatch?.[1]);
  const seller = cleanCapture(sellerMatch?.[1]);
  const target = parsed.target_company || cleanCapture(targetMatch?.[1]);
  const closeDate = normalizeDateInput(closeMatch?.[1]);
  const dealValue = valueMatch ? parseScaledNumber(valueMatch[1], valueMatch[2]) : undefined;
  const jurisdiction = cleanCapture(jurisdictionMatch?.[1]);

  if (name) parsed.deal_name = name;
  if (buyer) parsed.buyer = buyer;
  if (seller) parsed.seller = seller;
  if (target) parsed.target_company = target;
  if (closeDate) parsed.closing_date = closeDate;
  if (dealValue != null) parsed.deal_value = dealValue;
  if (jurisdiction) parsed.jurisdiction = jurisdiction;

  // Auto-detect deal type
  if (typeMatch && !parsed.deal_type) {
    const t = typeMatch[1].toLowerCase();
    if (t.includes('merger')) parsed.deal_type = 'Merger';
    else if (t.includes('leveraged') || t.includes('buyout')) parsed.deal_type = 'Leveraged Buyout';
    else if (t.includes('growth')) parsed.deal_type = 'Growth Equity';
    else if (t.includes('asset')) parsed.deal_type = 'Asset Acquisition';
    else parsed.deal_type = 'Private Equity Acquisition';
  }

  return parsed;
}

export function extractDealNameFromPrompt(message: string): string | undefined {
  const m = message.match(/\b(?:open|go\s*to|switch\s*to|show\s*me)\s+(?:deal\s+)?[""]?([^""]+?)[""]?\s*$/i)
    || message.match(/\bopen\s+(?:project|deal)\s+(.+)/i);
  return m?.[1]?.trim() || undefined;
}

export function detectIntent(message: string): NewtonIntent {
  for (const { pattern, action, scope, requiresForm, formType } of INTENT_PATTERNS) {
    if (pattern.test(message)) {
      let params: Record<string, any> = {};
      if (action === 'create_deal') params = parseCreateDealPrefill(message);
      if (action === 'open_deal') params = { deal_name: extractDealNameFromPrompt(message) };
      return {
        action,
        scope,
        confidence: 0.86,
        params,
        requiresForm,
        formType,
      };
    }
  }
  return { action: 'unsupported', scope: 'info', confidence: 0, params: {} };
}

// ─── Edge Function Caller ───────────────────────────────────────

async function callNewtonAction(action: string, params: Record<string, any>): Promise<NewtonActionResult> {
  try {
    const resp = await fetch(EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ action, params }),
    });

    const data = await resp.json();

    if (!resp.ok || !data.success) {
      return { success: false, message: data.error || data.message || `Action failed (${resp.status})` };
    }

    return {
      success: true,
      message: data.message || 'Action completed.',
      data,
    };
  } catch (e) {
    return { success: false, message: `Network error: ${e instanceof Error ? e.message : 'Unknown'}` };
  }
}

// ─── Action Executors ───────────────────────────────────────────

export async function executeCreateDeal(
  params: NewtonCreateDealParams,
  _userId?: string,
): Promise<NewtonActionResult> {
  const result = await callNewtonAction('create_deal', params);

  if (result.success && result.data) {
    const dealNumber = result.data.deal_number || result.data.deal_id;
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
        deal_id: result.data.deal_id,
        deal_name: result.data.deal_name,
        deal_number: dealNumber,
        readiness_initialized: true,
      },
      navigateTo: 'workspace',
      logEntry: `Newton created deal: ${params.deal_name}`,
    };
  }

  return result;
}

export async function executeSummarizeReadiness(dealId: string): Promise<NewtonActionResult> {
  return callNewtonAction('summarize_readiness', { deal_id: dealId });
}

export async function executeListBlockers(dealId: string): Promise<NewtonActionResult> {
  return callNewtonAction('list_blockers', { deal_id: dealId });
}

export async function executeGenerateKycRequests(dealId: string, _userId?: string): Promise<NewtonActionResult> {
  return callNewtonAction('generate_kyc_requests', { deal_id: dealId });
}

export async function executePrepareApprovalPackage(dealId: string, _userId?: string): Promise<NewtonActionResult> {
  return callNewtonAction('prepare_approval_package', { deal_id: dealId });
}

export async function executeListDeals(_userId?: string): Promise<NewtonActionResult> {
  return callNewtonAction('list_deals', {});
}

export async function executeParseFundsFlow(dealId: string): Promise<NewtonActionResult> {
  return callNewtonAction('parse_funds_flow', { deal_id: dealId });
}

export async function executeRunDiscrepancyCheck(dealId: string): Promise<NewtonActionResult> {
  return callNewtonAction('run_discrepancy_check', { deal_id: dealId });
}

export const SUPPORTED_ACTIONS_TEXT = `I can't complete that yet. I can help you with:
- **Create a new deal**
- **Show all deals** / **Open a deal by name**
- **Import or parse stakeholders**
- **Upload/review deal documents**
- **Parse funds flow & wire instructions**
- **Run wire discrepancy checks**
- **Summarize readiness** / **List blockers**
- **What should I do next?**
- **Execute the deal** (checks readiness)
- **Generate KYC/KYB requests**
- **Prepare approval package**
- **Show me how this deal works** (guided tour)`;
