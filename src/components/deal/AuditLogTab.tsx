import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type AuditEntry = Tables<"audit_log">;

export default function AuditLogTab({ dealId }: { dealId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("audit_log")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [dealId]);

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  if (entries.length === 0) {
    return (
      <div className="pivt-card p-12 text-center text-muted-foreground">
        No activity recorded yet.
      </div>
    );
  }

  return (
    <div className="pivt-card overflow-hidden">
      <div className="divide-y divide-border">
        {entries.map((entry) => (
          <div key={entry.id} className="p-4 flex items-start gap-4">
            <div className="w-2 h-2 mt-2 rounded-full bg-accent shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{entry.action}</p>
              {entry.details && Object.keys(entry.details as object).length > 0 && (
                <pre className="text-xs text-muted-foreground font-mono mt-1 overflow-x-auto">
                  {JSON.stringify(entry.details, null, 2)}
                </pre>
              )}
            </div>
            <p className="text-xs text-muted-foreground whitespace-nowrap font-mono">
              {new Date(entry.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
