# Multi-tenancy migration — deployment

The Phase-1 multi-tenancy work is **frontend-complete** on `dev`, but it depends on a schema migration that lives in `supabase/migrations/20260519010000_multi_tenancy_phase_1.sql` and hasn't run against your live Supabase project yet. Until that migration is applied:

- **What still works**: every existing feature — sign-in, Deals list, workspace, KYC, approvals, reports, etc. The app is "single-tenant-ish" because deals don't yet belong to an org.
- **What you'll see in the topbar**: an amber `Workspace setup needed` pill where the org switcher will eventually live. The frontend detected the missing schema and gracefully fell back rather than throwing errors.

## What the migration does

1. **Extends the existing `public.organizations` table** with: `slug`, `legal_entity_name`, `billing_email`, `org_type` (`customer | demo | system`), `created_by`, `updated_at`.
2. **Adds `org_id` to `public.deals`** (nullable so old data keeps working).
3. **Adds 3 helper RLS functions**: `user_org_ids(uuid)`, `has_org_role(uuid, uuid, text)`, `demo_org_id()`.
4. **Backfills:**
   - One shared `PIVT Demo` org (`org_type='demo'`) that holds all existing demo deals.
   - One personal org per existing real user, named after their `firm_name` (or `full_name`, or email-local-part). They get `role='owner'` membership.
   - All existing real deals get assigned to their owner's personal org.
5. **Adds an org-membership-based SELECT policy on `deals`** alongside the existing per-deal-participant policies (additive — RLS is permissive, any matching policy lets you read).

The migration is **idempotent** — safe to re-run. Existing rows aren't disturbed.

## How to deploy

You have two options. Pick whichever feels safer to you.

### Option A — Paste into Supabase Studio (fastest)

1. Open <https://supabase.com/dashboard/project/hipjywloeveadfndzary/sql/new>
2. Open `supabase/migrations/20260519010000_multi_tenancy_phase_1.sql` from this repo, copy the whole file
3. Paste into the SQL editor
4. Click **Run**
5. Refresh the local app → the amber "Workspace setup needed" pill should be replaced by the actual org switcher dropdown showing your personal org as the active workspace

### Option B — Push through Lovable

If you prefer Lovable to manage the migration (and the long-term schema drift), let Lovable's deployment pipeline pick up the new migration file. After the next deploy, the schema will be live and the switcher will activate.

## After deployment — what to verify

1. **Topbar shows the org switcher** with your personal org name (e.g. "PIVT Tech" if your last firm_name was that; otherwise your email-local-part).
2. **Click the switcher** → dropdown with: Your workspaces (your personal org), Explore (PIVT Demo), and a "Create new workspace" button.
3. **Switch to PIVT Demo** → the active workspace label updates with a small "Demo" pill.
4. **Create a new workspace** ("Acme Capital" or whatever) → switcher updates, you're now owner of two orgs.

## If something goes wrong

The migration is split into clear sections (1–7). If a re-run is needed, all `ALTER ... IF NOT EXISTS` / `DROP POLICY IF EXISTS` / `CREATE OR REPLACE FUNCTION` patterns mean re-running is safe.

If you see the amber pill keep showing after deploying:
- Hard-refresh the browser (Cmd-Shift-R) to bypass any cached schema info
- Open Supabase Studio → Database → Tables and confirm `organizations` has the new columns and `deals` has `org_id`

If anything looks broken: revert is straightforward — `ALTER TABLE deals DROP COLUMN org_id` plus dropping the new policies/functions. No data is moved or destroyed by the migration; it only adds.

## What's NOT in Phase 1 (planned for Phase 2)

- `org_id` on the rest of the deal-scoped tables (`cap_table_entries`, `contract_documents`, `wire_instructions`, etc) — they'll inherit transitively through `deal_id → deals.org_id` for now
- RLS rewrite to scope everything by org membership (currently lives alongside the existing per-deal-participant policies)
- Org Settings tab (rename org, list/invite members, leave org)
- Invitation flow (signup-via-invite-link)
- Demo deals special-casing in the deal-create flow

Phase 2 is the next pull; lots of value already lands once Phase 1 is deployed.
