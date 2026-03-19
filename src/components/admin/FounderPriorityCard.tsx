import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, AlertTriangle, Users, Target, TrendingUp, ShieldAlert } from "lucide-react";

interface FounderPriorityProps {
  insights: any[];
  overview: {
    totalAccounts?: number;
    newAccountsThisWeek?: number;
    openTickets?: number;
    criticalAlerts?: number;
    funnelSignedUp?: number;
    funnelLoggedIn?: number;
    funnelCreatedDeal?: number;
    funnelUploadedDoc?: number;
    funnelUsedNewton?: number;
  } | undefined;
}

export function FounderPriorityCard({ insights, overview }: FounderPriorityProps) {
  const criticalInsights = insights?.filter(i => i.severity === "critical") ?? [];
  const importantInsights = insights?.filter(i => i.severity === "important") ?? [];
  const topIssues = [...criticalInsights, ...importantInsights].slice(0, 3);

  // Derive friction points from funnel data
  const frictionPoints: string[] = [];
  if (overview) {
    const signedUp = overview.funnelSignedUp ?? 0;
    const loggedIn = overview.funnelLoggedIn ?? 0;
    const createdDeal = overview.funnelCreatedDeal ?? 0;
    const uploadedDoc = overview.funnelUploadedDoc ?? 0;

    if (signedUp > 0 && loggedIn < signedUp * 0.5) {
      frictionPoints.push("Over 50% of signups never log in — investigate email confirmation flow.");
    }
    if (loggedIn > 0 && createdDeal < loggedIn * 0.3) {
      frictionPoints.push("Most logged-in users don't create a deal — improve first-session guidance.");
    }
    if (createdDeal > 0 && uploadedDoc < createdDeal * 0.5) {
      frictionPoints.push("Users create deals but don't upload documents — simplify upload flow.");
    }
  }

  // Derive opportunity
  const usedNewton = overview?.funnelUsedNewton ?? 0;
  const totalAccounts = overview?.totalAccounts ?? 0;
  const opportunity = usedNewton > 0 && totalAccounts > 0
    ? `${Math.round((usedNewton / totalAccounts) * 100)}% of users have tried Newton — increase this through onboarding prompts.`
    : "Drive Newton adoption by highlighting AI features in onboarding.";

  // Risk
  const openTickets = overview?.openTickets ?? 0;
  const criticalAlerts = overview?.criticalAlerts ?? 0;
  const risk = criticalAlerts > 0
    ? `${criticalAlerts} critical blocker discrepancies need immediate resolution.`
    : openTickets > 3
    ? `${openTickets} unresolved support tickets may indicate product friction.`
    : "No urgent operational risks detected.";

  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            What Joanna Should Focus On
          </CardTitle>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
            Founder Copilot
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Issues */}
        {topIssues.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3" /> Top Issues to Fix
            </p>
            {topIssues.map((issue, i) => (
              <div key={issue.id} className="flex items-start gap-2 mb-2">
                <span className="text-xs font-bold text-primary mt-0.5">{i + 1}.</span>
                <div className="flex-1">
                  <p className="text-xs font-medium text-foreground">{issue.title}</p>
                  {issue.suggested_action && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <ArrowRight className="w-2.5 h-2.5 shrink-0" /> {issue.suggested_action}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Friction Points */}
        {frictionPoints.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Users className="w-3 h-3" /> User Journey Friction
            </p>
            {frictionPoints.slice(0, 2).map((f, i) => (
              <p key={i} className="text-xs text-foreground mb-1">• {f}</p>
            ))}
          </div>
        )}

        {/* Opportunity */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3" /> #1 Growth Opportunity
          </p>
          <p className="text-xs text-foreground">{opportunity}</p>
        </div>

        {/* Risk */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ShieldAlert className="w-3 h-3" /> #1 Urgent Risk
          </p>
          <p className="text-xs text-foreground">{risk}</p>
        </div>
      </CardContent>
    </Card>
  );
}
