/**
 * Tests for performance optimization utilities
 */

import React from 'react';
import { render, act, renderHook, waitFor } from '@testing-library/react';
import {
  arePropsEqual,
  withMemo,
  useDebounce,
  useThrottle,
  useVirtualList,
  useIntersectionObserver,
} from '../performanceOptimizations';

describe('Performance Optimizations', () => {
  describe('arePropsEqual', () => {
    it('should return true for identical primitive props', () => {
      const prev = { a: 1, b: 'test', c: true };
      const next = { a: 1, b: 'test', c: true };
      expect(arePropsEqual(prev, next)).toBe(true);
    });

    it('should return false for different primitive props', () => {
      const prev = { a: 1, b: 'test' };
      const next = { a: 2, b: 'test' };
      expect(arePropsEqual(prev, next)).toBe(false);
    });

    it('should skip function comparisons', () => {
      const fn1 = () => {};
      const fn2 = () => {};
      const prev = { onClick: fn1 };
      const next = { onClick: fn2 };
      expect(arePropsEqual(prev, next)).toBe(true);
    });

    it('should deep compare objects', () => {
      const prev = { data: { x: 1, y: 2 } };
      const next = { data: { x: 1, y: 2 } };
      expect(arePropsEqual(prev, next)).toBe(true);

      const different = { data: { x: 1, y: 3 } };
      expect(arePropsEqual(prev, different)).toBe(false);
    });

    it('should only compare specified props', () => {
      const prev = { a: 1, b: 2, c: 3 };
      const next = { a: 1, b: 3, c: 3 };
      expect(arePropsEqual(prev, next, ['a', 'c'])).toBe(true);
      expect(arePropsEqual(prev, next, ['b'])).toBe(false);
    });
  });

  describe('withMemo', () => {
    it('should memoize component and prevent unnecessary renders', () => {
      let renderCount = 0;

      const TestComponent: React.FC<{ value: number; callback: () => void }> = ({ value }) => {
        renderCount++;
        return <div>{value}</div>;
      };

      const MemoizedComponent = withMemo(TestComponent, ['value']);

      const { rerender } = render(<MemoizedComponent value={1} callback={() => {}} />);

      expect(renderCount).toBe(1);

      // Same value, different callback - should not re-render
      rerender(<MemoizedComponent value={1} callback={() => {}} />);
      expect(renderCount).toBe(1);

      // Different value - should re-render
      rerender(<MemoizedComponent value={2} callback={() => {}} />);
      expect(renderCount).toBe(2);
    });
  });

  describe('useDebounce', () => {
    vi.useFakeTimers();

    it('should debounce value changes', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      expect(result.current).toBe('initial');

      // Update value
      rerender({ value: 'updated', delay: 500 });
      expect(result.current).toBe('initial'); // Still initial

      // Fast forward time
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('updated');
    });

    it('should cancel previous timeout on new value', () => {
      const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
        initialProps: { value: 'initial', delay: 500 },
      });

      rerender({ value: 'first', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      rerender({ value: 'second', delay: 500 });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(result.current).toBe('second');
    });

    vi.useRealTimers();
  });

  describe('useThrottle', () => {
    vi.useFakeTimers();

    it('should throttle value changes', () => {
      const { result, rerender } = renderHook(({ value, interval }) => useThrottle(value, interval), {
        initialProps: { value: 'initial', interval: 1000 },
      });

      expect(result.current).toBe('initial');

      // First update - should be immediate
      rerender({ value: 'first', interval: 1000 });
      expect(result.current).toBe('first');

      // Second update within interval - should be throttled
      rerender({ value: 'second', interval: 1000 });
      expect(result.current).toBe('first');

      // Advance time past interval
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current).toBe('second');
    });

    vi.useRealTimers();
  });

  describe('useVirtualList', () => {
    it('should calculate visible items correctly', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);

      const { result } = renderHook(() =>
        useVirtualList({
          items,
          itemHeight: 50,
          containerHeight: 200,
          overscan: 2,
        }),
      );

      // Should show items 0-5 (4 visible + 2 overscan)
      expect(result.current.visibleItems).toHaveLength(6);
      expect(result.current.visibleItems[0]).toBe(0);
      expect(result.current.visibleItems[5]).toBe(5);
      expect(result.current.totalHeight).toBe(5000); // 100 * 50
      expect(result.current.offsetY).toBe(0);
    });

    it('should update visible items on scroll', () => {
      const items = Array.from({ length: 100 }, (_, i) => i);

      const { result } = renderHook(() =>
        useVirtualList({
          items,
          itemHeight: 50,
          containerHeight: 200,
          overscan: 2,
        }),
      );

      // Simulate scroll
      act(() => {
        const mockEvent = {
          currentTarget: { scrollTop: 250 },
        } as React.UIEvent<HTMLElement>;
        result.current.handleScroll(mockEvent);
      });

      // Should show items starting from index 3 (250 / 50 = 5, minus overscan)
      expect(result.current.visibleItems[0]).toBe(3);
      expect(result.current.offsetY).toBe(150); // 3 * 50
    });
  });

  describe('useIntersectionObserver', () => {
    // Mock IntersectionObserver
    const mockIntersectionObserver = vi.fn();
    mockIntersectionObserver.mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    });
    window.IntersectionObserver = mockIntersectionObserver as any;

    it('should observe element and report intersection', async () => {
      const ref = React.createRef<HTMLDivElement>();

      const { result } = renderHook(() => useIntersectionObserver(ref));

      // Initially not intersecting
      expect(result.current).toBe(false);

      // Create element
      const div = document.createElement('div');
      (ref as any).current = div;

      // Trigger observer callback
      const observerCallback = mockIntersectionObserver.mock.calls[0][0];
      act(() => {
        observerCallback([{ isIntersecting: true }]);
      });

      await waitFor(() => {
        expect(result.current).toBe(true);
      });
    });

    it('should accept custom options', () => {
      const ref = React.createRef<HTMLDivElement>();
      const options = { threshold: 0.5, rootMargin: '10px' };

      renderHook(() => useIntersectionObserver(ref, options));

      expect(mockIntersectionObserver).toHaveBeenCalledWith(expect.any(Function), options);
    });
  });
});
