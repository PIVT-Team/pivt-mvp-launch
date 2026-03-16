import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DealMetrics, getDealMetrics } from "@/services/dealMetricsService";

export function useDealMetrics(dealId: string | undefined) {
  const [metrics, setMetrics] = useState<DealMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    if (!dealId) {
      setMetrics(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await getDealMetrics(dealId);
      setMetrics(next);
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!dealId) return;

    const channel = supabase
      .channel(`deal-metrics-${dealId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "cap_table_entries", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "contract_documents", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_documents", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "obligations", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "wire_instructions", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_approvals", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "conditions", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "waterfall_tiers", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "tax_forms", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_allocations", filter: `deal_id=eq.${dealId}` }, refetch)
      .on("postgres_changes", { event: "*", schema: "public", table: "escrow_transactions", filter: `deal_id=eq.${dealId}` }, refetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [dealId, refetch]);

  return { metrics, loading, refetch };
}
