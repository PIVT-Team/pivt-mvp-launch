/**
 * useDealWorkflow — Deterministic deal pipeline hook
 *
 * Derives a strict pipeline stage from canonical deal metrics:
 *   UPLOAD → PARSE → RECONCILE → APPROVE → EXECUTE
 *
 * Each stage either passes or returns an explicit error.
 * All UI components should read from this hook for pipeline state.
 */

import { useMemo } from 'react';
import type { DealMetrics } from '@/services/dealMetricsService';

// ── Pipeline Stages ──
export type PipelineStage =
  | 'upload'
  | 'parse'
  | 'reconcile'
  | 'approve'
  | 'execute'
  | 'complete';

export interface PipelineGate {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  fixAction?: { step: string; sub?: string };
}

export interface PipelineStageInfo {
  stage: PipelineStage;
  label: string;
  description: string;
  gates: PipelineGate[];
  allPassed: boolean;
  error: string | null;
}

export interface DealWorkflowState {
  /** Current pipeline stage (first incomplete stage) */
  currentStage: PipelineStage;
  /** All stages with their gate states */
  stages: PipelineStageInfo[];
  /** Overall pipeline progress 0-100 */
  progressPercent: number;
  /** Whether every stage is complete */
  isComplete: boolean;
  /** First blocking error across all stages */
  firstBlocker: string | null;
  /** Human-readable next action */
  nextAction: string;
}

// ── Pure computation (testable without hooks) ──

export function computePipelineStages(m: DealMetrics | null): PipelineStageInfo[] {
  if (!m) {
    return getEmptyStages();
  }

  const upload: PipelineGate[] = [
    {
      id: 'stakeholders',
      label: 'Stakeholders configured',
      passed: m.gates.stakeholdersConfigured,
      detail: `${m.totalStakeholders} total · Buyer: ${m.buyerSideStakeholders > 0 ? '✓' : '✗'} · Seller: ${m.sellerSideStakeholders > 0 ? '✓' : '✗'}`,
      fixAction: { step: 'stakeholders', sub: 'deal-parties' },
    },
    {
      id: 'documents',
      label: 'Core documents uploaded',
      passed: m.gates.spaUploaded,
      detail: `${m.totalUploadedDocuments} uploaded · ${m.completedRequiredDocuments}/${m.requiredDocuments} required`,
      fixAction: { step: 'deal-inputs', sub: 'contracts' },
    },
    {
      id: 'wires',
      label: 'Wire instructions uploaded',
      passed: m.gates.wireInstructionsUploaded,
      detail: `${m.totalWireInstructions} on file`,
      fixAction: { step: 'deal-inputs', sub: 'wires' },
    },
  ];

  const parse: PipelineGate[] = [
    {
      id: 'seller_verified',
      label: 'Seller-side verified',
      passed: m.gates.sellerVerified,
      detail: m.sellerSideStakeholders > 0
        ? `${m.gates.sellerVerified ? 'All verified' : 'Pending verification'}`
        : 'No seller stakeholders',
      fixAction: { step: 'stakeholders', sub: 'kyc' },
    },
    {
      id: 'buyer_verified',
      label: 'Buyer-side verified',
      passed: m.gates.buyerVerified,
      detail: m.buyerSideStakeholders > 0
        ? `${m.gates.buyerVerified ? 'All verified' : 'Pending verification'}`
        : 'No buyer stakeholders',
      fixAction: { step: 'stakeholders', sub: 'kyc' },
    },
  ];

  const reconcile: PipelineGate[] = [
    {
      id: 'wires_verified',
      label: 'All wires verified',
      passed: m.gates.paymentsApproved,
      detail: `${m.verifiedWireInstructions}/${m.totalWireInstructions} verified`,
      fixAction: { step: 'verification' },
    },
    {
      id: 'no_critical_issues',
      label: 'No critical reconciliation issues',
      passed: m.reconciliationIssues.filter(i => i.severity === 'error').length === 0,
      detail: `${m.reconciliationIssues.filter(i => i.severity === 'error').length} critical issues`,
      fixAction: { step: 'execution', sub: 'discrepancies' },
    },
  ];

  const approve: PipelineGate[] = [
    {
      id: 'approvals',
      label: 'All required approvals granted',
      passed: m.gates.approvalsComplete,
      detail: `${m.grantedRequiredApprovals}/${m.requiredApprovals} required approvals`,
      fixAction: { step: 'approvals' },
    },
    {
      id: 'conditions',
      label: 'Conditions satisfied',
      passed: m.totalConditions === 0 || m.conditionsSatisfied === m.totalConditions,
      detail: m.totalConditions > 0
        ? `${m.conditionsSatisfied}/${m.totalConditions} satisfied`
        : 'No conditions',
      fixAction: { step: 'execution', sub: 'closing' },
    },
  ];

  const execute: PipelineGate[] = [
    {
      id: 'ready_to_close',
      label: 'Ready to close',
      passed: m.gates.readyToClose,
      detail: m.gates.readyToClose ? 'All execution gates passed' : 'Prerequisites incomplete',
      fixAction: { step: 'execution', sub: 'prep' },
    },
  ];

  const buildStage = (
    stage: PipelineStage,
    label: string,
    description: string,
    gates: PipelineGate[]
  ): PipelineStageInfo => {
    const allPassed = gates.every(g => g.passed);
    const failed = gates.filter(g => !g.passed);
    return {
      stage,
      label,
      description,
      gates,
      allPassed,
      error: failed.length > 0 ? failed.map(g => g.label).join('; ') : null,
    };
  };

  return [
    buildStage('upload', 'Upload', 'Upload stakeholders, documents, and wire instructions', upload),
    buildStage('parse', 'Verify', 'Verify buyer and seller stakeholders', parse),
    buildStage('reconcile', 'Reconcile', 'Verify wires and resolve discrepancies', reconcile),
    buildStage('approve', 'Approve', 'Obtain required approvals and satisfy conditions', approve),
    buildStage('execute', 'Execute', 'Generate wire pack and execute closing', execute),
  ];
}

function getEmptyStages(): PipelineStageInfo[] {
  return [
    { stage: 'upload', label: 'Upload', description: 'Upload stakeholders, documents, and wire instructions', gates: [], allPassed: false, error: 'No deal data loaded' },
    { stage: 'parse', label: 'Verify', description: 'Verify buyer and seller stakeholders', gates: [], allPassed: false, error: null },
    { stage: 'reconcile', label: 'Reconcile', description: 'Verify wires and resolve discrepancies', gates: [], allPassed: false, error: null },
    { stage: 'approve', label: 'Approve', description: 'Obtain required approvals and satisfy conditions', gates: [], allPassed: false, error: null },
    { stage: 'execute', label: 'Execute', description: 'Generate wire pack and execute closing', gates: [], allPassed: false, error: null },
  ];
}

export function computeWorkflowState(m: DealMetrics | null): DealWorkflowState {
  const stages = computePipelineStages(m);

  // Current stage = first stage that hasn't passed all gates
  let currentStage: PipelineStage = 'complete';
  for (const s of stages) {
    if (!s.allPassed) {
      currentStage = s.stage;
      break;
    }
  }

  const passedStages = stages.filter(s => s.allPassed).length;
  const progressPercent = Math.round((passedStages / stages.length) * 100);
  const isComplete = stages.every(s => s.allPassed);

  // First blocker
  const firstBlockingStage = stages.find(s => s.error);
  const firstBlocker = firstBlockingStage?.error || null;

  // Next action
  let nextAction = 'Review deal workspace';
  if (!m) {
    nextAction = 'Load deal data';
  } else if (currentStage !== 'complete') {
    const currentInfo = stages.find(s => s.stage === currentStage);
    const firstFailedGate = currentInfo?.gates.find(g => !g.passed);
    nextAction = firstFailedGate?.label || currentInfo?.description || 'Continue workflow';
  } else {
    nextAction = 'All gates passed — ready for execution';
  }

  return {
    currentStage,
    stages,
    progressPercent,
    isComplete,
    firstBlocker,
    nextAction,
  };
}

// ── React Hook ──

export function useDealWorkflow(metrics: DealMetrics | null): DealWorkflowState {
  return useMemo(() => computeWorkflowState(metrics), [metrics]);
}
