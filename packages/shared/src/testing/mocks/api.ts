/**
 * API Mocks for Testing
 * 
 * Provides mock implementations for API calls
 */

import { vi } from 'vitest';
import type { MockedFunction } from 'vitest';

// Mock response builders
export const createSuccessResponse = <T>(data: T, metadata?: any) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ success: true, data, metadata }),
  text: async () => JSON.stringify({ success: true, data, metadata }),
  clone: function() { return this; },
});

export const createErrorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  statusText: message,
  headers: new Headers({ 'content-type': 'application/json' }),
  json: async () => ({ success: false, error: message }),
  text: async () => JSON.stringify({ success: false, error: message }),
  clone: function() { return this; },
});

// Mock fetch implementation
export const mockFetch = vi.fn() as MockedFunction<typeof fetch>;

// Common API mocks
export const mockUploadEndpoints = () => {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Standard upload
    if (url.includes('/api/upload')) {
      return createSuccessResponse({
        id: 'upload_123',
        url: 'https://example.com/image.jpg',
        thumbnailUrl: 'https://example.com/thumb.jpg',
      });
    }

    // Chunked upload init
    if (url.includes('/api/upload/chunked/init')) {
      return createSuccessResponse({
        uploadId: 'chunked_123',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
    }

    // Chunked upload chunk
    if (url.includes('/api/upload/chunked/chunk')) {
      return createSuccessResponse({ success: true });
    }

    // Chunked upload complete
    if (url.includes('/api/upload/chunked/complete')) {
      return createSuccessResponse({
        id: 'upload_456',
        url: 'https://example.com/large-image.jpg',
        thumbnailUrl: 'https://example.com/large-thumb.jpg',
      });
    }

    // Default 404
    return createErrorResponse(404, 'Not Found');
  });

  return mockFetch;
};

export const mockAuthEndpoints = () => {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Login
    if (url.includes('/api/auth/login')) {
      return createSuccessResponse({
        user: {
          id: 'user_123',
          email: 'test@example.com',
          name: 'Test User',
        },
        token: 'mock_jwt_token',
      });
    }

    // Logout
    if (url.includes('/api/auth/logout')) {
      return createSuccessResponse({ success: true });
    }

    // Current user
    if (url.includes('/api/auth/me')) {
      return createSuccessResponse({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      });
    }

    return createErrorResponse(404, 'Not Found');
  });

  return mockFetch;
};

export const mockProjectEndpoints = () => {
  mockFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    // Get projects
    if (url.includes('/api/projects')) {
      return createSuccessResponse([
        {
          id: 'project_1',
          name: 'Test Project 1',
          description: 'Test description',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'project_2',
          name: 'Test Project 2',
          description: 'Another test',
          createdAt: new Date().toISOString(),
        },
      ]);
    }

    // Create project
    if (url.includes('/api/projects') && init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      return createSuccessResponse({
        id: 'project_new',
        ...body,
        createdAt: new Date().toISOString(),
      });
    }

    return createErrorResponse(404, 'Not Found');
  });

  return mockFetch;
};

// WebSocket mock
export class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    setTimeout(() => {
      this.readyState = 1;
      this.onopen?.(new Event('open'));
    }, 0);
  }

  send(data: string | ArrayBuffer | Blob) {
    // Mock send implementation
  }

  close() {
    this.readyState = 3;
    this.onclose?.(new CloseEvent('close'));
  }

  simulateMessage(data: any) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

// Export global mock setup
export const setupAPIMocks = () => {
  global.fetch = mockFetch as any;
  global.WebSocket = MockWebSocket as any;
};

export const resetAPIMocks = () => {
  mockFetch.mockReset();
};