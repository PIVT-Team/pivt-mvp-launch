import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClosingReadinessResult {
  // Individual gates
  sellerVerified: boolean;
  buyerVerified: boolean;
  spaUploaded: boolean;
  wireInstructionsUploaded: boolean;
  paymentApproved: boolean;

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

  loading: boolean;
  refetch: () => void;
}

export function useClosingReadiness(dealId: string | undefined): ClosingReadinessResult {
  const [state, setState] = useState<Omit<ClosingReadinessResult, 'loading' | 'refetch'>>({
    sellerVerified: false,
    buyerVerified: false,
    spaUploaded: false,
    wireInstructionsUploaded: false,
    paymentApproved: false,
    verificationComplete: false,
    documentsComplete: false,
    paymentAuthorized: false,
    readyToClose: false,
    stakeholdersTotal: 0,
    stakeholdersVerified: 0,
    documentsUploaded: 0,
    documentsRequired: 0,
    approvalsGranted: 0,
    approvalsTotal: 0,
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

    // Gate 1: Seller verified
    const sellerRoles = ['Seller', 'Target', 'Shareholder', 'Founder'];
    const sellers = stk.filter(s => sellerRoles.includes(s.role));
    const sellerVerified = sellers.length > 0 && sellers.every(s => s.verification_status === 'verified');

    // Gate 2: Buyer verified
    const buyerRoles = ['Buyer', 'Merger Sub', 'Investor'];
    const buyers = stk.filter(s => buyerRoles.includes(s.role));
    const buyerVerified = buyers.length > 0 && buyers.every(s => s.verification_status === 'verified');

    // Gate 3: SPA uploaded (check for SPA or MERGER_AGREEMENT doc types)
    const spaTypes = ['SPA', 'MERGER_AGREEMENT', 'PURCHASE_AGREEMENT'];
    const spaUploaded = docs.some(d => spaTypes.includes(d.doc_type) || d.doc_type === 'OTHER');

    // Gate 4: Wire instructions uploaded
    const wireTypes = ['WIRE_INSTRUCTIONS', 'BANK_LETTER'];
    const wireInstructionsUploaded = docs.some(d => wireTypes.includes(d.doc_type));

    // Gate 5: Payment approved
    const paymentApproved = pays.length > 0 && pays.every(p => (p.status as string) === 'CONFIRMED' || (p.status as string) === 'confirmed');

    const verificationComplete = sellerVerified && buyerVerified;
    const documentsComplete = spaUploaded && wireInstructionsUploaded;
    const paymentAuthorized = paymentApproved;
    const readyToClose = verificationComplete && documentsComplete && paymentAuthorized;

    const requiredRoles = [...sellerRoles, ...buyerRoles];
    const requiredStk = stk.filter(s => requiredRoles.includes(s.role));

    setState({
      sellerVerified,
      buyerVerified,
      spaUploaded,
      wireInstructionsUploaded,
      paymentApproved,
      verificationComplete,
      documentsComplete,
      paymentAuthorized,
      readyToClose,
      stakeholdersTotal: requiredStk.length,
      stakeholdersVerified: requiredStk.filter(s => s.verification_status === 'verified').length,
      documentsUploaded: docs.length,
      documentsRequired: Math.max(docs.filter(d => d.status !== 'UPLOADED').length + docs.length, 2),
      approvalsGranted: apps.filter(a => a.status === 'approved').length,
      approvalsTotal: apps.length,
    });
    setLoading(false);
  }, [dealId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { ...state, loading, refetch: fetch };
}
