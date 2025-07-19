import '@testing-library/jest-dom';
import { vi, afterEach, beforeEach } from 'vitest';
import ResizeObserver from 'resize-observer-polyfill';
import './mocks/i18next';
import './mocks/router';
import './mocks/auth';
import './mocks/logger';
import './mocks/config';
import './mocks/radix';
import './mocks/apiClient';

// Import new mocks
import { setupLocalStorageMock } from './mocks/localStorage';
import { setupWebSocketMocks } from './mocks/websocket';

// Fix missing globals - use direct assignment
// Store references first to avoid any timing issues
const nodeClearInterval = clearInterval;
const nodeSetInterval = setInterval;
const nodeClearTimeout = clearTimeout;
const nodeSetTimeout = setTimeout;

global.clearInterval = nodeClearInterval;
global.setInterval = nodeSetInterval;
global.clearTimeout = nodeClearTimeout;
global.setTimeout = nodeSetTimeout;

// Setup localStorage mock
setupLocalStorageMock();

// Setup WebSocket mocks
setupWebSocketMocks();

// Improve test performance by reducing console noise
global.console.error = vi.fn();
global.console.warn = vi.fn();

// Polyfill for ResizeObserver
global.ResizeObserver = ResizeObserver;

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
  constructor(callback: IntersectionObserverCallback) {
    // Immediately call with empty intersections
    setTimeout(() => {
      callback([], this);
    }, 0);
  }
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// Mock for window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
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

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock element properties not handled by jsdom
Element.prototype.scrollIntoView = vi.fn();
Element.prototype.scrollTo = vi.fn();

// MSW server setup for API mocking
// NOTE: Uncomment the below code to set up MSW in your tests
/*
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
*/

// Import router reset
import { resetRouterMocks } from './mocks/router';

// Reset all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
  resetRouterMocks();
  
  // Clear localStorage
  if (global.localStorage) {
    global.localStorage.clear();
  }
});

// Handle test failures better
vi.setConfig({
  // Timeout for hooks like beforeEach, afterEach, etc
  hookTimeout: 10000,
});

export {};
