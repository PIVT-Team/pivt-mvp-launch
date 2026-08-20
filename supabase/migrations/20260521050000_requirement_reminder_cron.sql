-- ═══════════════════════════════════════════════════════════════════════════
-- Automated chasing for outstanding requirements.
--
-- Feature 3 step 5: once a request has gone out, PIVT follows up on a cadence
-- until the deliverable arrives, then escalates to the internal owner.
--
-- Reminders previously existed only in `reminderStore.ts` — Zustand backed by
-- localStorage — so they fired only while somebody had a browser tab open.
--
-- Reuses the queue this project already has: enqueue_email() -> pgmq ->
-- process-email-queue (wired to pg_cron in 20260521040000). No new sending path.
--
-- SAFETY: additive. One function, one cron job. Re-runnable.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.tick_requirement_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r          record;
  n_sent     integer := 0;
  v_subject  text;
  v_body     text;
  v_deal     text;
BEGIN
  FOR r IN SELECT * FROM public.requirement_reminders_due(50) LOOP
    SELECT deal_name INTO v_deal FROM public.deals WHERE id = r.deal_id;

    IF r.is_escalation THEN
      v_subject := 'Action needed: ' || r.requirement_title || ' — ' || coalesce(v_deal, 'transaction');
      v_body := 'This request is still outstanding'
             || CASE WHEN r.due_date IS NOT NULL
                     THEN ' and was due on ' || to_char(r.due_date, 'DD Mon YYYY') ELSE '' END
             || '. We have followed up ' || r.reminder_number - 1 || ' time(s) without a response.';
    ELSE
      v_subject := 'Reminder: ' || r.requirement_title;
      v_body := 'A gentle reminder that we are still waiting on this item'
             || CASE WHEN r.due_date IS NOT NULL
                     THEN ', due ' || to_char(r.due_date, 'DD Mon YYYY') ELSE '' END || '.';
    END IF;

    -- Queue for the recipient.
    PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
      'to',            r.recipient_email,
      'from',          'PIVT <support@pivttech.ai>',
      'subject',       v_subject,
      'template_name', 'requirement_reminder',
      'body',          v_body,
      'metadata',      jsonb_build_object(
                         'requirement_id', r.requirement_id,
                         'request_id',     r.request_id,
                         'deal_id',        r.deal_id,
                         'reminder_number', r.reminder_number,
                         'escalation',     r.is_escalation)
    ));

    -- On the final reminder, tell the internal owner too. Chasing that quietly
    -- gives up is worse than no chasing — somebody has to pick it up.
    IF r.is_escalation THEN
      DECLARE v_owner_email text;
      BEGIN
        SELECT p.email INTO v_owner_email
        FROM public.profiles p
        WHERE p.user_id = coalesce(r.escalate_to, r.internal_owner_id);

        IF v_owner_email IS NOT NULL THEN
          PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
            'to',            v_owner_email,
            'from',          'PIVT <support@pivttech.ai>',
            'subject',       'Escalation: ' || r.requirement_title || ' is overdue',
            'template_name', 'requirement_escalation',
            'body',          r.recipient_email || ' has not responded after '
                             || r.reminder_number || ' attempts. This item is blocking closing.',
            'metadata',      jsonb_build_object('requirement_id', r.requirement_id, 'deal_id', r.deal_id)
          ));
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;  -- never let owner lookup failure stop the counterparty reminder
      END;
    END IF;

    PERFORM public.requirement_reminder_sent(r.request_id);

    INSERT INTO public.audit_log (deal_id, action, details)
    VALUES (r.deal_id, 'requirement_reminder_sent', jsonb_build_object(
      'requirement_id', r.requirement_id,
      'request_id',     r.request_id,
      'recipient',      r.recipient_email,
      'reminder_number', r.reminder_number,
      'escalation',     r.is_escalation));

    n_sent := n_sent + 1;
  END LOOP;

  RETURN n_sent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tick_requirement_reminders() TO service_role;

-- Hourly. Cadence is measured in days, so a finer interval buys nothing and
-- risks double-sending around boundaries.
SELECT cron.unschedule('requirement-reminders')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'requirement-reminders');

SELECT cron.schedule('requirement-reminders', '0 * * * *',
                     'SELECT public.tick_requirement_reminders();');
