import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// Create mock contexts that mimic the actual context structure
const LanguageContext = React.createContext({
  language: 'en',
  setLanguage: vi.fn(),
  t: vi.fn((key: string) => key),
  availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
});

const AuthContext = React.createContext({
  user: null,
  isAuthenticated: false,
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
});

const ThemeContext = React.createContext({
  theme: 'light',
  setTheme: vi.fn(),
});

// Mock providers
const MockLanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = {
    language: 'en',
    setLanguage: vi.fn(),
    t: vi.fn((key: string) => key),
    availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  };
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

const MockAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = {
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

const MockThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = {
    theme: 'light' as const,
    setTheme: vi.fn(),
  };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

interface AllTheProvidersProps {
  children: React.ReactNode;
}

export const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MockAuthProvider>
          <MockThemeProvider>
            <MockLanguageProvider>
              {children}
            </MockLanguageProvider>
          </MockThemeProvider>
        </MockAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Export hooks for direct usage
export const useLanguage = () => React.useContext(LanguageContext);
export const useAuth = () => React.useContext(AuthContext);
export const useTheme = () => React.useContext(ThemeContext);