# Requirements Engine — build plan for Features 1–3

Assessment after reading the codebase, not the roadmap. Short version: **you have
substantially more of this built than the brief assumes — but it is three
half-finished silos, and the missing 40% is the same missing 40% in all three.**

Your instinct in the "How These Three Features Fit Together" section is correct
and it is worth more than it looks: unifying first is *faster* than building the
three features separately, because most of the remaining work is shared.

---

## 1. What already exists

### Feature 1 — Signature packets: ~50% built, 0% reachable

| Piece | Status |
|---|---|
| `deal_approvals` table | **Already a signature-packet table.** Carries `packet_name`, `packet_type`, `envelope_id`, `recipient_id_ds`, `delivery_method`, `sent_at`, `viewed_at`, `completed_at`, `declined_at`, `expired_at`, `signed_document_url`, `reminder_count`, `last_reminder_at`, `approver_name/email/role`, `source_document_id`, `ai_generated`, `ai_confidence` |
| DocuSign integration | **Real, not a stub.** `docusign-oauth` (3-legged OAuth + token refresh), `docusign-envelope` (creates envelopes against `/restapi/v2.1`, `signHereTabs`, status polling, void), `docusign-webhook`, `esignature-webhook` |
| `ApprovalsWorkflowCover.tsx` | Live UI: connect DocuSign, add approvers, send, track status, mark not-required |
| `extract-signature-packets` | AI extraction exists — **but has zero callers anywhere in the app** |
| Status tracking | Sent / viewed / signed / declined / expired all wired through the webhook |

**The gap is narrower than the brief implies.** What is missing is not e-signature
plumbing — it is the *matrix*: `extract-signature-packets` emits packet-level rows
(`packet_name`, `packet_type`, `approver_role`) and writes them straight into
`deal_approvals`. It does **not** extract per-signatory rows, so there is no
Document × Party × Signatory × Capacity matrix, no signature-page grouping, and
no human review step before rows land in the table.

### Feature 2 — Third-party consents: ~10% built

| Piece | Status |
|---|---|
| Clause-level extraction pattern | **Exists** — `obligations` carries `source_document_id`, `source_text_snippet`, `confidence_score`. The traceability pattern the brief wants is already proven |
| `obligation-extractor` | Real AI extraction with structured tool-calling |
| Consent detection | **Does not exist.** `obligation_type` is money-only: `PURCHASE_PRICE_BASE`, `ESCROW_HOLD_BACK`, `DEBT_PAYOFF`, `BROKER_FEE`… no consent, notice, or change-of-control concept anywhere in the codebase |
| Consent matrix / request drafting / tracking | **Nothing** |

This is the greenest field of the three — but it is also the one that most
directly reuses the extraction pattern that already works.

### Feature 3 — External collection: ~60% built, wrong shape

| Piece | Status |
|---|---|
| `verification_requests` | **Already the external-request pattern.** `token_hash`, `expires_at`, `sent_at`, `opened_at`, `submitted_at`, `recipient_email/name`, `stakeholder_id`, `status`, `revoked_at` |
| `verification_submissions` | Immutable submission record with `ip_address`, `user_agent`, `consent_accepted` |
| `VerifyPage.tsx` (504 lines) | **The no-account external UX already exists** — secure token link, multi-step form, file upload straight to Supabase Storage with the anon key, draft auto-save |
| `send-verification` | Generates raw token, stores only the hash, emails the link |
| `verify-token`, `manual-verify` | Token redemption and manual override |
| Email infrastructure | `email_send_state`, `email_send_log`, `process-email-queue`, retry/backoff, suppression list |
| **Scheduler** | **`pg_cron` is installed and running a 5-second job** driving the email queue via `net.http_post` |
| Automated reminders | **Client-side only.** `reminderStore.ts` is Zustand + `localStorage`. Reminders exist only while someone has a browser tab open — there is no server-side cadence engine |
| AI document verification | **Nothing** |
| Generic deliverables | The whole flow is hard-bound to KYC/identity. There is no concept of "any required document from any external party" |

---

## 2. The unification

Four tables already do 80% of the same job and none of them know about each other:

- `closing_checklist_items` — the closest thing to a generic requirement today.
  Already carries `entity_id`, `responsible_party_id`, `due_date`,
  `supporting_document_id`, `satisfied_at/by`, `source`, `status`,
  `waiver_justification`, `regulatory_condition_id`
- `deal_approvals` — signature requirements + external send + status tracking
- `verification_requests` — external token requests + status tracking
- `obligations` — clause-traceable extracted requirements (money only)

**Recommendation: one `deal_requirements` table**, with a `requirement_kind`
discriminator (`signature` | `consent` | `notice` | `external_document` |
`condition`), plus two satellite tables that every kind shares:

```
deal_requirements          the requirement itself: what, who, entity, owner,
                           due date, source doc + clause, confidence, status,
                           blocks_closing, human-review state

requirement_requests       one outbound ask: token, recipient, channel,
                           sent/opened/submitted, reminder cadence + count,
                           escalation state

requirement_evidence       what came back: document, AI verification verdict,
                           confidence, issues found, human override
```

That is the whole Requirements Engine. Each feature then becomes an *extractor*
plus a *view* over shared machinery, which is exactly what you asked for.

Do **not** migrate `closing_checklist_items` or `deal_approvals` into it in v1 —
write the new table alongside, have the three new features use it, and backfill
later. `deal_approvals` in particular is load-bearing for live DocuSign flows.

---

## 3. What genuinely has to be built

Ordered by dependency, not by feature number.

### Phase A — the shared spine (nothing ships without this)

1. `deal_requirements` / `requirement_requests` / `requirement_evidence` schema
   + RLS. One additive migration.
2. **Server-side reminder engine.** A `pg_cron` job over `requirement_requests`
   evaluating cadence, sending via the existing email queue, incrementing
   `reminder_count`, escalating to the internal owner, and stopping on
   satisfaction. The cron infrastructure already exists — this is a second job,
   not new infrastructure.
3. **Human-review gate**, shared by all three: nothing AI-extracted becomes
   actionable, and nothing external gets contacted, until a human approves.
   This is the guardrail all three briefs call out and it should be one
   mechanism, not three.
4. **Readiness wiring.** `getDealMetrics` now returns `blockingIssues[]` with
   `category` / `reason` / `source` / `action` / `targetSection` (shipped in
   Test 2). Outstanding requirements become blocking issues by adding one query
   and one category — this is genuinely small now.

### Phase B — Feature 3 (external documents) — *build this one first*

It is the most complete, and building it first exercises the whole spine
end-to-end with the least new AI surface.

5. Generalise `verification_requests` → `requirement_requests` for arbitrary
   deliverables (currently KYC-only).
6. Generalise `VerifyPage.tsx` into a requirement-agnostic upload page. Most of
   the work is already done — token handling, upload, draft save.
7. **AI document verification**: compare uploaded document against the
   requirement (entity name match, jurisdiction, expiry, issuer, completeness) →
   `verified` / `review_required` / `rejected`, always human-overridable.
8. External Deliverables dashboard + auto-completion side effects (attach,
   mark complete, stop reminders, update readiness, audit, notify).

### Phase C — Feature 1 (signatures)

9. Rewrite `extract-signature-packets` to emit **per-signatory rows**
   (document × party × signatory × capacity × signature page) instead of
   packet-level rows, writing to `deal_requirements` with `kind='signature'`.
10. Signature Matrix review UI — approve / edit / add / remove before anything
    is sent. This is the guardrail the brief insists on and it does not exist today.
11. Packet assembly: group signature pages by signatory, generate a per-person
    PDF. `jspdf` and `jszip` are already dependencies.
12. Bridge to the existing DocuSign path — reuse `docusign-envelope`, do not
    rebuild it.

### Phase D — Feature 2 (consents)

13. Consent/notice extractor — a new extractor on the proven
    `obligation-extractor` pattern, searching for change-of-control, assignment,
    merger, transfer, notice and termination provisions, with
    `source_text_snippet` traceability and an explicit `unclear` classification.
14. Consent Matrix review UI (same component family as the Signature Matrix).
15. Consent request drafting from deal data + human edit before send.
16. Executed-consent matching back to the requirement — reuses Phase B's
    verification.

### Phase E — Newton + role-aware views

17. Newton read tools over `deal_requirements` — "who hasn't signed?", "what's
    outstanding?", "who are we waiting on?"
18. Newton write actions behind the existing authorisation gate — "prepare
    Sarah's packet", "chase all overdue".
19. Role-aware framing of one dataset: PE → "are we ready to close?",
    buy-side → "what still needs to happen?", sell-side → "which consents and
    signatures are outstanding?"

---

## 4. Sequencing note

Phases C and D are largely parallelisable once Phase A lands, because they are
different extractors over the same spine. Phase B should go first and alone —
it proves the spine end-to-end including the external round-trip, which is the
riskiest part of all three features.

---

## 5. Decisions needed before I start

1. **Reminder sending requires an email provider decision.** The queue and cron
   exist, but `send-verification` still has an `EMAIL_MODE=MOCK` path. Automated
   external chasing means real mail to real counterparties — confirm the
   provider and the from-domain before Phase A ships.
2. ~~**`tx_*` schema on `main`.**~~ **RESOLVED — see §6. Not a blocker. Build on
   the M&A side, borrowing the `tx_*` column vocabulary.**

3. **Signature page extraction fidelity.** Grouping signature pages by signatory
   requires page-level PDF positions. Confirm whether v1 assembles real extracted
   pages or generates fresh signature pages from a template — materially
   different effort.
4. **Scope of "external stakeholder".** `counterparty_invitations` +
   `counterparty_profiles` create real accounts. Feature 3 explicitly wants *no
   account*. Confirm these stay separate paths.

---

## 6. Resolved: what `tx_*` and `re_*` actually are

Investigated 2026-08-20. **This does not block Phase A.**

### The finding

`tx_*` / `re_*` is a **second product** — real-estate closings — deliberately
sharing the PIVT M&A Supabase project.

`re_transactions` is unambiguously property: `apn` (assessor's parcel number),
`property_address_line1/city/county/state/zip`, `earnest_money`, `contract_price`,
`is_non_financed`, `is_entity_buyer`, `fincen_reportable`. That last set is the
FinCEN all-cash-entity-purchase reporting rule, not M&A.

From the kernel migration's own header:

> tables here are intentionally generic — they're prefixed `tx_*` so the same
> schema can serve PIVT M&A in a later shared-engine extraction. Property-specific
> extensions stay `re_*`.

So convergence is the stated intent — **later**, via an explicit extraction.

### Why sharing the database was deliberate

`research/real-property/BUILD_PLAN.md` on the `research/real-property-pivot`
branch, strategy update dated 2026-06-08:

> User chose to share PIVT M&A's Supabase project rather than provision a new one,
> accelerating Phase 0 by ~30 min. Real-estate tables are namespaced `re_*` and
> workspaces are tagged via a new `organizations.product_kind` column so the two
> products don't accidentally surface each other's data.

`organizations.product_kind` **exists on `main`**, so that tenancy separation is
real and implemented, not aspirational.

⚠️ **The "Locked decisions" table in that same file still says "new Supabase
project" (D2/D3).** The strategy update above it supersedes that row. Worth
correcting the table — anyone reading it cold gets the wrong answer.

### Why we cannot build on `tx_*`

Every single `tx_*` table is anchored to property:

```
tx_documents            transaction_id UUID NOT NULL REFERENCES re_transactions(id)
tx_obligations          transaction_id UUID NOT NULL REFERENCES re_transactions(id)
tx_funds_flow_lines     transaction_id UUID NOT NULL REFERENCES re_transactions(id)
tx_conditions_precedent transaction_id UUID NOT NULL REFERENCES re_transactions(id)
tx_readiness_dimensions transaction_id UUID NOT NULL REFERENCES re_transactions(id)
tx_approvals            transaction_id UUID NOT NULL REFERENCES re_transactions(id)
```

An M&A deal is a `deals` row. Storing an M&A signature requirement in
`tx_approvals` would mean fabricating an `re_transactions` row — inventing a
property address and parcel number for a corporate acquisition.

Also: **no PIVT M&A code references `tx_*` or `re_*` at all.** The only file on
`main` that mentions them is the generated `src/integrations/supabase/types.ts`.
The real-estate product code lives in a sibling repo (Phase 0 complete). In this
repo the kernel is schema-only scaffolding.

### How we move forward

**Build `deal_requirements` on the M&A side — and adopt the `tx_*` column
vocabulary wherever it fits**, so the eventual shared-engine extraction is a
mechanical merge rather than a rewrite.

`tx_conditions_precedent` is already close to a generic requirement:

| `tx_conditions_precedent` | Adopt for `deal_requirements`? |
|---|---|
| `title`, `description`, `category` | ✅ same names |
| `status` = outstanding / satisfied / waived | ✅ same verbs |
| `satisfied_at`, `satisfied_by` | ✅ same |
| `evidence_doc_id` | ✅ same concept, points at our documents |
| `source` = manual / newton / derived | ✅ same |
| `source_ref JSONB` | ✅ — this is where clause traceability lives |
| `sort_order`, `deleted_at` | ✅ same |

What we add on top, which `tx_*` has no equivalent for: `requirement_kind`
(signature / consent / notice / external_document), external-stakeholder and
request/reminder state, and the AI verification verdict. All additive — so a
future merge means `tx_*` **gains** our columns rather than us rewriting.

This is not speculative reuse. Property closings are full of exactly these three
problems: title and lien releases, estoppel certificates, payoff letters,
insurance certificates, landlord consents. The Requirements Engine is very likely
the first thing worth extracting into the shared engine.

### Operational risk worth naming

Two repos now write migrations into one Supabase project with **no shared
migration history and no coordination mechanism**. Our `20260521010000` and their
`20260622000000` happen not to collide, but nothing prevents the next pair from
doing so, and neither repo's migration folder is a true record of the database.

Cheapest mitigation: agree a prefix convention (`re_*`/`tx_*` theirs, everything
else ours) and keep one canonical migration log. Worth 10 minutes now.
