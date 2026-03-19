import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecentActivity } from "@/hooks/useUserAnalytics";
import { Activity, Search, Filter } from "lucide-react";
import { format } from "date-fns";

const CATEGORY_COLORS: Record<string, string> = {
  auth: "bg-blue-500/10 text-blue-600",
  deal: "bg-emerald-500/10 text-emerald-600",
  document: "bg-amber-500/10 text-amber-600",
  newton: "bg-violet-500/10 text-violet-600",
  workflow: "bg-primary/10 text-primary",
  support: "bg-rose-500/10 text-rose-600",
};

export default function AdminUserActivity() {
  const { data: events, isLoading } = useRecentActivity();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filtered = useMemo(() => {
    if (!events) return [];
    let list = [...events];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.user_label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q)
      );
    }

    if (filterCategory !== "all") {
      list = list.filter(e => e.category === filterCategory);
    }

    return list;
  }, [events, search, filterCategory]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Activity className="w-6 h-6" />
          User Activity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time activity feed across the platform</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user or action..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            <SelectItem value="auth">Auth</SelectItem>
            <SelectItem value="deal">Deals</SelectItem>
            <SelectItem value="document">Documents</SelectItem>
            <SelectItem value="newton">Newton</SelectItem>
            <SelectItem value="workflow">Workflow</SelectItem>
            <SelectItem value="support">Support</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Feed */}
      <Card className="border border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Activity
            <Badge variant="secondary" className="text-xs ml-2">{filtered.length} events</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No activity events found.</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[700px] overflow-y-auto">
              {filtered.map(event => (
                <div key={event.id} className="flex items-center gap-3 p-3 rounded-md hover:bg-muted/30 transition-colors">
                  <Badge className={`text-[10px] shrink-0 capitalize ${CATEGORY_COLORS[event.category] ?? "bg-muted text-muted-foreground"}`}>
                    {event.category}
                  </Badge>
                  <span className="text-sm text-foreground flex-1">{event.description}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(event.created_at), "MMM d, h:mm a")}
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
