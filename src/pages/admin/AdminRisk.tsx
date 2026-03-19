import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminRisks } from "@/hooks/useAdminMetrics";
import { AlertTriangle, Clock, FileWarning, ShieldAlert } from "lucide-react";
import { format } from "date-fns";

export default function AdminRisk() {
  const { data: risks, isLoading } = useAdminRisks();

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Risk & Exception Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Operational and transaction risk signals</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Open Discrepancies", value: risks?.openDiscrepancies.length ?? 0, icon: FileWarning, color: "text-amber-600" },
          { label: "Critical", value: risks?.criticalDiscrepancies.length ?? 0, icon: ShieldAlert, color: "text-destructive" },
          { label: "Stalled Deals (>7d)", value: risks?.stalledDeals.length ?? 0, icon: Clock, color: "text-amber-600" },
          { label: "Pending Approval Deals", value: risks?.pendingApprovalDeals ?? 0, icon: AlertTriangle, color: "text-blue-600" },
        ].map(m => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Critical Discrepancies */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-destructive" />
            Critical Discrepancies
          </CardTitle>
          <CardDescription>Unresolved critical-severity issues requiring immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          {(risks?.criticalDiscrepancies ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No critical discrepancies</p>
          ) : (
            <div className="space-y-2">
              {risks!.criticalDiscrepancies.map(d => (
                <div key={d.id} className="p-3 rounded-md border border-destructive/20 bg-destructive/5">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="text-[10px]">Critical</Badge>
                    <span className="text-xs text-muted-foreground">{d.rule_key}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {format(new Date(d.created_at), "MMM d, yyyy")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground">{d.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stalled Deals */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            Stalled Deals
          </CardTitle>
          <CardDescription>Deals with no state change in over 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          {(risks?.stalledDeals ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No stalled deals detected</p>
          ) : (
            <div className="space-y-2">
              {risks!.stalledDeals.map(d => {
                const days = Math.round((Date.now() - new Date(d.state_updated_at).getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={d.id} className="p-3 rounded-md border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{d.deal_name}</p>
                      <p className="text-xs text-muted-foreground">{d.deal_number} · State: {d.deal_state.replace(/_/g, " ")}</p>
                    </div>
                    <Badge variant="secondary" className="text-xs">{days}d stalled</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Open Discrepancies */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileWarning className="w-4 h-4 text-amber-600" />
            All Open Discrepancies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(risks?.openDiscrepancies ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No open discrepancies</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {risks!.openDiscrepancies.map(d => (
                <div key={d.id} className="p-3 rounded-md border border-border/50 flex items-center gap-3">
                  <Badge
                    variant={d.severity === 'blocker' ? 'destructive' : d.severity === 'warn' ? 'secondary' : 'outline'}
                    className="text-[10px] shrink-0"
                  >
                    {d.severity}
                  </Badge>
                  <p className="text-sm text-foreground flex-1 truncate">{d.message}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(d.created_at), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
