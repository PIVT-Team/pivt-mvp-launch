import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Lightbulb, RefreshCw, Bot, ArrowRight, Calendar, Filter,
  CheckCircle, Eye, X, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";

type InsightStatus = "new" | "reviewed" | "dismissed" | "actioned";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  important: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  opportunity: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

const STATUS_OPTIONS: { value: InsightStatus; label: string; icon: typeof Eye }[] = [
  { value: "new", label: "New", icon: Sparkles },
  { value: "reviewed", label: "Reviewed", icon: Eye },
  { value: "actioned", label: "Actioned", icon: CheckCircle },
  { value: "dismissed", label: "Dismissed", icon: X },
];

const CATEGORIES = [
  "all", "activation", "retention", "newton", "support", "risk",
  "documents", "deals", "engagement", "general",
];

export default function AdminInsights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<"all" | "daily" | "weekly">("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedWeekly, setExpandedWeekly] = useState<string | null>(null);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);

  const { data: insights = [], isLoading } = useQuery({
    queryKey: ["admin-insights-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_insights")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: InsightStatus }) => {
      const { error } = await supabase
        .from("admin_insights")
        .update({ review_status: status, reviewed_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-insights-full"] }),
  });

  const generateInsights = async (type: "daily" | "weekly") => {
    const setter = type === "daily" ? setGeneratingDaily : setGeneratingWeekly;
    setter(true);
    try {
      const { error } = await supabase.functions.invoke("admin-insights", { body: { type } });
      if (error) throw error;
      toast({ title: `${type === "daily" ? "Daily" : "Weekly"} insights generated` });
      queryClient.invalidateQueries({ queryKey: ["admin-insights-full"] });
    } catch {
      toast({ title: "Error", description: "Failed to generate insights.", variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const filtered = insights.filter((i: any) => {
    if (typeFilter !== "all" && i.insight_type !== typeFilter) return false;
    if (severityFilter !== "all" && i.severity !== severityFilter) return false;
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (statusFilter !== "all" && (i.review_status ?? "new") !== statusFilter) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, any[]>>((acc, i: any) => {
    const date = new Date(i.generated_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    (acc[date] ??= []).push(i);
    return acc;
  }, {});

  const parseWeeklyBody = (body: string) => {
    try { return JSON.parse(body); } catch { return null; }
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Insights & Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-generated daily and weekly platform analysis</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => generateInsights("daily")} disabled={generatingDaily}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${generatingDaily ? "animate-spin" : ""}`} />
            {generatingDaily ? "Generating..." : "Daily Insights"}
          </Button>
          <Button size="sm" onClick={() => generateInsights("weekly")} disabled={generatingWeekly}>
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${generatingWeekly ? "animate-spin" : ""}`} />
            {generatingWeekly ? "Generating..." : "Weekly Brief"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground">
          <option value="all">All Types</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground">
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="important">Important</option>
          <option value="opportunity">Opportunity</option>
        </select>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground">
          {CATEGORIES.map(c => <option key={c} value={c}>{c === "all" ? "All Categories" : c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground">
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="text-xs text-muted-foreground ml-2">{filtered.length} insights</span>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-50 animate-spin" />
          <p className="text-sm">Loading insights...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No insights match your filters. Generate new insights to get started.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} className="space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{date}</span>
              <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
            </div>

            {items.map((insight: any) => {
              const isWeekly = insight.insight_type === "weekly";
              const weeklyData = isWeekly ? parseWeeklyBody(insight.body) : null;
              const isExpanded = expandedWeekly === insight.id;
              const status = insight.review_status ?? "new";

              return (
                <div key={insight.id} className={`p-4 rounded-lg border ${SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.opportunity}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant={insight.severity === "critical" ? "destructive" : "outline"} className="text-[10px]">
                          {insight.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {insight.insight_type}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{insight.category}</span>
                        <Badge variant={status === "new" ? "default" : "secondary"} className="text-[10px] ml-auto">
                          {status}
                        </Badge>
                      </div>

                      <p className="text-sm font-medium text-foreground">{insight.title}</p>

                      {!isWeekly && (
                        <>
                          <p className="text-xs text-muted-foreground mt-1">{insight.body}</p>
                          {insight.suggested_action && (
                            <p className="text-xs mt-2 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 shrink-0" />
                              <span className="font-medium">Action:</span> {insight.suggested_action}
                            </p>
                          )}
                        </>
                      )}

                      {isWeekly && weeklyData && (
                        <>
                          <button onClick={() => setExpandedWeekly(isExpanded ? null : insight.id)}
                            className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline">
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            {isExpanded ? "Collapse" : "View full brief"}
                          </button>
                          {isExpanded && (
                            <div className="mt-3 space-y-3 text-xs">
                              {weeklyData.highlights?.length > 0 && (
                                <div>
                                  <p className="font-semibold text-foreground mb-1">Key Highlights</p>
                                  {weeklyData.highlights.map((h: any, i: number) => (
                                    <div key={i} className="ml-2 mb-1">
                                      <span className="font-medium">{h.title}</span>: {h.body}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {weeklyData.top_product_priorities?.length > 0 && (
                                <div>
                                  <p className="font-semibold text-foreground mb-1">Product Priorities</p>
                                  {weeklyData.top_product_priorities.map((p: string, i: number) => (
                                    <p key={i} className="ml-2">• {p}</p>
                                  ))}
                                </div>
                              )}
                              {weeklyData.top_user_actions?.length > 0 && (
                                <div>
                                  <p className="font-semibold text-foreground mb-1">User Actions</p>
                                  {weeklyData.top_user_actions.map((a: string, i: number) => (
                                    <p key={i} className="ml-2">• {a}</p>
                                  ))}
                                </div>
                              )}
                              {weeklyData.growth_opportunity && (
                                <p><span className="font-semibold text-foreground">Growth Opportunity:</span> {weeklyData.growth_opportunity}</p>
                              )}
                              {weeklyData.operational_risk && (
                                <p><span className="font-semibold text-foreground">Operational Risk:</span> {weeklyData.operational_risk}</p>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {STATUS_OPTIONS.filter(s => s.value !== status).slice(0, 2).map(s => (
                        <button key={s.value} onClick={() => updateStatus.mutate({ id: insight.id, status: s.value })}
                          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title={s.label}>
                          <s.icon className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
