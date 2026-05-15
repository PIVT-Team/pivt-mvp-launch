import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { getDealMetrics } from "../dealMetricsService";

// ── Helpers ──
function createChainMock(data: any) {
  const chain: any = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  chain.then = (resolve: any) => resolve({ data: Array.isArray(data) ? data : [], error: null });
  return chain;
}

interface ScenarioData {
  deal?: any;
  stakeholders?: any[];
  contractDocs?: any[];
  dealDocs?: any[];
  obligations?: any[];
  wires?: any[];
  approvals?: any[];
  conditions?: any[];
  waterfall?: any[];
  taxForms?: any[];
  paymentAllocations?: any[];
  escrowTransactions?: any[];
}

function setupScenario(s: ScenarioData) {
  const tableMap: Record<string, any> = {
    deals: s.deal || { id: "d1", status: "active", buyer: "Buyer Co", seller: "Seller Co", target_company: "Target", deal_type: "M&A" },
    cap_table_entries: s.stakeholders || [],
    contract_documents: s.contractDocs || [],
    deal_documents: s.dealDocs || [],
    obligations: s.obligations || [],
    wire_instructions: s.wires || [],
    deal_approvals: s.approvals || [],
    conditions: s.conditions || [],
    waterfall_tiers: s.waterfall || [],
    tax_forms: s.taxForms || [],
    payment_allocations: s.paymentAllocations || [],
    escrow_transactions: s.escrowTransactions || [],
  };

  mockFrom.mockImplementation((table: string) => {
    const data = tableMap[table];
    return createChainMock(data);
  });
}

// ── Scenario 1: Clean Deal ──
describe("Clean Deal — Healthy Close ($185M)", () => {
  beforeEach(() => {
    setupScenario({
      deal: { id: "d1", status: "active", buyer: "CleanTech Ventures", seller: "Greenfield Solar Holdings", target_company: "Greenfield Solar Inc.", deal_type: "Asset Purchase" },
      stakeholders: [
        { id: "s1", role: "Seller", verification_status: "verified" },
        { id: "s2", role: "Buyer", verification_status: "verified" },
      ],
      contractDocs: [
        { id: "cd1", doc_type: "SPA", status: "PARSED" },
        { id: "cd2", doc_type: "FUNDS_FLOW", status: "VERIFIED" },
        { id: "cd3", doc_type: "WIRE_INSTRUCTIONS", status: "VERIFIED" },
        { id: "cd4", doc_type: "ESCROW_AGREEMENT", status: "PARSED" },
        { id: "cd5", doc_type: "DISCLOSURE_SCHEDULES", status: "PARSED" },
        { id: "cd6", doc_type: "BOARD_CONSENT", status: "PARSED" },
        { id: "cd7", doc_type: "OFFICER_CERTIFICATE", status: "PARSED" },
      ],
      wires: [
        { id: "w1", verification_status: "verified" },
        { id: "w2", verification_status: "verified" },
      ],
      approvals: [
        { id: "a1", status: "completed", required: true },
        { id: "a2", status: "completed", required: true },
      ],
      conditions: [
        { id: "c1", status: "SATISFIED" },
        { id: "c2", status: "SATISFIED" },
        { id: "c3", status: "SATISFIED" },
      ],
    });
  });

  it("shows 100% execution readiness", async () => {
    const m = await getDealMetrics("d1");
    expect(m.gates.stakeholdersConfigured).toBe(true);
    expect(m.gates.sellerVerified).toBe(true);
    expect(m.gates.buyerVerified).toBe(true);
    expect(m.gates.spaUploaded).toBe(true);
    expect(m.gates.wireInstructionsUploaded).toBe(true);
    expect(m.gates.paymentsApproved).toBe(true);
    expect(m.gates.approvalsComplete).toBe(true);
    expect(m.gates.readyToClose).toBe(true);
    expect(m.executionPercent).toBe(100);
  });

  it("reports all conditions satisfied", async () => {
    const m = await getDealMetrics("d1");
    expect(m.conditionsSatisfied).toBe(3);
    expect(m.totalConditions).toBe(3);
  });

  it("reports no reconciliation issues", async () => {
    const m = await getDealMetrics("d1");
    expect(m.reconciliationIssues).toHaveLength(0);
  });

  it("stage statuses reflect completion", async () => {
    const m = await getDealMetrics("d1");
    expect(m.stageStatuses.stakeholders).toBe("complete");
    expect(m.stageStatuses.verification).toBe("complete");
    expect(m.stageStatuses.execution).toBe("complete");
  });
});

// ── Scenario 2: Minor Discrepancy (one wire unverified) ──
describe("Minor Discrepancy — Payout Mismatch ($95M)", () => {
  beforeEach(() => {
    setupScenario({
      deal: { id: "d2", status: "active", buyer: "Atlas Freight Corp", seller: "Meridian Logistics Group", target_company: "Meridian Logistics Inc.", deal_type: "M&A" },
      stakeholders: [
        { id: "s1", role: "Seller", verification_status: "verified" },
        { id: "s2", role: "Buyer", verification_status: "verified" },
      ],
      wires: [
        { id: "w1", verification_status: "verified" },
        { id: "w2", verification_status: "verified" },
        { id: "w3", verification_status: "pending" },
      ],
      approvals: [
        { id: "a1", status: "completed", required: true },
        { id: "a2", status: "pending", required: true },
      ],
    });
  });

  it("blocks on unverified wires", async () => {
    const m = await getDealMetrics("d2");
    expect(m.gates.paymentsApproved).toBe(false);
    expect(m.verifiedWireInstructions).toBe(2);
    expect(m.totalWireInstructions).toBe(3);
  });

  it("blocks on incomplete approvals", async () => {
    const m = await getDealMetrics("d2");
    expect(m.gates.approvalsComplete).toBe(false);
    expect(m.grantedRequiredApprovals).toBe(1);
    expect(m.requiredApprovals).toBe(2);
  });

  it("not ready to close", async () => {
    const m = await getDealMetrics("d2");
    expect(m.gates.readyToClose).toBe(false);
    expect(m.executionPercent).toBeLessThan(100);
  });

  it("execution stage is in_progress", async () => {
    const m = await getDealMetrics("d2");
    expect(m.stageStatuses.execution).toBe("in_progress");
  });
});

// ── Scenario 3: Major Mismatch (blocked close) ──
describe("Major Mismatch — Blocked Close ($275M)", () => {
  beforeEach(() => {
    setupScenario({
      deal: { id: "d3", status: "active", buyer: "Titan Strategic Group", seller: "Cipher Health Partners", target_company: "Cipher Health Systems", deal_type: "Merger" },
      stakeholders: [
        { id: "s1", role: "Seller", verification_status: "pending" },
        { id: "s2", role: "Buyer", verification_status: "verified" },
      ],
      wires: [
        { id: "w1", verification_status: "verified" },
        { id: "w2", verification_status: "verified" },
      ],
      approvals: [
        { id: "a1", status: "completed", required: true },
        { id: "a2", status: "declined", required: true },
        { id: "a3", status: "pending", required: true },
      ],
      conditions: [
        { id: "c1", status: "NOT_STARTED" },
        { id: "c2", status: "IN_PROGRESS" },
        { id: "c3", status: "SATISFIED" },
        { id: "c4", status: "NOT_STARTED" },
      ],
    });
  });

  it("seller not verified", async () => {
    const m = await getDealMetrics("d3");
    expect(m.gates.sellerVerified).toBe(false);
  });

  it("approvals blocked with declined entry", async () => {
    const m = await getDealMetrics("d3");
    expect(m.gates.approvalsComplete).toBe(false);
    expect(m.grantedRequiredApprovals).toBe(1);
    expect(m.requiredApprovals).toBe(3);
  });

  it("execution stage is blocked", async () => {
    const m = await getDealMetrics("d3");
    expect(m.stageStatuses.execution).toBe("blocked");
  });

  it("only 1 of 4 conditions satisfied", async () => {
    const m = await getDealMetrics("d3");
    expect(m.conditionsSatisfied).toBe(1);
    expect(m.totalConditions).toBe(4);
  });

  it("not ready to close", async () => {
    const m = await getDealMetrics("d3");
    expect(m.gates.readyToClose).toBe(false);
  });

  it("next action prompts seller verification", async () => {
    const m = await getDealMetrics("d3");
    expect(m.nextRequiredAction).toContain("seller");
  });
});

// ── Edge Cases ──
describe("Edge Cases", () => {
  it("empty deal returns safe defaults", async () => {
    setupScenario({ deal: { id: "empty", status: "draft" } });
    const m = await getDealMetrics("empty");
    expect(m.totalStakeholders).toBe(0);
    expect(m.executionPercent).toBe(0);
    expect(m.readinessPercent).toBe(0);
    expect(m.gates.readyToClose).toBe(false);
    expect(m.nextRequiredAction).toContain("stakeholder");
  });

  it("deal with only buyer fails stakeholdersConfigured", async () => {
    setupScenario({
      deal: { id: "buyer-only", status: "active", buyer: null, seller: null },
      stakeholders: [{ id: "s1", role: "Buyer", verification_status: "verified" }],
    });
    const m = await getDealMetrics("buyer-only");
    expect(m.gates.stakeholdersConfigured).toBe(false);
  });

  it("deal.buyer/seller strings satisfy stakeholdersConfigured without cap_table rows", async () => {
    setupScenario({
      deal: { id: "names-only", status: "active", buyer: "Acme Corp", seller: "Target Inc" },
      stakeholders: [],
    });
    const m = await getDealMetrics("names-only");
    expect(m.gates.stakeholdersConfigured).toBe(true);
  });
});
