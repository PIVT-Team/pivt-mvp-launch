# PIVT — Customer-facing rebuild notes

A living record of what the customer-facing application needs to do **differently** from this demo model. Two columns for every gap:

- **Demo decision** — what we do (or don't) in the current repo. Goal: keep demos clean.
- **Customer-facing decision** — what the new production app must do when real customers are using it for real money. Goal: shippable to a paying firm.

Updated as we audit. Don't delete — append.

---

## Cross-cutting (applies everywhere in the rebuild)

| Area | Demo decision | Customer-facing decision |
|---|---|---|
| **Demo data (Project ATLAS / BEACON / CIPHER + seeded notifications, audit, team)** | Keep. Polish. It sells the product. | Gate behind a `?demo=true` flag or a dedicated `/demo` route. Never co-mingled with a real tenant's data. |
| **Multi-tenancy** | Single Supabase project shared with demo content. Single-tenant assumed in code. RLS makes everything visible to every user. | **Confirmed plan: stay on the same Supabase project for now.** Will revisit before paying customers. When the switch happens: hard tenant isolation, `organization_id` on every domain table, RLS scopes by org membership, tenant admin can revoke access. SOC2-grade. Demo content goes into a dedicated demo-tenant or behind a server-side flag. |
| **Auth** | Email + password, no verification gate. | Email verification mandatory. SSO/SAML for enterprise. MFA option. Password rotation. Session timeout. |
| **Money handling** | `deal_value` and `escrow_amount` are `NUMERIC` columns and JS `Number`s in the app. Fine for display. | Store **integer minor units** (cents) in DB. Never use JS `Number` for arithmetic on money — use `bigint` or a decimal lib. Audit any place currency conversions happen. |
| **Demo-mode toggle** | None. | Each tenant has an off-by-default "Show demo content" toggle in Settings so trainers/onboarders can flip it during user training. |
| **Audit trail** | Audit chain exists (good). | Every state-mutating action logged with actor, before, after, IP, user-agent. Tamper-evident (already there). Exportable per-deal for legal review. |
| **Newton (AI co-pilot)** | Generous limits. No metering. | Per-org rate limits. Per-org spend caps. Audit log of every LLM call (prompt, tokens, cost). PII redaction in prompts. Prompt-injection defense (output filtering on extracted-document content). |
| **Storage buckets** | 5 buckets, public:false, RLS. Good. | Lifecycle policies (auto-archive after deal `settled`). Virus scanning on upload. Server-side encryption with customer-managed key (CMK) for enterprise tier. |
| **Newton vs manual** | Newton-only empty-state CTAs (Verification, Approvals, Execution, Audit) — already aligned with the policy below. | **Confirmed plan: Newton is the primary surface, but every flow must have a manual override the customer can reach in one click.** That means: every Newton CTA in an empty state stays as primary; *additionally* there must be a secondary "Do it manually" link next to it. Customer never has to use Newton to complete a task, but Newton is presented first because it's faster. AI as primary, never AI as the only option. |
| **Error feedback** | Toasts on success/failure mostly. Some silent failures. | Every failure surfaces: toast + audit-log entry + Sentry/observability event. Partial-state operations (e.g. deal created but doc upload failed) recoverable from the workspace. |
| **Observability** | None. | Sentry for errors, PostHog/Amplitude for product analytics, custom OTel spans on every edge function call. Status page. Alerting on RLS-policy denial spikes (could indicate misconfig or attack). |

---

## Stage 1 — Sign-up → land in app

### What's audited

Auth flow, first render, demo-data leak through Risk Monitor / Home KPIs / Deals KPIs / deal-switcher dropdowns.

### Gaps found and disposition

| # | Gap | Demo decision | Customer-facing decision |
|---|---|---|---|
| S1.1 | Demo deals (ATLAS/BEACON/CIPHER) visible to every authenticated user via RLS, and their seeded approvals/discrepancies leaked into real users' KPIs and Risk Monitor. | **Fixed** — 6 components now filter `is_demo=false`. Showcase demos remain in their labeled "Demo Deals" section. | Demo deals live in a separate tenant or behind a server-side feature flag. Never co-mingled. Never visible to a paying customer unless they explicitly opt in. |
| S1.2 | `seedDemoNotifications` / `auditStore.seedDemo` / `teamStore.seedDemo` fire on every authenticated load — even for real users. | **Keep** — provides empty-state polish for demo viewing. Documented in code. | Remove. Real notifications come from real activity. Real audit log comes from real actions. Real team comes from invited members. No client-side seeding ever in production. |
| S1.3 | DealWizard's "demo" mode + `DEMO_BENEFICIARIES`/`DEMO_DOCS`/`DEMO_VALIDATION`/`DEMO_DISCREPANCIES` constants. | **Keep** — used by the marketing `/demo` page. | Remove entirely from the customer-facing app. The wizard collects real data only. |
| S1.4 | No SSO, no MFA, no password reset visible in the LoginPage. | **Keep simple**. | Auth0 / Supabase Auth with SAML for enterprise. MFA opt-in. Password reset via email. Session timeout configurable per tenant. |
| S1.5 | `.env` committed with Supabase anon key. | **Keep** — anon keys are designed to be public. | Same — anon key still goes in `.env.example`. Real secrets (service-role key, third-party API keys) go in Supabase Vault or deployment secrets, never the repo. |

---

## Stage 2 — Create first deal → activate it

### What's audited

The "+ New Deal" modal, deal-creation pipeline, the "Activate Deal" prerequisite gate, document upload (or lack thereof), Edit-vs-Create UI consistency.

### Gaps found and disposition

| # | Gap | Demo decision | Customer-facing decision |
|---|---|---|---|
| S2.1 | Modal lets you skip Buyer/Seller/Target/Deal-Type, but all four are required to activate. Permissive form + strict gate = "is this broken?" moment. | **Fix in demo too** — adds 4 `required` attributes, costs 2 min, makes the demo flow consistent. | Same fix, plus inline validation messages and a clear "you can't activate without these" copy block on the modal. |
| S2.2 | Empty-state storyboard ("Step 1: Upload SPA → Step 2: AI extracts → Step 3: Invite team") doesn't match what the "Create your first deal" button does (metadata-only modal). | **Acceptable for demo** — the modal works fine, and demo viewers tend to follow the narrator, not click around. Document as a known mismatch. | **Must fix.** Either (a) make the button open a doc-upload-first flow (DealWizard), or (b) collapse the storyboard so it accurately describes the metadata-first flow. Storyboard must match the button. |
| S2.3 | Create modal and `EditDealDrawer` are two completely separate components for the same data (different layouts, different field-history controls, zero shared code). | **Leave** — keeps the diff small for demo. | **Must fix.** Extract `<DealMetadataForm>` shared by Create + Edit. Required for any future addition (new fields, validation, doc upload section) to stay in sync. |
| S2.4 | Activate-Deal prereqs ("Payment structure initialized") use vocabulary that doesn't match the workspace tabs or the status bar ("Wire Instructions", "0/0 wires"). | **Easy demo fix** — rename to "Wire instructions added". | Same — plus run a vocabulary consistency pass across the workspace. One concept = one name. |
| S2.5 | Prereqs are static — no link to where the user goes to satisfy them. | **Easy demo fix** — make unchecked prereqs clickable to the right tab. | Same, plus track which prereq the user clicked → deal flow → first-completion event for funnel analytics. |
| S2.6 | Two different date pickers (Popover Calendar for Signing Date, native `<input type="date">` for Close Date) in the same modal. | **Easy demo fix** — unify on Popover+Calendar. | Same fix. |
| S2.7 | DealWizard (10-step) is only reachable via ⌘K. Effectively dead code unless a user knows the keyboard shortcut. | **Either link from the modal or remove**. Linking is 5 min. | Decide: keep the wizard as the "guided" path and the modal as the "quick" path, or kill the wizard. Don't ship both with one hidden. |
| S2.8 | Buyer/Seller/Target are freeform text. No counterparty entity table; no autocomplete; no duplicate detection. | **Leave** — fine for demo. | **Must add.** Counterparties table with org-scoped autocomplete. Same buyer reused across deals. Required for portfolio-level intelligence to work at all. |
| S2.9 | No file upload during deal creation. The empty-state storyboard promises it, the modal doesn't deliver. | **Keep the modal metadata-only for demo.** Acceptable since demo viewers see the storyboard, not the modal. | **Must add** OR **must remove the storyboard**. Either modal accepts docs and the storyboard is honest, or the storyboard is replaced with copy that matches what the modal does. Cannot ship both. |
| S2.10 | Deal Inputs tab previously gated behind "Newton-only" CTA; we removed that. Direct uploaders now render. | **Done.** | Revise the pattern to match the agreed Newton policy: **Newton CTA primary** ("Let Newton process this"), with a smaller secondary **"Upload manually"** link sitting underneath. Both visible at once. Customer chooses each time. |
| S2.11 | "+ New Deal" success path: deal row → participant row → deal_settings row → optional template apply. All in client-side code. | **Leave for demo.** | Move to an edge function: client posts the create request, edge function does the multi-write transactionally with proper RLS context. Today's flow has 3 separate inserts that can partially fail. |
| S2.12 | No invite-teammates field at deal creation. Users have to discover the workspace's invite flow after the fact. | **Leave** — demo viewers don't invite. | Add an optional "Invite collaborators (emails)" multi-input at the end of the create modal. Each email becomes a queued invite when the deal is created. |

---

## Stage 3 — Invite counterparties → collect their data

### What's audited

Counterparty invite drawer (`CounterpartyInviteDrawer.tsx`), the `counterparty-identity` edge function, the counterparty join page (`CounterpartyJoinPage.tsx`), the `counterparty_profiles` cross-deal reuse table, the `counterparty-kyc` storage bucket. Cross-checked email infrastructure.

### What's strong (worth keeping the design when rebuilding)

- **Cross-deal "Deal Passport"** — `counterparty_profiles` table reuses the same counterparty's identity, firm, role, and KYC status across every deal they join. Once verified, they don't redo KYC.
- **Pre-verified badge** — counterparty who has participated in 3+ prior deals shows up as "Pre-verified — no re-onboarding required". Strong signal for the inviting team.
- **Server-side bank-account encryption** — account number is stored as `account_number_encrypted`. Plaintext only in transit (HTTPS) and form state.
- **Token-scoped invite** — UUID token + 14-day expiry + email-match enforcement (invitation only usable by the exact email it was issued to). Good security baseline.
- **Email lookup before send** — drawer checks if the email is already a known counterparty and pre-fills profile + flags duplicates before the team finalizes.

### Gaps found and disposition

| # | Gap | Demo decision | Customer-facing decision |
|---|---|---|---|
| S3.1 | **No automated email sent on invite.** `createInvitation` generates a URL and returns it. Team has to copy the link and send via Slack/email/whatever. The email infrastructure (`process-email-queue` edge function, `auth-email-hook`) exists but is not wired to this flow. | **Keep for demo** — narrator can demonstrate the "copy link" flow as part of the story. | **Must fix.** Wire `createInvitation` to also enqueue a templated email via `process-email-queue`. Inviter optionally edits the message body. Standard subject/template per role-type (Counsel, Escrow Agent, etc.). Re-send & track-open events. |
| S3.2 | **Counterparty must already have a PIVT account** to use the join link. Page waits for `useAuth().user` before fetching the invitation. A first-time invitee has to sign up to PIVT before they can fill in even one field. | **Keep for demo** — demo viewer signs in once, plays both sides. | **Must change.** Magic-link / one-time-passcode flow: counterparty arrives at `/join/:token`, gets an OTP to their invited email, can complete the entire onboarding flow without a full PIVT account. Account creation (if any) is optional at the end. Removes the biggest source of invite drop-off in M&A. |
| S3.3 | **Zero UI surface lists `counterparty_invitations`.** Team creates an invite → URL is shown → drawer closes → no "Pending Invites" list anywhere in the app. The invitation row sits in the DB unobserved. The team has no way to see status, expire, revoke, or re-send. | **Acceptable for demo** — narrator skips ahead to "and now the counterparty has joined". | **Must add.** Stakeholders tab (or a new "Counterparties" tab) shows: Email, Firm, Role, Status (Pending / Accepted / Expired / Revoked), Sent At, Last Activity, Actions (Resend / Revoke / Re-issue). RLS-scoped to the deal. |
| S3.4 | **No resend / revoke / regenerate buttons.** The drawer creates an invite and closes. Same drawer reopens to make *another* invite, not to manage an existing one. | **Acceptable for demo.** | Same as S3.3 — these become buttons on the per-invite row in the new list view. |
| S3.5 | **Token expiry is hardcoded to 14 days.** | **Keep for demo.** | Tenant-configurable expiry (default 14d, allow 7-90d). Reminder emails at T-3 days and T-1 day before expiry. Auto-mark `expired` status when past `expires_at`. |
| S3.6 | **Counterparty profile fields are minimal** — display name, firm name, role type only. No address, phone, alternate contact, regulatory IDs (LEI, EIN, jurisdiction of incorporation), nothing for entity vs individual disambiguation. | **Keep for demo.** | Expand the profile to capture what M&A KYC actually needs: jurisdiction, entity type, LEI/EIN, registered address, beneficial owners (for legal entities), regulatory permissions where applicable. Pre-fill from public-registry lookups (OpenCorporates, GLEIF) where possible. |
| S3.7 | **KYC document types are unbounded.** `handleUpload(event, documentType)` accepts any string. No jurisdiction-aware required-doc matrix shown to the counterparty. | **Keep for demo.** | Driven by `required_document_matrix` (table already exists in migrations!). Counterparty sees: "For US LLC, we need: (1) Articles of Organization, (2) EIN letter, (3) Beneficial-ownership disclosure, (4) Authorized signatory ID". Each slot shows status, upload control, and an example doc. |
| S3.8 | **Pre-verified threshold is hardcoded at 3 deals.** | **Keep for demo.** | Tenant-configurable. Some firms will accept 1 prior verification, others want 5+. Also factor in time-since-last-verification (verified 4 years ago is stale). |
| S3.9 | **No partial-save / resume.** Counterparty fills 3 of 4 steps, leaves the page → returns next day → no resumption state visible. (Profile and bank instructions persist server-side, but the UI flow restart isn't friendly.) | **Acceptable for demo.** | "Welcome back, here's where you left off." Resume state stored against the invitation, banner on return shows last-completed step. Save on every field-blur, not just step-complete. |
| S3.10 | **No notification to deal team when counterparty completes onboarding.** | **Acceptable for demo.** | Team gets in-app notification + email when counterparty completes each step (profile saved, bank saved, KYC submitted, finalized). Configurable per-user. Newton can summarize: "3 counterparties completed onboarding today; 2 still pending." |
| S3.11 | **Drawer fields are uncontrolled when reopening.** `useEffect` resets all fields when `open` flips. Good for fresh invites, but if you reopen to copy the link from the previous invite, you lose state. | **Acceptable for demo.** | Once the "Pending Invites" list (S3.3) exists, this drawer becomes a strictly "create new" surface. Existing invite management moves to the list view. Problem dissolves. |
| S3.12 | **Bank account number flows plaintext through edge function.** Encryption happens server-side. HTTPS protects in transit. | **Keep for demo.** | Confirm encryption-at-rest uses CMK (customer-managed key) for enterprise tier, not just Supabase's default. Audit log every read of decrypted account number. Mask in UI by default ("••••1234") — already done on display, but ensure no debug log writes plaintext. |
| S3.13 | **No way for the counterparty to see what they previously submitted to other deals.** They have a Deal Passport but no UI to view/edit it outside of an invitation flow. | **Acceptable for demo.** | Counterparty self-service portal at `/my-profile` (post-rebuild): view their profile, see which deals they've participated in, manage saved bank instructions, view who has access to what, revoke access. This is a regulatory requirement in some jurisdictions (right-to-access / GDPR / CCPA). |

### How the rebuild's invite flow should look (end state)

The customer-facing version of this flow should be: **inviter sends → email lands → counterparty clicks → OTP → 4 short steps (Profile / Bank / KYC docs / Confirm) → progress visible to deal team → finished**.

Newton should be available on every step to: pre-fill from public records, flag suspicious entities (sanctions screen, PEP check), and resolve discrepancies between the counterparty's claimed identity and what's on the SPA. But the counterparty can always click "Skip Newton, fill manually."

## Stage 4 — Move toward closing

### What's audited

End-to-end probe of the 8 workflow steps shown in the `/demo` stepper, run against the live Supabase project on the test deal `PIVT-2026-000011`. For each step: confirmed (or failed) the DB write path, inspected the UI surface in the live workspace, called the relevant edge function where applicable.

### Workflow audit summary table

| Step | DB path | UI path on fresh deal | Edge function |
|---|---|---|---|
| 1. Create Deal | ✅ Works | ✅ Works (modal) | n/a |
| 2. Stakeholders | ✅ `cap_table_entries` insert returns 201 | ⚠️ Blocked by Newton-only empty state until `totalStakeholders > 0` | n/a |
| 3. KYC / KYB | ✅ Infra wired (`kyc-documents` bucket + `kycStore`) | ⚠️ Inside the same Stakeholders gate | n/a |
| 4. Upload Docs | ✅ Works | ✅ Works (fixed in this session — gate removed) | document-ai fires here (broken — see step 5) |
| 5. Extract | ❌ **`document-ai` returns 500 "Unknown error"** even with a real `deal_documents` row | n/a | **Broken** |
| 6. Verify | ✅ `wire_instructions` insert returns 201 | ⚠️ Blocked by gate until `totalWireInstructions > 0` | n/a |
| 7. Approve | ✅ `deal_approvals` insert returns 201 (with `approval_side='buyer'/'seller'`) | ⚠️ Blocked by gate until `totalApprovals > 0` | n/a |
| 8. Wire Pack | n/a | Reachable once wires exist | ✅ `generate-wire-pack` returns a real pack object (200). But the disbursement engine consuming it is a `MockProvider` — **no real money moves**. |

5/8 DB paths verified working. 1 broken edge function (Step 5). 1 fully-mocked disbursement provider (Step 8). 4 of 8 UI surfaces blocked from manual use by Newton-only empty-state gates.

### Gaps found and disposition

| # | Gap | Demo decision | Customer-facing decision |
|---|---|---|---|
| S4.1 | `document-ai` edge function returns `{"error":"Unknown error"}` with HTTP 500 even when called with a real `deal_documents` row and valid `extracted_text`. Reproducible. This is the post-upload classify + obligation-extract step that the storyboard ("Step 2: AI extracts deal data") promises. | **Must fix even for demo** — the demo's central narrative is "Newton extracts everything automatically"; a 500 here would derail any live demo. Restore the function, or replace with a stub that returns plausible structured output for known sample documents. | Re-implement the function from scratch with structured error propagation: `{ code, message, hint, document_id, stage }`. Surface errors in the UI with a retry path. Document the model + prompt template + fallback behavior. Consider running classification as a background job (queue → worker) rather than a blocking request, so a slow LLM doesn't pin the upload UX. |
| S4.2 | Empty-state gates in `DealWorkspaceCover.getWorkspaceEmptyState` push the user into Newton-only CTAs whenever `totalStakeholders`/`totalWireInstructions`/`totalApprovals`/`totalSettlementRecords`/`totalUploadedDocuments` are 0. There is no manual path on a fresh deal until the first row exists. | **Acceptable for demo** — narrator stays on the happy path. **Document as known UX inconsistency.** | **Must fix per the Newton-vs-manual policy** in the cross-cutting table: primary CTA stays "Let Newton process this", secondary link "Add manually" must always be visible. Apply to all 5 gates (stakeholders, verification, approvals, execution, audit). Today's Deal Inputs gate is already removed in this session — replicate that approach with the dual-CTA pattern instead of fully removing. |
| S4.3 | The Stakeholders tab routes between `DealPartiesCover` (read-only, derived from deal record) and `KycKybDealTab` (acts on `cap_table_entries`). Inserting a `cap_table_entries` row via the API does NOT change the Deal Parties content — they're different data sources. | **Acceptable for demo** — only KYC/KYB sub-tab is part of the demo story. | Rename "Deal Parties" to make its read-only / derived nature explicit (e.g. "Transaction Parties (from agreement)"). Or move it to a header summary above the editable sub-tabs. The current label suggests it's where you'd "add a party", which it isn't. |
| S4.4 | `wire_instructions` schema uses `account_number_last4` (4 digits), `account_holder`, `routing_number`, plus an encrypted full account number — good design. But there's no integration with a banking partner to actually verify the routing number is valid or the account exists. | **Leave for demo.** | Add real bank-data validation: routing-number lookup (ABA registry), bank-name auto-fill from routing number, account-validation via Plaid Verify or banking-partner API. Reject obviously bad input before it lands in the DB. |
| S4.5 | `deal_approvals.approval_side` enum (`buyer`/`seller`) supports dual-control at the schema level — but per ARCHITECTURE.md §I4, the dual-side enforcement is UI-only. Edge functions don't check. A direct API call from a single-side-approved deal can advance state. | **Acceptable for demo** — the UI presents dual-control correctly to viewers. | **Must fix at the edge-function layer.** Every state-mutating function that depends on approvals must verify (a) at least one approved row from each `approval_side`, (b) the approving user actually has the role for that side. Add a `STATE_OVERRIDE` audit-chain event type for any admin override; require two distinct admin user IDs for `forceState()`. |
| S4.6 | `generate-wire-pack` builds a real, structured pack (verified wires + obligations + readiness checks → JSON output). But the downstream `disbursement-engine` uses a `MockProvider` that returns simulated `provider_ref` strings. The "Execute" button records state but moves no money. | **Keep for demo** — the demo's story ends with "wire pack ready", not "wires sent". As long as the demo doesn't claim funds actually moved, this is fine. | **Must replace before launch.** Decision required: Modern Treasury, Stripe Connect, direct ACH integration, or partner-bank API. Whichever is chosen, must support: idempotency keys (per ARCHITECTURE.md §B6), per-payment audit-chain events, reconciliation against settled status, manual hold/release for high-risk wires, and same-day cancellation window. |
| S4.7 | The 8-step demo stepper (`/demo` route) shows a clean progression: Create → Stakeholders → KYC/KYB → Upload Docs → Extract → Verify → Approve → Wire Pack. The actual workspace shows a different 8-tab list (Overview / Stakeholders / Deal Inputs / Verification / Approvals / Execution / Audit / Comments). The demo's narrative doesn't map cleanly to the workspace structure. | **Acceptable for demo** — viewers see one or the other, never both side-by-side. | Align the two. Two reasonable directions: (a) reshape the workspace tabs to match the workflow steps (clearer mental model for new users), or (b) reshape the demo stepper to match the workspace tabs (consistency with the product they'll actually use). My recommendation: (a) — the workflow framing is more user-centric than the tab framing. |
| S4.8 | `audit_events` table is populated by some flows but not consistently. State transitions write `deal_events`, document uploads write nothing to the audit chain, approvals write to `deal_approvals` but not into the hash-chained log. Verification of the chain is on-demand only (ARCHITECTURE.md §I3). | **Acceptable for demo** — audit log isn't part of the user-facing demo. | **Must fix.** Every state-mutating action across the 8 workflow steps must emit a hash-chained `audit_events` row. Run `verify-audit-chain` automatically after every transition into `executing`/`settled`, and nightly across all active deals. Surface chain verification failures to internal admins immediately. Exportable per-deal for legal review. |
| S4.9 | The DealWizard (10-step including KYC, Documentation, Validation, Discrepancies, Approvals, Execution) is the only place in the codebase that simulates an end-to-end deal flow with stepper UI. But it's reachable only via ⌘K; Documentation step fakes upload; Validation step uses hardcoded `DEMO_VALIDATION`. | **Decision pending** — either link from the workspace, mark as the canonical guided onboarding flow, or kill it. | If kept: rebuild as the canonical first-deal onboarding (replaces `+ New Deal` modal as the default path for new users). Every step wired to real backend. Mark "I've done this before" option that swaps to a faster modal-style create. If killed: salvage the step labels and copy as a reference for designing the real flow. |

### Conclusion of the workflow audit

The demo model **demonstrates a coherent 8-step deal lifecycle** that maps to real schema, real edge functions, and (mostly) real UI components. The story holds.

But the customer-facing rebuild can't ship 4 of these 8 steps as-is:

- **Step 5 Extract is broken** — the auto-extract pipeline doesn't run.
- **Step 8 Wire Pack is mocked** — pack generation works but disbursement is a stub.
- **Steps 2/3/6/7 are reachable only via Newton** on a fresh deal — no manual path.

Fixing these four lines up cleanly with the cross-cutting policy (Newton-primary, manual-secondary, always both visible) and the recommended Phase 1/2 work in `ARCHITECTURE.md`. The schema underneath is sound; the gaps are in the orchestration and UI surface, not the data model.

---

## How to use this document

When the customer-facing rebuild starts:

1. Cross-cutting items go into the new app's foundation phase (auth, multi-tenancy, observability) before any deal-management features.
2. Stage 1–4 items map to specific user-flow tickets. Each "customer-facing decision" cell is a one-sentence acceptance criterion.
3. Anything marked **Must add** or **Must fix** is a launch blocker. Anything else is a friction reduction.
4. This document never replaces a real product spec — it's a record of *what we learned from the demo* so the rebuild starts informed instead of from scratch.
