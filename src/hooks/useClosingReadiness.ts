import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClosingReadinessResult {
  // Individual gates
  stakeholdersConfigured: boolean;
  sellerVerified: boolean;
  buyerVerified: boolean;
  spaUploaded: boolean;
  wireInstructionsUploaded: boolean;
  paymentApproved: boolean;
  approvalsComplete: boolean;

  // Aggregates
  verificationComplete: boolean;
  documentsComplete: boolean;
  paymentAuthorized: boolean;
  readyToClose: boolean;

  // Detail counts
  stakeholdersTotal: number;
  stakeholdersVerified: number;
  documentsUploaded: number;
  documentsRequired: number;
  approvalsGranted: number;
  approvalsTotal: number;
  paymentsConfigured: number;
  paymentsTotal: number;

  loading: boolean;
  refetch: () => void;
}

const SELLER_ROLES = ['Seller', 'Target', 'Shareholder', 'Founder', 'Employee'];
const BUYER_ROLES = ['Buyer', 'Merger Sub', 'Investor'];

export function useClosingReadiness(dealId: string | undefined): ClosingReadinessResult {
  const [state, setState] = useState<Omit<ClosingReadinessResult, 'loading' | 'refetch'>>({
    stakeholdersConfigured: false,
    sellerVerified: false,
    buyerVerified: false,
    spaUploaded: false,
    wireInstructionsUploaded: false,
    paymentApproved: false,
    approvalsComplete: false,
    verificationComplete: false,
    documentsComplete: false,
    paymentAuthorized: false,
    readyToClose: false,
    stakeholdersTotal: 0,
    stakeholdersVerified: 0,
    documentsUploaded: 0,
    documentsRequired: 2,
    approvalsGranted: 0,
    approvalsTotal: 0,
    paymentsConfigured: 0,
    paymentsTotal: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);

    const [stakeholders, documents, approvals, payments] = await Promise.all([
      supabase.from('cap_table_entries').select('id, role, verification_status').eq('deal_id', dealId),
      supabase.from('contract_documents').select('id, doc_type, status').eq('deal_id', dealId),
      supabase.from('deal_approvals').select('id, status').eq('deal_id', dealId),
      supabase.from('payment_instructions').select('id, status').eq('deal_id', dealId),
    ]);

    const stk = stakeholders.data || [];
    const docs = documents.data || [];
    const apps = approvals.data || [];
    const pays = payments.data || [];

    // Gate: Stakeholders configured (at least one seller + one buyer)
    const sellers = stk.filter(s => SELLER_ROLES.includes(s.role));
    const buyers = stk.filter(s => BUYER_ROLES.includes(s.role));
    const stakeholdersConfigured = sellers.length > 0 && buyers.length > 0;

    // Gate: Seller verified
    const sellerVerified = sellers.length > 0 && sellers.every(s => s.verification_status === 'verified');

    // Gate: Buyer verified
    const buyerVerified = buyers.length > 0 && buyers.every(s => s.verification_status === 'verified');

    // Gate: SPA uploaded
    const spaTypes = ['SPA', 'MERGER_AGREEMENT', 'PURCHASE_AGREEMENT'];
    const spaUploaded = docs.some(d => spaTypes.includes(d.doc_type) || d.doc_type === 'OTHER');

    // Gate: Wire instructions uploaded
    const wireTypes = ['WIRE_INSTRUCTIONS', 'BANK_LETTER'];
    const wireInstructionsUploaded = docs.some(d => wireTypes.includes(d.doc_type));

    // Gate: Payment approved
    const paymentApproved = pays.length > 0 && pays.every(p => {
      const s = (p.status as string).toUpperCase();
      return s === 'CONFIRMED' || s === 'APPROVED';
    });

    // Gate: Approvals complete
    const approvalsComplete = apps.length > 0 && apps.every(a => a.status === 'approved');

    const verificationComplete = sellerVerified && buyerVerified;
    const documentsComplete = spaUploaded && wireInstructionsUploaded;
    const paymentAuthorized = paymentApproved;
    const readyToClose = stakeholdersConfigured && verificationComplete && documentsComplete && paymentAuthorized && approvalsComplete;

    const requiredRoles = [...SELLER_ROLES, ...BUYER_ROLES];
    const requiredStk = stk.filter(s => requiredRoles.includes(s.role));

    setState({
      stakeholdersConfigured,
      sellerVerified,
      buyerVerified,
      spaUploaded,
      wireInstructionsUploaded,
      paymentApproved,
      approvalsComplete,
      verificationComplete,
      documentsComplete,
      paymentAuthorized,
      readyToClose,
      stakeholdersTotal: requiredStk.length,
      stakeholdersVerified: requiredStk.filter(s => s.verification_status === 'verified').length,
      documentsUploaded: docs.length,
      documentsRequired: Math.max(2, docs.length),
      approvalsGranted: apps.filter(a => a.status === 'approved').length,
      approvalsTotal: apps.length,
      paymentsConfigured: pays.filter(p => {
        const s = (p.status as string).toUpperCase();
        return s === 'CONFIRMED' || s === 'APPROVED';
      }).length,
      paymentsTotal: pays.length,
    });
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...state, loading, refetch: fetch };
}
