import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type CapEntry = Tables<"cap_table_entries">;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function WaterfallTab({ dealId, dealValue, isAdmin }: { dealId: string; dealValue: number; isAdmin: boolean }) {
  const [entries, setEntries] = useState<CapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchEntries = async () => {
    const { data } = await supabase
      .from("cap_table_entries")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at");
    setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [dealId]);

  const addEntry = async () => {
    const { error } = await supabase.from("cap_table_entries").insert({
      deal_id: dealId,
      shareholder_name: "",
      ownership_pct: 0,
      payout_amount: 0,
      escrow_holdback: 0,
      fees: 0,
    });
    if (!error) fetchEntries();
  };

  const updateEntry = async (id: string, field: string, value: string) => {
    const numVal = Number(value) || 0;
    const { error } = await supabase
      .from("cap_table_entries")
      .update({ [field]: field === "shareholder_name" ? value : numVal })
      .eq("id", id);
    if (!error) fetchEntries();
  };

  const deleteEntry = async (id: string) => {
    await supabase.from("cap_table_entries").delete().eq("id", id);
    fetchEntries();
  };

  const totalPayout = entries.reduce((s, e) => s + Number(e.payout_amount), 0);
  const totalNet = entries.reduce((s, e) => s + Number(e.net_payout || 0), 0);
  const totalEscrow = entries.reduce((s, e) => s + Number(e.escrow_holdback || 0), 0);
  const totalFees = entries.reduce((s, e) => s + Number(e.fees || 0), 0);
  const totalPct = entries.reduce((s, e) => s + Number(e.ownership_pct), 0);
  const reconciles = Math.abs(totalPayout - dealValue) < 0.01;

  const runValidation = async () => {
    // Delete old validation results for this deal
    await supabase.from("validation_results").delete().eq("deal_id", dealId);

    const checks = [
      {
        check_name: "Cap Table Totals Reconcile",
        status: reconciles ? "validated" : "discrepancy",
        message: reconciles
          ? "Total payouts match deal value"
          : `Payout total (${formatCurrency(totalPayout)}) does not equal deal value (${formatCurrency(dealValue)})`,
        affected_field: "payout_amount",
      },
      {
        check_name: "No Negative Distributions",
        status: entries.some((e) => Number(e.net_payout || 0) < 0) ? "blocking" : "validated",
        message: entries.some((e) => Number(e.net_payout || 0) < 0)
          ? "One or more shareholders have negative net payouts"
          : "All distributions are positive",
        affected_field: "net_payout",
      },
      {
        check_name: "Percentages Reconcile",
        status: Math.abs(totalPct - 100) < 0.01 ? "validated" : "discrepancy",
        message: Math.abs(totalPct - 100) < 0.01
          ? "Ownership percentages sum to 100%"
          : `Ownership total is ${totalPct.toFixed(2)}%, expected 100%`,
        affected_field: "ownership_pct",
      },
    ];

    for (const check of checks) {
      await supabase.from("validation_results").insert({ deal_id: dealId, ...check });
    }

    toast({ title: "Validation complete" });
  };

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Gross Payout", value: formatCurrency(totalPayout), warn: !reconciles },
          { label: "Escrow Retained", value: formatCurrency(totalEscrow) },
          { label: "Total Fees", value: formatCurrency(totalFees) },
          { label: "Net Distribution", value: formatCurrency(totalNet) },
          { label: "Ownership", value: `${totalPct.toFixed(2)}%`, warn: Math.abs(totalPct - 100) > 0.01 },
        ].map((s) => (
          <div key={s.label} className="pivt-card p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            <p className={`font-mono text-lg font-semibold mt-1 ${s.warn ? "text-discrepancy" : ""}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Reconciliation status */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
        reconciles
          ? "bg-validated/10 text-validated"
          : "bg-discrepancy/10 text-discrepancy"
      }`}>
        {reconciles ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        {reconciles
          ? "Payout totals reconcile with deal value"
          : `Discrepancy: ${formatCurrency(Math.abs(totalPayout - dealValue))} difference`}
      </div>

      {/* Table */}
      <div className="pivt-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Shareholder</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Ownership %</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Payout</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Escrow</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Fees</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Net Payout</th>
                {isAdmin && <th className="p-3 w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="p-3">
                    {isAdmin ? (
                      <Input
                        defaultValue={entry.shareholder_name}
                        onBlur={(e) => updateEntry(entry.id, "shareholder_name", e.target.value)}
                        className="h-8 text-sm"
                        placeholder="Shareholder name"
                      />
                    ) : (
                      entry.shareholder_name
                    )}
                  </td>
                  {["ownership_pct", "payout_amount", "escrow_holdback", "fees"].map((field) => (
                    <td key={field} className="p-3 text-right">
                      {isAdmin ? (
                        <Input
                          type="number"
                          defaultValue={String((entry as any)[field] || 0)}
                          onBlur={(e) => updateEntry(entry.id, field, e.target.value)}
                          className="h-8 text-sm text-right font-mono w-28 ml-auto"
                        />
                      ) : (
                        <span className="font-mono">
                          {field === "ownership_pct"
                            ? `${Number((entry as any)[field]).toFixed(2)}%`
                            : formatCurrency(Number((entry as any)[field] || 0))}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="p-3 text-right font-mono font-semibold">
                    {formatCurrency(Number(entry.net_payout || 0))}
                  </td>
                  {isAdmin && (
                    <td className="p-3">
                      <button onClick={() => deleteEntry(entry.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-3">
          <Button variant="outline" size="sm" onClick={addEntry} className="gap-2">
            <Plus className="w-4 h-4" /> Add Shareholder
          </Button>
          <Button size="sm" onClick={runValidation} className="bg-accent text-accent-foreground hover:bg-accent/90">
            Run Validation
          </Button>
        </div>
      )}
    </div>
  );
}
