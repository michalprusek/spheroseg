import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAuth } from './useAuth';
import { AllProviders } from '@/test-utils';
import { server } from '@/test-utils/mocks';
import { rest } from 'msw';
import { testUsers, testAuthStates } from '@/test-utils/fixtures';

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('initializes with unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('logs in user successfully', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toMatchObject({
        email: expect.any(String),
        id: expect.any(String),
      });
      expect(result.current.loading).toBe(false);
    });

    // Check tokens are stored
    expect(localStorage.getItem('token')).toBeTruthy();
    expect(localStorage.getItem('refreshToken')).toBeTruthy();
  });

  it('handles login error', async () => {
    server.use(
      rest.post('/auth/login', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({
            error: 'Invalid credentials',
          })
        );
      })
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await act(async () => {
      try {
        await result.current.login({
          email: 'wrong@example.com',
          password: 'wrongpassword',
        });
      } catch (error) {
        expect(error).toMatchObject({
          message: expect.stringContaining('Invalid credentials'),
        });
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('logs out user', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    // First login
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Then logout
    await act(async () => {
      await result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
    });
  });

  it('registers new user', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await act(async () => {
      await result.current.register({
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        organization: 'Test Org',
      });
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
      });
    });
  });

  it('refreshes token automatically', async () => {
    vi.useFakeTimers();
    
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    // Login
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    const originalToken = localStorage.getItem('token');

    // Fast forward to token refresh time
    await act(async () => {
      vi.advanceTimersByTime(30 * 60 * 1000); // 30 minutes
    });

    await waitFor(() => {
      const newToken = localStorage.getItem('token');
      expect(newToken).not.toBe(originalToken);
      expect(result.current.isAuthenticated).toBe(true);
    });

    vi.useRealTimers();
  });

  it('restores session from storage', async () => {
    // Set up stored session
    localStorage.setItem('token', 'stored-token');
    localStorage.setItem('refreshToken', 'stored-refresh-token');
    localStorage.setItem('user', JSON.stringify(testUsers.researcher));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toMatchObject({
        id: testUsers.researcher.id,
        email: testUsers.researcher.email,
      });
    });
  });

  it('handles expired token gracefully', async () => {
    server.use(
      rest.get('/users/me', (req, res, ctx) => {
        return res(
          ctx.status(401),
          ctx.json({
            error: 'Token expired',
          })
        );
      }),
      rest.post('/auth/refresh', (req, res, ctx) => {
        return res(
          ctx.json({
            token: 'new-token',
            refreshToken: 'new-refresh-token',
          })
        );
      })
    );

    localStorage.setItem('token', 'expired-token');
    localStorage.setItem('refreshToken', 'valid-refresh-token');

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('new-token');
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  it('updates user profile', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    // Login first
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    const updatedData = {
      name: 'Updated Name',
      organization: 'Updated Org',
    };

    await act(async () => {
      await result.current.updateProfile(updatedData);
    });

    await waitFor(() => {
      expect(result.current.user).toMatchObject(updatedData);
    });
  });

  it('checks permissions correctly', () => {
    const { result, rerender } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    // Not authenticated
    expect(result.current.hasPermission('admin')).toBe(false);

    // Set admin user
    act(() => {
      result.current.setUser(testUsers.admin);
    });

    rerender();

    expect(result.current.hasPermission('admin')).toBe(true);
    expect(result.current.hasPermission('user')).toBe(true);

    // Set regular user
    act(() => {
      result.current.setUser(testUsers.researcher);
    });

    rerender();

    expect(result.current.hasPermission('admin')).toBe(false);
    expect(result.current.hasPermission('researcher')).toBe(true);
  });

  it('handles network errors', async () => {
    server.use(
      rest.post('/auth/login', (req, res) => {
        return res.networkError('Network error');
      })
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await act(async () => {
      try {
        await result.current.login({
          email: 'test@example.com',
          password: 'password123',
        });
      } catch (error) {
        expect(error).toMatchObject({
          message: expect.stringContaining('Network'),
        });
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it('remembers user preference', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
        remember: true,
      });
    });

    expect(localStorage.getItem('rememberMe')).toBe('true');
    expect(localStorage.getItem('rememberedEmail')).toBe('test@example.com');
  });

  it('clears session on 401 responses', async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AllProviders,
    });

    // Login
    await act(async () => {
      await result.current.login({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    // Simulate 401 on any request
    server.use(
      rest.get('*', (req, res, ctx) => {
        return res(ctx.status(401));
      })
    );

    // Make any authenticated request
    await act(async () => {
      try {
        await fetch('/api/projects', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        });
      } catch {}
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});