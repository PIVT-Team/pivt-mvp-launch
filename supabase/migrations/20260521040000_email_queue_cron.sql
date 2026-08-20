-- ═══════════════════════════════════════════════════════════════════════════
-- Wire the email queue to pg_cron.
--
-- WHY THIS EXISTS
-- The email infrastructure (pgmq queues, send log, retry/backoff, DLQ, the
-- process-email-queue edge function) was built in migration 20260319211008 —
-- but its final two steps were documented as manual tasks and never performed:
--
--     "1. VAULT SECRET ... 2. CRON JOB (pg_cron) ... applied via the
--      Supabase Management API each time the tool runs."
--
-- Consequence: nothing has ever drained the queue. `cron.job` contains exactly
-- one entry (daily-demo-reset), and an email queued on 2026-05-19 was still
-- sitting in `pending` three months later. Mail that went out did so inline via
-- send-verification, bypassing the queue entirely.
--
-- pg_cron itself is healthy — daily-demo-reset has fired at 04:00 every day
-- without a miss. It simply was never given this job.
--
-- ─────────────────────────────────────────────────────────────────────────
-- ⚠️  BEFORE RUNNING: replace PASTE_YOUR_SERVICE_ROLE_KEY_HERE on line 40
--     with your service_role key (Supabase → Settings → API → service_role).
--
--     It is written into Vault, which is encrypted at rest, and is read back
--     only inside the cron job. Do not commit the filled-in version.
-- ─────────────────────────────────────────────────────────────────────────
--
-- SAFETY: additive. Creates one Vault secret and one cron job. Re-running
-- replaces both rather than duplicating them.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Store the service_role key in Vault ────────────────────────────────
--
-- If the secret already exists (a previous setup attempt may have created it),
-- this leaves it alone and you do NOT need to supply a key — just run the file
-- as-is. The placeholder only has to be replaced when no secret is present yet.
DO $$
DECLARE
  v_key      text := 'PASTE_YOUR_SERVICE_ROLE_KEY_HERE';
  v_id       uuid;
  v_supplied boolean;
BEGIN
  v_supplied := v_key <> 'PASTE_YOUR_' || 'SERVICE_ROLE_KEY_HERE';
  SELECT id INTO v_id FROM vault.secrets WHERE name = 'email_queue_service_role_key';

  IF v_id IS NOT NULL AND NOT v_supplied THEN
    RAISE NOTICE 'Vault secret email_queue_service_role_key already exists — keeping it. No key needed.';
  ELSIF v_supplied AND v_id IS NULL THEN
    PERFORM vault.create_secret(v_key, 'email_queue_service_role_key',
                                'service_role key used by the process-email-queue cron job');
    RAISE NOTICE 'Vault secret created.';
  ELSIF v_supplied AND v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, v_key);
    RAISE NOTICE 'Vault secret updated.';
  ELSE
    RAISE EXCEPTION
      'No vault secret named email_queue_service_role_key exists, and no key was supplied. Replace PASTE_YOUR_SERVICE_ROLE_KEY_HERE with your service_role key, then re-run.';
  END IF;
END $$;


-- ── 2. The queue-drain job ────────────────────────────────────────────────
--
-- Only calls the edge function when there is actually something to send and we
-- are not inside a provider rate-limit cooldown. Without those guards this
-- fires 17,280 times a day and burns function invocations doing nothing.
CREATE OR REPLACE FUNCTION public.tick_email_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key      text;
  v_pending  bigint := 0;
  v_cooldown timestamptz;
BEGIN
  -- Respect a provider back-off window.
  SELECT retry_after_until INTO v_cooldown FROM public.email_send_state WHERE id = 1;
  IF v_cooldown IS NOT NULL AND v_cooldown > now() THEN
    RETURN;
  END IF;

  -- Anything waiting?
  BEGIN
    SELECT coalesce((SELECT count(*) FROM pgmq.q_auth_emails), 0)
         + coalesce((SELECT count(*) FROM pgmq.q_transactional_emails), 0)
    INTO v_pending;
  EXCEPTION WHEN OTHERS THEN
    v_pending := 0;
  END;

  IF v_pending = 0 THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key';

  IF v_key IS NULL THEN
    RAISE WARNING 'tick_email_queue: vault secret email_queue_service_role_key is missing; queue not drained';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := 'https://hipjywloeveadfndzary.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key),
    body    := '{}'::jsonb
  );
END;
$$;

-- ── 3. Schedule it ────────────────────────────────────────────────────────
--
-- 10s rather than the 5s in the original notes: process-email-queue handles a
-- batch per invocation, so 10s drains just as fast while halving the wake-ups.
SELECT cron.unschedule('process-email-queue')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue');

SELECT cron.schedule('process-email-queue', '10 seconds', 'SELECT public.tick_email_queue();');
