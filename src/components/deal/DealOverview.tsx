import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, TrendingUp, AlertTriangle } from "lucide-react";
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
          <p className="font-mono text-lg font-semibold mt-1">{formatCurrency(Number(deal.escrow_amount || 0))}</p>
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
  );
}
