# Production setup checklist

Things to do in external dashboards (Supabase Studio, Resend, DNS, etc.) that the codebase can't flip on its own. Walk this top-to-bottom before opening to a paying customer.

## Supabase Studio → Authentication → Providers → Email

- [ ] **Turn on "Confirm email"** so new signups must click a link before they get a session. (Currently off — a test signup this session immediately landed `email_verified: true` with no email sent. Anyone can sign up with any address.)
- [ ] **Set the site URL** under URL Configuration → Site URL to your production domain (e.g. `https://app.pivttech.ai`).
- [ ] **Add redirect URLs** for `/login` and `/verify` patterns so password-reset / email-confirm links land where you expect.
- [ ] Decide on **password requirements** (minimum length, character classes). Default is 6+ which is weak; 8+ with a mix is the modern minimum.

## Supabase Studio → Authentication → Multi-Factor Authentication

- [ ] Enable **TOTP** if it isn't already (the Account tab's "Enable 2FA" button needs this on at the project level).
- [ ] Consider enabling **AAL2 enforcement** — Supabase can require fully-MFA-authenticated sessions for sensitive routes. Out of scope for v1 but worth a flag.

## Supabase Studio → Database → Functions / Auth Hooks

- [ ] **Auth Email Hook** points to `auth-email-hook` (this should already be set; verify after Lovable pushes).
- [ ] **Test hook delivery** — click "Send test email" on a hook → should arrive within 30s from `notify.pivttech.ai`.

## Supabase Studio → Settings → API → URL & Keys

- [ ] Rotate the **service role key** if it's been shared anywhere it shouldn't be (Slack screenshots, old contractor laptops). Anyone with that key has full DB access.
- [ ] Confirm the **anon/publishable key** in `.env` is the one currently active. The app uses it for the public client.

## Supabase Studio → Project settings → Configuration → Secrets (Edge Functions)

- [ ] `RESEND_API_KEY` — required by `send-verification` (KYC invites). Get from [resend.com](https://resend.com) → API Keys.
- [ ] `LOVABLE_API_KEY` — required by Newton and other AI edge functions. Set automatically by Lovable.
- [ ] Any other secrets your edge functions depend on (DocuSign client id/secret if you wire that flow).

## DNS for the email sender domain (`pivttech.ai` / `notify.pivttech.ai`)

- [ ] **SPF** record exists and includes both Resend and Lovable's sender IPs. Lovable's docs have the exact `include:` value.
- [ ] **DKIM** records published for `notify.pivttech.ai` (Lovable provides the CNAMEs; Resend dashboard shows status).
- [ ] **DMARC** record at `_dmarc.pivttech.ai` — at minimum `v=DMARC1; p=none; rua=mailto:dmarc-reports@pivttech.ai` so you can see who's failing alignment.
- [ ] **Resend dashboard** → Domains → `pivttech.ai` shows all-green.
- [ ] **Lovable dashboard** → Cloud → Emails → domain status confirms the same.

## Stripe (when ready to bill — currently not wired)

- [ ] Create products + prices for each plan tier
- [ ] Webhook endpoint that updates subscription state in DB
- [ ] Billing portal link from the Account tab
- [ ] Plan-gated features enforced server-side, not just client-side

## Backups + recovery

- [ ] Supabase **Point-in-Time Recovery** enabled (paid feature; required for any customer that cares about data durability).
- [ ] Document the **restore procedure** — when, by whom, with what RTO/RPO targets.
- [ ] Test a restore at least once into a staging project so you know it actually works.

## Observability

- [ ] Hook up a basic uptime monitor (Better Uptime / UptimeRobot / similar) hitting `/` and a known auth-requiring page.
- [ ] Pipe error logs somewhere a human reads (Sentry / Logflare / Lovable's built-in).
- [ ] Set up a Slack/email alert for: failed edge functions > N/min, Resend bounce rate spike, auth failures spike.

## Legal posture (these are wired in the app but need final review)

- [ ] **Privacy Policy** (`/privacy`) — verified by counsel for your jurisdiction.
- [ ] **Terms of Service** (`/terms`) — same.
- [ ] **Data Processing Agreement** (`/dpa`) — same; signed-counterpart workflow defined.
- [ ] **Cookie banner** in production mode actually appears on first visit (test in incognito).
- [ ] Privacy email `privacy@pivttech.ai` is monitored.

## In-app cleanup before launch

- [ ] Delete the `sai+pivt-legal-test-*@pivttech.ai` test user from Supabase Studio → Authentication → Users.
- [ ] Demo deals (`is_demo=true`) — confirm none are visible to real customers; the See Demo button is feature-flagged off for non-internal users if you want a fully-clean prod experience.
- [ ] Remove or feature-flag the **Admin** sidebar items so customers don't see them.

## Bonus: hardening you may want before scale

- [ ] **Rate limiting** on edge functions (Resend has its own; document yours).
- [ ] **Multi-tenancy** — orgs + org_members + org_id on deals (currently no org concept; first 1-2 customers can be hand-onboarded but #3+ needs this).
- [ ] **SOC 2 / ISO** posture (not the cert itself — the documented controls + practices a customer's vendor-security questionnaire will ask about).
- [ ] **Penetration test** before any customer with > $1M ARR.
