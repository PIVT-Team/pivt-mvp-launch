import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";

type Escrow = Tables<"escrow_transactions">;

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  allocated: "bg-accent/10 text-accent",
  executed: "bg-validated/10 text-validated",
  released: "bg-secondary text-secondary-foreground",
};

export default function EscrowTab({ dealId, isAdmin }: { dealId: string; isAdmin: boolean }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Escrow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    const { data } = await supabase
      .from("escrow_transactions")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at");
    setTransactions(data || []);
    setLoading(false);
  };

  useEffect(() => { fetch(); }, [dealId]);

  const markExecuted = async (id: string) => {
    const { error } = await supabase
      .from("escrow_transactions")
      .update({ status: "executed", executed_by: user?.id, executed_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      // Log to audit
      await supabase.from("audit_log").insert({
        deal_id: dealId,
        user_id: user?.id,
        action: "Marked escrow payout as executed",
        details: { transaction_id: id },
      });
      toast({ title: "Payout marked as executed" });
      fetch();
    }
  };

  const pending = transactions.filter((t) => t.status === "pending");
  const allocated = transactions.filter((t) => t.status === "allocated");
  const executed = transactions.filter((t) => t.status === "executed");

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      {/* Non-custody notice */}
      <div className="p-2.5 rounded-lg bg-accent/5 border border-accent/15 flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          ℹ️ PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="pivt-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Escrow</p>
          <p className="font-mono text-lg font-semibold mt-1">
            {formatCurrency(transactions.reduce((s, t) => s + Number(t.amount), 0))}
          </p>
        </div>
        <div className="pivt-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(pending.reduce((s, t) => s + Number(t.amount), 0))}</p>
        </div>
        <div className="pivt-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Allocated</p>
          <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(allocated.reduce((s, t) => s + Number(t.amount), 0))}</p>
        </div>
        <div className="pivt-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Executed</p>
          <p className="font-mono text-lg font-semibold mt-1 text-validated">{formatCurrency(executed.reduce((s, t) => s + Number(t.amount), 0))}</p>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="pivt-card p-12 text-center text-muted-foreground">
          No escrow transactions yet. They will be created from the waterfall.
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="pivt-card p-4 flex items-center gap-4">
              <div className="flex-1">
                <p className="font-medium">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(t.created_at).toLocaleDateString()}
                  {t.executed_at && ` • Executed ${new Date(t.executed_at).toLocaleDateString()}`}
                </p>
              </div>
              <p className="font-mono font-semibold">{formatCurrency(Number(t.amount))}</p>
              <Badge className={statusColors[t.status]}>{t.status}</Badge>
              {isAdmin && t.status === "pending" && (
                <Button size="sm" variant="outline" onClick={() => markExecuted(t.id)}>
                  Execute
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
