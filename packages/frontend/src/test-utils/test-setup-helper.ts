/**
 * Test setup helper functions
 * This file contains helper functions for setting up tests
 */
import { vi } from 'vitest';
import { setupApiClientMock } from './apiClientMock';
import { setupAllContextMocks } from './contextMocks';

/**
 * Mock for the window.localStorage object
 */
export const createLocalStorageMock = () => {
  let store: Record<string, string> = {};

  const localStorageMock = {
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
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    length: 0, // This will be updated by the getter
  };

  // Add getter for length property
  Object.defineProperty(localStorageMock, 'length', {
    get: () => Object.keys(store).length,
  });

  return localStorageMock;
};

/**
 * Mock for the window.matchMedia function
 */
export const createMatchMediaMock = () => {
  return vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
};

/**
 * Mock for the ResizeObserver class
 */
export const createResizeObserverMock = () => {
  return vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
};

/**
 * Mock for the IntersectionObserver class
 */
export const createIntersectionObserverMock = () => {
  return vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn(),
    root: null,
    rootMargin: '',
    thresholds: [],
  }));
};

/**
 * Setup common browser APIs for testing
 */
export const setupBrowserMocks = () => {
  // Mock localStorage
  const localStorageMock = createLocalStorageMock();
  Object.defineProperty(window, 'localStorage', { value: localStorageMock });

  // Mock matchMedia
  window.matchMedia = createMatchMediaMock();

  // Mock ResizeObserver
  global.ResizeObserver = createResizeObserverMock();

  // Mock IntersectionObserver
  global.IntersectionObserver = createIntersectionObserverMock();

  // Set React Router future flags
  window.REACT_ROUTER_FUTURE_FLAGS = {
    v7_startTransition: true,
    v7_relativeSplatPath: true,
    v7_normalizeFormMethod: true,
  };

  // Mock fetch API
  global.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      blob: () => Promise.resolve(new Blob()),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
      formData: () => Promise.resolve(new FormData()),
      headers: new Headers(),
      status: 200,
      statusText: 'OK',
    }),
  );

  // Return all mocks for additional configuration
  return {
    localStorage: localStorageMock,
    matchMedia: window.matchMedia,
    ResizeObserver: global.ResizeObserver,
    IntersectionObserver: global.IntersectionObserver,
    fetch: global.fetch,
  };
};

/**
 * Patch console methods to filter out noisy warnings
 */
export const setupConsoleMocks = () => {
  // Save original methods
  const originalWarn = console.warn;
  const originalError = console.error;

  // Patch console.warn
  console.warn = vi.fn((...args) => {
    // Filter React Router warnings
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('React Router Future Flag Warning') ||
        args[0].includes('ReactDOM.render is no longer supported') ||
        args[0].includes('unmountComponentAtNode is deprecated'))
    ) {
      return; // Ignore these warnings
    }
    originalWarn.apply(console, args);
  });

  // Patch console.error
  console.error = vi.fn((...args) => {
    // Filter certain errors
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: An update to') || // React update warnings
        args[0].includes('act(...)') || // Act warnings
        args[0].includes('Error: Not implemented')) // JSDOM not implemented errors
    ) {
      return; // Ignore these errors
    }
    originalError.apply(console, args);
  });

  // Return original methods for cleanup
  return {
    restore: () => {
      console.warn = originalWarn;
      console.error = originalError;
    },
  };
};

/**
 * Complete test setup helper that configures all mocks at once
 */
export const setupTest = () => {
  // Setup all browser mocks
  const browserMocks = setupBrowserMocks();

  // Patch console methods
  const consoleMocks = setupConsoleMocks();

  // Setup API client mock
  const apiClient = setupApiClientMock();

  // Setup context mocks
  const contexts = setupAllContextMocks();

  // Return all mocks for additional configuration or cleanup
  return {
    browserMocks,
    consoleMocks,
    apiClient,
    contexts,
    cleanup: () => {
      consoleMocks.restore();
      vi.resetAllMocks();
    },
  };
};
