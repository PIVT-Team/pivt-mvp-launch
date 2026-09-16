-- ═══════════════════════════════════════════════════════════════════════════
-- Project ATLAS (closing test) — one deal that exhibits every kind of blocker.
--
-- WHY THIS EXISTS
-- The website brief wants a clip of Newton working through a deal, and the
-- original Test 4 wanted an end-to-end pilot with no engineering intervention.
-- Neither has ever been run, because no deal existed that had anything to
-- resolve. This seeds one with a blocker of every origin the readiness
-- computation knows — gate, discrepancy, change event, requirement, and an
-- invalidated approval — plus one unreviewed AI requirement that must NOT
-- block, to prove the review guard.
--
-- Expected on the Closing Readiness screen and from Newton ("what's blocking
-- close?"), identically, because both use computeClosingReadiness():
--   can_close = false, 6 blockers:
--     1. change event   — Wire details changed for Meridian Holdings LLC
--     2. discrepancy    — Purchase price disagrees between SPA and funds flow
--     3. requirement    — Northgate Bank consent (approved, not yet requested)
--     4. gate           — Seller-side verification incomplete
--     5. gate           — Not all wire instructions are verified
--     6. gate           — Required approvals outstanding
--   plus counts.invalidatedApprovals = 1 (also keeps can_close false).
--
-- Idempotent: re-running replaces the deal. Safe: touches only this deal id.
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  -- ⚠ Set this to the email you log into PIVT with. The deal is created
  -- under that user; a wrong address raises an error rather than seeding.
  v_email   text := 'support@pivttech.ai';
  v_user    uuid;
  v_deal    uuid := 'aaaaaaaa-2222-4222-8222-222222222222';
  v_spa     uuid := 'aaaaaaaa-2222-4222-8222-222222222201';
  v_ff      uuid := 'aaaaaaaa-2222-4222-8222-222222222202';
  v_wire_ok uuid := 'aaaaaaaa-2222-4222-8222-222222222301';
  v_wire_pd uuid := 'aaaaaaaa-2222-4222-8222-222222222302';
BEGIN
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user found with email %. Edit v_email to the address you log in with.', v_email;
  END IF;

  -- Start clean.
  DELETE FROM public.deal_change_events  WHERE deal_id = v_deal;
  DELETE FROM public.discrepancies       WHERE deal_id = v_deal;
  DELETE FROM public.deal_requirements   WHERE deal_id = v_deal;
  DELETE FROM public.deal_approvals      WHERE deal_id = v_deal;
  DELETE FROM public.wire_instructions   WHERE deal_id = v_deal;
  DELETE FROM public.cap_table_entries   WHERE deal_id = v_deal;
  DELETE FROM public.contract_documents  WHERE deal_id = v_deal;
  DELETE FROM public.deal_participants   WHERE deal_id = v_deal;
  DELETE FROM public.deals               WHERE id = v_deal;

  -- A real deal (is_demo = false) so every real path runs.
  INSERT INTO public.deals (
    id, deal_name, deal_number, deal_type, status, deal_value, currency,
    escrow_amount, buyer, seller, target_company, created_by, owner_id, is_demo
  ) VALUES (
    v_deal, 'Project ATLAS (closing test)', 'ATL-001', 'STOCK_PURCHASE',
    'in_progress', 185000000, 'USD', 18500000,
    'CleanTech Ventures, Inc.', 'Meridian Holdings LLC', 'Greenfield Solar Inc.',
    v_user, v_user, false
  );
  INSERT INTO public.deal_participants (deal_id, user_id, party_role) VALUES (v_deal, v_user, 'owner');

  -- Documents: the SPA gate passes; the two documents disagree on price.
  INSERT INTO public.contract_documents (id, deal_id, doc_type, filename, status, is_current, version, text_content)
  VALUES
   (v_spa, v_deal, 'SPA', 'Greenfield_SPA_Execution.pdf', 'PARSED', true, 1,
    'STOCK PURCHASE AGREEMENT dated 14 March 2026 among CleanTech Ventures, Inc. (Buyer), Meridian Holdings LLC (Seller) and Greenfield Solar Inc. 1.1 Purchase Price. One Hundred Eighty-Five Million Dollars ($185,000,000). 1.2 Escrow. $18,500,000. 3.6 Consents. The consent of Northgate Bank under the Credit Agreement is required prior to Closing.'),
   (v_ff,  v_deal, 'FUNDS_FLOW', 'Greenfield_Funds_Flow_v3.xlsx', 'PARSED', true, 3,
    'Sheet: Funds Flow. Purchase price 184,500,000. Escrow 18,500,000. Meridian Holdings LLC 77,700,000. Meridian Capital LLC 14,800,000.');

  -- Stakeholders: buyer verified; one seller-side party is not → gate blocker.
  INSERT INTO public.cap_table_entries (deal_id, shareholder_name, role, stakeholder_type, ownership_pct, payout_amount, verification_status, email)
  VALUES
   (v_deal, 'CleanTech Ventures, Inc.', 'Buyer',  'entity', 0,  0,        'verified', 'legal@cleantech.example'),
   (v_deal, 'Meridian Holdings LLC',   'Seller', 'entity', 42, 77700000, 'verified', 'ops@meridian.example'),
   (v_deal, 'Jane Okafor',             'Seller', 'individual', 5, 9250000, 'pending',  'jane@example.com');

  -- Wires: one verified, one pending → gate blocker; the pending one changed.
  INSERT INTO public.wire_instructions (id, deal_id, payee_entity, payer_entity, amount, currency, payment_type,
                                        bank_name, routing_number, account_number_last4, verification_status, source_document_id)
  VALUES
   (v_wire_ok, v_deal, 'Meridian Capital LLC',  'CleanTech Ventures, Inc.', 14800000, 'USD', 'purchase_price',
    'Northgate Bank', '021000021', '4417', 'verified', v_ff),
   (v_wire_pd, v_deal, 'Meridian Holdings LLC', 'CleanTech Ventures, Inc.', 77700000, 'USD', 'purchase_price',
    'Northgate Bank', '111000025', '9902', 'pending',  v_ff);

  -- Approvals: one granted, one required and pending (gate), one invalidated by
  -- the wire change (blocker even though its own status says approved).
  INSERT INTO public.deal_approvals (deal_id, user_id, approval_side, status, required, approval_type, packet_name, approver_name, invalidated_at, invalidated_reason)
  VALUES
   (v_deal, v_user, 'buyer',  'approved', true, 'funds_flow', 'Funds flow v3', 'Buyer counsel', NULL, NULL),
   (v_deal, v_user, 'seller', 'pending',  true, 'funds_flow', 'Funds flow v3', 'Seller counsel', NULL, NULL),
   (v_deal, v_user, 'seller', 'approved', true, 'wire_pack',  'Wire pack v1',  'Seller counsel',
    now() - interval '2 hours', 'Banking details for Meridian Holdings LLC changed after approval');

  -- Discrepancy: the two documents disagree on the purchase price.
  INSERT INTO public.discrepancies (deal_id, rule_key, severity, status, message, object_type, object_id, details)
  VALUES (v_deal, 'purchase_price_consistency', 'blocker', 'open',
          'Purchase price disagrees: SPA says $185,000,000, funds flow v3 says $184,500,000',
          'document', v_ff,
          jsonb_build_object(
            'why_it_matters', 'Wires would be cut for $500,000 less than the agreement requires.',
            'source', 'Greenfield_SPA_Execution.pdf §1.1 vs Greenfield_Funds_Flow_v3.xlsx',
            'recommended_action', 'Confirm the price with both counsel and re-issue the funds flow.'));

  -- Change event: banking details moved after approval.
  INSERT INTO public.deal_change_events (deal_id, change_type, severity, blocks_closing, status, title, what_changed, why_it_matters,
                                         recommended_action, source_label, object_type, object_id, source_document_id, from_version, to_version)
  VALUES (v_deal, 'wire_details_changed', 'blocker', true, 'open',
          'Wire details changed for Meridian Holdings LLC',
          'Routing number changed from 021000021 to 111000025 and account ending 4417 to 9902.',
          'A changed account on a verified wire is the signature of payment fraud; the previous verification no longer applies.',
          'Call Meridian Holdings LLC on a known number to confirm the new details, then re-verify.',
          'Funds flow v2 → v3', 'wire_instruction', v_wire_pd, v_ff, 2, 3);

  -- Requirements: one approved and blocking (not yet requested), one unreviewed
  -- AI extraction that must NOT block.
  INSERT INTO public.deal_requirements (deal_id, requirement_kind, requirement_type, title, description, status, review_status, blocks_closing,
                                        counterparty_name, counterparty_email, trigger_event, source, source_ref, due_date)
  VALUES
   (v_deal, 'consent', 'consent', 'Northgate Bank consent under the Credit Agreement',
    'Section 3.6 requires the lender''s written consent before closing.', 'not_started', 'approved', true,
    'Northgate Bank', 'consents@northgate.example', 'Change of control', 'ai',
    jsonb_build_object('filename', 'Greenfield_SPA_Execution.pdf', 'clause_ref', '§3.6',
                       'snippet', 'The consent of Northgate Bank under the Credit Agreement is required prior to Closing.'),
    current_date + 10),
   (v_deal, 'notice', 'notice', 'Landlord notice — 30 days before assignment',
    'AI found a possible notice requirement; a person has not yet confirmed it.', 'not_started', 'pending_review', true,
    'Harbor Properties LP', NULL, 'Assignment', 'ai',
    jsonb_build_object('filename', 'Lease.pdf', 'clause_ref', '§9.3'), NULL);

  RAISE NOTICE 'Seeded % — expect can_close=false with 6 blockers and 1 invalidated approval', v_deal;
END $$;

-- What the readiness view and Newton should both report.
SELECT 'discrepancies (blocker)' AS what, count(*) FROM public.discrepancies WHERE deal_id = 'aaaaaaaa-2222-4222-8222-222222222222' AND severity = 'blocker' AND status = 'open'
UNION ALL SELECT 'change events (blocking)', count(*) FROM public.deal_change_events WHERE deal_id = 'aaaaaaaa-2222-4222-8222-222222222222' AND blocks_closing AND status = 'open'
UNION ALL SELECT 'requirements (approved+blocking)', count(*) FROM public.deal_requirements WHERE deal_id = 'aaaaaaaa-2222-4222-8222-222222222222' AND review_status = 'approved' AND blocks_closing
UNION ALL SELECT 'requirements (awaiting review)', count(*) FROM public.deal_requirements WHERE deal_id = 'aaaaaaaa-2222-4222-8222-222222222222' AND review_status = 'pending_review'
UNION ALL SELECT 'wires unverified', count(*) FROM public.wire_instructions WHERE deal_id = 'aaaaaaaa-2222-4222-8222-222222222222' AND verification_status <> 'verified'
UNION ALL SELECT 'approvals invalidated', count(*) FROM public.deal_approvals WHERE deal_id = 'aaaaaaaa-2222-4222-8222-222222222222' AND invalidated_at IS NOT NULL;
