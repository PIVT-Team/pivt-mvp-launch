# Persona KYC/KYB Integration — Setup Guide

This is the dev-side runbook for connecting PIVT to Persona. The code is
shipped; only the credentials + Persona Dashboard config need to land for
the integration to come alive.

## Architecture summary

```
            ┌──────────────────────┐
            │  React workspace UI  │
            └──────────┬───────────┘
                       │ click "Verify with Persona"
                       ▼
            ┌──────────────────────┐
            │  persona-create-     │  (Supabase Edge Function)
            │  inquiry             │  • holds PERSONA_API_KEY
            └──────────┬───────────┘  • resolves template (per-org > env)
                       │              • pins reference_id = stakeholder_id
                       │              • mirrors row in persona_inquiries
                       ▼
            ┌──────────────────────┐
            │  Persona REST API    │  ← inquiry_id, session_token
            └──────────┬───────────┘
                       │
                       ▼
            ┌──────────────────────┐
            │  Persona embedded    │  (loaded from CDN in browser)
            │  modal               │
            └──────────┬───────────┘
                       │ user completes / cancels
                       │ ⚠ DO NOT trust SDK callback as truth
                       ▼
            ┌──────────────────────┐
            │  Persona webhook     │ ─► POST /persona-webhook
            └──────────────────────┘    • HMAC verify (5 min freshness)
                                        • idempotent by event.id
                                        • updates persona_inquiries
                                        • mirrors to cap_table_entries
```

## Provisioning checklist

### 1. Create a Persona sandbox account

1. Go to <https://withpersona.com> → Sign up → choose Sandbox environment.
2. In the Persona Dashboard, open **API Keys** and create a key with these
   scopes (sandbox keys are scoped narrower than production):
   - `inquiry:create` `inquiry:read`
   - `account:read`
   - `report:create` `report:read`
3. Copy the **API key** (`persona_sandbox_...`).

### 2. Create three templates in the Persona Dashboard

Open **Inquiries → Templates** and create:

| Kind | Recommended template type | Notes |
|---|---|---|
| KYC | Government ID + Selfie + Database | Individuals |
| KYB | Business Verification | Entity name + EIN + UBO collection |
| Watchlist | Watchlist + Adverse Media Report | Run against verified Accounts |

Copy each `itmpl_xxx` template ID.

### 3. Configure a webhook endpoint in Persona

Open **Webhooks → New Webhook** and:

- Endpoint URL: `https://<your-project-ref>.functions.supabase.co/persona-webhook`
- Event types to subscribe (at minimum):
  - `inquiry.created` `inquiry.pending` `inquiry.completed`
  - `inquiry.approved` `inquiry.declined` `inquiry.failed` `inquiry.expired`
  - `inquiry.needs_review`
  - `report.ready` `report.completed`
- Copy the **webhook secret** (used to verify HMAC signatures).

### 4. Set Supabase Edge Function secrets

In the Supabase Dashboard → Edge Functions → Secrets:

```
PERSONA_API_KEY=persona_sandbox_xxxxxxxxxxxx
PERSONA_WEBHOOK_SECRET=wbhsec_xxxxxxxxxxxxxxxxxxxxxx
PERSONA_DEFAULT_KYC_TEMPLATE=itmpl_xxxxxxxxxxxxxxxx
PERSONA_DEFAULT_KYB_TEMPLATE=itmpl_xxxxxxxxxxxxxxxx
PERSONA_DEFAULT_WATCHLIST_TEMPLATE=itmpl_xxxxxxxxxxxxxxxx
```

### 5. Set client-side env var

In `.env.local` (or Vite env, depending on deploy target):

```
VITE_PERSONA_ENV=sandbox
```

Production uses `VITE_PERSONA_ENV=production`. The CDN URL is the same;
the Persona client uses this to pick the correct environment per inquiry.

### 6. Deploy the database migration

Run `supabase/migrations/20260520010000_persona_kyc_integration.sql` via
your usual deploy path (Lovable Cloud SQL editor, supabase db push, etc).
This creates:

- `persona_inquiries`
- `persona_webhook_events`
- `organization_persona_templates`
- Adds `persona_account_id`, `persona_last_inquiry_id`,
  `persona_last_verified_at` columns on `cap_table_entries`.

### 7. Deploy the three edge functions

- `persona-create-inquiry`
- `persona-webhook`
- `persona-watchlist-report`

The webhook endpoint must be **publicly reachable** (no JWT) — Persona
authenticates via signature, not bearer token. The other two require a
user JWT.

## Smoke test

After provisioning:

1. Open a deal → KYC/KYB tab.
2. For an unverified stakeholder, click **Verify (Persona)**.
3. The Persona modal opens with a sandbox-mode banner.
4. Use Persona's sandbox test IDs to walk through.
5. After completion the stakeholder row flips to `submitted` → `verified`
   within a few seconds (webhook landing).
6. Verify the row in `persona_inquiries` shows `status = approved` and
   `persona_account_id` populated.

## Failure mode reference

| Symptom | Cause | Fix |
|---|---|---|
| "Persona is not configured" toast | `PERSONA_API_KEY` not set in Supabase | Set the secret + redeploy edge functions |
| "No Persona template configured for kind=kyc" | env var or org override blank | Set `PERSONA_DEFAULT_KYC_TEMPLATE` |
| Webhook returns 401 "Signature mismatch" | `PERSONA_WEBHOOK_SECRET` wrong or key was rotated | Re-copy from Persona Dashboard |
| Webhook returns 401 "Timestamp drift" | Persona retry from old queued event OR server clock skew | Check server NTP; persistent drift means key compromise — rotate |
| Inquiry stuck on `created` | Webhook endpoint unreachable or not subscribed to events | Re-check webhook URL + event subscriptions in Persona Dashboard |
| Per-org template not respected | `organization_persona_templates.is_active = false` or row missing | Re-save in Workspace Settings → Persona identity verification |

## Cross-deal reuse

When a stakeholder appears on a new deal with an email that previously
completed a Persona verification, the **Verify** button auto-detects this
via `cap_table_entries.persona_account_id` and labels itself **Reuse +
Verify**. Persona then links the new inquiry to the existing Account —
faster for the stakeholder, and Persona does not bill repeat inquiries
against the same Account.

## Data deletion (GDPR Art. 17)

When a user invokes "Delete account" (Account Settings → Delete account):

- We delete our local rows in `persona_inquiries` via cascade.
- We do NOT automatically call `DELETE /api/v1/accounts/:id` against
  Persona — that's destructive of regulatory evidence we may need.
- Manual deletion of the Persona Account requires an admin to call the
  Persona endpoint with the stored `persona_account_id`.

A "Delete this stakeholder's Persona record" admin action is a future
follow-up; see `LOVABLE_DEPLOY_QUEUE.md`.

## Production-readiness checklist

Before flipping `VITE_PERSONA_ENV=production`:

- [ ] Sign Persona MSA + DPA (controller/processor)
- [ ] Rotate to a production API key with scoped permissions
- [ ] Configure EU residency if any customers require it (Enterprise tier)
- [ ] Set up Persona Workflow to auto-trigger Watchlist Report on
      `inquiry.approved` (otherwise call `persona-watchlist-report`
      manually after each KYC).
- [ ] Test the webhook signature rotation playbook (Persona supports
      dual-key acceptance during rotation; the verifier here handles
      multiple `v1=` values per signature header).
- [ ] Configure alerting on `persona_webhook_events.processing_error`
      (any non-null row = look at it).
