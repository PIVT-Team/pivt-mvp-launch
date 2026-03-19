import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, RefreshCw, Bot, Lightbulb, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/20",
  important: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  opportunity: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

interface TodaysInsightsProps {
  insights: any[];
}

export function TodaysInsightsCard({ insights }: TodaysInsightsProps) {
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [generatingWeekly, setGeneratingWeekly] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generate = async (type: "daily" | "weekly") => {
    const setter = type === "daily" ? setGeneratingDaily : setGeneratingWeekly;
    setter(true);
    try {
      const { error } = await supabase.functions.invoke("admin-insights", { body: { type } });
      if (error) throw error;
      toast({ title: `${type === "daily" ? "Daily" : "Weekly"} insights generated` });
      queryClient.invalidateQueries({ queryKey: ["admin-insights"] });
    } catch {
      toast({ title: "Error", description: "Failed to generate.", variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const dailyInsights = insights?.filter(i => i.insight_type === "daily") ?? [];
  const latestWeekly = insights?.find(i => i.insight_type === "weekly");

  return (
    <Card className="border border-border/50">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            Today's Key Insights
          </CardTitle>
          <CardDescription>AI-analyzed platform signals — what matters now</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => generate("daily")} disabled={generatingDaily}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${generatingDaily ? "animate-spin" : ""}`} />
            {generatingDaily ? "..." : "Daily"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => generate("weekly")} disabled={generatingWeekly}>
            <Sparkles className={`w-3.5 h-3.5 mr-1.5 ${generatingWeekly ? "animate-spin" : ""}`} />
            {generatingWeekly ? "..." : "Weekly"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {dailyInsights.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Bot className="w-7 h-7 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No insights yet. Click "Daily" to analyze platform activity.</p>
          </div>
        ) : (
          dailyInsights.slice(0, 5).map((insight: any) => (
            <div key={insight.id} className={`p-3 rounded-lg border ${SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.opportunity}`}>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={insight.severity === "critical" ? "destructive" : "outline"} className="text-[10px]">
                  {insight.severity}
                </Badge>
                <span className="text-xs text-muted-foreground">{insight.category}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{insight.title}</p>
              <p className="text-xs text-muted-foreground mt-1">{insight.body}</p>
              {insight.suggested_action && (
                <p className="text-xs mt-1.5 flex items-center gap-1">
                  <ArrowRight className="w-3 h-3 shrink-0" />
                  <span className="font-medium">Action:</span> {insight.suggested_action}
                </p>
              )}
            </div>
          ))
        )}

        {latestWeekly && (
          <div className="mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="text-[10px] bg-primary/20 text-primary border-0">Weekly Brief</Badge>
              <span className="text-[10px] text-muted-foreground">
                {new Date(latestWeekly.generated_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground">{latestWeekly.title}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
