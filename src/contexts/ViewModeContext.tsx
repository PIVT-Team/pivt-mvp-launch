import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ViewMode = 'cover' | 'glass';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    const modeParam = searchParams.get('mode');
    return modeParam === 'glass' ? 'glass' : 'cover';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    const newParams = new URLSearchParams(searchParams);
    if (mode === 'glass') {
      newParams.set('mode', 'glass');
    } else {
      newParams.delete('mode');
    }
    setSearchParams(newParams, { replace: true });
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'cover' ? 'glass' : 'cover');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        toggleViewMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewMode]);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, toggleViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
};

export const useViewMode = () => {
  const context = useContext(ViewModeContext);
  if (!context) throw new Error('useViewMode must be used within a ViewModeProvider');
  return context;
};
