import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { lazyWithRetry, prefetchComponent, createCodeSplitComponent } from '../codeSplitting';

vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    lazy: vi.fn((importFn) => {
      const Component = () => null;
      (Component as any)._importFn = importFn;
      return Component;
    }),
  };
});

describe('codeSplitting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    localStorage.clear();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('lazyWithRetry', () => {
    it('should create a lazy component with retry logic', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => null });
      const component = lazyWithRetry(mockImport);

      expect(vi.mocked(React.lazy)).toHaveBeenCalled();
      expect(component).toBeDefined();
    });

    it('should retry failed imports', async () => {
      const mockImport = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ default: () => null });

      // Call lazyWithRetry first to trigger React.lazy
      const component = lazyWithRetry(mockImport);
      
      // Now get the lazy function that was passed to React.lazy
      const lazyFn = vi.mocked(React.lazy).mock.calls[0][0];

      // Execute the lazy function
      await lazyFn();

      // Should have been called 3 times (2 failures + 1 success)
      expect(mockImport).toHaveBeenCalledTimes(3);
    });

    it('should track failed imports in localStorage', async () => {
      const mockImport = vi.fn().mockRejectedValue(new Error('Import failed'));
      const chunkName = 'test-chunk';

      // Call lazyWithRetry first
      const component = lazyWithRetry(mockImport, { chunkName, retryAttempts: 1 });
      
      // Get the lazy function - need to get the latest call
      const calls = vi.mocked(React.lazy).mock.calls;
      const lazyFn = calls[calls.length - 1][0];

      try {
        await lazyFn();
      } catch (error) {
        // Expected to fail
      }

      const failedImports = JSON.parse(localStorage.getItem('failedImports') || '[]');
      expect(failedImports).toContain(chunkName);
    });

    it('should not retry if chunk previously failed', async () => {
      const chunkName = 'failed-chunk';
      localStorage.setItem('failedImports', JSON.stringify([chunkName]));

      const mockImport = vi.fn().mockRejectedValue(new Error('Import failed'));
      
      // Call lazyWithRetry first
      const component = lazyWithRetry(mockImport, { chunkName });
      
      // Get the lazy function - need to get the latest call
      const calls = vi.mocked(React.lazy).mock.calls;
      const lazyFn = calls[calls.length - 1][0];

      try {
        await lazyFn();
      } catch (error) {
        // Expected to fail
      }

      // Should only be called once (no retries)
      expect(mockImport).toHaveBeenCalledTimes(1);
    });
  });

  describe('prefetchComponent', () => {
    it('should prefetch component resources', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => null });
      const mockFetch = vi.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      await prefetchComponent(mockImport, 'test-component');

      expect(mockImport).toHaveBeenCalled();
    });

    it('should cache prefetched components', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => null });

      await prefetchComponent(mockImport, 'cached-component');
      await prefetchComponent(mockImport, 'cached-component');

      // Should only be called once due to caching
      expect(mockImport).toHaveBeenCalledTimes(1);
    });

    it('should handle prefetch errors gracefully', async () => {
      const mockImport = vi.fn().mockRejectedValue(new Error('Prefetch failed'));

      // Should not throw
      await expect(prefetchComponent(mockImport, 'error-component')).resolves.toBeUndefined();
    });
  });

  describe('createCodeSplitComponent', () => {
    it('should create a component with prefetching support', () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => null });
      const result = createCodeSplitComponent(mockImport, {
        chunkName: 'split-component',
        prefetch: true,
      });

      expect(result).toBeDefined();
      expect(result.Component).toBeDefined();
      expect(result.prefetch).toBeDefined();
      expect(result.preload).toBeDefined();
      expect(vi.mocked(React.lazy)).toHaveBeenCalled();
    });

    it('should provide prefetch function', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => null });
      const result = createCodeSplitComponent(mockImport, {
        chunkName: 'prefetch-component',
      });

      await result.prefetch();
      expect(mockImport).toHaveBeenCalled();
    });

    it('should provide preload function', async () => {
      const mockImport = vi.fn().mockResolvedValue({ default: () => null });
      const result = createCodeSplitComponent(mockImport, {
        chunkName: 'preload-component',
      });

      const module = await result.preload();
      expect(module).toHaveProperty('default');
      expect(mockImport).toHaveBeenCalled();
    });
  });

  describe('integration', () => {
    it('should handle full code splitting flow', async () => {
      const TestComponent = () => React.createElement('div', null, 'Test');
      const mockImport = vi.fn().mockResolvedValue({ default: TestComponent });

      // Create code split component
      const SplitComponent = createCodeSplitComponent(mockImport, {
        chunkName: 'integration-test',
        prefetch: true,
        retryAttempts: 2,
      });

      expect(SplitComponent).toBeDefined();
      expect(vi.mocked(React.lazy)).toHaveBeenCalled();

      // Verify component structure
      expect(SplitComponent.Component).toBeDefined();
      expect(typeof SplitComponent.prefetch).toBe('function');
      expect(typeof SplitComponent.preload).toBe('function');
    });

    it('should track loading performance', async () => {
      const mockImport = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve({ default: () => null }), 100)));

      // Call lazyWithRetry first
      const component = lazyWithRetry(mockImport, { chunkName: 'perf-test' });
      
      // Get the lazy function - need to get the latest call
      const calls = vi.mocked(React.lazy).mock.calls;
      const lazyFn = calls[calls.length - 1][0];

      const start = Date.now();
      await lazyFn();
      const duration = Date.now() - start;

      // Should take at least 100ms
      expect(duration).toBeGreaterThanOrEqual(100);
    });
  });
});
