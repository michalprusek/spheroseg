import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockApiClientProvider } from '../../lib/__mocks__/enhanced/apiClient';
import { useAuthApi } from '../../hooks/api/useAuthApi';

// Mock user data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: '2023-05-15T10:00:00Z'
};

const mockLoginResponse = {
  user: mockUser,
  token: 'mock-jwt-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600
};

const mockRegisterData = {
  email: 'new@example.com',
  password: 'Password123!',
  name: 'New User'
};

describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Clear any localStorage mock or actual data
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('login', () => {
    it('should login successfully and store token', async () => {
      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              login: {
                data: mockLoginResponse,
                status: 200
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      let response;
      await act(async () => {
        response = await result.current.login('test@example.com', 'password123');
      });

      expect(response).toEqual(mockLoginResponse);
      expect(localStorage.getItem('authToken')).toBe('mock-jwt-token');
      expect(localStorage.getItem('refreshToken')).toBe('mock-refresh-token');
    });

    it('should handle invalid credentials', async () => {
      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              login: {
                error: new Error('Invalid email or password'),
                status: 401
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await expect(result.current.login('wrong@example.com', 'wrongpassword')).rejects.toThrow('Invalid email or password');
      });

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should handle server errors', async () => {
      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              login: {
                error: new Error('Internal server error'),
                status: 500
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await expect(result.current.login('test@example.com', 'password123')).rejects.toThrow('Internal server error');
      });
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockNewUser = {
        id: 'new-user-id',
        email: mockRegisterData.email,
        name: mockRegisterData.name,
        role: 'user',
        createdAt: '2023-06-20T12:00:00Z'
      };

      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              register: {
                data: { user: mockNewUser },
                status: 201
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      let response;
      await act(async () => {
        response = await result.current.register(mockRegisterData);
      });

      expect(response.user).toEqual(mockNewUser);
      // Registration should not automatically log in the user
      expect(localStorage.getItem('authToken')).toBeNull();
    });

    it('should handle duplicate email error', async () => {
      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              register: {
                error: new Error('Email already in use'),
                status: 409
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await expect(result.current.register({ ...mockRegisterData, email: 'existing@example.com' })).rejects.toThrow('Email already in use');
      });
    });

    it('should handle validation errors', async () => {
      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              register: {
                error: new Error('Password must be at least 8 characters'),
                status: 400
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await expect(result.current.register({ ...mockRegisterData, password: '123' })).rejects.toThrow('Password must be at least 8 characters');
      });
    });
  });

  describe('refreshToken', () => {
    it('should refresh the token successfully', async () => {
      const newTokenResponse = {
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600
      };

      // Set up initial tokens
      localStorage.setItem('authToken', 'old-jwt-token');
      localStorage.setItem('refreshToken', 'old-refresh-token');

      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              refreshToken: {
                data: newTokenResponse,
                status: 200
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      let response;
      await act(async () => {
        response = await result.current.refreshToken();
      });

      expect(response).toEqual(newTokenResponse);
      expect(localStorage.getItem('authToken')).toBe('new-jwt-token');
      expect(localStorage.getItem('refreshToken')).toBe('new-refresh-token');
    });

    it('should handle invalid refresh token', async () => {
      localStorage.setItem('refreshToken', 'expired-refresh-token');

      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              refreshToken: {
                error: new Error('Invalid refresh token'),
                status: 401
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await expect(result.current.refreshToken()).rejects.toThrow('Invalid refresh token');
      });

      // The old tokens should be removed on failure
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('logout', () => {
    it('should log out the user and clear tokens', async () => {
      // Set up initial tokens
      localStorage.setItem('authToken', 'jwt-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              logout: {
                data: { success: true },
                status: 200
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });

    it('should clear tokens even if server call fails', async () => {
      // Set up initial tokens
      localStorage.setItem('authToken', 'jwt-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              logout: {
                error: new Error('Network error'),
                status: 500
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        // This should not throw since we want logout to succeed client-side even if server fails
        await result.current.logout();
      });

      // Tokens should still be cleared
      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should get the current user details successfully', async () => {
      localStorage.setItem('authToken', 'valid-jwt-token');

      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getCurrentUser: {
                data: { user: mockUser },
                status: 200
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      let user;
      await act(async () => {
        user = await result.current.getCurrentUser();
      });

      expect(user).toEqual(mockUser);
    });

    it('should handle unauthorized access', async () => {
      // No token set
      const { result } = renderHook(() => useAuthApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getCurrentUser: {
                error: new Error('Unauthorized'),
                status: 401
              }
            }}
          >
            {children}
          </MockApiClientProvider>
        )
      });

      await act(async () => {
        await expect(result.current.getCurrentUser()).rejects.toThrow('Unauthorized');
      });
    });
  });
});