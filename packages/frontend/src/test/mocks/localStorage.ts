/**
 * localStorage Mock
 * 
 * Comprehensive localStorage mock for testing that properly simulates
 * browser localStorage behavior including persistence between calls.
 */

import { vi } from 'vitest';

class LocalStorageMock {
  private store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }

  get length(): number {
    return Object.keys(this.store).length;
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store);
    return keys[index] || null;
  }

  // Helper method for tests to set initial state
  __setInitialState(state: Record<string, string>): void {
    this.store = { ...state };
  }

  // Helper method for tests to get current state
  __getState(): Record<string, string> {
    return { ...this.store };
  }

  // Helper method to reset storage
  __reset(): void {
    this.clear();
  }
}

// Create and export the mock
export const localStorageMock = new LocalStorageMock();

// Setup function to install the mock
export function setupLocalStorageMock(initialState?: Record<string, string>) {
  // Set initial state if provided
  if (initialState) {
    localStorageMock.__setInitialState(initialState);
  }

  // Assign to global
  Object.defineProperty(global, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });

  // Also assign to window for browser environment
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });
  }

  return localStorageMock;
}

// Vitest hooks for automatic setup/cleanup
export function setupLocalStorageHooks() {
  beforeEach(() => {
    localStorageMock.__reset();
  });

  afterEach(() => {
    localStorageMock.__reset();
  });
}

export default localStorageMock;