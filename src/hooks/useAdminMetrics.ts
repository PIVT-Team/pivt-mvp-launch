import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useAdminOverview() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [
        dealsRes,
        usersRes,
        docsRes,
        capTableRes,
        approvalsRes,
        supportRes,
        agentRunsRes,
        discrepanciesRes,
      ] = await Promise.all([
        supabase.from("deals").select("id, status, deal_state, deal_kind, created_at, visibility", { count: "exact" }),
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("contract_documents").select("id", { count: "exact" }),
        supabase.from("cap_table_entries").select("id", { count: "exact" }),
        supabase.from("deal_approvals").select("id, status", { count: "exact" }),
        supabase.from("contact_submissions").select("id, status", { count: "exact" }),
        supabase.from("agent_runs").select("id, status", { count: "exact" }),
        supabase.from("discrepancies").select("id, status, severity", { count: "exact" }),
      ]);

      const deals = dealsRes.data ?? [];
      const approvals = approvalsRes.data ?? [];
      const support = supportRes.data ?? [];
      const agentRuns = agentRunsRes.data ?? [];
      const discrepancies = discrepanciesRes.data ?? [];

      const activeDeals = deals.filter(d => !['settled', 'archived'].includes(d.deal_state) && d.visibility !== 'global_demo');
      const completedDeals = deals.filter(d => d.deal_state === 'settled');
      const stalledDeals = deals.filter(d => d.deal_state === 'conditions_pending' || (d as any).blocked_reason);
      const executionReady = deals.filter(d => d.deal_state === 'ready_for_execution');
      const openTickets = support.filter(s => s.status === 'new' || s.status === 'in_progress');
      const completedRuns = agentRuns.filter(r => r.status === 'completed');
      const criticalDiscrepancies = discrepancies.filter(d => d.severity === 'critical' && d.status === 'open');

      return {
        totalDeals: deals.length,
        activeDeals: activeDeals.length,
        completedDeals: completedDeals.length,
        stalledDeals: stalledDeals.length,
        executionReady: executionReady.length,
        totalUsers: usersRes.count ?? 0,
        totalDocuments: docsRes.count ?? 0,
        totalStakeholders: capTableRes.count ?? 0,
        totalApprovals: approvals.length,
        pendingApprovals: approvals.filter(a => a.status === 'pending').length,
        openTickets: openTickets.length,
        totalTickets: support.length,
        newtonRuns: agentRuns.length,
        newtonSuccessRate: agentRuns.length > 0 ? Math.round((completedRuns.length / agentRuns.length) * 100) : 0,
        criticalAlerts: criticalDiscrepancies.length,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useAdminSupport() {
  return useQuery({
    queryKey: ["admin-support"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}

export function useAdminDealFunnel() {
  return useQuery({
    queryKey: ["admin-deal-funnel"],
    queryFn: async () => {
      const [deals, capTable, docs, approvals, wires, discrepancies] = await Promise.all([
        supabase.from("deals").select("id, deal_state, visibility, created_at").then(r => r.data ?? []),
        supabase.from("cap_table_entries").select("deal_id").then(r => r.data ?? []),
        supabase.from("contract_documents").select("deal_id, doc_type").then(r => r.data ?? []),
        supabase.from("deal_approvals").select("deal_id, status").then(r => r.data ?? []),
        supabase.from("wire_instructions").select("deal_id").then(r => r.data ?? []),
        supabase.from("discrepancies").select("deal_id, status").then(r => r.data ?? []),
      ]);

      const userDeals = deals.filter(d => d.visibility !== 'global_demo');
      const dealsWithStakeholders = new Set(capTable.map(c => c.deal_id));
      const dealsWithDocs = new Set(docs.map(d => d.deal_id));
      const dealsWithWires = new Set(wires.map(w => w.deal_id));
      const dealsWithApprovals = new Set(approvals.map(a => a.deal_id));
      const approvedDeals = new Set(approvals.filter(a => a.status === 'approved').map(a => a.deal_id));

      return {
        created: userDeals.length,
        stakeholderAdded: userDeals.filter(d => dealsWithStakeholders.has(d.id)).length,
        documentsUploaded: userDeals.filter(d => dealsWithDocs.has(d.id)).length,
        wiresUploaded: userDeals.filter(d => dealsWithWires.has(d.id)).length,
        approvalsRequested: userDeals.filter(d => dealsWithApprovals.has(d.id)).length,
        approvalsCompleted: userDeals.filter(d => approvedDeals.has(d.id)).length,
        executionReady: userDeals.filter(d => d.deal_state === 'ready_for_execution').length,
        settled: userDeals.filter(d => d.deal_state === 'settled').length,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useAdminAgentRuns() {
  return useQuery({
    queryKey: ["admin-agent-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

export function useAdminRisks() {
  return useQuery({
    queryKey: ["admin-risks"],
    queryFn: async () => {
      const [discrepancies, deals, approvals] = await Promise.all([
        supabase.from("discrepancies").select("*").eq("status", "open").then(r => r.data ?? []),
        supabase.from("deals").select("id, deal_name, deal_state, deal_number, state_updated_at, visibility")
          .neq("visibility", "global_demo").then(r => r.data ?? []),
        supabase.from("deal_approvals").select("deal_id, status").eq("status", "pending").then(r => r.data ?? []),
      ]);

      const stalledDeals = deals.filter(d => {
        const updatedAt = new Date(d.state_updated_at);
        const daysSince = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        return daysSince > 7 && !['settled', 'archived'].includes(d.deal_state);
      });

      const pendingApprovalDeals = [...new Set(approvals.map(a => a.deal_id))];

      return {
        openDiscrepancies: discrepancies,
        criticalDiscrepancies: discrepancies.filter(d => d.severity === 'critical'),
        stalledDeals,
        pendingApprovalDeals: pendingApprovalDeals.length,
      };
    },
    refetchInterval: 60_000,
  });
}

export function useAdminInsights() {
  return useQuery({
    queryKey: ["admin-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_insights")
        .select("*")
        .order("generated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 120_000,
  });
}

export function useAdminAuditLog() {
  return useQuery({
    queryKey: ["admin-audit-log"],
    queryFn: async () => {
      const [auditEvents, dealEvents] = await Promise.all([
        supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(50).then(r => r.data ?? []),
        supabase.from("deal_events").select("*").order("created_at", { ascending: false }).limit(50).then(r => r.data ?? []),
      ]);
      const combined = [
        ...auditEvents.map(e => ({ ...e, source: 'audit' as const })),
        ...dealEvents.map(e => ({ ...e, source: 'deal' as const, entity_type: 'deal', entity_id: e.deal_id })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return combined.slice(0, 100);
    },
    refetchInterval: 60_000,
  });
}
