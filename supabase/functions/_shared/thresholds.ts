/**
 * Every tuning constant in the extraction and requirements pipeline, in one
 * place, with what goes wrong when it is wrong.
 *
 * These were chosen by judgement, not measurement. Scattered across six files
 * as bare literals they were invisible: nobody could see what the system's
 * assumptions were, let alone change one without a code deploy. Collecting them
 * does not make them measured — it makes them arguable, and adjustable per
 * environment while we gather evidence.
 *
 * Each reads an environment variable so a value can be moved without shipping
 * code. Set them in the Supabase dashboard under Edge Functions → Secrets.
 */

function num(name: string, fallback: number): number {
  const raw = (globalThis as { Deno?: { env: { get(k: string): string | undefined } } }).Deno?.env.get(name);
  if (raw == null || raw === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    console.warn(`${name}="${raw}" is not a number; using the default ${fallback}`);
    return fallback;
  }
  return parsed;
}

export const THRESHOLDS = {
  /**
   * Characters below which extracted text is treated as "not enough to check".
   * Too high and a short but valid consent letter is skipped; too low and a
   * cover page is analysed as if it were the agreement.
   */
  minUsefulChars: num("PIVT_MIN_USEFUL_CHARS", 200),

  /**
   * Fraction of printable characters below which a PDF's text layer is assumed
   * garbled rather than read. Too high and legitimate text is routed to the
   * expensive vision path; too low and mojibake is passed off as contract text.
   */
  minPrintableRatio: num("PIVT_MIN_PRINTABLE_RATIO", 0.85),

  /**
   * TJ kerning, in thousandths of an em, at or below which a gap is treated as
   * a word break. Too aggressive and words split mid-token; too lax and
   * "WireInstructions—ClosingSettlement" comes back as one word, which is what
   * the original extractor did.
   */
  wordBreakKerning: num("PIVT_WORD_BREAK_KERNING", -120),

  /** PDF size and page ceilings for the vision fallback — the only path here
   *  that can make an arbitrarily expensive model request. */
  visionMaxBytes: num("PIVT_VISION_MAX_BYTES", 8 * 1024 * 1024),
  visionMaxPages: num("PIVT_VISION_MAX_PAGES", 30),

  /**
   * Model confidence at or above which a submitted document is accepted without
   * a human looking at it. This is the highest-stakes number in the file: too
   * low and the wrong document is accepted and the chasing stops.
   */
  autoVerifyConfidence: num("PIVT_AUTO_VERIFY_CONFIDENCE", 0.8),

  /** Floors below which an extracted signature block or consent requirement is
   *  dropped before anyone reviews it. Too high and real findings vanish. */
  signatureConfidenceFloor: num("PIVT_SIGNATURE_CONFIDENCE_FLOOR", 0.3),
  consentConfidenceFloor: num("PIVT_CONSENT_CONFIDENCE_FLOOR", 0.25),

  /** Upload ceiling on the external requirement portal. A scanned title report
   *  can legitimately exceed this. */
  portalMaxUploadBytes: num("PIVT_PORTAL_MAX_UPLOAD_BYTES", 20 * 1024 * 1024),
} as const;

/**
 * Emit the inputs and outcome of an automatic accept/reject decision.
 *
 * The auto-verify threshold cannot be tuned without knowing the distribution of
 * confidences it is deciding on, and nothing was recording them. These lines
 * are the raw material for choosing a real number later.
 */
export function logThresholdDecision(
  gate: string,
  confidence: number,
  threshold: number,
  outcome: string,
  context: Record<string, unknown> = {}
): void {
  console.log(JSON.stringify({
    event: "threshold_decision",
    gate,
    confidence,
    threshold,
    passed: confidence >= threshold,
    outcome,
    ...context,
  }));
}
