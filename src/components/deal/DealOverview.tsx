import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Deal = Tables<"deals">;

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  active: { label: "Active", variant: "default" },
  closing: { label: "Closing", variant: "outline" },
  closed: { label: "Closed", variant: "default" },
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function DealOverview({ deal, onUpdate }: { deal: Deal; onUpdate: () => void }) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const cfg = statusMap[deal.status] || statusMap.draft;

  // Interest projection (simulated)
  const escrowAmt = Number(deal.escrow_amount || 0);
  const interestRate = 4.25;
  const openDate = new Date(deal.created_at);
  const closeDate = deal.closing_date ? new Date(deal.closing_date) : new Date(Date.now() + 90 * 86400000);
  const holdingDays = Math.max(1, Math.round((closeDate.getTime() - openDate.getTime()) / 86400000));
  const grossInterest = escrowAmt * (interestRate / 100) * (holdingDays / 365);
  const clientShare = grossInterest * 0.85;
  const platformShare = grossInterest * 0.15;

  const advanceStatus = async () => {
    const order = ["draft", "active", "closing", "closed"];
    const idx = order.indexOf(deal.status);
    if (idx < order.length - 1) {
      const { error } = await supabase
        .from("deals")
        .update({ status: order[idx + 1] })
        .eq("id", deal.id);
      if (!error) {
        toast({ title: `Deal moved to ${order[idx + 1]}` });
        onUpdate();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="pivt-card p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">{deal.deal_name}</h1>
              <Badge variant={cfg.variant}>{cfg.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {deal.id.slice(0, 8).toUpperCase()}</p>
          </div>
          {isAdmin && deal.status !== "closed" && (
            <Button size="sm" onClick={advanceStatus} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Advance Status
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Deal Value</p>
            <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(Number(deal.deal_value))}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Escrow</p>
            <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(escrowAmt)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Closing Date</p>
            <p className="text-sm font-medium mt-1">{deal.closing_date || "TBD"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p>
            <p className="text-sm font-medium mt-1">{new Date(deal.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {/* Projected Interest Earnings */}
      {escrowAmt > 0 && (
        <div className="pivt-card p-5 border-l-2 border-l-accent">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-accent" />
            <h3 className="font-medium text-sm">Projected Interest Earnings</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium ml-auto">
              Projected (simulated for pilot environment)
            </span>
          </div>
          <div className="grid grid-cols-5 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Holding Period</p>
              <p className="font-mono font-semibold mt-0.5">{holdingDays} days</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Interest Rate</p>
              <p className="font-mono font-semibold mt-0.5">{interestRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gross Interest</p>
              <p className="font-mono font-semibold mt-0.5">{formatCurrency(grossInterest)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Client Share (85%)</p>
              <p className="font-mono font-semibold mt-0.5 text-validated">{formatCurrency(clientShare)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Platform Share (15%)</p>
              <p className="font-mono font-semibold mt-0.5 text-accent">{formatCurrency(platformShare)}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
            <Info className="w-3 h-3 text-muted-foreground" />
            <p className="text-[10px] text-muted-foreground">
              PIVT does not hold or custody client funds. Funds are held at regulated partner institutions.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
