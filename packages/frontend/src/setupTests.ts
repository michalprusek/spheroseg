/// <reference types="vitest/globals" />

// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Set up React Router future flags for testing
// This ensures the same flags that are in index.html are applied during tests
window.REACT_ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_normalizeFormMethod: true,
};

// Mock matchMedia if needed in tests
window.matchMedia =
  window.matchMedia ||
  function () {
    return {
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
  };

// Polyfill/Mock for ResizeObserver, which is not available in jsdom
// A simple mock implementation without relying on jest.fn()
global.ResizeObserver = class ResizeObserver {
  observe() {
    // do nothing
  }
  unobserve() {
    // do nothing
  }
  disconnect() {
    // do nothing
  }
};

// Mock timers to fix clearInterval issues in jsdom
// Store references to real timer functions
const realSetTimeout = globalThis.setTimeout;
const realClearTimeout = globalThis.clearTimeout;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;

// Ensure timer functions are properly defined in global scope
globalThis.setTimeout = realSetTimeout;
globalThis.clearTimeout = realClearTimeout;
globalThis.setInterval = realSetInterval;
globalThis.clearInterval = realClearInterval;

// Also ensure they're available on window object
if (typeof window !== 'undefined') {
  window.setTimeout = realSetTimeout;
  window.clearTimeout = realClearTimeout;
  window.setInterval = realSetInterval;
  window.clearInterval = realClearInterval;
}
