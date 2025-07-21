import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthApi } from '../../hooks/api/useAuthApi';
import apiClient from '@/services/api/client';

// Mock user data
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  createdAt: '2023-05-15T10:00:00Z',
};

const mockLoginResponse = {
  user: mockUser,
  token: 'mock-jwt-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
};

const mockRegisterData = {
  email: 'new@example.com',
  password: 'Password123!',
  name: 'New User',
};

describe('Auth API Integration Tests', () => {
  const mockApiClient = apiClient as any;

  beforeEach(() => {
    vi.useFakeTimers();
    // Clear any localStorage mock or actual data
    localStorage.clear();
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
  });

  describe('login', () => {
    it('should login successfully and store token', async () => {
      // Mock the API response
      mockApiClient.post.mockResolvedValue({ data: mockLoginResponse });

      const { result } = renderHook(() => useAuthApi());

      let response;
      await act(async () => {
        response = await result.current.login({ email: 'test@example.com', password: 'password123' });
      });

      expect(response).toEqual(mockLoginResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'test@example.com', password: 'password123' });
    });

    it('should handle invalid credentials', async () => {
      // Mock the API error response
      mockApiClient.post.mockRejectedValue(new Error('Invalid email or password'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await expect(result.current.login({ email: 'wrong@example.com', password: 'wrongpassword' })).rejects.toThrow(
          'Invalid email or password',
        );
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'wrong@example.com', password: 'wrongpassword' });
    });

    it('should handle server errors', async () => {
      // Mock the API error response
      mockApiClient.post.mockRejectedValue(new Error('Internal server error'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await expect(result.current.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow('Internal server error');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'test@example.com', password: 'password123' });
    });
  });

  describe('register', () => {
    it('should register a new user successfully', async () => {
      const mockNewUser = {
        id: 'new-user-id',
        email: mockRegisterData.email,
        name: mockRegisterData.name,
        role: 'user',
        createdAt: '2023-06-20T12:00:00Z',
      };

      // Mock the API response
      mockApiClient.post.mockResolvedValue({ data: { user: mockNewUser } });

      const { result } = renderHook(() => useAuthApi());

      let response;
      await act(async () => {
        response = await result.current.register(mockRegisterData);
      });

      expect(response.user).toEqual(mockNewUser);
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', mockRegisterData);
    });

    it('should handle duplicate email error', async () => {
      // Mock the API error response
      mockApiClient.post.mockRejectedValue(new Error('Email already in use'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await expect(
          result.current.register({
            ...mockRegisterData,
            email: 'existing@example.com',
          }),
        ).rejects.toThrow('Email already in use');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', {
        ...mockRegisterData,
        email: 'existing@example.com',
      });
    });

    it('should handle validation errors', async () => {
      // Mock the API error response
      mockApiClient.post.mockRejectedValue(new Error('Password must be at least 8 characters'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await expect(result.current.register({ ...mockRegisterData, password: '123' })).rejects.toThrow(
          'Password must be at least 8 characters',
        );
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/register', { ...mockRegisterData, password: '123' });
    });
  });

  describe('refreshToken', () => {
    it('should refresh the token successfully', async () => {
      const newTokenResponse = {
        token: 'new-jwt-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
      };

      // Set up initial tokens
      localStorage.setItem('authToken', 'old-jwt-token');
      localStorage.setItem('refreshToken', 'old-refresh-token');

      // Mock the API response
      mockApiClient.post.mockResolvedValue({ data: newTokenResponse });

      const { result } = renderHook(() => useAuthApi());

      let response;
      await act(async () => {
        response = await result.current.refreshToken();
      });

      expect(response).toEqual(newTokenResponse);
      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh');
    });

    it('should handle invalid refresh token', async () => {
      localStorage.setItem('refreshToken', 'expired-refresh-token');

      // Mock the API error response
      mockApiClient.post.mockRejectedValue(new Error('Invalid refresh token'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await expect(result.current.refreshToken()).rejects.toThrow('Invalid refresh token');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/refresh');
    });
  });

  describe('logout', () => {
    it('should log out the user and clear tokens', async () => {
      // Set up initial tokens
      localStorage.setItem('authToken', 'jwt-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      // Mock the API response
      mockApiClient.post.mockResolvedValue({ data: { success: true } });

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('should clear tokens even if server call fails', async () => {
      // Set up initial tokens
      localStorage.setItem('authToken', 'jwt-token');
      localStorage.setItem('refreshToken', 'refresh-token');

      // Mock the API error response
      mockApiClient.post.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        // This should not throw since we want logout to succeed client-side even if server fails
        await expect(result.current.logout()).rejects.toThrow('Network error');
      });

      expect(mockApiClient.post).toHaveBeenCalledWith('/auth/logout');
    });
  });

  describe('getCurrentUser', () => {
    it('should get the current user details successfully', async () => {
      localStorage.setItem('authToken', 'valid-jwt-token');

      // Mock the API response
      mockApiClient.get.mockResolvedValue({ data: { user: mockUser } });

      const { result } = renderHook(() => useAuthApi());

      let user;
      await act(async () => {
        user = await result.current.getCurrentUser();
      });

      expect(user).toEqual(mockUser);
      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
    });

    it('should handle unauthorized access', async () => {
      // No token set
      // Mock the API error response
      mockApiClient.get.mockRejectedValue(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuthApi());

      await act(async () => {
        await expect(result.current.getCurrentUser()).rejects.toThrow('Unauthorized');
      });

      expect(mockApiClient.get).toHaveBeenCalledWith('/auth/me');
    });
  });
});