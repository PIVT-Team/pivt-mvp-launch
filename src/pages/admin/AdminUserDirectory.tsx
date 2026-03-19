import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserDirectory, UserProfile } from "@/hooks/useUserAnalytics";
import { Search, Users, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const ENGAGEMENT_COLORS: Record<string, string> = {
  high: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  medium: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  low: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  dormant: "bg-muted text-muted-foreground border-border",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/10 text-emerald-700",
  inactive: "bg-destructive/10 text-destructive",
  new: "bg-blue-500/10 text-blue-600",
};

type SortKey = "newest" | "most_active" | "least_active" | "most_docs" | "most_deals" | "most_newton";

export default function AdminUserDirectory() {
  const { data: users, isLoading } = useUserDirectory();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterEngagement, setFilterEngagement] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortKey>("newest");

  const filtered = useMemo(() => {
    if (!users) return [];
    let list = [...users];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.organization ?? "").toLowerCase().includes(q)
      );
    }

    if (filterEngagement !== "all") {
      list = list.filter(u => u.engagement_score === filterEngagement);
    }

    if (filterStatus !== "all") {
      list = list.filter(u => u.status === filterStatus);
    }

    switch (sortBy) {
      case "newest": list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()); break;
      case "most_active": list.sort((a, b) => b.login_count - a.login_count); break;
      case "least_active": list.sort((a, b) => a.login_count - b.login_count); break;
      case "most_docs": list.sort((a, b) => b.documents_uploaded - a.documents_uploaded); break;
      case "most_deals": list.sort((a, b) => b.deals_created - a.deals_created); break;
      case "most_newton": list.sort((a, b) => b.newton_sessions - a.newton_sessions); break;
    }

    return list;
  }, [users, search, filterEngagement, filterStatus, sortBy]);

  const engagementCounts = useMemo(() => {
    if (!users) return { high: 0, medium: 0, low: 0, dormant: 0 };
    return users.reduce((acc, u) => {
      acc[u.engagement_score] = (acc[u.engagement_score] || 0) + 1;
      return acc;
    }, { high: 0, medium: 0, low: 0, dormant: 0 } as Record<string, number>);
  }, [users]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6" />
          User Directory
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {users?.length ?? 0} accounts • {engagementCounts.high} high engagement • {engagementCounts.dormant} dormant
        </p>
      </div>

      {/* Engagement Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(["high", "medium", "low", "dormant"] as const).map(level => (
          <Card key={level} className="border border-border/50 cursor-pointer hover:border-accent/50 transition-colors"
                onClick={() => setFilterEngagement(filterEngagement === level ? "all" : level)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground capitalize">{level} Engagement</span>
                <Badge variant="outline" className={`text-[10px] ${ENGAGEMENT_COLORS[level]}`}>{level}</Badge>
              </div>
              <p className="text-2xl font-bold text-foreground mt-1">{engagementCounts[level]}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-[400px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or organization..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterEngagement} onValueChange={setFilterEngagement}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Engagement" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Engagement</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="dormant">Dormant</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="new">New</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
          <SelectTrigger className="w-[180px]">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="most_active">Most Active</SelectItem>
            <SelectItem value="least_active">Least Active</SelectItem>
            <SelectItem value="most_docs">Most Documents</SelectItem>
            <SelectItem value="most_deals">Most Deals</SelectItem>
            <SelectItem value="most_newton">Most Newton Usage</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User Table */}
      <Card className="border border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No users found matching your criteria.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">User</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Organization</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Signup</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Last Active</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Logins</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Deals</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Docs</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Newton</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Engagement</th>
                    <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(user => (
                    <tr
                      key={user.user_id}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/admin/users/${user.user_id}`)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-foreground">{user.full_name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.organization ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {format(new Date(user.created_at), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {user.last_login ? format(new Date(user.last_login), "MMM d, h:mm a") : "Never"}
                      </td>
                      <td className="px-4 py-3 text-center font-medium">{user.login_count}</td>
                      <td className="px-4 py-3 text-center font-medium">{user.deals_created}</td>
                      <td className="px-4 py-3 text-center font-medium">{user.documents_uploaded}</td>
                      <td className="px-4 py-3 text-center font-medium">{user.newton_sessions}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${ENGAGEMENT_COLORS[user.engagement_score]}`}>
                          {user.engagement_score}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[user.status]}`}>
                          {user.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
