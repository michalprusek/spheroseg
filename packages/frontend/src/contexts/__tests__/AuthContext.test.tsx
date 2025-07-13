// Mock logger before any imports
import { vi } from 'vitest';
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
  },
}));

// Mock error handling
vi.mock('@/utils/enhancedErrorHandling', () => ({
  safeAsync: vi.fn((fn) => fn),
  NetworkErrorType: {},
  getErrorType: vi.fn(),
  showEnhancedError: vi.fn(),
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    withRetry: vi.fn(),
  },
}));

vi.mock('@/utils/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
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

  it('starts with loading state and transitions to unauthenticated when no token exists', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null });

    renderWithAuthProvider();

    // Initially in loading state
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

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
    // Setup a valid token in localStorage
    localStorage.setItem('authToken', 'valid-token');

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
    expect(apiClient.get).toHaveBeenCalledWith('/users/me');
  });

  it('handles sign in in development mode', async () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    // Set to development
    process.env.NODE_ENV = 'development';

    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

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
    expect(toast.success).toHaveBeenCalled();

    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('handles sign up in development mode', async () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    // Set to development
    process.env.NODE_ENV = 'development';

    const navigateMock = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(navigateMock);

    renderWithAuthProvider();

    // Wait for initial loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Trigger sign up
    await act(async () => {
      screen.getByTestId('sign-up-btn').click();
    });

    // Should redirect to sign in
    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/signin?signupSuccess=true');
    });

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Registration successful\! Please sign in.');

    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('handles sign out correctly', async () => {
    // Setup authenticated state
    localStorage.setItem('authToken', 'valid-token');

    // Mock user response
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: { id: 'user-123', email: 'user@example.com' },
    });

    // Mock logout response
    vi.mocked(apiClient.post).mockResolvedValueOnce({
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
    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout');

    // Should navigate to sign in
    expect(navigateMock).toHaveBeenCalledWith('/sign-in');

    // Should remove token from localStorage
    expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');

    // Should show success toast
    expect(toast.success).toHaveBeenCalledWith('Signed out successfully');
  });

  it('handles authentication failures correctly', async () => {
    // Setup an invalid token
    localStorage.setItem('authToken', 'invalid-token');

    // Mock the API to throw auth error
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Unauthorized'));

    renderWithAuthProvider();

    // Wait for the loading to complete
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Should be unauthenticated
    expect(screen.getByTestId('auth-status')).toHaveTextContent('unauthenticated');

    // Should remove invalid token
    expect(localStorage.removeItem).toHaveBeenCalledWith('authToken');
  });

  it('handles network timeouts with fallback user', async () => {
    // Setup a token
    localStorage.setItem('authToken', 'test-token');

    // Mock a token that can be decoded
    vi.mock('jwt-decode', () => ({
      jwtDecode: vi.fn(() => ({
        sub: 'offline-id',
        email: 'offline@example.com',
      })),
    }));

    // Force timeout by not resolving the promise
    vi.mocked(apiClient.withRetry).mockImplementation(async () => {
      return new Promise(() => {
        // This promise never resolves - simulating timeout
      });
    });

    // Mock the timer
    vi.useFakeTimers();

    renderWithAuthProvider();

    // Fast-forward past all timers
    vi.advanceTimersByTime(35000);

    // Wait for the loading to complete with fallback user
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    // Should be authenticated with fallback user from token
    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('offline-id');
    expect(screen.getByTestId('token')).toHaveTextContent('test-token');

    // Should show warning about offline mode
    expect(toast.warning).toHaveBeenCalled();

    vi.useRealTimers();
  });
});
