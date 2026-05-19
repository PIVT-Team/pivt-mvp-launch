# Email infrastructure

What gets sent, by whom, and what to check if a message doesn't arrive.

## Two production paths

PIVT sends outbound email through two providers, picked per use case:

### 1. Lovable email pipeline (`@lovable.dev/email-js`)

Handles **auth-flow emails** and any other email that's queued and retried by the platform.

| Edge function | When it runs | What it sends |
|---|---|---|
| `supabase/functions/auth-email-hook/` | Webhook from Supabase Auth | Signup confirmation, password reset, magic link, invite, email change, reauthentication |
| `supabase/functions/process-email-queue/` | Batch processor (cron-style) | Anything written to the email queue with retry + DLQ + 429/403 handling |

- **Sender domain:** `notify.pivttech.ai`
- **Templates:** React Email components in `supabase/functions/_shared/email-templates/`
- **Auth:** Webhook signature verification (LEGITIMATELY_UNAUTHENTICATED — see header comment in `auth-email-hook/index.ts`)
- **Dashboard:** Lovable project dashboard (Cloud → Emails)

### 2. Resend (direct REST API)

Handles **KYC/KYB invitation emails** to deal counterparties — a tighter, single-purpose path that doesn't need to live in the auth queue.

| Edge function | When it runs | What it sends |
|---|---|---|
| `supabase/functions/send-verification/` | Called when a deal owner clicks "Send Request" on a stakeholder | Invitation email with secure `/verify?token=…` link |

- **API:** `https://api.resend.com/emails`
- **Auth:** `RESEND_API_KEY` env var in Supabase project settings
- **Dashboard:** [resend.com](https://resend.com) → Logs

## Status (as of 2026-05-18)

| Path | Confirmed working? |
|---|---|
| Auth signup confirmation | ⚠ Needs end-to-end verification — sign up a fresh email and check inbox |
| Password reset | ⚠ Needs end-to-end verification |
| KYC invitation (`send-verification`) | ✅ Verified working this session (real invite sent + opened during the KYC wiring) |
| Queued transactional (process-email-queue) | ⚠ Used by edge functions but no end-user surface yet kicks one off |

## Recovery plan if a customer reports "I never got the email"

1. **Auth emails:** check Lovable project dashboard → Cloud → Emails for delivery status. Look for the recipient's email under recent sends.
2. **KYC invites:** check Resend dashboard → Logs for the recipient's email.
3. **Common false positives:** Gmail / Outlook spam folder. Domain reputation for `pivttech.ai` should be warm by now but check SPF/DKIM/DMARC records in your DNS if a specific corporate domain blocks.

## What's still missing for "customer-ready"

- [ ] **In-app "send test email" button** for admins to verify their setup without a real user signup. Should hit both pipelines.
- [ ] **Bounce / complaint handling** — if a KYC recipient bounces, the deal owner currently has no signal. Could wire Resend webhooks to flag the verification_request as `bounced` so the UI prompts a re-send.
- [ ] **Email preferences page** — let users opt out of non-essential notifications (when those exist).
- [ ] **DKIM/SPF/DMARC verification** for `pivttech.ai` — Resend dashboard shows status; need to confirm green.

## How to add a new email type

1. Decide pipeline: auth-adjacent → Lovable pipeline (queue or auth-email-hook). Anything else → either Resend direct or queue into Lovable.
2. For Lovable: add a React Email template in `_shared/email-templates/`, wire it in `auth-email-hook` (if auth) or write a small edge function that calls `sendLovableEmail()`.
3. For Resend: copy the `send-verification` pattern — `fetch('https://api.resend.com/emails')` with `RESEND_API_KEY`.
4. Always: log the send to `audit_log` so the Audit tab shows it happened.
