/**
 * Chunking for document extraction.
 *
 * Both extractors used to send `text.slice(0, 25000)` to the model. A 40-page
 * agreement is roughly 250,000 characters, so anything beyond about eight pages
 * was never read — and **execution blocks are at the end of a document**. The
 * signature extractor therefore returned "no signatories found" for documents
 * full of them, with no indication that it had only seen the first tenth.
 *
 * Two shapes, because the two extractors have different needs:
 *
 *   sequential  — consents and obligations can appear anywhere, so cover the
 *                 whole document with overlapping windows.
 *   endsBiased  — signatures cluster at the end, and the front matter names the
 *                 parties. Read the head and the tail first so the useful pass
 *                 happens even if later chunks are dropped for cost.
 *
 * Windows overlap so a clause spanning a boundary is not cut in half.
 */

export interface Chunk {
  text: string;
  index: number;
  total: number;
  /** Character offset in the source, for traceability in a finding. */
  offset: number;
  label: string;
}

export interface ChunkOptions {
  /** Characters per window. Default sized for a comfortable model context. */
  size?: number;
  /** Overlap between windows, so boundary-spanning clauses survive. */
  overlap?: number;
  /** Hard ceiling on windows, to bound cost on very large documents. */
  maxChunks?: number;
}

const DEFAULT_SIZE = 24_000;
const DEFAULT_OVERLAP = 2_000;
const DEFAULT_MAX = 12;

/** Prefer breaking at a paragraph, then a sentence, rather than mid-word. */
function softBreak(text: string, target: number): number {
  if (target >= text.length) return text.length;
  const window = text.slice(Math.max(0, target - 800), target + 800);
  const para = window.lastIndexOf("\n\n");
  if (para > 0) return Math.max(0, target - 800) + para + 2;
  const sentence = window.lastIndexOf(". ");
  if (sentence > 0) return Math.max(0, target - 800) + sentence + 2;
  return target;
}

/** Cover the whole document with overlapping windows. */
export function chunkSequential(text: string, opts: ChunkOptions = {}): Chunk[] {
  const size = opts.size ?? DEFAULT_SIZE;
  const overlap = opts.overlap ?? DEFAULT_OVERLAP;
  const max = opts.maxChunks ?? DEFAULT_MAX;

  if (text.length <= size) {
    return [{ text, index: 0, total: 1, offset: 0, label: "whole document" }];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length && chunks.length < max) {
    const end = softBreak(text, Math.min(start + size, text.length));
    chunks.push({
      text: text.slice(start, end),
      index: chunks.length,
      total: 0,
      offset: start,
      label: `part ${chunks.length + 1}`,
    });
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.map((c) => ({ ...c, total: chunks.length }));
}

/**
 * Head and tail first, then the middle.
 *
 * For signatures the two highest-value regions are the opening (which names the
 * parties) and the closing (which carries the execution blocks). Reading those
 * first means the extractor produces its most important findings even if the
 * remaining windows are skipped.
 */
export function chunkEndsBiased(text: string, opts: ChunkOptions = {}): Chunk[] {
  const size = opts.size ?? DEFAULT_SIZE;
  const max = opts.maxChunks ?? DEFAULT_MAX;

  if (text.length <= size) {
    return [{ text, index: 0, total: 1, offset: 0, label: "whole document" }];
  }

  const tailStart = Math.max(0, text.length - size);
  const chunks: Chunk[] = [
    { text: text.slice(0, size), index: 0, total: 0, offset: 0, label: "opening" },
    { text: text.slice(tailStart), index: 1, total: 0, offset: tailStart, label: "execution pages" },
  ];

  // Then the middle, in order, up to the cap.
  const middle = chunkSequential(text.slice(size, tailStart), { ...opts, maxChunks: max - 2 });
  for (const m of middle) {
    if (m.text.trim().length < 500) continue;
    chunks.push({
      text: m.text,
      index: chunks.length,
      total: 0,
      offset: size + m.offset,
      label: `middle ${chunks.length - 1}`,
    });
  }

  return chunks.map((c) => ({ ...c, total: chunks.length }));
}

/** True when the cap meant part of the document was not read. */
export function wasTruncated(text: string, chunks: Chunk[]): boolean {
  const covered = chunks.reduce((n, c) => n + c.text.length, 0);
  // Overlap inflates the total, so compare against the source generously.
  return covered < text.length * 0.95;
}
