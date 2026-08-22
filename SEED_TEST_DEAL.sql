-- ═══════════════════════════════════════════════════════════════════════════
-- Sample deal with REAL document text, so the extractors have something to read.
--
-- The existing sample deals insert contract_documents with a filename and a
-- status but no text_content — metadata rows so the UI looks populated, with
-- no document behind them. Both extractors skip anything under 200 characters
-- of text, so on those deals they correctly report "no readable documents" and
-- the feature looks broken when it is the fixture that is empty.
--
-- This creates one deal with three documents carrying genuine contract language:
--   • an SPA with execution blocks for three signatories
--   • a customer agreement with a change-of-control consent clause
--   • an office lease with an assignment clause that is deliberately ambiguous
--
-- ⚠️  BEFORE RUNNING: replace YOUR_EMAIL_HERE below with your login email so the
--     deal is visible to you.
--
-- Safe to re-run: removes and recreates the same deal.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_email  text := 'YOUR_EMAIL_HERE';
  v_user   uuid;
  v_deal   uuid := 'dddddddd-1111-4111-8111-111111111111';
BEGIN
  IF v_email = 'YOUR_' || 'EMAIL_HERE' THEN
    RAISE EXCEPTION 'Replace YOUR_EMAIL_HERE with the email you log into PIVT with.';
  END IF;

  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No user found with email %. Use the address you log in with.', v_email;
  END IF;

  -- Explicit, rather than relying on ON DELETE CASCADE — so a re-run is clean
  -- whatever the FK configuration happens to be.
  DELETE FROM public.contract_documents  WHERE deal_id = v_deal;
  DELETE FROM public.deal_participants   WHERE deal_id = v_deal;
  DELETE FROM public.deals               WHERE id = v_deal;

  INSERT INTO public.deals (
    id, deal_name, deal_number, deal_type, status, deal_value, currency,
    escrow_amount, buyer, seller, target_company, created_by, owner_id, is_demo
  ) VALUES (
    v_deal, 'Project MERIDIAN (extractor test)', 'MER-001', 'STOCK_PURCHASE',
    'in_progress', 120000000, 'USD', 9000000,
    'Cardinal Bidco Inc.', 'Meridian Holdings LLC', 'Meridian Data Systems, Inc.',
    v_user, v_user, true
  );

  INSERT INTO public.deal_participants (deal_id, user_id, party_role)
  VALUES (v_deal, v_user, 'owner');

  -- ── 1. SPA with three execution blocks ──
  INSERT INTO public.contract_documents (deal_id, doc_type, filename, status, text_content)
  VALUES (v_deal, 'SPA', 'Meridian_SPA_Execution_Version.pdf', 'PARSED',
$doc$STOCK PURCHASE AGREEMENT

This Stock Purchase Agreement (this "Agreement") is entered into as of 15 September 2026 by and among Cardinal Bidco Inc., a Delaware corporation ("Buyer"), Meridian Holdings LLC, a Delaware limited liability company ("Seller"), and Meridian Data Systems, Inc., a Delaware corporation (the "Company").

ARTICLE I — PURCHASE AND SALE
1.1 Purchase Price. Subject to the terms hereof, Buyer shall purchase from Seller all of the issued and outstanding shares of capital stock of the Company for an aggregate purchase price of One Hundred Twenty Million Dollars ($120,000,000) (the "Purchase Price").
1.2 Escrow. At Closing, Buyer shall deposit Nine Million Dollars ($9,000,000) with the Escrow Agent to be held in accordance with the Escrow Agreement.

ARTICLE VII — CONDITIONS TO CLOSING
7.3 Third Party Consents. Each consent listed on Schedule 7.3 shall have been obtained in writing and shall be in full force and effect as of the Closing.

ARTICLE X — MISCELLANEOUS
10.9 Counterparts. This Agreement may be executed in counterparts, each of which shall be deemed an original.

IN WITNESS WHEREOF, the parties hereto have caused this Agreement to be duly executed as of the date first written above.

BUYER:
CARDINAL BIDCO INC.

By: ______________________________
Name: Jane Smith
Title: Chief Executive Officer

SELLER:
MERIDIAN HOLDINGS LLC

By: ______________________________
Name: John Doe
Title: President and Manager

THE COMPANY:
MERIDIAN DATA SYSTEMS, INC.

By: ______________________________
Name: Aisha Rahman
Title: Chief Financial Officer
$doc$);

  -- ── 2. Customer agreement: unambiguous change-of-control CONSENT ──
  INSERT INTO public.contract_documents (deal_id, doc_type, filename, status, text_content)
  VALUES (v_deal, 'OTHER', 'Acme_Customer_Agreement.pdf', 'PARSED',
$doc$MASTER SERVICES AGREEMENT

This Master Services Agreement is made between Acme Inc., a New York corporation ("Customer"), and Meridian Data Systems, Inc. ("Supplier"), dated 3 March 2024.

SECTION 12 — TERM AND TERMINATION
12.1 This Agreement shall continue for an initial term of five (5) years.

SECTION 14 — ASSIGNMENT AND CHANGE OF CONTROL
14.1 Neither party may assign this Agreement, in whole or in part, without the prior written consent of the other party.
14.2 Supplier shall not, without the prior written consent of Customer (such consent not to be unreasonably withheld, conditioned or delayed), undergo any Change of Control. For purposes of this Section, "Change of Control" means any transaction or series of transactions resulting in the transfer of more than fifty percent (50%) of the voting securities of Supplier to any person that is not an affiliate of Supplier as of the date hereof.
14.3 Customer shall respond to any request for consent under Section 14.2 within thirty (30) days of receipt. Any purported Change of Control effected without such consent shall constitute a material breach entitling Customer to terminate this Agreement upon thirty (30) days written notice.

Notices to Customer shall be sent to: legal@acme.example
$doc$);

  -- ── 3. Office lease: assignment clause that may or may not be triggered ──
  INSERT INTO public.contract_documents (deal_id, doc_type, filename, status, text_content)
  VALUES (v_deal, 'OTHER', 'Office_Lease_Landlord_LLC.pdf', 'PARSED',
$doc$COMMERCIAL LEASE AGREEMENT

Landlord: Landlord LLC
Tenant: Meridian Data Systems, Inc.
Premises: 400 Harbour Street, Suite 1200
Commencement Date: 1 June 2023

ARTICLE 9 — ASSIGNMENT AND SUBLETTING
9.1 Tenant shall not assign this Lease, nor sublet the Premises or any part thereof, without the prior written consent of Landlord, which consent shall not be unreasonably withheld.
9.2 For the avoidance of doubt, a transfer of stock of Tenant among existing shareholders shall not constitute an assignment for the purposes of Section 9.1.
9.3 Tenant shall give Landlord not less than thirty (30) days prior written notice of any proposed assignment.

ARTICLE 15 — NOTICES
All notices to Landlord shall be delivered to the address set forth above.
$doc$);

  RAISE NOTICE 'Created deal % with 3 documents for user %', v_deal, v_email;
END $$;

-- confirm
SELECT filename, doc_type, length(text_content) AS chars
FROM public.contract_documents
WHERE deal_id = 'dddddddd-1111-4111-8111-111111111111'
ORDER BY filename;
