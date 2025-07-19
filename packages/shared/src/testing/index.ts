/**
 * Shared Testing Utilities
 * 
 * Main export file for all testing utilities
 */

// Setup and configuration
export * from './setup';

// Test utilities
export * from './test-utils';

// Mocks
export * from './mocks/api';
export * from './mocks/components';
export * from './mocks/files';

// Re-export commonly used testing library functions
export {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  cleanup,
  within,
  prettyDOM,
} from '@testing-library/react';

export { default as userEvent } from '@testing-library/user-event';

// Vitest utilities
export { vi, expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';

// Custom test suites
export const describeIf = (condition: boolean) => 
  condition ? describe : describe.skip;

export const itIf = (condition: boolean) => 
  condition ? it : it.skip;

// Environment checks
export const isCI = process.env['CI'] === 'true';
export const isDebug = process.env['DEBUG'] === 'true';

// Performance benchmarks
export const benchmark = async (
  _name: string,
  fn: () => void | Promise<void>,
  iterations = 100
): Promise<{ mean: number; min: number; max: number; median: number }> => {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const end = performance.now();
    times.push(end - start);
  }

  times.sort((a, b) => a - b);
  
  return {
    mean: times.reduce((a, b) => a + b, 0) / times.length,
    min: times[0] || 0,
    max: times[times.length - 1] || 0,
    median: times[Math.floor(times.length / 2)] || 0,
  };
};

// Test data generators
export const generateId = () => `test_${Math.random().toString(36).substr(2, 9)}`;

export const generateUser = (overrides = {}) => ({
  id: generateId(),
  email: 'test@example.com',
  name: 'Test User',
  avatar: null,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const generateProject = (overrides = {}) => ({
  id: generateId(),
  name: 'Test Project',
  description: 'Test project description',
  userId: generateId(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const generateImage = (overrides = {}) => ({
  id: generateId(),
  projectId: generateId(),
  name: 'test-image.jpg',
  url: 'https://example.com/image.jpg',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  size: 1024000,
  width: 1920,
  height: 1080,
  segmentationStatus: 'pending',
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Assertion helpers
export const expectToBeWithinRange = (value: number, min: number, max: number) => {
  expect(value).toBeGreaterThanOrEqual(min);
  expect(value).toBeLessThanOrEqual(max);
};

export const expectToHaveBeenCalledWithPartial = (
  mock: any,
  partial: Record<string, any>
) => {
  expect(mock).toHaveBeenCalled();
  const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
  expect(lastCall[0]).toMatchObject(partial);
};

// Debug helpers
export const logTestInfo = (info: any) => {
  if (isDebug) {
    console.log('[TEST DEBUG]:', info);
  }
};

export const takeScreenshot = async (element: Element, filename: string) => {
  if (isDebug) {
    // In a real implementation, this would use a screenshot library
    console.log(`[SCREENSHOT]: ${filename}`, element.innerHTML);
  }
};