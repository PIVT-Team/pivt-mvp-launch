# Placeholders, hard-coded values and temporary work

Audit of everything standing between the current state and something a paying
customer relies on. Found by scanning for markers, hard-coded identifiers,
magic numbers, demo data and silent failure paths — across the existing
codebase **and my own work from this session**, which is where several of these
come from.

Ordered by impact, not by effort.

---

## P0 — will produce wrong answers or lose money

### ~~T1. Truncation silently discards contract text~~ — **FIXED**

Both extractors now chunk with overlap via `_shared/chunk-text.ts`. Signatures
use an ends-biased strategy (opening and execution pages first, then the
middle); consents cover the document sequentially. Findings are deduped across
overlapping windows, and when a document is still too large for the chunk cap
the response carries `partially_read` and says so in `note` — a partial read no
longer looks like a complete one. `document-ai`'s storage cap went from 100k to
2MB.

Demonstrated in test: on a 146,836-character agreement the old
`slice(0, 25000)` did **not** contain the signatory's name; ends-biased chunking
finds it in the second window. Original text follows.

### T1 (original finding). Truncation silently discards contract text
`extract-consents` and `extract-signature-matrix` send only the first **25,000
characters** of a document to the model. `document-ai` stores only the first
**100,000**.

A 40-page agreement extracted to 248,584 characters in testing. Signature blocks
live at the *end* of a document. So on any document longer than roughly 8 pages,
**the extractor never sees the execution page** — and returns "no signatories
found" for a document full of them.

Nothing warns anyone. The answer is confidently empty.

**Fix:** chunk long documents and extract per chunk, or seek the signature
section explicitly. Until then, log when truncation occurs so a wrong answer is
at least traceable. *~half a day.*

### T2. The disbursement engine is a mock
`MockProvider` returns `mock-<timestamp>-<random>` as a payment reference. No
bank API, no settlement, no reconciliation. The audit log records "wire
executed".

I added a simulation notice to the execution surfaces this session, which stops
it *reading* as real, but the underlying claim is still false. Anything that
depends on a payment having happened is unfounded.

**Fix:** real provider integration, or remove execution from the product surface
until there is one. *Weeks, and a vendor decision.*

### T3. Money is computed in floating point
`disbursement-engine` uses `Math.round(share * 100) / 100` for waterfall
allocations. At 8–9 figures across 20+ stakeholders, cents drift and totals stop
reconciling. Flagged in `ARCHITECTURE.md` as B5 and still open.

My `toCents()` in `_shared/entity-match.ts` does the right thing, but only the
funds-flow diff uses it.

**Fix:** integer cents everywhere; `NUMERIC(20,0)` in Postgres. *~1 day.*

---

## P1 — visibly wrong, or wrong under load

### ~~T4. XLSX and DOCX cannot be extracted~~ — **FIXED**

`supabase/functions/_shared/ooxml.ts` reads both formats directly from the ZIP
container. Spreadsheets come out as TSV per sheet with column positions kept,
percentages rendered as percentages (Excel stores 5% as 0.05) and dates as
dates. Word tables are converted cell-first, so a party and its notice address
stay on one line. Legacy .doc/.xls now get an actionable message.

Found while testing: `document-ai` fetched and parsed the document and then sent
the caller's `"[Document: foo.pdf]"` stub to the model anyway, so classification
and field extraction were still reading a filename. It now sends the extracted
text, opening and closing sections rather than a flat head-slice.

Also found: `toCents` returned `NaN` for `"$1,234.56"` and truncated `"1.005"`
to 100 cents. A NaN cent count compares unequal to everything, so every amount
looked changed and no duplicate was detected.

### T13. `SEED_TEST_DEAL.sql` in the repo root — **FIXED**, now `scripts/seed-test-deal.sql`.

### T4 (original finding). XLSX and DOCX cannot be read
`extract-text.ts` handles PDF and plain text. A spreadsheet returns
"Unsupported file type". Cap-table ingestion — a core input — has no extraction
path, and `CapTableCover` still sends a `[XLSX: …]` stub.

**Fix:** SheetJS in the edge function for XLSX; mammoth or similar for DOCX.
*~half a day.*

### ~~T5. Vision OCR has no cost ceiling~~ — **FIXED**

Refuses above 8MB or 30 pages with an explanation naming the limits, rather than
issuing the most expensive request the system can make. Per-org budgets are
still absent (`ARCHITECTURE.md` I1) — this is a guard, not a budget.

### T5 (original finding). Vision OCR has no cost ceiling
When a PDF has no text layer, `extract-text.ts` base64-encodes the **entire
file** into a single model call. A 200-page scan is one enormous request. There
is no page cap, no size guard, no rate limit, and no per-org budget anywhere in
the product (`ARCHITECTURE.md` I1).

**Fix:** cap pages sent to vision, refuse above a size threshold, add a budget
check. *~2 hours.*

### T6. Uploaded-document tracking lives in localStorage
My fix for vanishing documents remembers "documents uploaded through this panel"
in `localStorage`. It works, but it is per-browser: a colleague opening the same
deal sees a different list, and clearing site data loses it.

**Fix:** persist the user's chosen type in a column — `document_role` is taken,
so a new `uploaded_as` — and filter on that. *~2 hours.* Honest interim, not a
resting place.

### ~~T7. Demo data still ships inside eight live components~~ — **PARTLY FIXED**

Six pure-demo covers now carry a `SampleDataNotice` saying plainly that the
content is illustrative. `DocumentsCover`'s demo-ingest action — which wrote
fabricated `extracted_text` into `deal_documents`, where the extractors would
read it as genuine contract text — is now restricted to demo deals.

Still open: wiring those six screens to real data, or removing them. The notice
makes the state legible; it does not make the screens work.

### T7 (original finding). Demo data still ships inside eight live components
`DealsCover`, `ApprovalsCover`, `CommunicationsHub`, `RiskMonitorCover`,
`PortfolioPaymentsCover`, `DocumentsCover`, `DealInputsCover`,
`AIDashboardCover` all carry `DEMO_*` / `MOCK_*` constants.

`DocumentsCover` is the sharpest: its `extracted_text` values are handwritten
strings describing a $185M deal. Anyone looking at that screen concludes
extraction works beautifully.

**Fix:** move demo data behind the existing `isDemoDeal` flag so it can never
render for a real deal. *~half a day.*

### T8. Project ref hard-coded in a migration
`20260521040000_email_queue_cron.sql` contains
`https://hipjywloeveadfndzary.supabase.co/...` — mine. It breaks silently in any
other environment, which matters the moment there is a staging project.

**Fix:** read the project URL from a Vault secret alongside the service key.
*~30 min.*

---

## P2 — worth fixing before it bites

### T9. Thresholds I chose by judgement, not measurement
All in my session's code, all unmeasured:

| Value | Where | Risk if wrong |
|---|---|---|
| `200` chars minimum | extract-text, both extractors | A short but valid consent letter is skipped |
| `0.85` printable ratio | extract-text | Legitimate text routed to expensive OCR |
| `-120` kerning = word break | extract-text | Words joined or split in dense typography |
| `0.8` confidence to auto-verify | verify-requirement-document | Wrong document auto-accepted, chasing stops |
| `0.3` / `0.25` extractor floors | signature / consent extractors | Real findings dropped before review |
| `{3,3,2}` reminder cadence | requirements migration | Too aggressive or too slow for counterparties |
| `30 days` token expiry | send-requirement-request | Link dies mid-negotiation, or lives too long |
| `20 MB` upload cap | requirement-portal | A large scanned title report is rejected |

They are defensible defaults, not tuned ones. **Fix:** make them configurable
per deal or per org, and instrument the two that matter most — the auto-verify
threshold and the 200-char floor. *~half a day.*

### T10. Signature packets are generated, not extracted
`signaturePacketService` builds a fresh signature page rather than slicing the
real page from the source PDF. Deliberate — a mis-sliced page is worse than a
clean generated one — but it means the returned packet is not the original
document, which a counsel may object to.

**Fix:** page-level extraction using the same PDF parsing now in
`extract-text.ts`. *~1 day.*

### T11. Two hard-coded emails and one domain in my migration
`support@pivttech.ai` appears twice in the reminder cron, and `pivt-team`
is hard-coded in the deploy workflow's `--scope`.

**Fix:** a settings row for the from-address; a repository variable for the
scope. *~30 min.*

### T12. Three silent catch blocks
Small but exactly the pattern that produced today's worst findings — code that
looks like it works because failure is invisible.

**Fix:** log with context; never `catch {}` without a reason comment. *~1 hour.*

### T13. `scripts/seed-test-deal.sql` ships with a placeholder
Contains `YOUR_EMAIL_HERE` and lives at the repo root. It guards against being
run unedited, but it is test scaffolding sitting beside production migrations.

**Fix:** move to a `scripts/` or `fixtures/` directory. *~10 min.*

---

## Suggested order

**This week (~2 days), biggest correctness-per-hour:**

1. **T1 truncation** — the one most likely to give a confidently wrong answer today
2. **T7 demo data** — stop a real deal ever rendering fabricated content
3. **T5 vision cost ceiling** — before a large scan lands
4. **T4 XLSX/DOCX** — unblocks cap-table ingestion
5. **T8 + T11 hard-coded values** — cheap, and blocks having a staging environment

**Next (~2 days):** T6 upload tracking, T9 thresholds with instrumentation,
T12 silent catches, T13 file move.

**Separate track, needs decisions:** T2 disbursement provider, T3 integer-cents
money, T10 real signature-page extraction.

---

## The pattern worth naming

T1, T5 and T9 are all the same failure I have been finding all session and have
now reproduced myself: **code that returns a confident answer when it should
report that it could not answer.**

Truncation returns "no signatories" instead of "I only read a third of this."
The confidence floors drop findings without saying so. The old extraction
pipeline returned a classification based on a filename.

The rule that would prevent all of them: *when a component cannot do its job
fully, it must say so in its output* — which is why `extract-text.ts` returns a
`method`, a `quality` and a `problem` rather than just a string.
