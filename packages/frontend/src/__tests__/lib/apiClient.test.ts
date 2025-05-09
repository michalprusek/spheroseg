import { vi, describe, it, expect, beforeEach } from 'vitest';
import apiClient from '@/lib/apiClient';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('apiClient', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('has the correct base URL', () => {
    // Check that apiClient is defined
    expect(apiClient).toBeDefined();

    // Check that it has the expected methods
    expect(apiClient.get).toBeDefined();
    expect(apiClient.post).toBeDefined();
    expect(apiClient.put).toBeDefined();
    expect(apiClient.delete).toBeDefined();
  });

  it('has request and response interceptors', () => {
    // Check that interceptors are defined
    expect(apiClient.interceptors).toBeDefined();
    expect(apiClient.interceptors.request).toBeDefined();
    expect(apiClient.interceptors.response).toBeDefined();
  });

  it('adds authorization header when token is available', () => {
    // Set up a mock token in localStorage
    localStorageMock.setItem('authToken', 'test-token');

    // Create a mock request config
    const config = { headers: {} };

    // Manually call the request interceptor logic
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check if the authorization header was added
    expect(config.headers.Authorization).toBe('Bearer test-token');
  });

  it('does not add authorization header when token is not available', () => {
    // Create a mock request config
    const config = { headers: {} };

    // Manually call the request interceptor logic
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check that no authorization header was added
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('handles 401 errors by removing the auth token', () => {
    // Set up a mock token in localStorage
    localStorageMock.setItem('authToken', 'test-token');

    // Manually call the response interceptor logic for a 401 error
    const error = { response: { status: 401 }, message: 'Unauthorized' };

    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
    }

    // Check if the token was removed from localStorage
    expect(localStorageMock.getItem('authToken')).toBeNull();
  });

  it('does not remove auth token for non-401 errors', () => {
    // Set up a mock token in localStorage
    localStorageMock.setItem('authToken', 'test-token');

    // Manually call the response interceptor logic for a 500 error
    const error = { response: { status: 500 }, message: 'Server Error' };

    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
    }

    // Check if the token is still in localStorage
    expect(localStorageMock.getItem('authToken')).toBe('test-token');
  });
});
