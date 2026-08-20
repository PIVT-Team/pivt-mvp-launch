/**
 * Funds-flow version diff.
 *
 * Before this existed, uploading a new funds flow ran a "supersede" step that
 * deleted rows whose `source_document_id` matched *the document being uploaded*
 * — which, for a new version, matched nothing. The prior version's wires stayed
 * and the new version's were inserted alongside them, silently doubling every
 * payment on the deal (gap G2).
 *
 * This module answers "what actually changed between the payment set on file
 * and the one in the new document", so the caller can apply a diff instead of a
 * blind insert, and can explain each change to a human.
 *
 * Pure and side-effect free so it can be unit tested without a database.
 */
import { normalizePayee, accountFingerprint, toCents } from "./entity-match.ts";

export interface PaymentRow {
  id?: string;
  payee_entity: string;
  amount: number | string;
  currency?: string | null;
  payment_type?: string | null;
  bank_name?: string | null;
  account_holder?: string | null;
  account_number_last4?: string | null;
  routing_number?: string | null;
  swift_bic?: string | null;
  iban?: string | null;
  verification_status?: string | null;
  source_document_id?: string | null;
}

export type BankFieldChange = {
  field: string;
  from: string | null;
  to: string | null;
};

export interface PaymentDiff {
  added: PaymentRow[];
  removed: PaymentRow[];
  amountChanged: Array<{
    existing: PaymentRow;
    incoming: PaymentRow;
    fromCents: number;
    toCents: number;
  }>;
  bankChanged: Array<{
    existing: PaymentRow;
    incoming: PaymentRow;
    changes: BankFieldChange[];
    wasVerified: boolean;
  }>;
  unchanged: PaymentRow[];
  /** Payees appearing more than once in the INCOMING set (same payee + amount). */
  duplicatesInIncoming: Array<{ payee: string; amountCents: number; rows: PaymentRow[] }>;
}

const BANK_FIELDS = [
  "bank_name",
  "account_holder",
  "account_number_last4",
  "routing_number",
  "swift_bic",
  "iban",
] as const;

const VERIFIED = new Set(["verified", "confirmed", "approved"]);

/**
 * Match key. Payee identity first (normalised, so "Apex Advisory, LLC" and
 * "Apex Advisory LLC" are one party), then account fingerprint to keep genuinely
 * separate payments to the same party apart — an escrow funding and a purchase
 * price payment to the same bank are distinct rows only if their accounts or
 * payment types differ.
 */
function matchKey(p: PaymentRow): string {
  return `${normalizePayee(p.payee_entity)}::${(p.payment_type || "").toLowerCase().trim()}`;
}

export function diffPaymentSet(existing: PaymentRow[], incoming: PaymentRow[]): PaymentDiff {
  const diff: PaymentDiff = {
    added: [], removed: [], amountChanged: [], bankChanged: [],
    unchanged: [], duplicatesInIncoming: [],
  };

  // Duplicates inside the incoming document itself — the same payee billed twice.
  const incomingByPayeeAmount = new Map<string, PaymentRow[]>();
  for (const p of incoming) {
    const k = `${normalizePayee(p.payee_entity)}|${toCents(p.amount)}`;
    if (!incomingByPayeeAmount.has(k)) incomingByPayeeAmount.set(k, []);
    incomingByPayeeAmount.get(k)!.push(p);
  }
  for (const [k, rows] of incomingByPayeeAmount) {
    if (rows.length > 1) {
      diff.duplicatesInIncoming.push({
        payee: rows[0].payee_entity,
        amountCents: toCents(rows[0].amount),
        rows,
      });
    }
  }

  // Index the existing set. Multiple rows can share a key (that is itself a
  // duplicate); consume them one at a time so extras fall out as "removed".
  const existingByKey = new Map<string, PaymentRow[]>();
  for (const e of existing) {
    const k = matchKey(e);
    if (!existingByKey.has(k)) existingByKey.set(k, []);
    existingByKey.get(k)!.push(e);
  }

  for (const inc of incoming) {
    const k = matchKey(inc);
    const pool = existingByKey.get(k);
    if (!pool || pool.length === 0) {
      diff.added.push(inc);
      continue;
    }

    // Prefer the existing row whose account already matches, so an amount-only
    // change isn't misreported as a bank change and vice versa.
    const incFp = accountFingerprint(inc);
    let idx = pool.findIndex((e) => accountFingerprint(e) === incFp);
    if (idx === -1) idx = 0;
    const ex = pool.splice(idx, 1)[0];

    const bankChanges: BankFieldChange[] = [];
    for (const f of BANK_FIELDS) {
      const from = (ex as any)[f] ?? null;
      const to = (inc as any)[f] ?? null;
      // A version that simply omits a bank field is not a change to blank — the
      // extractor often only restates the lines it touched.
      if (to == null || to === "") continue;
      if (String(from ?? "") !== String(to)) {
        bankChanges.push({ field: f, from: from == null ? null : String(from), to: String(to) });
      }
    }

    const fromCents = toCents(ex.amount);
    const toCentsVal = toCents(inc.amount);

    if (bankChanges.length > 0) {
      diff.bankChanged.push({
        existing: ex,
        incoming: inc,
        changes: bankChanges,
        wasVerified: VERIFIED.has(String(ex.verification_status || "").toLowerCase()),
      });
    }
    if (fromCents !== toCentsVal) {
      diff.amountChanged.push({ existing: ex, incoming: inc, fromCents, toCents: toCentsVal });
    }
    if (bankChanges.length === 0 && fromCents === toCentsVal) {
      diff.unchanged.push(ex);
    }
  }

  // Anything left unconsumed was dropped by the new version.
  for (const [, pool] of existingByKey) {
    for (const leftover of pool) diff.removed.push(leftover);
  }

  return diff;
}

/** True when the diff contains anything a human must look at before closing. */
export function isMaterial(diff: PaymentDiff): boolean {
  return (
    diff.added.length > 0 ||
    diff.removed.length > 0 ||
    diff.amountChanged.length > 0 ||
    diff.bankChanged.length > 0 ||
    diff.duplicatesInIncoming.length > 0
  );
}
