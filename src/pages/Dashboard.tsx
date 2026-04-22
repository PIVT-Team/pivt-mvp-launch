import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";
import { Plus, ArrowRight, TrendingUp, AlertTriangle, CheckCircle2, Clock, Sparkles, Upload, Users } from "lucide-react";
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
    const { data } = await supabase.from("deals").select("*").eq("is_demo", false).order("created_at", { ascending: false });
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

  const stats = useMemo(() => ([
    { label: "Total Deals", value: deals.length },
    { label: "Total Value", value: formatCurrency(deals.reduce((s, d) => s + Number(d.deal_value), 0)) },
    { label: "Active", value: deals.filter((d) => d.status === "active").length },
    { label: "Escrow Held", value: formatCurrency(deals.reduce((s, d) => s + Number(d.escrow_amount || 0), 0)) },
  ]), [deals]);

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
        {stats.map((stat) => (
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
        <div className="pivt-card p-12 md:p-14 space-y-8">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold">Close your first deal in minutes</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Start with Newton-guided intake, let AI structure the transaction, then bring in your team when the workspace is ready.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              { icon: Upload, title: "Upload SPA", detail: "Drop in the agreement and supporting deal documents." },
              { icon: Sparkles, title: "AI extracts deal data", detail: "Newton maps parties, obligations, and approvals into the workspace." },
              { icon: Users, title: "Invite your team", detail: "Bring in counsel, finance, and approvers once the deal shell is ready." },
            ].map((step, index) => (
              <div key={step.title} className="rounded-xl border border-border/60 bg-muted/20 p-5">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <step.icon className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Step {index + 1}</span>
                </div>
                <h3 className="text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => window.dispatchEvent(new CustomEvent('pivt:open-newton'))} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Create your first deal
            </Button>
            <Button variant="link" className="px-0" asChild>
              <Link to="/?section=deals">Explore a demo deal first</Link>
            </Button>
          </div>
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
                    <span className="font-mono text-accent/80">{(deal as any).deal_number}</span>
                    {" • "}{cfg.label} • Closing {deal.closing_date || "TBD"}
                  </p>
                  {((deal as any).buyer || (deal as any).seller || (deal as any).target_company) && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {(deal as any).buyer && <>Buyer: {(deal as any).buyer}</>}
                      {(deal as any).seller && <>{(deal as any).buyer ? ' · ' : ''}Seller: {(deal as any).seller}</>}
                      {(deal as any).target_company && <> · Target: {(deal as any).target_company}</>}
                    </p>
                  )}
                  {((deal as any).sector || (deal as any).jurisdiction) && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {(deal as any).sector && <>Sector: {(deal as any).sector}</>}
                      {(deal as any).jurisdiction && <>{(deal as any).sector ? ' · ' : ''}Jurisdiction: {(deal as any).jurisdiction}</>}
                    </p>
                  )}
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
