import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminOverview, useAdminInsights, useAdminDealFunnel } from "@/hooks/useAdminMetrics";
import {
  FileText, Users, AlertTriangle, Bot, Inbox, CheckCircle2,
  TrendingUp, Zap, ArrowRight, Lightbulb, Target, Shield, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  important: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  opportunity: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "destructive",
  important: "secondary",
  opportunity: "outline",
};

export default function AdminDashboard() {
  const { data: overview, isLoading } = useAdminOverview();
  const { data: insights } = useAdminInsights();
  const { data: funnel } = useAdminDealFunnel();
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

  const metrics = [
    { label: "Total Deals", value: overview?.totalDeals ?? 0, icon: FileText, color: "text-primary" },
    { label: "Active Deals", value: overview?.activeDeals ?? 0, icon: TrendingUp, color: "text-emerald-600" },
    { label: "Execution-Ready", value: overview?.executionReady ?? 0, icon: Zap, color: "text-amber-600" },
    { label: "Open Tickets", value: overview?.openTickets ?? 0, icon: Inbox, color: "text-blue-600" },
    { label: "Newton Success", value: `${overview?.newtonSuccessRate ?? 0}%`, icon: Bot, color: "text-violet-600" },
    { label: "Critical Alerts", value: overview?.criticalAlerts ?? 0, icon: AlertTriangle, color: overview?.criticalAlerts ? "text-destructive" : "text-muted-foreground" },
  ];

  const funnelSteps = funnel ? [
    { label: "Deals Created", value: funnel.created },
    { label: "Stakeholders Added", value: funnel.stakeholderAdded },
    { label: "Documents Uploaded", value: funnel.documentsUploaded },
    { label: "Wires Uploaded", value: funnel.wiresUploaded },
    { label: "Approvals Requested", value: funnel.approvalsRequested },
    { label: "Approvals Completed", value: funnel.approvalsCompleted },
    { label: "Execution-Ready", value: funnel.executionReady },
    { label: "Settled", value: funnel.settled },
  ] : [];

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">PIVT internal control center</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">
            <Shield className="w-3 h-3 mr-1" />
            Admin Access
          </Badge>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {metrics.map((m) => (
          <Card key={m.label} className="border border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className={`w-4 h-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{m.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: overview?.totalUsers ?? 0, icon: Users },
          { label: "Documents", value: overview?.totalDocuments ?? 0, icon: FileText },
          { label: "Stakeholders", value: overview?.totalStakeholders ?? 0, icon: Target },
          { label: "Approvals Sent", value: overview?.totalApprovals ?? 0, icon: CheckCircle2 },
        ].map((m) => (
          <Card key={m.label} className="border border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <m.icon className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="text-lg font-semibold text-foreground">{isLoading ? "—" : m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Insights */}
      <Card className="border border-border/50">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-500" />
              Today's Key Insights
            </CardTitle>
            <CardDescription>AI-generated analysis of platform activity</CardDescription>
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
              <p className="text-sm">No insights yet. Click "Generate Insights" to analyze platform data.</p>
            </div>
          ) : (
            insights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border ${SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.opportunity}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={SEVERITY_BADGE[insight.severity] as any ?? "outline"} className="text-[10px]">
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

      {/* Deal Funnel */}
      {funnel && (
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Deal Funnel
            </CardTitle>
            <CardDescription>End-to-end deal workflow progression</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2">
              {funnelSteps.map((step, i) => {
                const maxVal = Math.max(...funnelSteps.map(s => s.value), 1);
                const height = Math.max((step.value / maxVal) * 120, 8);
                const prevVal = i > 0 ? funnelSteps[i - 1].value : step.value;
                const dropOff = prevVal > 0 ? Math.round(((prevVal - step.value) / prevVal) * 100) : 0;
                return (
                  <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-foreground">{step.value}</span>
                    <div
                      className="w-full rounded-t bg-primary/20 border border-primary/30 transition-all"
                      style={{ height: `${height}px` }}
                    />
                    <span className="text-[10px] text-muted-foreground text-center leading-tight">{step.label}</span>
                    {i > 0 && dropOff > 0 && (
                      <span className="text-[9px] text-destructive font-medium">-{dropOff}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Support Volume */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Inbox className="w-4 h-4 text-blue-600" />
              Support Volume
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Tickets</p>
                <p className="text-xl font-bold">{overview?.totalTickets ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Open</p>
                <p className="text-xl font-bold text-amber-600">{overview?.openTickets ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-violet-600" />
              Newton Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Total Runs</p>
                <p className="text-xl font-bold">{overview?.newtonRuns ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Success Rate</p>
                <p className="text-xl font-bold text-emerald-600">{overview?.newtonSuccessRate ?? 0}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
