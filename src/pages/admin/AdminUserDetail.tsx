import { useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUserDetail } from "@/hooks/useUserAnalytics";
import {
  ArrowLeft, User, Mail, Building2, Calendar, LogIn, FileText, Bot,
  Users, Activity, Clock, ChevronRight
} from "lucide-react";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  auth: "bg-blue-500/10 text-blue-600",
  deal: "bg-emerald-500/10 text-emerald-600",
  document: "bg-amber-500/10 text-amber-600",
  newton: "bg-violet-500/10 text-violet-600",
  workflow: "bg-primary/10 text-primary",
};

export default function AdminUserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { data, isLoading } = useUserDetail(userId ?? "");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || !data.profile) {
    return (
      <div className="p-6">
        <Link to="/admin/users" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to User Directory
        </Link>
        <p className="text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const { profile, email, loginCount, lastLogin, firstLogin, dealsCreated, documentsUploaded, newtonRuns, newtonCompleted, newtonFailed, stakeholdersAdded, activeDaysLast30, timeline } = data;

  const engagementLevel = (() => {
    const score = loginCount + dealsCreated * 3 + documentsUploaded * 2 + newtonRuns * 2;
    const daysSinceLogin = lastLogin ? (Date.now() - new Date(lastLogin).getTime()) / (1000 * 60 * 60 * 24) : 999;
    if (daysSinceLogin > 30) return "dormant";
    if (score >= 15 && daysSinceLogin < 7) return "high";
    if (score >= 5) return "medium";
    return "low";
  })();

  const healthLabel = (() => {
    if (engagementLevel === "high") return { label: "Healthy", color: "bg-emerald-500/10 text-emerald-700" };
    if (engagementLevel === "medium") return { label: "Warming Up", color: "bg-blue-500/10 text-blue-600" };
    if (engagementLevel === "low") return { label: "Stalled", color: "bg-amber-500/10 text-amber-700" };
    return { label: "Inactive", color: "bg-muted text-muted-foreground" };
  })();

  return (
    <div className="p-6 space-y-6 max-w-[1200px]">
      <Link to="/admin/users" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to User Directory
      </Link>

      {/* User Summary Card */}
      <Card className="border border-border/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
              <User className="w-8 h-8 text-accent" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground">{profile.full_name || "Unnamed User"}</h1>
                <Badge variant="outline" className={`text-xs ${healthLabel.color}`}>{healthLabel.label}</Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5" />
                  <span>{email || "No email"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>{profile.organization || "No organization"}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Joined {format(new Date(profile.created_at), "MMM d, yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Last active {lastLogin ? format(new Date(lastLogin), "MMM d, h:mm a") : "Never"}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {[
          { label: "Total Logins", value: loginCount, icon: LogIn },
          { label: "Active Days (30d)", value: activeDaysLast30, icon: Activity },
          { label: "Deals Created", value: dealsCreated, icon: FileText },
          { label: "Docs Uploaded", value: documentsUploaded, icon: FileText },
          { label: "Stakeholders", value: stakeholdersAdded, icon: Users },
          { label: "Newton Runs", value: newtonRuns, icon: Bot },
          { label: "Newton OK/Fail", value: `${newtonCompleted}/${newtonFailed}`, icon: Bot },
        ].map(m => (
          <Card key={m.label} className="border border-border/50">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <m.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Engagement Pattern */}
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Engagement Pattern
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-muted-foreground">First Login</p>
              <p className="text-sm font-medium">{firstLogin ? format(new Date(firstLogin), "MMM d, yyyy") : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Login</p>
              <p className="text-sm font-medium">{lastLogin ? format(new Date(lastLogin), "MMM d, h:mm a") : "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Login Frequency</p>
              <p className="text-sm font-medium">
                {activeDaysLast30 > 0 ? `${activeDaysLast30} days in last 30` : "No recent activity"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Engagement Level</p>
              <Badge variant="outline" className={`text-xs capitalize ${
                engagementLevel === "high" ? "text-emerald-600" :
                engagementLevel === "medium" ? "text-blue-600" :
                engagementLevel === "low" ? "text-amber-600" : "text-muted-foreground"
              }`}>{engagementLevel}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Activity Timeline
          </CardTitle>
          <CardDescription>{timeline.length} events</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No activity recorded yet.</p>
          ) : (
            <div className="space-y-1 max-h-[600px] overflow-y-auto">
              {timeline.map(event => (
                <div key={event.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/30 transition-colors">
                  <Badge className={`text-[10px] shrink-0 capitalize ${CATEGORY_COLORS[event.category] ?? "bg-muted text-muted-foreground"}`}>
                    {event.category}
                  </Badge>
                  <span className="text-xs text-foreground flex-1">{event.description}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(event.timestamp), "MMM d, h:mm a")}
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
