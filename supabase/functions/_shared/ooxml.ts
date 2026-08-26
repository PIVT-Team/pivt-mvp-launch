/**
 * Word and Excel text extraction.
 *
 * Cap tables, funds flows and closing checklists arrive as .xlsx far more often
 * than as PDF, and markup drafts arrive as .docx. Before this, both fell through
 * to a raw `TextDecoder` decode of a ZIP archive, which produced binary noise,
 * failed the printable-character check, and returned "Unsupported file type" —
 * so a cap table could be uploaded, stored, and never read.
 *
 * Both formats are ZIP containers of XML (OOXML). This module reads the archive
 * directly rather than pulling in a dependency: the ZIP format needs about
 * eighty lines, and `DecompressionStream("deflate-raw")` is built into Deno.
 *
 * For spreadsheets the output is deliberately TSV with a sheet header, not a
 * prose flattening. A cap table read as "Alice 1,000,000 12.4%" on one line is
 * usable by the extractors; the same numbers run together are not.
 */

const EOCD_SIG = 0x06054b50;
const CDIR_SIG = 0x02014b50;

interface ZipEntry {
  name: string;
  method: number;
  compressedSize: number;
  offset: number;
}

function u16(b: Uint8Array, o: number) { return b[o] | (b[o + 1] << 8); }
function u32(b: Uint8Array, o: number) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }

/** Locate the End of Central Directory record, scanning back over the comment. */
function findEocd(b: Uint8Array): number {
  const min = Math.max(0, b.length - 66_000);
  for (let i = b.length - 22; i >= min; i--) {
    if (u32(b, i) === EOCD_SIG) return i;
  }
  return -1;
}

function readCentralDirectory(b: Uint8Array): ZipEntry[] {
  const eocd = findEocd(b);
  if (eocd < 0) throw new Error("not a ZIP archive (no end-of-central-directory record)");

  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  if (p === 0xffffffff) throw new Error("ZIP64 archives are not supported");

  const entries: ZipEntry[] = [];
  for (let i = 0; i < count && p + 46 <= b.length; i++) {
    if (u32(b, p) !== CDIR_SIG) break;
    const method = u16(b, p + 10);
    const compressedSize = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const offset = u32(b, p + 42);
    const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nameLen));
    entries.push({ name, method, compressedSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Read one named entry. Reads lazily rather than expanding the whole archive:
 * an .xlsx with a hundred sheets should not be fully inflated to read three.
 */
async function readEntry(b: Uint8Array, e: ZipEntry): Promise<string> {
  // The central directory records where the entry starts, but the local header
  // that precedes the data has its own (possibly different) name/extra lengths.
  const lo = e.offset;
  if (u32(b, lo) !== 0x04034b50) throw new Error(`corrupt entry: ${e.name}`);
  const start = lo + 30 + u16(b, lo + 26) + u16(b, lo + 28);
  const raw = b.subarray(start, start + e.compressedSize);
  const out = e.method === 0 ? raw : await inflateRaw(raw);
  return new TextDecoder().decode(out);
}

// ── XML helpers ──────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

function unescapeXml(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]);
}

// ── DOCX ─────────────────────────────────────────────────────────────────────

/** Remove every element that carries no visible text, keeping <w:t> contents. */
function stripRuns(fragment: string): string {
  return fragment
    .replace(/<w:tab\b[^>]*\/?>/g, "\t")
    .replace(/<w:br\b[^>]*\/?>/g, "\n")
    .replace(/<(?!\/?w:t[ >\/])[^>]*>/g, "")
    .replace(/<\/?w:t[^>]*>/g, "");
}

/**
 * Split a body into table and non-table stretches, honouring nesting.
 *
 * Word allows a table inside a table cell, so a non-greedy `<w:tbl>…</w:tbl>`
 * match ends at the wrong tag and splices the outer table's remainder into
 * running text.
 */
function splitTables(body: string): Array<{ table: boolean; xml: string }> {
  const parts: Array<{ table: boolean; xml: string }> = [];
  const tag = /<(\/?)w:tbl[ >]/g;
  let depth = 0, start = 0, blockStart = 0, m: RegExpExecArray | null;

  while ((m = tag.exec(body))) {
    if (m[1] === "") {
      if (depth === 0) {
        if (m.index > start) parts.push({ table: false, xml: body.slice(start, m.index) });
        blockStart = m.index;
      }
      depth++;
    } else if (depth > 0) {
      depth--;
      if (depth === 0) {
        const end = m.index + m[0].length + "w:tbl".length; // past </w:tbl>
        parts.push({ table: true, xml: body.slice(blockStart, end) });
        start = end;
      }
    }
  }
  if (start < body.length) parts.push({ table: false, xml: body.slice(start) });
  return parts;
}

/**
 * Word documents put their body in `word/document.xml`. Paragraph and table
 * structure is preserved because contract structure — numbered sections, a
 * table of parties and notice addresses — is what the obligation, consent and
 * signature extractors key on.
 *
 * Tables are converted cell-first. Every cell contains at least one `<w:p>`, so
 * treating paragraph ends as line breaks everywhere puts each cell on its own
 * line and destroys the row: a party and its notice email stop being related.
 */
export function docxXmlToText(xml: string): string {
  const body = xml.replace(/^[\s\S]*?<w:body[^>]*>/, "").replace(/<\/w:body>[\s\S]*$/, "");

  const chunks = splitTables(body).map(({ table, xml: frag }) => {
    if (!table) {
      return stripRuns(frag.replace(/<\/w:p>/g, "\n"));
    }
    // Inside a cell, a paragraph break is a space; the cell and row boundaries
    // are what carry the layout.
    return stripRuns(
      frag
        .replace(/<\/w:p>/g, " ")
        .replace(/<\/w:tc>/g, "\t")
        .replace(/<\/w:tr>/g, "\n")
    );
  });

  return unescapeXml(chunks.join(""))
    .replace(/[ \t]+\t/g, "\t")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── XLSX ─────────────────────────────────────────────────────────────────────

/** Built-in numeric formats that mean "this is a percentage" / "this is a date". */
const BUILTIN_PERCENT = new Set([9, 10]);
const BUILTIN_DATE = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

function parseStyles(xml: string): Map<number, "percent" | "date" | "plain"> {
  const kinds = new Map<number, "percent" | "date" | "plain">();
  if (!xml) return kinds;

  // Custom formats declare their own ids; a '%' or a 'y'/'d' in the format code
  // is what distinguishes 0.05-as-5% from 0.05-as-a-number.
  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g)) {
    custom.set(Number(m[1]), unescapeXml(m[2]));
  }

  const cellXfs = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1] ?? "";
  let i = 0;
  for (const m of cellXfs.matchAll(/<xf\b[^>]*>/g)) {
    const id = Number(m[0].match(/numFmtId="(\d+)"/)?.[1] ?? 0);
    const code = custom.get(id);
    let kind: "percent" | "date" | "plain" = "plain";
    if (BUILTIN_PERCENT.has(id) || (code && code.includes("%"))) kind = "percent";
    else if (BUILTIN_DATE.has(id) || (code && /(?:^|[^\\])(yy|dd|mmm)/.test(code))) kind = "date";
    kinds.set(i++, kind);
  }
  return kinds;
}

/** Excel serial date → ISO. Day 1 is 1900-01-01, with Excel's 1900 leap-year bug. */
function serialToIso(n: number): string {
  const days = Math.floor(n);
  const ms = Math.round((n - days) * 86400) * 1000;
  const epoch = Date.UTC(1899, 11, 30);
  const d = new Date(epoch + days * 86400000 + ms);
  const iso = d.toISOString();
  return ms === 0 ? iso.slice(0, 10) : iso.slice(0, 19).replace("T", " ");
}

function colIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export function sheetXmlToRows(
  xml: string,
  shared: string[],
  styles: Map<number, "percent" | "date" | "plain">
): string[][] {
  const rows: string[][] = [];
  for (const rowM of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cm of rowM[1].matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const inner = cm[2] ?? "";
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1];
      const type = attrs.match(/t="([^"]+)"/)?.[1] ?? "n";
      const styleIdx = Number(attrs.match(/s="(\d+)"/)?.[1] ?? -1);

      let value = "";
      if (type === "s") {
        const idx = Number(inner.match(/<v>(\d+)<\/v>/)?.[1] ?? -1);
        value = shared[idx] ?? "";
      } else if (type === "inlineStr") {
        value = unescapeXml([...inner.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""));
      } else {
        const raw = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
        value = unescapeXml(raw);
        const kind = styles.get(styleIdx);
        const num = Number(value);
        if (value !== "" && !Number.isNaN(num)) {
          // Excel stores 5% as 0.05 and a date as a day count. Emitting the raw
          // number would turn "12.4% of the equity" into "0.124", which the
          // ownership-total checks would then read as 12 basis points.
          if (kind === "percent") value = `${+(num * 100).toFixed(6)}%`;
          else if (kind === "date") value = serialToIso(num);
        }
      }

      // Keep column positions: a blank cell between two values is meaningful in
      // a cap table, where column order carries the meaning of the number.
      if (ref) {
        const at = colIndex(ref);
        while (cells.length < at) cells.push("");
        cells[at] = value;
      } else {
        cells.push(value);
      }
    }
    if (cells.some((c) => c !== "")) rows.push(cells);
  }
  return rows;
}

export interface OoxmlResult {
  text: string;
  /** Sheet names for spreadsheets, empty for documents. */
  sheets: string[];
  problem?: string;
}

export async function extractOoxml(bytes: Uint8Array, filename: string): Promise<OoxmlResult> {
  const entries = readCentralDirectory(bytes);
  const byName = new Map(entries.map((e) => [e.name, e]));
  const get = async (name: string) => {
    const e = byName.get(name);
    return e ? await readEntry(bytes, e) : "";
  };

  const lower = filename.toLowerCase();

  if (lower.endsWith(".docx") || byName.has("word/document.xml")) {
    const xml = await get("word/document.xml");
    if (!xml) return { text: "", sheets: [], problem: "This .docx has no readable document body." };
    return { text: docxXmlToText(xml), sheets: [] };
  }

  if (lower.endsWith(".xlsx") || lower.endsWith(".xlsm") || byName.has("xl/workbook.xml")) {
    const workbook = await get("xl/workbook.xml");
    const styles = parseStyles(await get("xl/styles.xml"));

    const sharedXml = await get("xl/sharedStrings.xml");
    const shared = [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) =>
      unescapeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join(""))
    );

    // Sheet order in workbook.xml is the order a human sees in Excel; the
    // sheetN.xml filenames are not guaranteed to match it.
    const rels = await get("xl/_rels/workbook.xml.rels");
    const relTarget = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
      relTarget.set(m[1], m[2].replace(/^\/?xl\//, "").replace(/^\.\//, ""));
    }

    const declared = [...workbook.matchAll(/<sheet\b[^>]*\/?>/g)].map((m) => ({
      name: unescapeXml(m[0].match(/name="([^"]*)"/)?.[1] ?? "Sheet"),
      rid: m[0].match(/r:id="([^"]+)"/)?.[1] ?? "",
    }));

    const parts: string[] = [];
    const sheets: string[] = [];
    let n = 0;
    for (const s of declared) {
      const target = relTarget.get(s.rid) ?? `worksheets/sheet${++n}.xml`;
      const xml = await get(`xl/${target}`);
      if (!xml) continue;
      const rows = sheetXmlToRows(xml, shared, styles);
      if (rows.length === 0) continue;
      sheets.push(s.name);
      parts.push(`## Sheet: ${s.name}\n` + rows.map((r) => r.join("\t").replace(/\t+$/, "")).join("\n"));
    }

    if (parts.length === 0) {
      return { text: "", sheets: [], problem: "This spreadsheet contains no cell data." };
    }
    return { text: parts.join("\n\n"), sheets };
  }

  return { text: "", sheets: [], problem: `Unsupported Office format (${filename}).` };
}

/** True for the container formats this module can read. */
export function isOoxml(filename: string, bytes: Uint8Array): boolean {
  // "PK\x03\x04" — every OOXML file is a ZIP.
  const zip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  return zip && /\.(docx|xlsx|xlsm)$/i.test(filename || "");
}
