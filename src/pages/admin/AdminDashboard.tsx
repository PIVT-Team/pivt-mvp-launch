import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAdminUserOverview } from "@/hooks/useUserAnalytics";
import { useAdminInsights } from "@/hooks/useAdminMetrics";
import { FounderPriorityCard } from "@/components/admin/FounderPriorityCard";
import { TodaysInsightsCard } from "@/components/admin/TodaysInsightsCard";
import {
  Users, UserPlus, Activity, FileText, Bot, Inbox, AlertTriangle,
  TrendingUp, Zap, Shield, Target
} from "lucide-react";

export default function AdminDashboard() {
  const { data: overview, isLoading } = useAdminUserOverview();
  const { data: insights } = useAdminInsights();

  const v = (val: number | undefined) => isLoading ? "—" : (val ?? 0);

  const topMetrics = [
    { label: "Total Accounts", value: v(overview?.totalAccounts), icon: Users, color: "text-primary" },
    { label: "New This Week", value: v(overview?.newAccountsThisWeek), icon: UserPlus, color: "text-blue-600" },
    { label: "DAU", value: v(overview?.dau), icon: Activity, color: "text-emerald-600" },
    { label: "WAU", value: v(overview?.wau), icon: Activity, color: "text-emerald-600" },
    { label: "MAU", value: v(overview?.mau), icon: Activity, color: "text-emerald-600" },
    { label: "Avg Sessions/User", value: isLoading ? "—" : overview?.avgSessionsPerUser ?? 0, icon: TrendingUp, color: "text-violet-600" },
  ];

  const secondaryMetrics = [
    { label: "Total Documents", value: v(overview?.totalDocuments), icon: FileText },
    { label: "Total Deals", value: v(overview?.totalDeals), icon: Target },
    { label: "Newton Sessions", value: v(overview?.totalNewtonSessions), icon: Bot },
    { label: "Open Tickets", value: v(overview?.openTickets), icon: Inbox },
    { label: "Critical Alerts", value: v(overview?.criticalAlerts), icon: AlertTriangle },
  ];

  const funnel = overview ? [
    { label: "Signed Up", value: overview.funnelSignedUp },
    { label: "Logged In", value: overview.funnelLoggedIn },
    { label: "Created Deal", value: overview.funnelCreatedDeal },
    { label: "Uploaded Document", value: overview.funnelUploadedDoc },
    { label: "Used Newton", value: overview.funnelUsedNewton },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Founder Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">User analytics & platform engagement</p>
        </div>
        <Badge variant="outline" className="text-xs">
          <Shield className="w-3 h-3 mr-1" />
          Admin Access
        </Badge>
      </div>

      {/* Founder Priority Card */}
      <FounderPriorityCard insights={insights ?? []} overview={overview} />

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {topMetrics.map((m) => (
          <Card key={m.label} className="border border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {secondaryMetrics.map((m) => (
          <Card key={m.label} className="border border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-semibold text-foreground">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Activation Funnel */}
      {funnel.length > 0 && (
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-500" />
              Activation Funnel
            </CardTitle>
            <CardDescription>How users progress through key milestones</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {funnel.map((step, i) => {
                const totalRate = funnel[0].value > 0 ? Math.round((step.value / funnel[0].value) * 100) : 0;
                const barWidth = funnel[0].value > 0 ? Math.max((step.value / funnel[0].value) * 100, 2) : 0;
                const prevVal = i > 0 ? funnel[i - 1].value : step.value;
                const convRate = prevVal > 0 ? Math.round((step.value / prevVal) * 100) : 100;
                return (
                  <div key={step.label} className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-[150px] shrink-0">{step.label}</span>
                    <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                      <div className="h-full bg-accent/20 rounded-md transition-all" style={{ width: `${barWidth}%` }} />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground">{step.value}</span>
                    </div>
                    <span className="text-xs font-medium text-foreground w-[50px] text-right">{totalRate}%</span>
                    {i > 0 && convRate < 100 && (
                      <span className="text-[10px] text-destructive w-[60px]">-{100 - convRate}% drop</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Key Insights */}
      <TodaysInsightsCard insights={insights ?? []} />
    </div>
  );
}
