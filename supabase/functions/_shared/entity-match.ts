/**
 * Payee-name normalisation.
 *
 * Duplicate detection used to key on `payee_entity.toLowerCase().trim()`, which
 * treated "Apex Advisory LLC" and "Apex Advisory, LLC" as two different payees.
 * In the Project MERIDIAN stress test that let a third $1,250,000 wire to the
 * same advisor, on the same account, pass unflagged (gap G7).
 *
 * This is deliberately conservative: it strips punctuation, corporate suffixes,
 * and honorifics, but it does NOT do fuzzy/edit-distance matching. Two payees
 * only collapse when they normalise to exactly the same token stream, so it
 * cannot silently merge "Meridian Holdings" and "Meridian Holdings II".
 */

/**
 * Legal-form suffixes only.
 *
 * Deliberately does NOT include "holdings", "group", "partners", "capital",
 * "ventures", or "trust". Those read like suffixes but are load-bearing parts of
 * a name: stripping them collapses "Meridian Holdings LLC" and "Meridian Capital
 * LLC" into the same key, which would merge two unrelated payees and send money
 * to the wrong account. Under-matching costs a duplicate warning; over-matching
 * costs a misdirected wire.
 */
const CORPORATE_SUFFIXES = new Set([
  "llc", "inc", "incorporated", "corp", "corporation", "co", "company",
  "ltd", "limited", "llp", "lp", "plc", "gmbh", "ag", "ab", "as", "sa", "nv",
  "bv", "pty", "pte", "srl", "spa", "oy", "aps", "kk", "sarl", "sas", "na",
]);

const NOISE_PREFIXES = [
  "escrow agent", "escrow agent —", "escrow agent -", "lienholder", "payee",
  "attn", "attention", "c/o", "care of", "fbo", "f/b/o", "for benefit of",
];

/**
 * Reduce a payee label to a stable comparison key.
 *
 *   "Apex Advisory, LLC"          → "apex advisory"
 *   "Apex Advisory LLC"           → "apex advisory"
 *   "APEX ADVISORY L.L.C."        → "apex advisory"
 *   "Escrow Agent — First Atlantic Trust" → "first atlantic"
 *   "Meridian Holdings II LLC"    → "meridian ii"   (stays distinct)
 */
export function normalizePayee(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = String(raw).toLowerCase();

  // strip diacritics, then unify every dash variant to a plain hyphen so the
  // punctuation pass below catches em/en dashes too
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[\u2010-\u2015\u2212]/g, "-");

  // drop a leading role marker ("Escrow Agent — X", "FBO X")
  for (const prefix of NOISE_PREFIXES) {
    if (s.startsWith(prefix)) {
      s = s.slice(prefix.length);
      break;
    }
  }

  // Drop periods before anything else so dotted acronyms survive tokenisation:
  // "L.L.C." must become "llc", not the three tokens "l" "l" "c".
  s = s.replace(/\./g, "");

  // remaining punctuation → space, collapse whitespace
  s = s.replace(/[,'"`()\[\]{}\/\\|&+*#:;_-]+/g, " ").replace(/\s+/g, " ").trim();

  // drop corporate suffix tokens wherever they appear
  const tokens = s.split(" ").filter((t) => t && !CORPORATE_SUFFIXES.has(t));

  return tokens.join(" ").trim() || s;
}

/** True when two payee labels denote the same party after normalisation. */
export function samePayee(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePayee(a);
  const nb = normalizePayee(b);
  return na.length > 0 && na === nb;
}

/**
 * Bank-account fingerprint. Two wires that normalise to the same payee AND the
 * same account fingerprint are the same instruction, not two payments.
 */
export function accountFingerprint(w: {
  routing_number?: string | null;
  account_number_last4?: string | null;
  swift_bic?: string | null;
  iban?: string | null;
}): string {
  const parts = [
    (w.routing_number || "").replace(/\D/g, ""),
    (w.account_number_last4 || "").replace(/\D/g, ""),
    (w.swift_bic || "").toUpperCase().replace(/\s/g, ""),
    (w.iban || "").toUpperCase().replace(/\s/g, ""),
  ];
  return parts.join("|");
}

/** Money comparison in integer cents — never compare payment amounts as floats. */
export function toCents(amount: number | string | null | undefined): number {
  if (amount == null) return 0;
  return Math.round(Number(amount) * 100);
}
