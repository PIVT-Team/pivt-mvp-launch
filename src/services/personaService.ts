// personaService — thin client wrapper around the Persona edge functions
// and the embedded Persona SDK.
//
// Why a service layer:
//   • Components shouldn't talk to supabase.functions.invoke directly for
//     anything beyond a trivial RPC — it makes future swaps (e.g. retry
//     wrapping, telemetry, mock provider) one file.
//   • The Persona SDK loads from a CDN; we wrap the script-tag dance here
//     so consumers just await `loadPersonaSDK()`.
//   • Schema-not-deployed defensive path: surfaces a typed result instead
//     of a thrown Postgrest error.

import { supabase } from '@/integrations/supabase/client';

const PERSONA_SDK_URL = 'https://cdn.withpersona.com/dist/persona-v5.1.4.js';

export type PersonaKind = 'kyc' | 'kyb' | 'watchlist';

export interface CreateInquiryResult {
  success: boolean;
  inquiry_id?: string;
  session_token?: string | null;
  template_id?: string;
  reference_id?: string;
  reused_account?: boolean;
  error?: string;
  code?: string;
}

export interface PersonaInquiryRow {
  id: string;
  deal_id: string;
  stakeholder_id: string;
  kind: PersonaKind;
  persona_inquiry_id: string | null;
  persona_account_id: string | null;
  persona_template_id: string;
  reference_id: string;
  status: string;
  initiated_at: string;
  completed_at: string | null;
  watchlist_report_id: string | null;
  evidence_url: string | null;
}

// ────────────────────────────────────────────────────────────────────────
// SDK loader
// ────────────────────────────────────────────────────────────────────────
//
// Persona's `Persona` global comes from a CDN script tag. We lazy-load it
// so the workspace bundle doesn't grow for users who never touch KYC.

let sdkPromise: Promise<typeof window.Persona> | null = null;

declare global {
  interface Window {
    Persona?: {
      Client: new (opts: PersonaClientOptions) => { open: () => void; cancel: () => void };
    };
  }
}

export interface PersonaClientOptions {
  /** Inquiry id returned by persona-create-inquiry */
  inquiryId: string;
  /** Session token returned by persona-create-inquiry (required for resuming) */
  sessionToken?: string | null;
  environment?: 'sandbox' | 'production';
  onComplete?: (payload: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
}

export async function loadPersonaSDK(): Promise<NonNullable<Window['Persona']>> {
  if (typeof window === 'undefined') {
    throw new Error('Persona SDK can only load in the browser');
  }
  if (window.Persona) return window.Persona;
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${PERSONA_SDK_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => {
        if (window.Persona) resolve(window.Persona);
        else reject(new Error('Persona SDK loaded but window.Persona is undefined'));
      });
      existing.addEventListener('error', () => reject(new Error('Persona SDK failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = PERSONA_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.Persona) resolve(window.Persona);
      else reject(new Error('Persona SDK loaded but window.Persona is undefined'));
    };
    script.onerror = () => reject(new Error('Persona SDK failed to load'));
    document.head.appendChild(script);
  });

  return sdkPromise;
}

// ────────────────────────────────────────────────────────────────────────
// Inquiry creation + opening
// ────────────────────────────────────────────────────────────────────────

export async function createInquiry(args: {
  dealId: string;
  stakeholderId: string;
  kind?: PersonaKind;
}): Promise<CreateInquiryResult> {
  try {
    const { data, error } = await supabase.functions.invoke('persona-create-inquiry', {
      body: {
        deal_id: args.dealId,
        stakeholder_id: args.stakeholderId,
        kind: args.kind ?? 'kyc',
      },
    });
    if (error) {
      return { success: false, error: error.message };
    }
    return data as CreateInquiryResult;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Convenience: create an inquiry AND open the Persona modal. Resolves with
 * the SDK-side completion payload — but treat the webhook as source of
 * truth, not this callback (mobile network drops can swallow completion).
 */
export async function startVerification(args: {
  dealId: string;
  stakeholderId: string;
  kind?: PersonaKind;
  onComplete?: (payload: { inquiryId: string; status: string }) => void;
  onCancel?: () => void;
}): Promise<{ success: boolean; error?: string; inquiry_id?: string; reused_account?: boolean }> {
  const created = await createInquiry({
    dealId: args.dealId,
    stakeholderId: args.stakeholderId,
    kind: args.kind,
  });
  if (!created.success || !created.inquiry_id) {
    return { success: false, error: created.error || 'Could not create Persona inquiry' };
  }

  const sdk = await loadPersonaSDK().catch((e) => {
    return e as Error;
  });
  if (sdk instanceof Error) {
    return { success: false, error: sdk.message };
  }

  const client = new sdk.Client({
    inquiryId: created.inquiry_id,
    sessionToken: created.session_token ?? undefined,
    environment: (import.meta.env.VITE_PERSONA_ENV as 'sandbox' | 'production') || 'sandbox',
    onComplete: ({ inquiryId, status }) => {
      args.onComplete?.({ inquiryId, status });
    },
    onCancel: () => {
      args.onCancel?.();
    },
    onError: (err) => {
      console.error('Persona SDK error:', err);
    },
  });

  client.open();

  return {
    success: true,
    inquiry_id: created.inquiry_id,
    reused_account: created.reused_account,
  };
}

// ────────────────────────────────────────────────────────────────────────
// Reads — schema-aware (returns null when persona_* tables aren't deployed)
// ────────────────────────────────────────────────────────────────────────

function isSchemaMissing(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const code = err.code;
  if (code === 'PGRST205' || code === 'PGRST204' || code === '42P01') return true;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('relation') && msg.includes('persona_')
  );
}

/** Latest inquiry per stakeholder for a deal. Returns [] if schema missing. */
export async function listInquiriesForDeal(dealId: string): Promise<PersonaInquiryRow[] | 'schema_missing'> {
  const { data, error } = await supabase
    .from('persona_inquiries' as never)
    .select('id, deal_id, stakeholder_id, kind, persona_inquiry_id, persona_account_id, persona_template_id, reference_id, status, initiated_at, completed_at, watchlist_report_id, evidence_url')
    .eq('deal_id', dealId)
    .order('initiated_at', { ascending: false });
  if (error) {
    if (isSchemaMissing(error)) return 'schema_missing';
    console.error('listInquiriesForDeal error:', error);
    return [];
  }
  return (data as unknown as PersonaInquiryRow[]) || [];
}

/**
 * Look up prior Persona Account verification for an email across all deals
 * the user can see. Powers the "Reuse verification from [Deal X]" prompt.
 */
export async function findReusableAccount(email: string): Promise<{
  email: string;
  persona_account_id: string;
  last_verified_at: string;
  source_deal_id: string;
} | null> {
  if (!email) return null;
  const { data, error } = await supabase
    .from('cap_table_entries')
    // @ts-expect-error generated types lag the migration
    .select('email, persona_account_id, persona_last_verified_at, deal_id')
    .ilike('email', email)
    .not('persona_account_id', 'is', null)
    .order('persona_last_verified_at', { ascending: false, nullsFirst: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { email: string; persona_account_id: string; persona_last_verified_at: string; deal_id: string };
  if (!row.persona_account_id || !row.persona_last_verified_at) return null;
  return {
    email: row.email,
    persona_account_id: row.persona_account_id,
    last_verified_at: row.persona_last_verified_at,
    source_deal_id: row.deal_id,
  };
}

export async function runWatchlistReport(localInquiryId: string): Promise<{ success: boolean; error?: string; report_id?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('persona-watchlist-report', {
      body: { inquiry_id: localInquiryId },
    });
    if (error) return { success: false, error: error.message };
    return data as { success: boolean; error?: string; report_id?: string };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
