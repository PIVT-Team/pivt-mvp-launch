import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthAnalytics } from "@/hooks/useAuthAnalytics";
import { Users, UserCheck, UserX, Activity, BarChart3, Shield, Smartphone, Globe } from "lucide-react";
import { format } from "date-fns";

const EVENT_COLORS: Record<string, string> = {
  user_login: "bg-emerald-500/10 text-emerald-600",
  user_logout: "bg-muted text-muted-foreground",
  account_created: "bg-blue-500/10 text-blue-600",
  failed_login_attempt: "bg-destructive/10 text-destructive",
};

export default function AdminAuthAnalytics() {
  const { data, isLoading } = useAuthAnalytics();

  const pctDealCreators = data && data.totalLoggedInUsers > 0
    ? Math.round((data.usersWhoCreatedDeal / data.totalLoggedInUsers) * 100)
    : 0;
  const pctNewtonUsers = data && data.totalLoggedInUsers > 0
    ? Math.round((data.usersWhoUsedNewton / data.totalLoggedInUsers) * 100)
    : 0;
  const pctWorkflowUsers = data && data.totalLoggedInUsers > 0
    ? Math.round((data.usersWhoCompletedWorkflowStep / data.totalLoggedInUsers) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground">User & Auth Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Login tracking, engagement metrics, and retention analysis</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "DAU", value: data?.dau ?? 0, icon: Users, desc: "Daily Active" },
          { label: "WAU", value: data?.wau ?? 0, icon: Users, desc: "Weekly Active" },
          { label: "MAU", value: data?.mau ?? 0, icon: Users, desc: "Monthly Active" },
          { label: "Total Accounts", value: data?.totalAccounts ?? 0, icon: UserCheck, desc: "All time" },
          { label: "New This Week", value: data?.newSignupsThisWeek ?? 0, icon: Activity, desc: "Signups" },
          { label: "Failed Logins", value: data?.failedLoginsThisWeek ?? 0, icon: UserX, desc: "This week" },
        ].map(m => (
          <Card key={m.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{m.desc}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{isLoading ? "—" : m.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="engagement" className="space-y-4">
        <TabsList>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="breakdown">Login Breakdown</TabsTrigger>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
        </TabsList>

        {/* Engagement Tab */}
        <TabsContent value="engagement" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Login → Create Deal", pct: pctDealCreators, count: data?.usersWhoCreatedDeal ?? 0, total: data?.totalLoggedInUsers ?? 0, color: "bg-primary" },
              { label: "Login → Use Newton", pct: pctNewtonUsers, count: data?.usersWhoUsedNewton ?? 0, total: data?.totalLoggedInUsers ?? 0, color: "bg-violet-500" },
              { label: "Login → Workflow Step", pct: pctWorkflowUsers, count: data?.usersWhoCompletedWorkflowStep ?? 0, total: data?.totalLoggedInUsers ?? 0, color: "bg-emerald-500" },
            ].map(m => (
              <Card key={m.label} className="border-border/50">
                <CardContent className="p-5">
                  <p className="text-sm font-medium text-foreground mb-3">{m.label}</p>
                  <div className="flex items-end gap-3 mb-3">
                    <p className="text-3xl font-bold text-foreground">{m.pct}%</p>
                    <p className="text-xs text-muted-foreground pb-1">{m.count} of {m.total} users</p>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full ${m.color} rounded-full transition-all`} style={{ width: `${m.pct}%` }} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Engagement Funnel</CardTitle>
              <CardDescription>What percentage of logged-in users take meaningful actions</CardDescription>
            </CardHeader>
            <CardContent>
              {data && data.totalLoggedInUsers > 0 ? (
                <div className="space-y-3">
                  {[
                    { label: "Logged In (MAU)", value: data.totalLoggedInUsers, pct: 100 },
                    { label: "Created a Deal", value: data.usersWhoCreatedDeal, pct: pctDealCreators },
                    { label: "Used Newton AI", value: data.usersWhoUsedNewton, pct: pctNewtonUsers },
                    { label: "Completed Workflow Step", value: data.usersWhoCompletedWorkflowStep, pct: pctWorkflowUsers },
                  ].map((step, i, arr) => {
                    const prevPct = i > 0 ? arr[i - 1].pct : 100;
                    const dropOff = prevPct - step.pct;
                    return (
                      <div key={step.label} className="flex items-center gap-4">
                        <span className="text-xs text-muted-foreground w-[200px] shrink-0">{step.label}</span>
                        <div className="flex-1 h-7 bg-muted/50 rounded-md overflow-hidden relative">
                          <div
                            className="h-full bg-primary/20 rounded-md"
                            style={{ width: `${step.pct}%` }}
                          />
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium text-foreground">
                            {step.value}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-foreground w-[50px] text-right">{step.pct}%</span>
                        {i > 0 && dropOff > 0 && (
                          <span className="text-[10px] text-destructive w-[50px]">-{dropOff}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Insufficient login data to display engagement funnel.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retention Tab */}
        <TabsContent value="retention" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-foreground mb-1">First-Time Users</p>
                <p className="text-xs text-muted-foreground mb-3">Users who logged in once this month</p>
                <p className="text-3xl font-bold text-foreground">{data?.firstTimeUsers ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5">
                <p className="text-sm font-medium text-foreground mb-1">Returning Users</p>
                <p className="text-xs text-muted-foreground mb-3">Users who logged in multiple times</p>
                <p className="text-3xl font-bold text-foreground">{data?.returningUsers ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base">Retention Overview</CardTitle>
              <CardDescription>User return behavior based on login frequency</CardDescription>
            </CardHeader>
            <CardContent>
              {data && (data.firstTimeUsers + data.returningUsers) > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-[120px]">First-time</span>
                    <div className="flex-1 h-8 bg-muted/50 rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-blue-500/30 rounded-md"
                        style={{ width: `${(data.firstTimeUsers / (data.firstTimeUsers + data.returningUsers)) * 100}%` }}
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium">{data.firstTimeUsers}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground w-[120px]">Returning</span>
                    <div className="flex-1 h-8 bg-muted/50 rounded-md overflow-hidden relative">
                      <div
                        className="h-full bg-emerald-500/30 rounded-md"
                        style={{ width: `${(data.returningUsers / (data.firstTimeUsers + data.returningUsers)) * 100}%` }}
                      />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-medium">{data.returningUsers}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Insufficient data for retention analysis.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Login Breakdown Tab */}
        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "By Method", icon: Shield, data: data?.loginsByMethod ?? {} },
              { title: "By Browser", icon: Globe, data: data?.loginsByBrowser ?? {} },
              { title: "By Device", icon: Smartphone, data: data?.loginsByDevice ?? {} },
            ].map(section => (
              <Card key={section.title} className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <section.icon className="w-4 h-4" />
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {Object.keys(section.data).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No data yet</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(section.data).sort((a, b) => b[1] - a[1]).map(([key, count]) => {
                        const total = Object.values(section.data).reduce((s, v) => s + v, 0);
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <span className="text-xs text-foreground capitalize w-[80px] truncate">{key}</span>
                            <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden">
                              <div className="h-full bg-primary/20 rounded" style={{ width: `${(count / total) * 100}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-[30px] text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Recent Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Recent Auth Events
                <Badge variant="secondary" className="text-xs ml-2">{data?.recentEvents.length ?? 0}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.recentEvents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No auth events recorded yet. Events will appear here after users log in.</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                  {data!.recentEvents.map(event => (
                    <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors">
                      <Badge className={`text-[10px] shrink-0 ${EVENT_COLORS[event.event_type] ?? ""}`}>
                        {event.event_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-foreground truncate flex-1">{event.email ?? "—"}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{event.browser}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">{event.device_type}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(event.created_at), "MMM d, h:mm a")}
                      </span>
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
