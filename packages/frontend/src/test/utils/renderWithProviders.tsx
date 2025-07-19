/**
 * Test Render Utilities
 * 
 * Enhanced render function that wraps components with all necessary providers
 * for comprehensive testing.
 */

import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';

// Import context providers
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ProfileProvider } from '@/contexts/ProfileContext';
import { FilterProvider } from '@/contexts/FilterContext';
import { NotificationProvider } from '@/contexts/NotificationContext';

// Mock user for auth context
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
};

// Mock auth context value
const mockAuthContextValue = {
  user: mockUser,
  loading: false,
  error: null,
  signIn: vi.fn().mockResolvedValue({ user: mockUser }),
  signUp: vi.fn().mockResolvedValue({ user: mockUser }),
  signOut: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue(undefined),
  updatePassword: vi.fn().mockResolvedValue(undefined),
};

// Options for customizing the test render
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  // Route configuration
  route?: string;
  initialEntries?: string[];
  
  // Auth configuration
  user?: any;
  isAuthenticated?: boolean;
  
  // Provider configuration
  includeAuth?: boolean;
  includeTheme?: boolean;
  includeLanguage?: boolean;
  includeProfile?: boolean;
  includeFilter?: boolean;
  includeNotification?: boolean;
  
  // Router configuration
  useMemoryRouter?: boolean;
}

// All providers wrapper component
interface AllProvidersProps {
  children: ReactNode;
  options?: CustomRenderOptions;
}

function AllProviders({ children, options = {} }: AllProvidersProps) {
  const {
    route = '/',
    initialEntries = ['/'],
    user = mockUser,
    isAuthenticated = true,
    includeAuth = true,
    includeTheme = true,
    includeLanguage = true,
    includeProfile = true,
    includeFilter = true,
    includeNotification = true,
    useMemoryRouter = false,
  } = options;

  // Create auth value based on options
  const authValue = {
    ...mockAuthContextValue,
    user: isAuthenticated ? user : null,
  };

  // Build the provider tree
  let content = children;

  if (includeNotification) {
    content = <NotificationProvider>{content}</NotificationProvider>;
  }

  if (includeFilter) {
    content = <FilterProvider>{content}</FilterProvider>;
  }

  if (includeProfile) {
    content = <ProfileProvider>{content}</ProfileProvider>;
  }

  if (includeLanguage) {
    content = <LanguageProvider>{content}</LanguageProvider>;
  }

  if (includeTheme) {
    content = <ThemeProvider>{content}</ThemeProvider>;
  }

  if (includeAuth) {
    // Mock AuthProvider since the real one might have complex logic
    content = (
      <AuthProvider value={authValue as any}>
        {content}
      </AuthProvider>
    );
  }

  // Wrap with router
  if (useMemoryRouter) {
    content = (
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path={route} element={content} />
          <Route path="*" element={content} />
        </Routes>
      </MemoryRouter>
    );
  } else {
    content = <BrowserRouter>{content}</BrowserRouter>;
  }

  return <>{content}</>;
}

// Custom render function
export function renderWithProviders(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  const { ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders options={options}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

// Render with specific route
export function renderWithRoute(
  ui: ReactElement,
  route: string,
  options?: CustomRenderOptions
): RenderResult {
  return renderWithProviders(ui, {
    ...options,
    route,
    useMemoryRouter: true,
    initialEntries: [route],
  });
}

// Render without auth (for login/signup pages)
export function renderWithoutAuth(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult {
  return renderWithProviders(ui, {
    ...options,
    isAuthenticated: false,
    user: null,
  });
}

// Re-export everything from testing library
export * from '@testing-library/react';

// Export render functions
export default renderWithProviders;