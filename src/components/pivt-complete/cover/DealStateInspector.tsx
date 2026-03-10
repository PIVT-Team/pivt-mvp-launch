import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useDealWorkspace } from '@/contexts/DealWorkspaceContext';
import { supabase } from '@/integrations/supabase/client';
import { fadeInUp } from '@/lib/animations';
import { Bug, ChevronDown, ChevronRight, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface InspectorData {
  dealId: string;
  dealName: string;
  seedKey: string | null;
  isDemo: boolean;
  // Counts
  totalStakeholders: number;
  equityHolders: number;
  dealPartyEntries: number;
  dealPartiesTable: number;
  contacts: number;
  contractDocuments: number;
  dealDocuments: number;
  conditions: number;
  conditionsMet: number;
  approvals: number;
  approvalsApproved: number;
  wireInstructions: number;
  waterfall: number;
  escrowAccounts: number;
  discrepancies: number;
  obligations: number;
  // Integrity
  integrityChecks: { label: string; pass: boolean; detail: string }[];
  lastFetched: string;
}

export const DealStateInspector: React.FC = () => {
  const { dealId, isDemoDeal, realDeal } = useDealWorkspace();
  const [data, setData] = useState<InspectorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const fetchInspectorData = async () => {
    if (!dealId) return;
    setLoading(true);

    const [
      capTable, dealParties, contractDocs, dealDocs, conditions,
      approvals, wires, waterfall, escrow, discrepancies, obligations,
      deal,
    ] = await Promise.all([
      supabase.from('cap_table_entries').select('id, role, ownership_pct').eq('deal_id', dealId),
      supabase.from('deal_parties').select('id').eq('deal_id', dealId),
      supabase.from('contract_documents').select('id').eq('deal_id', dealId),
      supabase.from('deal_documents').select('id').eq('deal_id', dealId),
      supabase.from('conditions').select('id, status').eq('deal_id', dealId),
      supabase.from('deal_approvals').select('id, status').eq('deal_id', dealId),
      supabase.from('wire_instructions').select('id').eq('deal_id', dealId),
      supabase.from('waterfall_tiers').select('id').eq('deal_id', dealId),
      supabase.from('escrow_accounts').select('id').eq('deal_id', dealId),
      supabase.from('discrepancies').select('id').eq('deal_id', dealId),
      supabase.from('obligations').select('id').eq('deal_id', dealId),
      supabase.from('deals').select('deal_name, seed_key, is_demo').eq('id', dealId).single(),
    ]);

    const ct = capTable.data || [];
    const NON_EQUITY = ['Buyer', 'Seller', 'Target', 'Merger Sub', 'Escrow Agent', 'Lender', 'Buyer Counsel', 'Seller Counsel', 'Paying Agent', 'Administrative Agent'];
    const equityHolders = ct.filter(e => !NON_EQUITY.includes(e.role) && Number(e.ownership_pct) > 0);
    const partyEntries = ct.filter(e => NON_EQUITY.includes(e.role));
    const conds = conditions.data || [];
    const apps = approvals.data || [];

    // Integrity checks
    const checks: InspectorData['integrityChecks'] = [];

    // Check: stakeholders exist
    checks.push({
      label: 'Stakeholders seeded',
      pass: ct.length > 0,
      detail: ct.length > 0 ? `${ct.length} entries in cap_table_entries` : 'No cap_table_entries found',
    });

    // Check: deal parties match
    const dpCount = (dealParties.data || []).length;
    checks.push({
      label: 'Deal parties table',
      pass: dpCount > 0 || partyEntries.length > 0,
      detail: `${dpCount} in deal_parties, ${partyEntries.length} party-role entries in cap_table`,
    });

    // Check: documents exist
    const totalDocs = (contractDocs.data || []).length + (dealDocs.data || []).length;
    checks.push({
      label: 'Documents linked',
      pass: totalDocs > 0,
      detail: `${(contractDocs.data || []).length} contract_documents, ${(dealDocs.data || []).length} deal_documents`,
    });

    // Check: equity ownership reconciles
    const totalPct = equityHolders.reduce((s, e) => s + Number(e.ownership_pct), 0);
    checks.push({
      label: 'Equity ownership total',
      pass: totalPct >= 99.9 && totalPct <= 100.1,
      detail: `${totalPct.toFixed(1)}% allocated`,
    });

    setData({
      dealId,
      dealName: deal.data?.deal_name || '—',
      seedKey: deal.data?.seed_key || null,
      isDemo: deal.data?.is_demo || false,
      totalStakeholders: ct.length,
      equityHolders: equityHolders.length,
      dealPartyEntries: partyEntries.length,
      dealPartiesTable: dpCount,
      contacts: ct.length,
      contractDocuments: (contractDocs.data || []).length,
      dealDocuments: (dealDocs.data || []).length,
      conditions: conds.length,
      conditionsMet: conds.filter(c => c.status === 'SATISFIED' || c.status === 'WAIVED' || c.status === 'MET').length,
      approvals: apps.length,
      approvalsApproved: apps.filter(a => a.status === 'approved').length,
      wireInstructions: (wires.data || []).length,
      waterfall: (waterfall.data || []).length,
      escrowAccounts: (escrow.data || []).length,
      discrepancies: (discrepancies.data || []).length,
      obligations: (obligations.data || []).length,
      integrityChecks: checks,
      lastFetched: new Date().toLocaleTimeString(),
    });
    setLoading(false);
  };

  useEffect(() => {
    if (expanded && dealId) fetchInspectorData();
  }, [expanded, dealId]);

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bug className="w-3.5 h-3.5" />
        <span className="font-mono">Deal State Inspector</span>
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {expanded && (
        <motion.div {...fadeInUp} className="mt-3 border border-border rounded-xl bg-card/50 p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono font-semibold text-foreground">{data?.dealName || '—'}</span>
              <span className="ml-2 text-muted-foreground font-mono">{dealId}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={fetchInspectorData} disabled={loading} className="gap-1 h-7 text-xs">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {data && (
            <>
              {/* Metadata */}
              <div className="grid grid-cols-3 gap-2">
                <div className="font-mono">
                  <span className="text-muted-foreground">seed_key:</span>{' '}
                  <span className="text-foreground">{data.seedKey || 'null'}</span>
                </div>
                <div className="font-mono">
                  <span className="text-muted-foreground">is_demo:</span>{' '}
                  <span className="text-foreground">{String(data.isDemo)}</span>
                </div>
                <div className="font-mono">
                  <span className="text-muted-foreground">fetched:</span>{' '}
                  <span className="text-foreground">{data.lastFetched}</span>
                </div>
              </div>

              {/* Counts grid */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Total Stakeholders', value: data.totalStakeholders },
                  { label: 'Equity Holders', value: data.equityHolders },
                  { label: 'Party Entries (cap_table)', value: data.dealPartyEntries },
                  { label: 'deal_parties rows', value: data.dealPartiesTable },
                  { label: 'contract_documents', value: data.contractDocuments },
                  { label: 'deal_documents', value: data.dealDocuments },
                  { label: 'Conditions', value: `${data.conditionsMet}/${data.conditions}` },
                  { label: 'Approvals', value: `${data.approvalsApproved}/${data.approvals}` },
                  { label: 'Wire Instructions', value: data.wireInstructions },
                  { label: 'Waterfall Tiers', value: data.waterfall },
                  { label: 'Escrow Accounts', value: data.escrowAccounts },
                  { label: 'Discrepancies', value: data.discrepancies },
                  { label: 'Obligations', value: data.obligations },
                ].map(item => (
                  <div key={item.label} className="px-2 py-1.5 rounded bg-muted/30 font-mono">
                    <span className="text-muted-foreground">{item.label}:</span>{' '}
                    <span className="font-semibold text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Integrity checks */}
              <div className="space-y-1">
                <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Integrity Checks</span>
                {data.integrityChecks.map((check, i) => (
                  <div key={i} className="flex items-center gap-2 font-mono">
                    {check.pass ? (
                      <CheckCircle2 className="w-3 h-3 text-validated shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 text-blocking shrink-0" />
                    )}
                    <span className={check.pass ? 'text-foreground' : 'text-blocking'}>
                      {check.label}
                    </span>
                    <span className="text-muted-foreground ml-auto">{check.detail}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {!data && !loading && (
            <p className="text-muted-foreground text-center py-4">Click Refresh to load inspector data</p>
          )}
          {loading && (
            <div className="flex justify-center py-4">
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
