import React from 'react';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { PIVTCompleteUnified } from '@/components/pivt-complete';

const PIVTCompletePage: React.FC = () => {
  return (
    <ViewModeProvider>
      <PIVTCompleteUnified />
    </ViewModeProvider>
  );
};

export default PIVTCompletePage;
