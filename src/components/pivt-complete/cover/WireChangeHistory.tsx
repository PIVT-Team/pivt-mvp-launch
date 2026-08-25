import React, { useEffect, useState } from 'react';
import { History, ShieldAlert, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bank-detail change history for a deal's wire instructions.
 *
 * A database trigger records every change to a wire instruction and, when the
 * banking fields change, resets verification to `pending`. That trail is the
 * evidence for the re-verification behaviour — and nothing displayed it, so a
 * user saw a wire flip back to unverified with no explanation of why.
 *
 * Payment-redirection fraud looks exactly like a legitimate bank-detail update.
 * The distinguishing question is always "what changed, when, and from where",
 * which is precisely what this shows.
 */

interface HistoryRow {
  id: string;
  wire_instruction_id: string;
  changed_fields: string[];
  banking_changed: boolean;
  previous_values: Record<string, unknown>;
  new_values: Record<string, unknown>;
  previous_verification_status: string | null;
  changed_by_source: string;
  created_at: string;
}

const FIELD_LABEL: Record<string, string> = {
  bank_name: 'Bank', account_holder: 'Account holder',
  account_number_last4: 'Account (last 4)', routing_number: 'Routing number',
  swift_bic: 'SWIFT/BIC', iban: 'IBAN',
  amount: 'Amount', currency: 'Currency', payee_entity: 'Payee',
};

const fmtVal = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : String(v);

export const WireChangeHistory: React.FC<{ dealId?: string; wireId?: string }> = ({ dealId, wireId }) => {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [payees, setPayees] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dealId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      let q = supabase
        .from('wire_instruction_history')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (wireId) q = q.eq('wire_instruction_id', wireId);

      const [{ data }, { data: wires }] = await Promise.all([
        q,
        supabase.from('wire_instructions').select('id, payee_entity').eq('deal_id', dealId),
      ]);
      setRows((data || []) as unknown as HistoryRow[]);
      setPayees(Object.fromEntries((wires || []).map((w: any) => [w.id, w.payee_entity])));
      setLoading(false);
    })();
  }, [dealId, wireId]);

  if (loading) {
    return (
      <div className="pivt-card p-8 flex justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="pivt-card p-8 text-center text-sm text-muted-foreground">
        No changes recorded. Any edit to a wire instruction will appear here.
      </div>
    );
  }

  const bankingChanges = rows.filter((r) => r.banking_changed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <History className="w-4 h-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Wire change history</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {rows.length} change{rows.length > 1 ? 's' : ''}
          {bankingChanges > 0 && ` · ${bankingChanges} affecting bank details`}
        </span>
      </div>

      {rows.map((r) => {
        const payee = payees[r.wire_instruction_id] || 'Unknown payee';
        const when = new Date(r.created_at).toLocaleString();
        return (
          <div
            key={r.id}
            className={`pivt-card p-4 border-l-4 ${
              r.banking_changed ? 'border-blocking bg-blocking/4' : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium truncate">{payee}</p>
                  {r.banking_changed && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blocking/15 text-blocking font-medium flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" /> VERIFICATION RESET
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-1">
                  {r.changed_fields.map((f) => (
                    <p key={f} className="text-[11px] font-mono">
                      <span className="text-muted-foreground">{FIELD_LABEL[f] ?? f}: </span>
                      <span className="line-through opacity-60">{fmtVal(r.previous_values?.[f])}</span>
                      <span className="mx-1.5">→</span>
                      <span className="font-medium">{fmtVal(r.new_values?.[f])}</span>
                    </p>
                  ))}
                </div>

                {r.banking_changed && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    This account was <span className="font-medium">{r.previous_verification_status ?? 'unverified'}</span> before
                    the change. Prior verification described the old account, so it no longer applies —
                    reverify by independent callback before funding.
                  </p>
                )}
              </div>

              <div className="text-right shrink-0">
                <p className="text-[10px] text-muted-foreground">{when}</p>
                <p className="text-[10px] text-muted-foreground/70 mt-0.5">via {r.changed_by_source}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
