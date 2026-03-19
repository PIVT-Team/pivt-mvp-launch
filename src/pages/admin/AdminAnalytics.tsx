import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminOverview, useAdminDealFunnel, useAdminAgentRuns } from "@/hooks/useAdminMetrics";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Users, FileText, Bot, TrendingUp, Activity } from "lucide-react";

export default function AdminAnalytics() {
  const { data: overview } = useAdminOverview();
  const { data: funnel } = useAdminDealFunnel();
  const { data: agentRuns } = useAdminAgentRuns();

  const agentTypeStats = (agentRuns ?? []).reduce<Record<string, { total: number; completed: number; failed: number }>>((acc, r) => {
    if (!acc[r.agent_type]) acc[r.agent_type] = { total: 0, completed: 0, failed: 0 };
    acc[r.agent_type].total++;
    if (r.status === 'completed') acc[r.agent_type].completed++;
    if (r.status === 'failed') acc[r.agent_type].failed++;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Platform Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Comprehensive platform metrics and usage data</p>
      </div>

      <Tabs defaultValue="platform" className="space-y-4">
        <TabsList>
          <TabsTrigger value="platform">Platform</TabsTrigger>
          <TabsTrigger value="deal-funnel">Deal Funnel</TabsTrigger>
          <TabsTrigger value="newton">Newton / AI</TabsTrigger>
        </TabsList>

        {/* Platform Tab */}
        <TabsContent value="platform" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: overview?.totalUsers ?? 0, icon: Users },
              { label: "Total Deals", value: overview?.totalDeals ?? 0, icon: FileText },
              { label: "Documents Uploaded", value: overview?.totalDocuments ?? 0, icon: FileText },
              { label: "Stakeholders Added", value: overview?.totalStakeholders ?? 0, icon: Users },
            ].map(m => (
              <Card key={m.label} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <m.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{m.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{m.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Platform Health
              </CardTitle>
              <CardDescription>Key operational metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  { label: "Active Deals", value: overview?.activeDeals ?? 0 },
                  { label: "Completed Deals", value: overview?.completedDeals ?? 0 },
                  { label: "Stalled Deals", value: overview?.stalledDeals ?? 0 },
                  { label: "Pending Approvals", value: overview?.pendingApprovals ?? 0 },
                  { label: "Open Support Tickets", value: overview?.openTickets ?? 0 },
                  { label: "Critical Alerts", value: overview?.criticalAlerts ?? 0 },
                ].map(m => (
                  <div key={m.label}>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    <p className="text-xl font-semibold text-foreground">{m.value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deal Funnel Tab */}
        <TabsContent value="deal-funnel" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Deal Workflow Funnel
              </CardTitle>
              <CardDescription>Conversion rates through each workflow stage</CardDescription>
            </CardHeader>
            <CardContent>
              {funnel ? (
                <div className="space-y-3">
                  {[
                    { label: "Deals Created", value: funnel.created },
                    { label: "Stakeholders Added", value: funnel.stakeholderAdded },
                    { label: "Documents Uploaded", value: funnel.documentsUploaded },
                    { label: "Wire Instructions", value: funnel.wiresUploaded },
                    { label: "Approvals Requested", value: funnel.approvalsRequested },
                    { label: "Approvals Completed", value: funnel.approvalsCompleted },
                    { label: "Execution-Ready", value: funnel.executionReady },
                    { label: "Settled", value: funnel.settled },
                  ].map((step, i, arr) => {
                    const prevVal = i > 0 ? arr[i - 1].value : step.value;
                    const convRate = prevVal > 0 ? Math.round((step.value / prevVal) * 100) : 100;
                    const totalRate = funnel.created > 0 ? Math.round((step.value / funnel.created) * 100) : 0;
                    const barWidth = funnel.created > 0 ? Math.max((step.value / funnel.created) * 100, 2) : 0;
                    return (
                      <div key={step.label} className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground w-[160px] shrink-0">{step.label}</span>
                        <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                          <div
                            className="h-full bg-primary/20 rounded-md transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground">
                            {step.value}
                          </span>
                        </div>
                        <div className="w-[80px] text-right shrink-0">
                          {i > 0 && (
                            <Badge variant={convRate >= 50 ? "outline" : "destructive"} className="text-[10px]">
                              {convRate}% conv
                            </Badge>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground w-[40px] text-right">{totalRate}%</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Loading funnel data...</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Newton/AI Tab */}
        <TabsContent value="newton" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Runs</p>
                <p className="text-2xl font-bold">{agentRuns?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {agentRuns?.filter(r => r.status === 'completed').length ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Failed</p>
                <p className="text-2xl font-bold text-destructive">
                  {agentRuns?.filter(r => r.status === 'failed').length ?? 0}
                </p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Avg Duration</p>
                <p className="text-2xl font-bold">
                  {agentRuns?.length
                    ? `${Math.round((agentRuns.filter(r => r.duration_ms).reduce((s, r) => s + (r.duration_ms ?? 0), 0) / agentRuns.filter(r => r.duration_ms).length) / 1000)}s`
                    : "—"}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agent Type Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(agentTypeStats).length === 0 ? (
                <p className="text-sm text-muted-foreground">No agent run data available yet.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(agentTypeStats).map(([type, stats]) => (
                    <div key={type} className="flex items-center gap-4">
                      <span className="text-xs font-medium text-foreground w-[200px] truncate capitalize">
                        {type.replace(/_/g, " ")}
                      </span>
                      <div className="flex-1 h-6 bg-muted/50 rounded relative overflow-hidden">
                        <div
                          className="h-full bg-emerald-500/30 rounded"
                          style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-[80px] text-right">
                        {stats.completed}/{stats.total}
                      </span>
                      {stats.failed > 0 && (
                        <Badge variant="destructive" className="text-[10px]">{stats.failed} failed</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
