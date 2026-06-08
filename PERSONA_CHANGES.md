# Persona KYC/KYB Integration — Change Log

Commit: `dcec843` on branch `dev`
Date: 2026-05-20
Files changed: 11 (8 new, 3 modified) · +1,747 / −18 lines

This document is a full breakdown of every change the Persona integration introduced. Read together with `PERSONA_SETUP.md` (the operator-facing provisioning runbook).

---

## 1. Database — 1 new migration

### `supabase/migrations/20260520010000_persona_kyc_integration.sql` (NEW, 205 lines)

Creates three new tables, one new helper function, and adds three columns to an existing table. All RLS policies are gated on existing helpers (`can_access_deal`, `can_write_deal`, `user_org_ids`, `has_org_role`, `has_role`) using `DO $$` blocks so the migration is safe to run even if some helpers are missing.

#### New tables

| Table | Purpose | Key columns |
|---|---|---|
| `persona_inquiries` | Canonical row per Persona verification attempt — one in-flight + many historical per stakeholder. | `persona_inquiry_id`, `persona_account_id`, `persona_template_id`, `reference_id`, `status`, `evidence_url`, `watchlist_report_id`, `raw_payload` (jsonb) |
| `persona_webhook_events` | Idempotent event log — Persona retries up to 8×, the same `event_id` can land twice. PK is the Persona event id itself. | `event_id` (PK), `event_type`, `payload`, `signature_verified`, `processed_at`, `processing_error` |
| `organization_persona_templates` | Per-org template overrides. Default templates come from env vars; enterprise customers can swap in their own. | `org_id`, `kind` (kyc/kyb/watchlist), `persona_template_id`, `is_active`. UNIQUE(org_id, kind). |

#### Columns added to `cap_table_entries`

| Column | Why |
|---|---|
| `persona_account_id` | Cross-deal reuse — Persona's identity-of-record handle. |
| `persona_last_inquiry_id` | Most recent successful inquiry — links UI back to the inquiry record. |
| `persona_last_verified_at` | Cheap "last verified" sort key without joining `persona_inquiries`. |

#### Helper trigger function

- `touch_persona_updated_at()` — generic `updated_at` bumper attached to both new tables that have an `updated_at` column.

#### Indexes

7 indexes added across the new tables — deal_id, stakeholder_id, inquiry_id, account_id, reference_id, status (on `persona_inquiries`); inquiry_id, account_id, type (on `persona_webhook_events`); org_id (on `organization_persona_templates`); plus `idx_cap_table_persona_account` for cross-deal lookups.

---

## 2. Backend — 3 new edge functions

### `supabase/functions/persona-create-inquiry/index.ts` (NEW, 243 lines)

Server-side Persona inquiry creation. Client never holds the Persona API key, never picks the template_id. Returns a session token the client passes to the Persona embedded SDK.

Key behaviors:
- **Auth:** requires user JWT via `requireJwt` helper.
- **Template resolution:** per-org override (`organization_persona_templates`) wins over env default (`PERSONA_DEFAULT_KYC_TEMPLATE` / `PERSONA_DEFAULT_KYB_TEMPLATE` / `PERSONA_DEFAULT_WATCHLIST_TEMPLATE`).
- **`reference_id` pinning:** always `cap_table_entries.id` — stable across deals, lets Persona dedupe the Account.
- **Account reuse:** if the stakeholder row already has a `persona_account_id`, the inquiry is created with a `relationships.account` link so Persona associates it to the prior identity.
- **Local mirror:** inserts a `persona_inquiries` row immediately so the UI has a stable handle even before webhooks land.
- **Optimistic UI flip:** updates `cap_table_entries.verification_status` to `'in_progress'` so the KYC tab reflects activity instantly.
- **Audit:** writes `audit_log` row with action `persona_inquiry_created`.
- **Graceful failure modes:** typed error codes `PERSONA_NOT_CONFIGURED` (no API key), `TEMPLATE_NOT_CONFIGURED` (no template), `PERSONA_API_ERROR` (Persona rejected).

### `supabase/functions/persona-webhook/index.ts` (NEW, 283 lines)

Receives Persona webhooks (JSON:API format). The sole source of truth for inquiry status — never trust the SDK callback.

Three non-negotiables enforced:

1. **HMAC-SHA256 signature verification** — `crypto.subtle.sign` with timing-safe string compare. Supports multiple `v1=` values in the `Persona-Signature` header for key-rotation windows.
2. **Timestamp freshness ≤ 5 minutes** — blocks replay attacks. Returns 401 with explicit `Timestamp drift` reason on failure.
3. **Idempotency by `event_id`** — PK constraint on `persona_webhook_events.event_id` short-circuits duplicates. Duplicate insert returns 200 OK so Persona stops retrying.

Side-effects on signature-verified events:
- **Inquiry events** (`inquiry.*`, `verification.*`): updates `persona_inquiries.status` + mirrors `verification_status` onto `cap_table_entries` using a status mapping (approved/completed → verified, declined/failed → failed, etc.). On `verified` also persists `persona_account_id`, `persona_last_inquiry_id`, `persona_last_verified_at` on the stakeholder for cross-deal reuse.
- **Report events** (`report.*`): folds `watchlist_report_id` into the parent inquiry.
- **Audit:** writes `persona_inquiry_<status>` rows.
- **Error recovery:** processing failures persist to `persona_webhook_events.processing_error` and return 500 so Persona retries.

**LEGITIMATELY_UNAUTHENTICATED** — no JWT required. Auth is by HMAC signature only.

### `supabase/functions/persona-watchlist-report/index.ts` (NEW, 140 lines)

Kicks off a Watchlist Report (sanctions / PEP / adverse media) against a verified Persona Account.

- **Auth:** user JWT required.
- **Pre-condition:** target inquiry must have a `persona_account_id` (which means it completed). Returns a humane error if not.
- **Template resolution:** same per-org override pattern as create-inquiry.
- **Persists `watchlist_report_id` on `persona_inquiries`** so UI can show "Watchlist running…" → "✓ Clear" / "⚠ Hits found" once the result webhook lands.
- **Audit:** writes `persona_watchlist_started`.

---

## 3. Frontend — 3 new files + 2 modified

### `src/services/personaService.ts` (NEW, 254 lines)

Thin client wrapper around the three edge functions and the Persona embedded SDK.

Exports:
- `loadPersonaSDK()` — lazy CDN script-tag loader for `persona-v5.1.4.js`. Memoized; subsequent calls reuse the same `<script>` tag.
- `createInquiry({ dealId, stakeholderId, kind })` — calls `persona-create-inquiry`.
- `startVerification({ ... })` — convenience: creates the inquiry AND opens the Persona modal in one call. Resolves SDK callbacks back into `onComplete`/`onCancel` props.
- `listInquiriesForDeal(dealId)` — schema-aware read; returns `'schema_missing'` sentinel instead of throwing if `persona_inquiries` table isn't deployed.
- `findReusableAccount(email)` — cross-deal Account lookup. Queries `cap_table_entries` for any row with a matching email + non-null `persona_account_id`, sorted by most recent `persona_last_verified_at`.
- `runWatchlistReport(localInquiryId)` — calls `persona-watchlist-report`.

Defensive helpers:
- `isSchemaMissing(err)` — checks PostgREST codes `PGRST205`, `PGRST204`, `42P01` plus message heuristics.

### `src/components/persona/PersonaVerifyButton.tsx` (NEW, 145 lines)

The user-facing trigger. Two visual variants:
- `variant="default"` — full button for empty-state CTAs.
- `variant="inline"` — table-cell-sized text button with icon, used inside the KYC tab rows.

UX behaviors:
- On mount, if `stakeholderEmail` is provided, calls `findReusableAccount(email)` and re-labels itself **Reuse + Verify** when a prior verification exists on a *different* deal.
- Click → `startVerification` → loading state → Persona modal opens → onComplete fires.
- SDK callbacks drive toast messages only ("Verification submitted — Persona will finalise momentarily"). The webhook is the actual truth.
- Handles `PERSONA_NOT_CONFIGURED` error code with a workspace-admin-friendly message.

Also exports `PersonaNotConfiguredBanner` — an amber-tinted banner with the specific env vars needed in Supabase secrets.

### `src/components/persona/PersonaTemplateSettings.tsx` (NEW, 244 lines)

Per-workspace Persona template configuration panel. Rendered inside `WorkspaceSettingsPanel`.

- Reads from `organization_persona_templates`. Returns the "schema not deployed" amber notice if the table is missing.
- Renders 3 rows (KYC / KYB / Watchlist), each with:
  - Template ID text input (monospace, placeholder `itmpl_xxxxxxxxxxxxxxxx`)
  - Enabled/disabled `Switch`
  - Save button
- Toast messaging:
  - Blank + active → "Leaving template blank reverts this workspace to the platform default."
  - Save success → `{kind} updated`.
- Links out to `app.withpersona.com/dashboard/templates` so admins know where to grab IDs.
- Disabled UI when `canManage = false` (read-only for viewers).

### `src/components/pivt-complete/cover/KycKybDealTab.tsx` (MODIFIED)

Added the new Persona path to the `LiveKycKybTab` (live customer flow only — demo tab unchanged).

Three insertions:
1. `import { PersonaVerifyButton }` at the top.
2. For stakeholders in `not_sent` / `not_requested` / `pending` status → render `<PersonaVerifyButton variant="inline">` as the primary action, with the old "Send Request" button demoted to a secondary "Email Link" muted button.
3. For stakeholders in `failed` status → render `<PersonaVerifyButton>` plus the existing "Resend" button as fallback.

The KYB/KYC kind is auto-derived from `stakeholder_type === 'entity'`.

### `src/components/pivt-complete/cover/WorkspaceSettingsPanel.tsx` (MODIFIED)

Two insertions:
1. `import { PersonaTemplateSettings }`.
2. New section rendered between Members and Leave-Workspace: `{!isDemoWorkspace && <PersonaTemplateSettings orgId={activeOrg.id} canManage={isAdmin} />}` — hidden on the demo workspace (verified working in browser preview).

---

## 4. Documentation

### `PERSONA_SETUP.md` (NEW, 183 lines)

Operator-facing provisioning runbook. Covers:
- Architecture diagram (data flow from React → create-inquiry → Persona modal → webhook → mirrored status).
- 7-step provisioning checklist:
  1. Persona sandbox signup + API key with scoped permissions
  2. Three templates (KYC, KYB, Watchlist) in Persona dashboard
  3. Webhook endpoint configuration with subscribed event types
  4. Supabase Edge Function secrets (5 env vars listed verbatim)
  5. Client `.env.local` (`VITE_PERSONA_ENV`)
  6. Database migration deployment
  7. Edge function deployment
- Smoke-test procedure.
- Failure-mode reference table (7 common errors and their fixes).
- Cross-deal reuse behavior explanation.
- GDPR Art. 17 data deletion note (deliberate non-auto-deletion of Persona Accounts).
- Production-readiness checklist before flipping `VITE_PERSONA_ENV=production`.

### `LOVABLE_DEPLOY_QUEUE.md` (MODIFIED)

Added one new row tagged **`REQUIRES MIGRATION + SECRETS`** documenting the full integration so it can be pasted into Lovable cleanly when ready.

---

## 5. What's NOT changed

Deliberately untouched so this commit stays surgical:
- The existing email-link KYC flow (`counterparty_invitations`, `counterparty_identity` edge function, `counterparty_kyc_documents`) — unchanged. Both paths coexist.
- The `kycStore` Zustand store and `user_kyc` / `org_kyb` tables — unchanged. They're the user-self-attest flow, separate from per-stakeholder verification on a deal.
- The demo KYC tab path — unchanged. Customers don't see the demo path.
- `cap_table_entries.verification_status` enum values — unchanged. The webhook maps Persona statuses INTO existing values so downstream code (sidebar dots, completion %, review queue) needs no changes.

---

## 6. Deployment requirements

To activate the integration, the operator needs to:

| Action | Where | Status |
|---|---|---|
| Apply migration `20260520010000_persona_kyc_integration.sql` | Lovable Cloud SQL editor / supabase db push | **pending** |
| Deploy edge function `persona-create-inquiry` | Supabase Edge Functions | **pending** |
| Deploy edge function `persona-webhook` | Supabase Edge Functions | **pending** |
| Deploy edge function `persona-watchlist-report` | Supabase Edge Functions | **pending** |
| Sign up at withpersona.com (sandbox) | Persona dashboard | **pending** |
| Create 3 templates (KYC, KYB, Watchlist) | Persona dashboard | **pending** |
| Configure webhook endpoint | Persona dashboard | **pending** |
| Set 5 secrets in Supabase Edge Function env | Supabase dashboard | **pending** |
| Set `VITE_PERSONA_ENV=sandbox` in client env | Vite env / Lovable env | **pending** |

Full step-by-step in `PERSONA_SETUP.md`.

---

## 7. Verification status

| Check | Result |
|---|---|
| TypeScript compiles (`tsc --noEmit`) | ✅ Clean, exit 0 |
| Browser preview renders without crash | ✅ KYC tab + Settings tab both render |
| Persona section correctly hidden on demo workspace | ✅ Verified — gated by `!isDemoWorkspace` |
| No new console errors introduced | ✅ Pre-existing DialogTitle a11y warnings unchanged |
| Full end-to-end Persona flow | ⏳ Blocked on operator provisioning steps above |

---

## 8. Outstanding follow-ups (deferred — out of scope for this commit)

- **Admin-side Persona Account deletion UI** for GDPR Art. 17 requests (currently manual via Persona dashboard).
- **Persona Workflow auto-trigger for Watchlist** so reports run automatically on `inquiry.approved` instead of needing a manual call to `persona-watchlist-report`.
- **EU residency configuration** (Enterprise tier toggle, needed for any EU customer).
- **Webhook signature rotation runbook** in `PERSONA_SETUP.md` — the verifier handles multiple `v1=` values but the operational procedure isn't documented yet.
- **Alerting on `persona_webhook_events.processing_error`** — table is built, alert wiring is not.
- **Production Persona MSA + DPA signing** — gated on first paying customer.
