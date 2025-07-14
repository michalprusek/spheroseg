// Mock logger before any imports
import { vi } from 'vitest';

// Mock unifiedLogger first since logger.ts re-exports from it
vi.mock('@/utils/logging/unifiedLogger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Now mock logger.ts which re-exports from unifiedLogger
vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';

// Unmock AuthContext to test the real implementation
vi.unmock('@/contexts/AuthContext');
import { AuthProvider, useAuth } from '../AuthContext';

// Mock dependencies
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(() => vi.fn()),
  };
});

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Import authService mocks
import * as authService from '@/services/authService';

// Mock authService
vi.mock('@/services/authService', () => ({
  getAccessToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  setTokens: vi.fn(),
  removeTokens: vi.fn(),
  isAccessTokenExpired: vi.fn(() => true),
  refreshAccessToken: vi.fn(),
  saveCurrentRoute: vi.fn(),
  getLastRoute: vi.fn(() => null),
  clearLastRoute: vi.fn(),
  shouldPersistSession: vi.fn(() => true),
}));

// Mock userProfileService
vi.mock('@/services/userProfileService', () => ({
  default: {
    saveUserSetting: vi.fn(),
    migrateLocalStorageToDatabase: vi.fn().mockResolvedValue(undefined),
    initializeUserSettings: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock error handling
vi.mock('@/utils/enhancedErrorHandling', () => ({
  safeAsync: vi.fn((fn) => fn),
  NetworkErrorType: {},
  getErrorType: vi.fn(),
  showEnhancedError: vi.fn(),
}));

// Mock unifiedCacheService
vi.mock('@/services/unifiedCacheService', () => ({
  deleteByTag: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    withRetry: vi.fn(),
  },
}));


vi.mock('@/utils/enhancedErrorHandling', () => ({
  safeAsync: vi.fn((fn, options) =>
    fn().catch((e) => {
      if (options?.onError) options.onError(e);
      return options?.defaultValue || null;
    }),
  ),
  NetworkErrorType: {
    AUTH_ERROR: 'AUTH_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    SERVER_ERROR: 'SERVER_ERROR',
  },
  getErrorType: vi.fn(() => 'AUTH_ERROR'),
  showEnhancedError: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    store,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create a test component to easily access the context
const TestAuthConsumer = () => {
  const { user, token, loading, signIn, signUp, signOut } = useAuth();

  return (
    <div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="auth-status">{user ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-id">{user?.id || 'no-user'}</div>
      <div data-testid="user-email">{user?.email || 'no-email'}</div>
      <div data-testid="token">{token || 'no-token'}</div>
      <button data-testid="sign-in-btn" onClick={() => signIn('test@example.com', 'password')}>
        Sign In
      </button>
      <button data-testid="sign-up-btn" onClick={() => signUp('test@example.com', 'password', 'Test User')}>
        Sign Up
      </button>
      <button data-testid="sign-out-btn" onClick={() => signOut()}>
        Sign Out
      </button>
    </div>
  );
};

const renderWithAuthProvider = () => {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <TestAuthConsumer />
      </AuthProvider>
    </MemoryRouter>,
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Default mocks for apiClient
    vi.mocked(apiClient.withRetry).mockImplementation(async (fn) => {
      return await fn();
    });
  });

  it('starts unauthenticated when no token exists', async () => {
    // No token in localStorage
    localStorage.removeItem('authToken');
    
    renderWithAuthProvider();

    // Wait for the loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Should be unauthenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
    expect(screen.getByTestId('token')).toHaveTextContent('no-token');
  });

  it('loads and validates existing token from localStorage', async () => {
    // Setup a valid token with authService
    vi.mocked(authService.getAccessToken).mockReturnValue('valid-token');
    vi.mocked(authService.isAccessTokenExpired).mockReturnValue(false);

    // Mock the user response
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 'user-123', email: 'user@example.com' },
    });

    renderWithAuthProvider();

    // Wait for the loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Should be authenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    expect(screen.getByTestId('user-email')).toHaveTextContent('user@example.com');
    expect(screen.getByTestId('token')).toHaveTextContent('valid-token');

    // Verify the API call to validate the token
    expect(apiClient.get).toHaveBeenCalledWith('/api/users/me', expect.any(Object));
  });

  it('handles sign in successfully', async () => {
    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

    // Mock successful login response - AuthContext uses axios directly
    const axios = await import('axios');
    vi.mocked(axios.default.post).mockResolvedValueOnce({
      data: {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        user: { id: 'user-123', email: 'test@example.com' },
        message: 'Login successful',
        tokenType: 'Bearer',
      },
    });

    renderWithAuthProvider();

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Trigger sign in
    await act(async () => {
      screen.getByTestId('sign-in-btn').click();
    });

    // Should be authenticated
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');

    // Should navigate to dashboard
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Login successful');
  });

  it('handles sign up successfully', async () => {
    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

    // Mock successful signup response
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        message: 'Registration successful',
      },
    });

    renderWithAuthProvider();

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Trigger sign up
    await act(async () => {
      screen.getByTestId('sign-up-btn').click();
    });

    // Should show a success result
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/auth/register',
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password',
          name: 'Test User',
          language: 'en',
        }),
        expect.any(Object)
      );
    });
  });

  it('handles sign out correctly', async () => {
    // Setup authenticated state with tokens
    vi.mocked(authService.getAccessToken).mockReturnValue('valid-token');
    vi.mocked(authService.getRefreshToken).mockReturnValue('valid-refresh-token');
    vi.mocked(authService.isAccessTokenExpired).mockReturnValue(false);

    // Mock user response
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 'user-123', email: 'user@example.com' },
    });

    // Mock logout response - AuthContext uses axios directly
    const axios = await import('axios');
    vi.mocked(axios.default.post).mockResolvedValueOnce({
      data: { success: true },
    });

    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

    renderWithAuthProvider();

    // Wait for authentication to complete
    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    });

    // Trigger sign out
    await act(async () => {
      screen.getByTestId('sign-out-btn').click();
    });

    // Should now be unauthenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
    expect(screen.getByTestId('token')).toHaveTextContent('no-token');

    // Should call logout endpoint
    expect(axios.default.post).toHaveBeenCalledWith(
      '/api/auth/logout',
      { refreshToken: 'valid-refresh-token' },
      expect.any(Object)
    );

    // Should navigate to home page
    expect(navigateMock).toHaveBeenCalledWith('/');

    // Should remove user from localStorage
    expect(localStorage.removeItem).toHaveBeenCalledWith('spheroseg_user');

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Signed out successfully');
  });

  it.skip('handles authentication failures correctly', async () => {
    // Setup an invalid token
    vi.mocked(authService.getAccessToken).mockReturnValue('invalid-token');
    vi.mocked(authService.isAccessTokenExpired).mockReturnValue(false);

    // Mock the API to throw auth error immediately
    const error = new Error('Unauthorized');
    (error as any).response = { status: 401 };
    vi.mocked(apiClient.get).mockRejectedValueOnce(error);

    renderWithAuthProvider();

    // Wait for the loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    }, { timeout: 2000 });

    // Should be unauthenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');

    // Should remove invalid tokens
    expect(authService.removeTokens).toHaveBeenCalled();
  });

});
