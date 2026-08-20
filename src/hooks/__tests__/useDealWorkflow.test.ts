import { describe, it, expect } from 'vitest';
import { computeWorkflowState, computePipelineStages, type PipelineStage } from '../useDealWorkflow';
import type { DealMetrics } from '@/services/dealMetricsService';

function makeMetrics(overrides: Partial<DealMetrics> = {}): DealMetrics {
  return {
    dealId: 'test',
    dealStatus: 'active',
    totalStakeholders: 0,
    verifiedStakeholders: 0,
    requiredStakeholders: 0,
    requiredVerifiedStakeholders: 0,
    buyerSideStakeholders: 0,
    sellerSideStakeholders: 0,
    totalUploadedDocuments: 0,
    completedDocuments: 0,
    requiredDocuments: 7,
    completedRequiredDocuments: 0,
    totalDealInputs: 0,
    requiredDealInputs: 8,
    completedDealInputs: 0,
    totalObligations: 0,
    confirmedObligations: 0,
    totalWireInstructions: 0,
    verifiedWireInstructions: 0,
    totalApprovals: 0,
    requiredApprovals: 0,
    grantedApprovals: 0,
    grantedRequiredApprovals: 0,
    totalConditions: 0,
    conditionsSatisfied: 0,
    totalSettlementRecords: 0,
    settledRecords: 0,
    readinessPercent: 0,
    executionPercent: 0,
    stageStatuses: {
      overview: 'not_started',
      approvals: 'not_started',
      audit: 'not_started',
      comments: 'not_started',
      stakeholders: 'not_started',
      deal_inputs: 'not_started',
      verification: 'not_started',
      execution: 'not_started',
      settlement: 'not_started',
      compliance: 'not_started',
    },
    gates: {
      stakeholdersConfigured: false,
      sellerVerified: false,
      buyerVerified: false,
      spaUploaded: false,
      wireInstructionsUploaded: false,
      paymentsApproved: false,
      approvalsComplete: false,
      settlementComplete: false,
      readyToClose: false,
    },
    nextRequiredAction: 'Add stakeholders',
    reconciliationIssues: [],
    ...overrides,
  };
}

describe('computeWorkflowState — deterministic pipeline', () => {
  it('null metrics → upload stage, 0%', () => {
    const state = computeWorkflowState(null);
    expect(state.currentStage).toBe('upload');
    expect(state.progressPercent).toBe(0);
    expect(state.isComplete).toBe(false);
  });

  it('empty deal → stuck at upload', () => {
    const state = computeWorkflowState(makeMetrics());
    expect(state.currentStage).toBe('upload');
    expect(state.progressPercent).toBe(0);
  });

  describe('Scenario: Clean Deal (all gates pass)', () => {
    const cleanMetrics = makeMetrics({
      totalStakeholders: 2,
      buyerSideStakeholders: 1,
      sellerSideStakeholders: 1,
      verifiedStakeholders: 2,
      requiredVerifiedStakeholders: 2,
      totalUploadedDocuments: 7,
      completedRequiredDocuments: 7,
      totalWireInstructions: 2,
      verifiedWireInstructions: 2,
      totalApprovals: 2,
      requiredApprovals: 2,
      grantedApprovals: 2,
      grantedRequiredApprovals: 2,
      totalConditions: 3,
      conditionsSatisfied: 3,
      gates: {
        stakeholdersConfigured: true,
        sellerVerified: true,
        buyerVerified: true,
        spaUploaded: true,
        wireInstructionsUploaded: true,
        paymentsApproved: true,
        approvalsComplete: true,
        settlementComplete: false,
        readyToClose: true,
      },
      reconciliationIssues: [],
    });

    it('reaches complete stage', () => {
      const state = computeWorkflowState(cleanMetrics);
      expect(state.currentStage).toBe('complete');
      expect(state.isComplete).toBe(true);
      expect(state.progressPercent).toBe(100);
      expect(state.firstBlocker).toBeNull();
    });

    it('all 5 pipeline stages pass', () => {
      const stages = computePipelineStages(cleanMetrics);
      expect(stages.every(s => s.allPassed)).toBe(true);
    });
  });

  describe('Scenario: Minor Discrepancy (buyer not verified)', () => {
    const minorMetrics = makeMetrics({
      totalStakeholders: 2,
      buyerSideStakeholders: 1,
      sellerSideStakeholders: 1,
      totalUploadedDocuments: 5,
      totalWireInstructions: 3,
      verifiedWireInstructions: 2,
      gates: {
        stakeholdersConfigured: true,
        sellerVerified: true,
        buyerVerified: false,
        spaUploaded: true,
        wireInstructionsUploaded: true,
        paymentsApproved: false,
        approvalsComplete: false,
        settlementComplete: false,
        readyToClose: false,
      },
      reconciliationIssues: [],
    });

    it('stuck at parse (verify) stage', () => {
      const state = computeWorkflowState(minorMetrics);
      expect(state.currentStage).toBe('parse');
      expect(state.isComplete).toBe(false);
    });

    it('upload stage passes, parse does not', () => {
      const stages = computePipelineStages(minorMetrics);
      expect(stages[0].allPassed).toBe(true); // upload
      expect(stages[1].allPassed).toBe(false); // parse
      expect(stages[1].error).toContain('Buyer');
    });
  });

  describe('Scenario: Major Mismatch (critical reconciliation issues)', () => {
    const majorMetrics = makeMetrics({
      totalStakeholders: 2,
      buyerSideStakeholders: 1,
      sellerSideStakeholders: 1,
      totalUploadedDocuments: 5,
      totalWireInstructions: 3,
      verifiedWireInstructions: 1,
      gates: {
        stakeholdersConfigured: true,
        sellerVerified: true,
        buyerVerified: true,
        spaUploaded: true,
        wireInstructionsUploaded: true,
        paymentsApproved: false,
        approvalsComplete: false,
        settlementComplete: false,
        readyToClose: false,
      },
      reconciliationIssues: [
        { code: 'wire_total_mismatch', message: 'Wires exceed deal value by $13.5M', severity: 'error' },
      ],
    });

    it('stuck at reconcile stage', () => {
      const state = computeWorkflowState(majorMetrics);
      expect(state.currentStage).toBe('reconcile');
    });

    it('upload and parse pass, reconcile fails', () => {
      const stages = computePipelineStages(majorMetrics);
      expect(stages[0].allPassed).toBe(true);
      expect(stages[1].allPassed).toBe(true);
      expect(stages[2].allPassed).toBe(false);
      expect(stages[2].error).toContain('critical');
    });

    it('firstBlocker reflects the issue', () => {
      const state = computeWorkflowState(majorMetrics);
      expect(state.firstBlocker).toBeTruthy();
    });
  });

  it('pipeline stages are always in deterministic order', () => {
    const stages = computePipelineStages(makeMetrics());
    const order: PipelineStage[] = ['upload', 'parse', 'reconcile', 'approve', 'execute'];
    expect(stages.map(s => s.stage)).toEqual(order);
  });
});
