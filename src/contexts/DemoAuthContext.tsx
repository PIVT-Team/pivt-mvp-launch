import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'pivt_demo_auth';

interface DemoAuthService {
  isAuthenticated: boolean;
  login: (username: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
}

const DemoAuthContext = createContext<DemoAuthService | null>(null);

export const useDemoAuth = () => {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) throw new Error('useDemoAuth must be used within DemoAuthProvider');
  return ctx;
};

export const DemoAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  });

  const login = useCallback((username: string, password: string) => {
    if (username === 'Demo' && password === 'Pivt2026') {
      localStorage.setItem(STORAGE_KEY, 'true');
      setIsAuthenticated(true);
      return { success: true };
    }
    return { success: false, error: 'Incorrect credentials. Please try again.' };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsAuthenticated(false);
  }, []);

  return (
    <DemoAuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </DemoAuthContext.Provider>
  );
};
