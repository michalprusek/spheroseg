import React from 'react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProfileProvider } from '@/contexts/ProfileContext';

// Ensure React Router future flags are set
window.REACT_ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_normalizeFormMethod: true,
};

/**
 * A complete test wrapper that includes all necessary context providers
 */
export const AllProvidersWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <ProfileProvider>{children}</ProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

/**
 * A test wrapper with Memory Router (for tests that need URL control)
 */
export const MemoryRouterWrapper: React.FC<{
  children: React.ReactNode;
  initialEntries?: string[];
  initialIndex?: number;
}> = ({ children, initialEntries = ['/'], initialIndex = 0 }) => {
  return (
    <MemoryRouter initialEntries={initialEntries} initialIndex={initialIndex}>
      <LanguageProvider>
        <ThemeProvider>
          <AuthProvider>
            <ProfileProvider>{children}</ProfileProvider>
          </AuthProvider>
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
};

/**
 * A minimal test wrapper - use only for simple components that don't need context
 */
export const MinimalWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};
