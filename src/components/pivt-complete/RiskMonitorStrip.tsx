import React, { useEffect, useMemo, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { AlertTriangle, Clock3, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { usePIVTStore } from "@/stores/pivtStore";
import { Badge } from "@/components/ui/badge";

type RiskAlert = {
  id: string;
  dealId: string;
  dealName: string;
  description: string;
  elapsedLabel: string;
  step: string;
  sub?: string;
  tone: "blocking" | "warning";
};

const FALLBACK_ALERTS: RiskAlert[] = [
  {
    id: "atlas-kyc",
    dealId: "atlas",
    dealName: "Project ATLAS",
    description: "2 counterparties still need KYC clearance",
    elapsedLabel: "6h active",
    step: "stakeholders",
    sub: "kyc",
    tone: "blocking",
  },
  {
    id: "beacon-docs",
    dealId: "beacon",
    dealName: "Project BEACON",
    description: "Funds flow source document is still missing",
    elapsedLabel: "11h active",
    step: "deal-inputs",
    sub: "contracts",
    tone: "warning",
  },
  {
    id: "cipher-approval",
    dealId: "cipher",
    dealName: "Project CIPHER",
    description: "One client sign-off remains outstanding",
    elapsedLabel: "1d active",
    step: "approvals",
    tone: "warning",
  },
];

export const RiskMonitorStrip: React.FC = () => {
  const { deals, setActiveSection, setSelectedDealId } = usePIVTStore();
  const [alerts, setAlerts] = useState<RiskAlert[]>(FALLBACK_ALERTS);

  useEffect(() => {
    let cancelled = false;

    const loadAlerts = async () => {
      const { data: liveDeals } = await supabase
        .from("deals")
        .select("id, deal_name, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(12);

      if (!liveDeals?.length) {
        if (!cancelled && deals.length > 0) {
          setAlerts(FALLBACK_ALERTS);
        }
        return;
      }

      const dealIds = liveDeals.map((deal) => deal.id);
      const [discRes, approvalsRes, wireRes] = await Promise.all([
        supabase
          .from("discrepancies")
          .select("deal_id, created_at, object_type, severity, status")
          .in("deal_id", dealIds)
          .in("status", ["open", "acknowledged"]),
        supabase
          .from("deal_approvals")
          .select("deal_id, created_at, approval_type, status")
          .in("deal_id", dealIds)
          .eq("status", "pending"),
        supabase
          .from("wire_instructions")
          .select("deal_id, created_at, verification_status")
          .in("deal_id", dealIds)
          .neq("verification_status", "verified"),
      ]);

      const dealMap = new Map(liveDeals.map((deal) => [deal.id, deal]));
      const nextAlerts: RiskAlert[] = [];

      for (const row of discRes.data ?? []) {
        const deal = dealMap.get(row.deal_id);
        if (!deal) continue;
        nextAlerts.push({
          id: `disc-${row.deal_id}-${row.created_at}`,
          dealId: row.deal_id,
          dealName: deal.deal_name,
          description: row.object_type
            ? `${row.object_type.replace(/_/g, " ")} requires resolution`
            : "An unresolved discrepancy is blocking progress",
          elapsedLabel: `${formatDistanceToNowStrict(new Date(row.created_at))} active`,
          step: row.object_type?.toLowerCase().includes("document") ? "verification" : "execution",
          sub: row.object_type?.toLowerCase().includes("document") ? undefined : "discrepancies",
          tone: row.severity === "critical" || row.severity === "high" ? "blocking" : "warning",
        });
      }

      for (const row of approvalsRes.data ?? []) {
        const deal = dealMap.get(row.deal_id);
        if (!deal) continue;
        nextAlerts.push({
          id: `approval-${row.deal_id}-${row.created_at}`,
          dealId: row.deal_id,
          dealName: deal.deal_name,
          description: `${row.approval_type || "Approval"} is still waiting on sign-off`,
          elapsedLabel: `${formatDistanceToNowStrict(new Date(row.created_at))} active`,
          step: "approvals",
          tone: "warning",
        });
      }

      for (const row of wireRes.data ?? []) {
        const deal = dealMap.get(row.deal_id);
        if (!deal) continue;
        nextAlerts.push({
          id: `wire-${row.deal_id}-${row.created_at}`,
          dealId: row.deal_id,
          dealName: deal.deal_name,
          description: "Wire instructions still require verification",
          elapsedLabel: `${formatDistanceToNowStrict(new Date(row.created_at))} active`,
          step: "execution",
          sub: "payments",
          tone: "warning",
        });
      }

      const deduped = nextAlerts
        .sort((a, b) => Number(b.tone === "blocking") - Number(a.tone === "blocking") || a.dealName.localeCompare(b.dealName))
        .filter((alert, index, arr) => arr.findIndex((item) => item.dealId === alert.dealId && item.description === alert.description) === index)
        .slice(0, 10);

      if (!cancelled) {
        setAlerts(deduped.length > 0 ? deduped : FALLBACK_ALERTS);
      }
    };

    loadAlerts();
    return () => {
      cancelled = true;
    };
  }, [deals]);

  const visibleAlerts = useMemo(() => alerts.slice(0, 10), [alerts]);

  const handleOpenAlert = (alert: RiskAlert) => {
    setSelectedDealId(alert.dealId);
    setActiveSection("workspace");
    window.dispatchEvent(new CustomEvent("pivt:navigate-workspace", { detail: { step: alert.step, sub: alert.sub } }));
  };

  return (
    <div className="border-b border-border/30 bg-background/95 px-6 py-2 backdrop-blur-sm">
      <div className="flex items-center gap-3 overflow-x-auto">
        <div className="flex shrink-0 items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5 text-accent" />
          Risk Monitor
        </div>

        {visibleAlerts.map((alert) => (
          <button
            key={alert.id}
            onClick={() => handleOpenAlert(alert)}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs transition-colors hover:bg-muted/40"
          >
            <AlertTriangle className={`h-3.5 w-3.5 ${alert.tone === "blocking" ? "text-blocking" : "text-discrepancy"}`} />
            <span className="font-medium text-foreground">{alert.dealName}</span>
            <span className="text-muted-foreground">{alert.description}</span>
            <Badge variant="outline" className="gap-1 border-border/70 text-[10px] text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              {alert.elapsedLabel}
            </Badge>
          </button>
        ))}
      </div>
    </div>
  );
};
