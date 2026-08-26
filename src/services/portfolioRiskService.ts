/**
 * Portfolio-wide risk, from the database.
 *
 * The Risk Monitor screen showed four invented deals — "Project ATLAS" at 42%
 * readiness with two blockers — to every user, including one looking at their
 * own live transaction. Every number on it was a literal in the component.
 *
 * The shape of the queries follows the portfolio pattern already used by
 * `DealsCover`: a handful of aggregate reads keyed on `deal_id IN (…)`, rather
 * than per-deal fan-out. RLS scopes the deal list, and every later query is
 * bounded by the ids it returned.
 *
 * Deliberately absent: an execution-readiness percentage. That figure has one
 * definition, in `getDealMetrics`, which reads fourteen tables for a single
 * deal. Recomputing it here from a cheaper set of signals would produce a
 * second number that disagrees with the deal's own Execution tab — and a
 * readiness figure that changes depending on which screen you are looking at is
 * worse than no figure at all.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DealRisk {
  id: string;
  dealName: string;
  dealNumber: string;
  isDemo: boolean;
  blockers: number;
  warnings: number;
  infos: number;
  /** The message of the highest-severity open discrepancy, if any. */
  topIssue: string | null;
  pendingApprovals: number;
  unverifiedWires: number;
  lastActivity: string | null;
}

export interface PortfolioRisk {
  deals: DealRisk[];
  totals: {
    blockers: number;
    warnings: number;
    dealsClear: number;
    dealCount: number;
    pendingApprovals: number;
  };
  /** True when more deals exist than were read — the UI must say so. */
  truncated: boolean;
}

const OPEN_STATUSES: Array<"open" | "acknowledged"> = ["open", "acknowledged"];

export async function getPortfolioRisk(limit = 50): Promise<PortfolioRisk> {
  // One extra row tells us whether there are more, without a second count.
  const { data: dealRows, error } = await supabase
    .from("deals")
    .select("id, deal_name, deal_number, is_demo, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit + 1);

  if (error) throw error;

  const truncated = (dealRows?.length ?? 0) > limit;
  const deals = (dealRows ?? []).slice(0, limit);

  const empty: PortfolioRisk = {
    deals: [],
    totals: { blockers: 0, warnings: 0, dealsClear: 0, dealCount: 0, pendingApprovals: 0 },
    truncated: false,
  };
  if (deals.length === 0) return empty;

  const dealIds = deals.map((d) => d.id);

  const [discrepancyRes, approvalRes, wireRes] = await Promise.all([
    supabase
      .from("discrepancies")
      .select("deal_id, severity, message, created_at")
      .in("deal_id", dealIds)
      .in("status", OPEN_STATUSES),
    supabase
      .from("deal_approvals")
      .select("deal_id")
      .in("deal_id", dealIds)
      .eq("status", "pending"),
    supabase
      .from("wire_instructions")
      .select("deal_id, verification_status")
      .in("deal_id", dealIds),
  ]);

  // A failed read must not silently render as "no risk". An empty risk monitor
  // and a broken one look identical, and the wrong one is reassuring.
  for (const res of [discrepancyRes, approvalRes, wireRes]) {
    if (res.error) throw res.error;
  }

  const SEVERITY_RANK: Record<string, number> = { blocker: 0, warn: 1, info: 2 };

  type Bucket = {
    blockers: number;
    warnings: number;
    infos: number;
    /** The single worst open discrepancy, chosen deterministically. */
    worst: { severity: string; message: string; created_at: string } | null;
  };

  const bySeverity = new Map<string, Bucket>();
  for (const id of dealIds) {
    bySeverity.set(id, { blockers: 0, warnings: 0, infos: 0, worst: null });
  }

  for (const d of discrepancyRes.data ?? []) {
    const b = bySeverity.get(d.deal_id);
    if (!b) continue;

    if (d.severity === "blocker") b.blockers += 1;
    else if (d.severity === "warn") b.warnings += 1;
    else b.infos += 1;

    // Highest severity wins; oldest wins a tie, so the message does not change
    // every time the page is loaded.
    const rank = SEVERITY_RANK[d.severity] ?? 3;
    const currentRank = b.worst ? (SEVERITY_RANK[b.worst.severity] ?? 3) : 99;
    if (rank < currentRank || (rank === currentRank && d.created_at < b.worst!.created_at)) {
      b.worst = { severity: d.severity, message: d.message, created_at: d.created_at };
    }
  }

  const approvalCounts = new Map<string, number>();
  for (const a of approvalRes.data ?? []) {
    approvalCounts.set(a.deal_id, (approvalCounts.get(a.deal_id) ?? 0) + 1);
  }

  const unverifiedWires = new Map<string, number>();
  for (const w of wireRes.data ?? []) {
    const verified = String(w.verification_status ?? "").toLowerCase() === "verified";
    if (verified) continue;
    unverifiedWires.set(w.deal_id, (unverifiedWires.get(w.deal_id) ?? 0) + 1);
  }

  const rows: DealRisk[] = deals.map((d) => {
    const b = bySeverity.get(d.id)!;
    return {
      id: d.id,
      dealName: d.deal_name,
      dealNumber: d.deal_number,
      isDemo: Boolean(d.is_demo),
      blockers: b.blockers,
      warnings: b.warnings,
      infos: b.infos,
      topIssue: b.worst?.message ?? null,
      pendingApprovals: approvalCounts.get(d.id) ?? 0,
      unverifiedWires: unverifiedWires.get(d.id) ?? 0,
      lastActivity: d.updated_at ?? null,
    };
  });

  // Worst first: a portfolio view is read top-down, and the deal that cannot
  // close belongs at the top.
  rows.sort((a, b) =>
    b.blockers - a.blockers ||
    b.warnings - a.warnings ||
    (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "")
  );

  return {
    deals: rows,
    totals: {
      blockers: rows.reduce((s, r) => s + r.blockers, 0),
      warnings: rows.reduce((s, r) => s + r.warnings, 0),
      dealsClear: rows.filter((r) => r.blockers === 0 && r.warnings === 0).length,
      dealCount: rows.length,
      pendingApprovals: rows.reduce((s, r) => s + r.pendingApprovals, 0),
    },
    truncated,
  };
}
