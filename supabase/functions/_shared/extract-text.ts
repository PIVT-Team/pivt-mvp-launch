/**
 * Document text extraction.
 *
 * Until now nothing in this codebase read a document. The uploader sent
 * `"[Document: foo.pdf, Type hint: SPA]"` as the "text content" and document-ai
 * classified from the filename — so `contract_documents.text_content` was ~45
 * characters on every upload, and every downstream feature (obligations,
 * discrepancy field checks, signature and consent extraction, Newton document
 * Q&A) was reasoning about a filename.
 *
 * Two strategies, in order:
 *   1. Native text layer — most PDFs produced by Word, Google Docs, DocuSign
 *      etc. carry their text in uncompressed or Flate-compressed streams. This
 *      is fast, free and deterministic, and covers the overwhelming majority of
 *      transaction documents.
 *   2. Vision fallback — when the text layer is missing or too thin (a scan),
 *      hand the page images to the multimodal model.
 *
 * Deliberately returns a QUALITY signal alongside the text. A caller must be
 * able to tell "this document has no readable text" from "this document is
 * empty", because the first needs OCR or a human and the second is a real fact
 * about the deal. Silently returning "" is what produced the current situation.
 */

import { extractOoxml, isOoxml } from "./ooxml.ts";

export type ExtractionMethod =
  | "pdf_text_layer"
  | "plain_text"
  | "vision_ocr"
  | "office_xml"
  | "none";

export interface ExtractionResult {
  text: string;
  method: ExtractionMethod;
  /** Rough confidence that the text is a faithful reading of the document. */
  quality: number;
  /** Set when extraction produced nothing usable — surfaced, never swallowed. */
  problem?: string;
  pages?: number;
}

const MIN_USEFUL_CHARS = 200;

/**
 * Cost guards for the vision fallback.
 *
 * A scan with no text layer gets base64-encoded whole and sent to a multimodal
 * model in one request. A 200-page scanned title report is an enormous call, and
 * nothing in this product has per-org budgets or rate limits yet. An
 * accidentally-uploaded 80MB scan should be refused with an explanation, not
 * silently turned into the most expensive request the system can make.
 */
const VISION_MAX_BYTES = 8 * 1024 * 1024;   // ~8MB of PDF
const VISION_MAX_PAGES = 30;

/** Printable-character ratio. Binary noise from a failed parse scores near zero. */
function printableRatio(s: string): number {
  if (!s) return 0;
  const printable = s.replace(/[^\x20-\x7E\n\r\t -ɏ]/g, "").length;
  return printable / s.length;
}

/**
 * Build a glyph-code → unicode map from the document's ToUnicode CMaps.
 *
 * Many real PDFs (LaTeX, InDesign, several e-signature tools) embed CID fonts
 * and write text as hex strings of glyph ids — `<0071004200600032>` — rather
 * than literal `(text)`. Without the CMap those bytes are meaningless, which is
 * why a perfectly good contract can extract to nothing.
 *
 * The maps from every font are merged into one. Fonts can in principle reuse
 * code points, but in practice generators assign distinct ranges, and one
 * shared map recovers the text far more often than it garbles it.
 */
function buildToUnicodeMap(streams: string[]): Map<number, string> {
  const map = new Map<number, string>();
  const hexToStr = (h: string) => {
    let out = "";
    for (let i = 0; i + 3 < h.length + 1; i += 4) {
      const code = parseInt(h.slice(i, i + 4), 16);
      if (!isNaN(code) && code !== 0) out += String.fromCharCode(code);
    }
    return out;
  };

  for (const cmap of streams) {
    if (!cmap.includes("beginbfchar") && !cmap.includes("beginbfrange")) continue;

    // <src> <dst>
    for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) || []) {
      for (const pair of block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || []) {
        const m = pair.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/)!;
        map.set(parseInt(m[1], 16), hexToStr(m[2]));
      }
    }

    // <lo> <hi> <dstStart>   — consecutive codes map to consecutive characters
    for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) || []) {
      for (const t of block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) || []) {
        const m = t.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/)!;
        const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16), dst = parseInt(m[3], 16);
        if (hi - lo > 65535) continue;
        for (let c = lo; c <= hi; c++) map.set(c, String.fromCharCode(dst + (c - lo)));
      }
    }
  }
  return map;
}

/** Decode a PDF hex string using the CMap, falling back to raw 2-byte codes. */
function decodeHexString(hex: string, cmap: Map<number, string>): string {
  const clean = hex.replace(/[^0-9A-Fa-f]/g, "");
  let out = "";
  // CID text is almost always 2 bytes per glyph.
  for (let i = 0; i + 1 < clean.length; i += 4) {
    const code = parseInt(clean.slice(i, i + 4), 16);
    if (isNaN(code)) continue;
    const mapped = cmap.get(code);
    if (mapped !== undefined) out += mapped;
    else if (code >= 32 && code <= 0x2fff) out += String.fromCharCode(code);
  }
  return out;
}

/**
 * Pull text out of a PDF's content streams.
 *
 * Handles the two forms that matter: uncompressed streams, and Flate-compressed
 * streams (which is most of them). Text lives in BT/ET blocks as Tj/TJ operands.
 * This is not a full PDF parser and does not try to be — it recovers reading
 * order well enough for a language model, which is all any caller needs.
 */
async function extractPdfTextLayer(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const raw = new TextDecoder("latin1").decode(bytes);
  const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length || 1;
  const chunks: string[] = [];

  // Pass 1: inflate every stream once. ToUnicode CMaps live in their own
  // streams, so the map has to be built before any content is decoded.
  const decoded: string[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    const body = m[1];
    if (body.charCodeAt(0) === 0x78) {
      try {
        const bin = new Uint8Array(body.length);
        for (let i = 0; i < body.length; i++) bin[i] = body.charCodeAt(i) & 0xff;
        const ds = new DecompressionStream("deflate");
        decoded.push(await new Response(new Blob([bin]).stream().pipeThrough(ds)).text());
      } catch { /* not deflate, or corrupt */ }
    } else {
      decoded.push(body);
    }
  }

  const cmap = buildToUnicodeMap(decoded);

  // Pass 2: pull text out of the content streams.
  for (const content of decoded) {
    if (!content.includes("BT") && !content.includes("Tj") && !content.includes("TJ")) continue;

    // Text-showing operators, in both string forms:
    //   literal : (text) Tj      /  [(a) -250 (b)] TJ
    //   hex     : <0041> Tj      /  [<0041> -250 <0042>] TJ   (CID fonts)
    const out: string[] = [];
    const tjRe = /(?:\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>)\s*Tj|\[((?:\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|[^\]])*)\]\s*TJ/g;
    let t: RegExpExecArray | null;
    while ((t = tjRe.exec(content)) !== null) {
      const seg = t[0];
      let piece = "";
      const tokenRe = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]*>|-?\d+(?:\.\d+)?/g;
      let tok: RegExpExecArray | null;
      while ((tok = tokenRe.exec(seg)) !== null) {
        const v = tok[0];
        // A kerning adjustment. Anything beyond roughly a quarter em is a word
        // break in practice; smaller values are letter-spacing.
        if (/^-?\d/.test(v)) {
          if (parseFloat(v) <= -120 && piece && !piece.endsWith(" ")) piece += " ";
          continue;
        }
        if (v.startsWith("<")) {
          piece += decodeHexString(v.slice(1, -1), cmap);
        } else {
          piece += v.slice(1, -1)
            .replace(/\\([nrtbf])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "", f: "" }[c as string] ?? ""))
            .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
            .replace(/\\(.)/g, "$1");
        }
      }
      if (piece.trim()) out.push(piece);
    }
    // A TD/Td/T* between blocks is a line break; approximate with newlines
    // between text-showing runs so paragraphs don't collapse into one line.
    if (out.length) chunks.push(out.join(" "));
  }

  const text = chunks
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { text, pages };
}

/** Ask the multimodal model to read the document when there is no text layer. */
async function extractViaVision(
  bytes: Uint8Array,
  mimeType: string,
  apiKey: string
): Promise<string> {
  // Chunked base64 — a spread over a large array blows the call stack.
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  const b64 = btoa(bin);

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Transcribe this document to plain text. Reproduce it faithfully and completely, " +
            "preserving headings, section numbers, signature blocks, names and titles exactly as " +
            "written. Do not summarise, interpret, or omit anything. Output only the transcription.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this document in full." },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${b64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`vision transcription returned ${res.status}`);
  const payload = await res.json();
  return payload.choices?.[0]?.message?.content ?? "";
}

/**
 * Extract text from a stored document.
 *
 * Never throws for an unreadable document — returns a result with a `problem`
 * so the caller can record it and a human can act. Throwing here would fail the
 * whole ingestion pass over one bad scan.
 */
export async function extractDocumentText(
  admin: { storage: { from: (b: string) => { download: (p: string) => Promise<{ data: Blob | null; error: unknown }> } } },
  storagePath: string,
  filename: string,
  opts: { bucket?: string; apiKey?: string | null; allowVision?: boolean } = {}
): Promise<ExtractionResult> {
  const bucket = opts.bucket ?? "deal-documents";

  const { data: blob, error } = await admin.storage.from(bucket).download(storagePath);
  if (error || !blob) {
    return { text: "", method: "none", quality: 0, problem: `Could not read the file from storage: ${String((error as { message?: string })?.message ?? "not found")}` };
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const lower = (filename || "").toLowerCase();
  const isPdf = lower.endsWith(".pdf") || bytes[0] === 0x25; // %PDF

  // Plain text formats need no parsing.
  if (!isPdf && /\.(txt|md|csv|json)$/.test(lower)) {
    const text = new TextDecoder().decode(bytes).trim();
    return text.length >= MIN_USEFUL_CHARS
      ? { text, method: "plain_text", quality: 1 }
      : { text, method: "plain_text", quality: 0.3, problem: "File contains very little text." };
  }

  // Word and Excel. Spreadsheets matter disproportionately here: cap tables,
  // funds flows and closing checklists arrive as .xlsx, and until this existed
  // they decoded to ZIP noise and were reported as an unsupported file type.
  if (isOoxml(filename, bytes)) {
    try {
      const office = await extractOoxml(bytes, filename);
      if (office.text.length >= MIN_USEFUL_CHARS) {
        return { text: office.text, method: "office_xml", quality: 1 };
      }
      return {
        text: office.text,
        method: office.text ? "office_xml" : "none",
        quality: office.text ? 0.3 : 0,
        problem: office.problem ??
          `Only ${office.text.length} characters were found in this file, which is too little to check automatically.`,
      };
    } catch (e) {
      return {
        text: "",
        method: "none",
        quality: 0,
        problem: `This Office file could not be opened (${String((e as Error)?.message ?? e)}). ` +
          `It may be corrupt, password-protected, or saved in the older .doc/.xls format — re-save it as .docx or .xlsx.`,
      };
    }
  }

  if (isPdf) {
    let layer = { text: "", pages: 1 };
    try {
      layer = await extractPdfTextLayer(bytes);
    } catch (e) {
      layer = { text: "", pages: 1 };
      console.error("PDF text-layer extraction failed:", e);
    }

    const ratio = printableRatio(layer.text);
    if (layer.text.length >= MIN_USEFUL_CHARS && ratio > 0.85) {
      return { text: layer.text, method: "pdf_text_layer", quality: Math.min(1, ratio), pages: layer.pages };
    }

    // Thin or garbled text layer — almost always a scan.
    if (opts.allowVision !== false && opts.apiKey) {
      if (bytes.length > VISION_MAX_BYTES || (layer.pages ?? 1) > VISION_MAX_PAGES) {
        return {
          text: layer.text,
          method: layer.text ? "pdf_text_layer" : "none",
          quality: 0,
          pages: layer.pages,
          problem:
            `This document has no readable text layer and is too large to transcribe automatically ` +
            `(${Math.round(bytes.length / 1024 / 1024)}MB, ~${layer.pages} pages; the limit is ` +
            `${VISION_MAX_BYTES / 1024 / 1024}MB and ${VISION_MAX_PAGES} pages). ` +
            `Split it, or supply a text-based PDF.`,
        };
      }
      try {
        const vision = await extractViaVision(bytes, "application/pdf", opts.apiKey);
        if (vision.trim().length >= MIN_USEFUL_CHARS) {
          return { text: vision.trim(), method: "vision_ocr", quality: 0.75, pages: layer.pages };
        }
      } catch (e) {
        console.error("vision transcription failed:", e);
      }
    }

    // Distinguish the two failure modes: they need different responses from a
    // human. A scan needs OCR or a replacement file; a short document may be
    // perfectly fine and simply not have enough content to check.
    const ratioNow = printableRatio(layer.text);
    const problem = layer.text.length === 0
      ? "This PDF has no readable text layer — it is most likely a scan. Its contents cannot be " +
        "checked automatically until it is OCR'd or replaced with a text PDF."
      : ratioNow <= 0.85
      ? `The text in this PDF could not be decoded reliably (${Math.round(ratioNow * 100)}% legible). ` +
        "It may use an unusual font encoding. Consider re-exporting it as a standard PDF."
      : `Only ${layer.text.length} characters of text were found, which is too little to check ` +
        "automatically. If this document should contain more, it may be partly scanned.";

    return {
      text: layer.text,
      method: layer.text ? "pdf_text_layer" : "none",
      quality: 0,
      pages: layer.pages,
      problem,
    };
  }

  // Everything else: try a best-effort decode, flag if it looks binary.
  const guess = new TextDecoder().decode(bytes);
  if (printableRatio(guess) > 0.8 && guess.trim().length >= MIN_USEFUL_CHARS) {
    return { text: guess.trim(), method: "plain_text", quality: 0.6 };
  }
  return {
    text: "",
    method: "none",
    quality: 0,
    problem: /\.(doc|xls|ppt)$/i.test(lower)
      ? `The legacy ${lower.slice(lower.lastIndexOf("."))} format cannot be read. Re-save this file as ` +
        `.docx, .xlsx or PDF and upload it again.`
      : `Unsupported file type for text extraction (${filename}). Upload a PDF, Word, Excel or plain text file.`,
  };
}

export const MIN_EXTRACTABLE_CHARS = MIN_USEFUL_CHARS;
