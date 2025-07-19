/**
 * Mock Components for Testing
 * 
 * Provides mock implementations of common components
 */

import React from 'react';
import { vi } from 'vitest';

// Mock UI components
export const MockButton = ({ children, onClick, ...props }: any) => (
  <button onClick={onClick} {...props}>
    {children}
  </button>
);

export const MockInput = ({ value, onChange, ...props }: any) => (
  <input 
    value={value} 
    onChange={e => onChange?.(e.target.value)} 
    {...props} 
  />
);

export const MockDialog = ({ open, children }: any) => 
  open ? <div role="dialog">{children}</div> : null;

// Mock context providers
export const MockLanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const mockT = (key: string, _params?: any, defaultValue?: string) => 
    defaultValue || key;

  const value = {
    t: mockT,
    language: 'en',
    setLanguage: vi.fn(),
  };

  return (
    <div data-testid="mock-language-provider" data-context={JSON.stringify(value)}>
      {children}
    </div>
  );
};

export const MockProfileProvider = ({ children, profile = {} }: any) => {
  const defaultProfile = {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    ...profile,
  };

  const value = {
    profile: defaultProfile,
    updateProfile: vi.fn(),
    updateAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    loading: false,
  };

  return (
    <div data-testid="mock-profile-provider" data-context={JSON.stringify(value)}>
      {children}
    </div>
  );
};

export const MockAuthProvider = ({ children, isAuthenticated = true }: any) => {
  const value = {
    isAuthenticated,
    user: isAuthenticated ? { id: 'user_123', email: 'test@example.com' } : null,
    login: vi.fn(),
    logout: vi.fn(),
    loading: false,
  };

  return (
    <div data-testid="mock-auth-provider" data-context={JSON.stringify(value)}>
      {children}
    </div>
  );
};

// Mock hooks
export const useMockLanguage = () => ({
  t: (key: string, _params?: any, defaultValue?: string) => defaultValue || key,
  language: 'en',
  setLanguage: vi.fn(),
});

export const useMockProfile = () => ({
  profile: {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
  },
  updateProfile: vi.fn(),
  updateAvatar: vi.fn(),
  removeAvatar: vi.fn(),
  loading: false,
});

export const useMockAuth = () => ({
  isAuthenticated: true,
  user: { id: 'user_123', email: 'test@example.com' },
  login: vi.fn(),
  logout: vi.fn(),
  loading: false,
});

// Mock toast notifications
export const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
};

// Mock router
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  pathname: '/',
  query: {},
  params: {},
};

export const MockRouterProvider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="mock-router-provider" data-router={JSON.stringify(mockRouter)}>
    {children}
  </div>
);

// Utility to wrap component with all common providers
export const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MockAuthProvider>
    <MockLanguageProvider>
      <MockProfileProvider>
        <MockRouterProvider>
          {children}
        </MockRouterProvider>
      </MockProfileProvider>
    </MockLanguageProvider>
  </MockAuthProvider>
);

// Export mock implementations
export const mocks = {
  Button: MockButton,
  Input: MockInput,
  Dialog: MockDialog,
  toast: mockToast,
  router: mockRouter,
  useLanguage: useMockLanguage,
  useProfile: useMockProfile,
  useAuth: useMockAuth,
};