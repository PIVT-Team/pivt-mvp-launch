import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminUserOverview } from "@/hooks/useUserAnalytics";
import { useAdminInsights } from "@/hooks/useAdminMetrics";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Activity, FileText, Bot, Inbox, AlertTriangle,
  TrendingUp, Lightbulb, ArrowRight, RefreshCw, Shield, Target, Zap
} from "lucide-react";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  important: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  opportunity: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export default function AdminDashboard() {
  const { data: overview, isLoading } = useAdminUserOverview();
  const { data: insights } = useAdminInsights();
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const { toast } = useToast();

  const generateInsights = async () => {
    setGeneratingInsights(true);
    try {
      const { error } = await supabase.functions.invoke("admin-insights");
      if (error) throw error;
      toast({ title: "Insights generated", description: "New AI insights have been created." });
    } catch {
      toast({ title: "Error", description: "Failed to generate insights.", variant: "destructive" });
    } finally {
      setGeneratingInsights(false);
    }
  };

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
                const prevVal = i > 0 ? funnel[i - 1].value : step.value;
                const convRate = prevVal > 0 ? Math.round((step.value / prevVal) * 100) : 100;
                const totalRate = funnel[0].value > 0 ? Math.round((step.value / funnel[0].value) * 100) : 0;
                const barWidth = funnel[0].value > 0 ? Math.max((step.value / funnel[0].value) * 100, 2) : 0;
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

      {/* User Insights */}
      <Card className="border border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              User Insights — What should Joanna focus on?
            </CardTitle>
            <CardDescription>AI-generated analysis of user behavior</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={generateInsights} disabled={generatingInsights}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${generatingInsights ? 'animate-spin' : ''}`} />
            {generatingInsights ? "Generating..." : "Generate Insights"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(!insights || insights.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No insights yet. Click "Generate Insights" to analyze user behavior.</p>
            </div>
          ) : (
            insights.map((insight) => (
              <div key={insight.id} className={`p-4 rounded-lg border ${SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.opportunity}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={insight.severity === "critical" ? "destructive" : "outline"} className="text-[10px]">
                        {insight.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{insight.category}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{insight.body}</p>
                    {insight.suggested_action && (
                      <p className="text-xs mt-2 flex items-center gap-1">
                        <ArrowRight className="w-3 h-3" />
                        <span className="font-medium">Action:</span> {insight.suggested_action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
