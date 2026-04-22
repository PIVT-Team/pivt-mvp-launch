import React, { createContext, useContext, useMemo, useState } from 'react';

export type NewtonWorkspaceTab =
  | 'overview'
  | 'stakeholders'
  | 'deal-inputs'
  | 'verification'
  | 'approvals'
  | 'execution'
  | 'compliance'
  | 'comments'
  | 'ai';

export type NewtonRecordType =
  | 'deal'
  | 'stakeholder'
  | 'document'
  | 'approval'
  | 'payment'
  | 'discrepancy'
  | 'comment'
  | 'entity'
  | null;

interface NewtonContextValue {
  currentDealId?: string;
  currentTab: NewtonWorkspaceTab;
  currentRecordId?: string;
  currentRecordType: NewtonRecordType;
  railForcedOpen: boolean;
  setCurrentTab: (tab: NewtonWorkspaceTab) => void;
  setFocusedRecord: (record: { id?: string; type: NewtonRecordType }) => void;
  openRail: () => void;
  clearRailForcedOpen: () => void;
}

const NewtonContext = createContext<NewtonContextValue | undefined>(undefined);

export const NewtonProvider: React.FC<{
  currentDealId?: string;
  children: React.ReactNode;
}> = ({ currentDealId, children }) => {
  const [currentTab, setCurrentTab] = useState<NewtonWorkspaceTab>('overview');
  const [currentRecordId, setCurrentRecordId] = useState<string | undefined>();
  const [currentRecordType, setCurrentRecordType] = useState<NewtonRecordType>(null);
  const [railForcedOpen, setRailForcedOpen] = useState(false);

  const value = useMemo<NewtonContextValue>(() => ({
    currentDealId,
    currentTab,
    currentRecordId,
    currentRecordType,
    railForcedOpen,
    setCurrentTab,
    setFocusedRecord: ({ id, type }) => {
      setCurrentRecordId(id);
      setCurrentRecordType(type);
    },
    openRail: () => setRailForcedOpen(true),
    clearRailForcedOpen: () => setRailForcedOpen(false),
  }), [currentDealId, currentTab, currentRecordId, currentRecordType, railForcedOpen]);

  return <NewtonContext.Provider value={value}>{children}</NewtonContext.Provider>;
};

export function useNewtonContext() {
  const context = useContext(NewtonContext);
  if (!context) throw new Error('useNewtonContext must be used within NewtonProvider');
  return context;
}