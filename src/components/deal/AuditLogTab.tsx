import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Download, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type AuditEntry = Tables<"audit_log">;

type VerifyAuditChainResponse = {
  valid: boolean;
  total_events: number;
  first_event_at: string | null;
  last_event_at: string | null;
  broken_at_sequence?: number;
};

export default function AuditLogTab({ dealId }: { dealId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainStatus, setChainStatus] = useState<VerifyAuditChainResponse | null>(null);
  const [chainCheckedAt, setChainCheckedAt] = useState<Date | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [verifyingChain, setVerifyingChain] = useState(true);
  const [exportingChain, setExportingChain] = useState(false);

  const verifyChain = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setVerifyingChain(true);

    const { data, error } = await supabase.functions.invoke("verify-audit-chain", {
      body: { deal_id: dealId },
    });

    if (error) {
      setChainError(error.message || "Chain verification failed");
      setChainStatus(null);
      setChainCheckedAt(null);
      setVerifyingChain(false);
      return;
    }

    setChainStatus((data ?? null) as VerifyAuditChainResponse | null);
    setChainCheckedAt(new Date());
    setChainError(null);
    setVerifyingChain(false);
  }, [dealId]);

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

  useEffect(() => {
    void verifyChain();

    const interval = window.setInterval(() => {
      void verifyChain({ silent: true });
    }, 60_000);

    return () => window.clearInterval(interval);
  }, [verifyChain]);

  const verifiedAgoLabel = useMemo(() => {
    if (!chainCheckedAt) return null;
    const diffMinutes = Math.max(0, Math.floor((Date.now() - chainCheckedAt.getTime()) / 60_000));
    return `${diffMinutes} min ago`;
  }, [chainCheckedAt]);

  const handleExportAuditChain = useCallback(async () => {
    setExportingChain(true);

    const { data, error } = await supabase.functions.invoke("export-audit-chain", {
      body: { deal_id: dealId },
    });

    if (error) {
      toast.error(error.message || "Failed to export audit chain");
      setExportingChain(false);
      return;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `audit-chain-${dealId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Audit chain exported");
    setExportingChain(false);
  }, [dealId]);

  const showChainFailure = Boolean(chainError) || chainStatus?.valid === false;

  if (loading) return <div className="py-8 text-center text-muted-foreground">Loading...</div>;

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="pivt-card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {showChainFailure ? (
              <Badge variant="destructive" className="gap-2 px-3 py-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                ⚠ Chain integrity check failed
              </Badge>
            ) : chainStatus?.total_events ? (
              <Badge variant="outline" className="gap-2 px-3 py-1 border-validated/30 bg-validated/10 text-validated">
                <ShieldCheck className="h-3.5 w-3.5" />
                ✓ Chain intact — verified {verifiedAgoLabel ?? "just now"}
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2 px-3 py-1">
                {verifyingChain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                {verifyingChain ? "Verifying chain…" : "Chain pending — awaiting first post-migration event"}
              </Badge>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleExportAuditChain} disabled={exportingChain || verifyingChain}>
            {exportingChain ? <Loader2 className="animate-spin" /> : <Download />}
            Export Audit Chain
          </Button>
        </div>

        {showChainFailure && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Chain verification failed</AlertTitle>
            <AlertDescription>
              {chainError ?? `Mismatch detected at sequence ${chainStatus?.broken_at_sequence ?? "unknown"}.`}
            </AlertDescription>
          </Alert>
        )}

        <div className="pivt-card p-12 text-center text-muted-foreground">
          No activity recorded yet.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="pivt-card p-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {showChainFailure ? (
            <Badge variant="destructive" className="gap-2 px-3 py-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              ⚠ Chain integrity check failed
            </Badge>
          ) : chainStatus?.total_events ? (
            <Badge variant="outline" className="gap-2 px-3 py-1 border-validated/30 bg-validated/10 text-validated">
              <ShieldCheck className="h-3.5 w-3.5" />
              ✓ Chain intact — verified {verifiedAgoLabel ?? "just now"}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2 px-3 py-1">
              {verifyingChain ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {verifyingChain ? "Verifying chain…" : "Chain pending — awaiting first post-migration event"}
            </Badge>
          )}

          {chainStatus?.total_events ? (
            <span className="text-xs text-muted-foreground font-mono">
              {chainStatus.total_events} chained event{chainStatus.total_events === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        <Button variant="outline" size="sm" onClick={handleExportAuditChain} disabled={exportingChain || verifyingChain}>
          {exportingChain ? <Loader2 className="animate-spin" /> : <Download />}
          Export Audit Chain
        </Button>
      </div>

      {showChainFailure && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Chain verification failed</AlertTitle>
          <AlertDescription>
            {chainError ?? `Mismatch detected at sequence ${chainStatus?.broken_at_sequence ?? "unknown"}.`}
          </AlertDescription>
        </Alert>
      )}

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
    </div>
  );
}
