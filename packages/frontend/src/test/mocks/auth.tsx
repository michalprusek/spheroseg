import React from 'react';
import { vi } from 'vitest';

// Mock auth context
export const mockUser = {
  id: '1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  imageQuota: 100,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  lastLogin: new Date().toISOString(),
  isActive: true,
  hasCompletedOnboarding: true,
  notificationPreferences: {
    email: true,
    push: true,
  },
};

export const mockAuthContext = {
  user: null,
  token: null,
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  updateUser: vi.fn(),
  refreshToken: vi.fn(),
  isAuthenticated: false,
  isOnboarding: false,
  completeOnboarding: vi.fn(),
};

const AuthContext = React.createContext(mockAuthContext);

export const MockAuthProvider = ({ children, value = mockAuthContext }: {
  children: React.ReactNode;
  value?: typeof mockAuthContext;
}) => {
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Setup module mock
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: MockAuthProvider,
  useAuth,
}));