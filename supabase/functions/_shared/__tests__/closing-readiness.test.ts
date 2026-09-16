// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { computeClosingReadiness, type ReadinessInput } from '../closing-readiness.ts';

const base = (over: Partial<ReadinessInput> = {}): ReadinessInput => ({
  deal: { buyer: 'CleanTech', seller: 'Greenfield' },
  stakeholders: [
    { role: 'Buyer', verification_status: 'verified' },
    { role: 'Seller', verification_status: 'verified' },
  ],
  contractDocs: [{ doc_type: 'SPA', status: 'PARSED', is_current: true }],
  dealDocs: [],
  wires: [{ verification_status: 'verified' }],
  approvals: [{ status: 'completed', required: true }],
  discrepancies: [],
  changeEvents: [],
  requirements: [],
  ...over,
});

describe('computeClosingReadiness', () => {
  it('a clean deal can close and has no blockers', () => {
    const r = computeClosingReadiness(base());
    expect(r.canClose).toBe(true);
    expect(r.blockingIssues).toEqual([]);
    expect(Object.values(r.gates).every(Boolean)).toBe(true);
  });

  it('an unverified wire fails the gate and appears as a blocker', () => {
    const r = computeClosingReadiness(base({ wires: [{ verification_status: 'verified' }, { verification_status: 'pending' }] }));
    expect(r.canClose).toBe(false);
    expect(r.gates.paymentsApproved).toBe(false);
    expect(r.blockingIssues.map((b) => b.origin)).toContain('gate');
    expect(r.blockingIssues.find((b) => b.title.includes('wire instructions'))?.action).toMatch(/Verify/);
  });

  it('a blocker discrepancy blocks; a warning does not', () => {
    const warn = computeClosingReadiness(base({ discrepancies: [{ id: 'x', rule_key: 'party_name_alignment', severity: 'warn' }] }));
    expect(warn.canClose).toBe(true);
    const block = computeClosingReadiness(base({ discrepancies: [{
      id: 'd1', rule_key: 'purchase_price_consistency', severity: 'blocker',
      message: 'Purchase price disagrees with the SPA',
      details: { why_it_matters: 'Wires would be cut for the wrong amount.', source: 'SPA §2.1 vs funds flow v3', recommended_action: 'Reconcile the price.' },
    }] }));
    expect(block.canClose).toBe(false);
    expect(block.blockingIssues[0]).toMatchObject({
      origin: 'discrepancy', category: 'funds_flow',
      title: 'Purchase price disagrees with the SPA',
      source: 'SPA §2.1 vs funds flow v3', action: 'Reconcile the price.',
    });
  });

  it('a change event comes first — it describes something that moved', () => {
    const r = computeClosingReadiness(base({
      discrepancies: [{ id: 'd1', rule_key: 'x', severity: 'blocker', message: 'disc' }],
      changeEvents: [{ id: 'c1', change_type: 'wire_details_changed', blocks_closing: true, title: 'Wire details changed' }],
    }));
    expect(r.blockingIssues[0].origin).toBe('change_event');
    expect(r.blockingIssues[0].category).toBe('verification');
  });

  it('an unreviewed AI requirement never blocks on its own', () => {
    const r = computeClosingReadiness(base({ requirements: [
      { id: 'r1', requirement_kind: 'consent', title: 'Northgate consent', status: 'not_started', review_status: 'pending_review', blocks_closing: true, source: 'ai' },
    ] }));
    expect(r.canClose).toBe(true);
    expect(r.counts.requirementsAwaitingReview).toBe(1);
    expect(r.counts.blockingRequirements).toBe(0);
  });

  it('an approved, blocking, open requirement blocks with the right next action', () => {
    const r = computeClosingReadiness(base({ requirements: [
      { id: 'r1', requirement_kind: 'consent', title: 'Northgate consent', status: 'not_started', review_status: 'approved',
        blocks_closing: true, counterparty_name: 'Northgate Bank.', source: 'ai', source_ref: { filename: 'SPA.pdf', clause_ref: '§3.6' } },
    ] }));
    expect(r.canClose).toBe(false);
    const b = r.blockingIssues.find((i) => i.origin === 'requirement')!;
    expect(b.source).toBe('SPA.pdf — §3.6');
    expect(b.action).toBe('Send the consent request to Northgate Bank.');   // trailing period trimmed once
    expect(b.targetSection).toBe('requirements');
  });

  it('an invalidated approval blocks even when every gate passes', () => {
    const r = computeClosingReadiness(base({ approvals: [{ status: 'completed', required: true, invalidated_at: '2026-09-01T00:00:00Z' }] }));
    expect(r.gates.approvalsComplete).toBe(true);
    expect(r.canClose).toBe(false);
    expect(r.counts.invalidatedApprovals).toBe(1);
  });

  it('a superseded document version does not satisfy the SPA gate', () => {
    const r = computeClosingReadiness(base({ contractDocs: [{ doc_type: 'SPA', status: 'PARSED', is_current: false }] }));
    expect(r.gates.spaUploaded).toBe(false);
  });

  it('deal.buyer/seller names satisfy stakeholdersConfigured without rows', () => {
    const r = computeClosingReadiness(base({ stakeholders: [] }));
    expect(r.gates.stakeholdersConfigured).toBe(true);
    expect(r.gates.buyerVerified).toBe(false);   // nobody to verify
  });

  it('every blocker carries what, why, where and what-next', () => {
    const r = computeClosingReadiness(base({ stakeholders: [], contractDocs: [], wires: [], approvals: [] }));
    for (const b of r.blockingIssues) {
      for (const k of ['title', 'reason', 'source', 'action', 'targetSection'] as const) {
        expect(b[k], `${b.id}.${k}`).toBeTruthy();
      }
    }
  });
});

describe('the closing-test seed (scripts/seed-closing-test-deal.sql)', () => {
  // The same rows the seed inserts. If the seed and this drift, one of them is
  // wrong about what the product will show — and this is the one that runs.
  const seeded: ReadinessInput = {
    deal: { buyer: 'CleanTech Ventures, Inc.', seller: 'Meridian Holdings LLC' },
    stakeholders: [
      { role: 'Buyer', verification_status: 'verified' },
      { role: 'Seller', verification_status: 'verified' },
      { role: 'Seller', verification_status: 'pending' },
    ],
    contractDocs: [
      { doc_type: 'SPA', status: 'PARSED', is_current: true },
      { doc_type: 'FUNDS_FLOW', status: 'PARSED', is_current: true },
    ],
    dealDocs: [],
    wires: [{ verification_status: 'verified' }, { verification_status: 'pending' }],
    approvals: [
      { status: 'approved', required: true },
      { status: 'pending', required: true },
      { status: 'approved', required: true, invalidated_at: '2026-09-16T10:00:00Z' },
    ],
    discrepancies: [{
      id: 'd1', rule_key: 'purchase_price_consistency', severity: 'blocker', status: 'open',
      message: 'Purchase price disagrees: SPA says $185,000,000, funds flow v3 says $184,500,000',
      object_type: 'document', details: { why_it_matters: 'w', source: 'SPA §1.1 vs funds flow', recommended_action: 'a' },
    } as never],
    changeEvents: [{
      id: 'c1', change_type: 'wire_details_changed', blocks_closing: true, title: 'Wire details changed for Meridian Holdings LLC',
      what_changed: 'Routing number changed', why_it_matters: 'fraud signature', recommended_action: 'call to confirm',
      source_label: 'Funds flow v2 → v3', object_type: 'wire_instruction',
    }],
    requirements: [
      { id: 'r1', requirement_kind: 'consent', title: 'Northgate Bank consent under the Credit Agreement', status: 'not_started',
        review_status: 'approved', blocks_closing: true, counterparty_name: 'Northgate Bank', source: 'ai',
        source_ref: { filename: 'Greenfield_SPA_Execution.pdf', clause_ref: '§3.6' } },
      { id: 'r2', requirement_kind: 'notice', title: 'Landlord notice', status: 'not_started',
        review_status: 'pending_review', blocks_closing: true, source: 'ai' },
    ],
  };

  it('yields exactly the six blockers the seed header promises, in that order', () => {
    const r = computeClosingReadiness(seeded);
    expect(r.canClose).toBe(false);
    expect(r.blockingIssues.map((b) => b.origin)).toEqual([
      'change_event', 'discrepancy', 'requirement', 'gate', 'gate', 'gate',
    ]);
    expect(r.blockingIssues.map((b) => b.title)).toEqual([
      'Wire details changed for Meridian Holdings LLC',
      'Purchase price disagrees: SPA says $185,000,000, funds flow v3 says $184,500,000',
      'Northgate Bank consent under the Credit Agreement',
      'Seller-side verification incomplete',
      'Not all wire instructions are verified',
      'Required approvals outstanding',
    ]);
    expect(r.counts.invalidatedApprovals).toBe(1);
    expect(r.counts.requirementsAwaitingReview).toBe(1);     // present, not blocking
  });

  it('every one of the six carries a source and a next action Newton can quote', () => {
    for (const b of computeClosingReadiness(seeded).blockingIssues) {
      expect(b.source.length).toBeGreaterThan(0);
      expect(b.action.length).toBeGreaterThan(0);
    }
  });
});
