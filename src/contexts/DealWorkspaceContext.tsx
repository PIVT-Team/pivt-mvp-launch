import React, { createContext, useContext } from 'react';
import type { RealDeal } from '@/hooks/useDealOperations';

interface DealWorkspaceContextValue {
  dealId: string | undefined;
  isDemoDeal: boolean;
  realDeal: RealDeal | null;
}

const DealWorkspaceContext = createContext<DealWorkspaceContextValue>({
  dealId: undefined,
  isDemoDeal: true,
  realDeal: null,
});

export const DealWorkspaceProvider: React.FC<{
  dealId: string | undefined;
  isDemoDeal: boolean;
  realDeal: RealDeal | null;
  children: React.ReactNode;
}> = ({ dealId, isDemoDeal, realDeal, children }) => (
  <DealWorkspaceContext.Provider value={{ dealId, isDemoDeal, realDeal }}>
    {children}
  </DealWorkspaceContext.Provider>
);

export const useDealWorkspace = () => useContext(DealWorkspaceContext);
