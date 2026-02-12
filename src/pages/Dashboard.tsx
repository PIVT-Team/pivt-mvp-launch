import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Plus, ArrowRight, TrendingUp, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateDealDialog from "@/components/CreateDealDialog";
import type { Tables } from "@/integrations/supabase/types";

type Deal = Tables<"deals">;

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchDeals = async () => {
    const { data } = await supabase.from("deals").select("*").order("created_at", { ascending: false });
    setDeals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
    draft: { icon: Clock, color: "text-muted-foreground", label: "Draft" },
    active: { icon: TrendingUp, color: "text-accent", label: "Active" },
    closing: { icon: AlertTriangle, color: "text-discrepancy", label: "Closing" },
    closed: { icon: CheckCircle2, color: "text-validated", label: "Closed" },
  };

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deal Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {deals.length} active deal{deals.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2">
            <Plus className="w-4 h-4" />
            New Deal
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Deals", value: deals.length },
          { label: "Total Value", value: formatCurrency(deals.reduce((s, d) => s + Number(d.deal_value), 0)) },
          { label: "Active", value: deals.filter((d) => d.status === "active").length },
          { label: "Escrow Held", value: formatCurrency(deals.reduce((s, d) => s + Number(d.escrow_amount || 0), 0)) },
        ].map((stat) => (
          <div key={stat.label} className="pivt-card p-5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            <p className="pivt-stat mt-2">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Deal list */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <div className="pivt-card p-12 text-center">
          <p className="text-muted-foreground">No deals yet.</p>
          {isAdmin && (
            <Button onClick={() => setShowCreate(true)} variant="outline" className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Create your first deal
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {deals.map((deal) => {
            const cfg = statusConfig[deal.status] || statusConfig.draft;
            const Icon = cfg.icon;
            return (
              <Link
                key={deal.id}
                to={`/deals/${deal.id}`}
                className="pivt-card p-5 flex items-center gap-4 hover:border-accent/50 transition-colors group"
              >
                <Icon className={`w-5 h-5 ${cfg.color} shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{deal.deal_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cfg.label} • Closing {deal.closing_date || "TBD"}
                  </p>
                </div>
                <p className="font-mono text-sm font-medium">{formatCurrency(Number(deal.deal_value))}</p>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </Link>
            );
          })}
        </div>
      )}

      <CreateDealDialog open={showCreate} onOpenChange={setShowCreate} onCreated={fetchDeals} />
    </div>
  );
}
