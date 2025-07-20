/**
 * Test utilities for handling React act() warnings in tests
 * These utilities help properly wrap async operations that cause React state updates
 */

import { act } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Wraps an async function in act() to prevent React warnings
 * Use this for any async operations that might cause state updates
 */
export const actAsync = async <T>(fn: () => Promise<T>): Promise<T> => {
  let result: T;
  await act(async () => {
    result = await fn();
  });
  return result!;
};

/**
 * Wraps a synchronous function in act() to prevent React warnings
 * Use this for sync operations that cause immediate state updates
 */
export const actSync = <T>(fn: () => T): T => {
  let result: T;
  act(() => {
    result = fn();
  });
  return result!;
};

/**
 * Waits for a specified amount of time while wrapped in act()
 * Useful for waiting for async effects to complete
 */
export const actWait = async (ms: number = 0): Promise<void> => {
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, ms));
  });
};

/**
 * Flushes all pending promises and timers while wrapped in act()
 * Use this after triggering async operations to ensure they complete
 */
export const actFlush = async (): Promise<void> => {
  await act(async () => {
    // Flush promises
    await new Promise(resolve => setImmediate(resolve));
    // Flush timers
    vi.runAllTimers();
  });
};

/**
 * Helper to suppress React act() warnings for a specific test block
 * Use this sparingly, only when the warnings are expected and not fixable
 */
export const suppressActWarnings = (testFn: () => void | Promise<void>) => {
  return async () => {
    const originalWarn = console.warn;
    console.warn = (...args) => {
      if (args[0] && typeof args[0] === 'string' && args[0].includes('Warning: An update')) {
        return; // Suppress React update warnings
      }
      originalWarn.apply(console, args);
    };

    try {
      await testFn();
    } finally {
      console.warn = originalWarn;
    }
  };
};

/**
 * Wraps a render function to automatically handle initial async effects
 * This prevents act() warnings for components that have async effects during mount
 */
export const renderWithAsyncEffects = async <T>(renderFn: () => T): Promise<T> => {
  let result: T;
  await act(async () => {
    result = renderFn();
    // Give async effects time to run
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  return result!;
};

export default {
  actAsync,
  actSync,
  actWait,
  actFlush,
  suppressActWarnings,
  renderWithAsyncEffects,
};