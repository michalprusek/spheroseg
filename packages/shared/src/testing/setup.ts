/**
 * Shared Testing Setup and Configuration
 * 
 * Provides common setup for all test environments
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom';

// Setup fetch mock
import 'whatwg-fetch';

// Setup global test environment
beforeAll(() => {
  // Mock console methods to reduce noise in tests
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));

  // Mock crypto.subtle for upload service
  if (!global.crypto) {
    global.crypto = {} as Crypto;
  }
  Object.defineProperty(global.crypto, 'subtle', {
    writable: true,
    value: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    }
  });

  // Mock URL.createObjectURL
  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };
  global.localStorage = localStorageMock as any;

  // Mock sessionStorage
  global.sessionStorage = localStorageMock as any;
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

// Cleanup after all tests
afterAll(() => {
  vi.restoreAllMocks();
});

// Global test utilities
export const waitForAsync = (ms = 0): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

export const flushPromises = (): Promise<void> => 
  new Promise(resolve => setImmediate(resolve));

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});

// Export test utilities
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { renderHook, act } from '@testing-library/react-hooks';