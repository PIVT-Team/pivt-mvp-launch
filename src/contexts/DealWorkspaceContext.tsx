import React, { createContext, useContext } from 'react';
import type { RealDeal } from '@/hooks/useDealOperations';
import type { DealMetrics } from '@/services/dealMetricsService';
import type { DealWorkflowState } from '@/hooks/useDealWorkflow';

interface DealWorkspaceContextValue {
  dealId: string | undefined;
  isDemoDeal: boolean;
  realDeal: RealDeal | null;
  /** Canonical deal metrics — single source of truth for all components */
  metrics: DealMetrics | null;
  metricsLoading: boolean;
  /** Deterministic pipeline state derived from metrics */
  workflow: DealWorkflowState | null;
  /** Refetch metrics (triggers realtime update) */
  refetchMetrics: () => void;
}

const DealWorkspaceContext = createContext<DealWorkspaceContextValue>({
  dealId: undefined,
  isDemoDeal: true,
  realDeal: null,
  metrics: null,
  metricsLoading: true,
  workflow: null,
  refetchMetrics: () => {},
});

export const DealWorkspaceProvider: React.FC<{
  dealId: string | undefined;
  isDemoDeal: boolean;
  realDeal: RealDeal | null;
  metrics: DealMetrics | null;
  metricsLoading: boolean;
  workflow: DealWorkflowState | null;
  refetchMetrics: () => void;
  children: React.ReactNode;
}> = ({ dealId, isDemoDeal, realDeal, metrics, metricsLoading, workflow, refetchMetrics, children }) => (
  <DealWorkspaceContext.Provider value={{ dealId, isDemoDeal, realDeal, metrics, metricsLoading, workflow, refetchMetrics }}>
    {children}
  </DealWorkspaceContext.Provider>
);

export const useDealWorkspace = () => useContext(DealWorkspaceContext);
