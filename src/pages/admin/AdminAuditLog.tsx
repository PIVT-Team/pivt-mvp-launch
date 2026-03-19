import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAdminAuditLog } from "@/hooks/useAdminMetrics";
import { ScrollText, Search } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

export default function AdminAuditLog() {
  const { data: logs, isLoading } = useAdminAuditLog();
  const [search, setSearch] = useState("");

  const filtered = (logs ?? []).filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.event_type?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q) ||
      log.entity_id?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Searchable log of all platform actions</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by event type, entity..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ScrollText className="w-4 h-4" />
            Recent Events
            <Badge variant="secondary" className="text-xs ml-2">{filtered.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No audit events found</p>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {filtered.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50">
                  <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
                    {log.source}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {log.event_type?.replace(/_/g, " ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {log.entity_type} · {log.entity_id?.slice(0, 8)}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {format(new Date(log.created_at), "MMM d, h:mm a")}
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
