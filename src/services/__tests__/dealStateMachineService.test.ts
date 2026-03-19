import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing the service
const mockFrom = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockFrom(...args),
  },
}));

import { computeGates, computeNextState, type DealState } from "../dealStateMachineService";

// ── Helper to create chainable query mock ──
function mockQuery(data: any, error: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  // For non-single queries, resolve on eq
  chain.eq.mockImplementation(() => {
    const next = { ...chain };
    next.then = (resolve: any) => resolve({ data: Array.isArray(data) ? data : [], error });
    return next;
  });
  return chain;
}

function setupMocks(scenario: {
  stakeholders?: any[];
  documents?: any[];
  approvals?: any[];
  payments?: any[];
  conditions?: any[];
  deal?: any;
}) {
  const tables: Record<string, any> = {
    cap_table_entries: scenario.stakeholders || [],
    contract_documents: scenario.documents || [],
    deal_approvals: scenario.approvals || [],
    payment_instructions: scenario.payments || [],
    conditions: scenario.conditions || [],
    deals: scenario.deal || { deal_state: "draft", deal_value: 100000000, escrow_amount: 5000000 },
  };

  mockFrom.mockImplementation((table: string) => {
    const data = tables[table];
    const isSingle = table === "deals";
    const chain: any = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data, error: null });
    // Make it thenable for Promise.all
    chain.then = (resolve: any) => {
      if (isSingle) return chain.single().then((r: any) => resolve(r));
      return resolve({ data: Array.isArray(data) ? data : [], error: null });
    };
    return chain;
  });
}

// ── Tests ──

describe("computeNextState", () => {
  it("advances through all states in order", () => {
    const transitions: [DealState, DealState | null][] = [
      ["draft", "verification_pending"],
      ["verification_pending", "structuring"],
      ["structuring", "conditions_pending"],
      ["conditions_pending", "ready_for_execution"],
      ["ready_for_execution", "executing"],
      ["executing", "settled"],
      ["settled", "archived"],
      ["archived", null],
    ];
    transitions.forEach(([from, to]) => {
      expect(computeNextState(from)).toBe(to);
    });
  });
});

describe("computeGates — Clean Deal (no discrepancies)", () => {
  beforeEach(() => {
    setupMocks({
      stakeholders: [
        { id: "s1", role: "Seller", verification_status: "verified" },
        { id: "s2", role: "Buyer", verification_status: "verified" },
      ],
      documents: [
        { id: "d1", doc_type: "SPA", status: "PARSED" },
        { id: "d2", doc_type: "WIRE_INSTRUCTIONS", status: "PARSED" },
      ],
      approvals: [{ id: "a1", status: "approved" }],
      payments: [{ id: "p1", status: "CONFIRMED" }],
      conditions: [
        { id: "c1", status: "SATISFIED" },
        { id: "c2", status: "WAIVED" },
      ],
      deal: { deal_state: "draft", deal_value: 185000000, escrow_amount: 9250000 },
    });
  });

  it("passes draft gates when buyer + seller exist", async () => {
    const result = await computeGates("deal-1");
    expect(result.currentState).toBe("draft");
    expect(result.gates.every((g) => g.passed)).toBe(true);
    expect(result.allPassed).toBe(true);
    expect(result.suggestedNextState).toBe("verification_pending");
    expect(result.blockedReason).toBeNull();
  });
});

describe("computeGates — Minor Discrepancy (missing buyer verification)", () => {
  beforeEach(() => {
    setupMocks({
      stakeholders: [
        { id: "s1", role: "Seller", verification_status: "verified" },
        { id: "s2", role: "Buyer", verification_status: "pending" },
      ],
      deal: { deal_state: "verification_pending", deal_value: 95000000, escrow_amount: 4750000 },
    });
  });

  it("blocks on buyer verification gate", async () => {
    const result = await computeGates("deal-2");
    expect(result.currentState).toBe("verification_pending");
    expect(result.allPassed).toBe(false);
    expect(result.suggestedNextState).toBeNull();
    expect(result.blockedReason).toContain("Buyer-side verified");

    const sellerGate = result.gates.find((g) => g.key === "seller_verified");
    expect(sellerGate?.passed).toBe(true);

    const buyerGate = result.gates.find((g) => g.key === "buyer_verified");
    expect(buyerGate?.passed).toBe(false);
  });
});

describe("computeGates — Major Mismatch (blocked conditions + declined approvals)", () => {
  beforeEach(() => {
    setupMocks({
      stakeholders: [
        { id: "s1", role: "Seller", verification_status: "verified" },
        { id: "s2", role: "Buyer", verification_status: "verified" },
      ],
      approvals: [
        { id: "a1", status: "approved" },
        { id: "a2", status: "declined" },
      ],
      payments: [{ id: "p1", status: "PENDING" }],
      conditions: [
        { id: "c1", status: "SATISFIED" },
        { id: "c2", status: "NOT_STARTED" },
      ],
      deal: { deal_state: "conditions_pending", deal_value: 275000000, escrow_amount: 27500000 },
    });
  });

  it("fails multiple gates", async () => {
    const result = await computeGates("deal-3");
    expect(result.currentState).toBe("conditions_pending");
    expect(result.allPassed).toBe(false);
    expect(result.suggestedNextState).toBeNull();

    const condGate = result.gates.find((g) => g.key === "conditions_met");
    expect(condGate?.passed).toBe(false);

    const approvalGate = result.gates.find((g) => g.key === "approvals_complete");
    expect(approvalGate?.passed).toBe(false);

    const paymentGate = result.gates.find((g) => g.key === "payments_approved");
    expect(paymentGate?.passed).toBe(false);
  });
});

describe("computeGates — No stakeholders in draft", () => {
  beforeEach(() => {
    setupMocks({
      stakeholders: [],
      deal: { deal_state: "draft", deal_value: 50000000, escrow_amount: 2500000 },
    });
  });

  it("blocks on stakeholder gate", async () => {
    const result = await computeGates("deal-empty");
    expect(result.allPassed).toBe(false);
    expect(result.blockedReason).toContain("Stakeholders configured");
  });
});

describe("computeGates — settled/archived have no gates", () => {
  it("reports all passed for settled state", async () => {
    setupMocks({ deal: { deal_state: "settled", deal_value: 100000000, escrow_amount: 0 } });
    const result = await computeGates("deal-settled");
    expect(result.allPassed).toBe(true);
    expect(result.suggestedNextState).toBe("archived");
  });
});
