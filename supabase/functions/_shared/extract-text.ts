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

export type ExtractionMethod = "pdf_text_layer" | "plain_text" | "vision_ocr" | "none";

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

/** Printable-character ratio. Binary noise from a failed parse scores near zero. */
function printableRatio(s: string): number {
  if (!s) return 0;
  const printable = s.replace(/[^\x20-\x7E\n\r\t -ɏ]/g, "").length;
  return printable / s.length;
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

  // Every stream ... endstream pair, decompressed where needed.
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    const body = m[1];
    let content = body;

    // Flate streams start with a zlib header (0x78). Inflate via DecompressionStream.
    if (body.charCodeAt(0) === 0x78) {
      try {
        const bin = new Uint8Array(body.length);
        for (let i = 0; i < body.length; i++) bin[i] = body.charCodeAt(i) & 0xff;
        const ds = new DecompressionStream("deflate");
        const stream = new Blob([bin]).stream().pipeThrough(ds);
        content = await new Response(stream).text();
      } catch {
        continue; // not actually deflate, or corrupt — skip this stream
      }
    }

    if (!content.includes("BT") && !content.includes("Tj") && !content.includes("TJ")) continue;

    // Tj: (literal) Tj      TJ: [(a) -250 (b)] TJ
    const out: string[] = [];
    const tjRe = /\((?:\\.|[^\\()])*\)\s*Tj|\[((?:\((?:\\.|[^\\()])*\)|[^\]])*)\]\s*TJ/g;
    let t: RegExpExecArray | null;
    while ((t = tjRe.exec(content)) !== null) {
      const seg = t[0];
      const literals = seg.match(/\((?:\\.|[^\\()])*\)/g) || [];
      const piece = literals
        .map((l) =>
          l.slice(1, -1)
            .replace(/\\([nrtbf])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "", f: "" }[c as string] ?? ""))
            .replace(/\\(\d{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
            .replace(/\\(.)/g, "$1")
        )
        .join("");
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
      try {
        const vision = await extractViaVision(bytes, "application/pdf", opts.apiKey);
        if (vision.trim().length >= MIN_USEFUL_CHARS) {
          return { text: vision.trim(), method: "vision_ocr", quality: 0.75, pages: layer.pages };
        }
      } catch (e) {
        console.error("vision transcription failed:", e);
      }
    }

    return {
      text: layer.text,
      method: layer.text ? "pdf_text_layer" : "none",
      quality: 0,
      pages: layer.pages,
      problem:
        "This PDF has no readable text layer — it is most likely a scan. " +
        "Its contents cannot be checked automatically until it is OCR'd or replaced with a text PDF.",
    };
  }

  // Word and everything else: try a best-effort decode, flag if it looks binary.
  const guess = new TextDecoder().decode(bytes);
  if (printableRatio(guess) > 0.8 && guess.trim().length >= MIN_USEFUL_CHARS) {
    return { text: guess.trim(), method: "plain_text", quality: 0.6 };
  }
  return {
    text: "",
    method: "none",
    quality: 0,
    problem: `Unsupported file type for text extraction (${filename}). Upload a PDF or plain text file.`,
  };
}

export const MIN_EXTRACTABLE_CHARS = MIN_USEFUL_CHARS;
