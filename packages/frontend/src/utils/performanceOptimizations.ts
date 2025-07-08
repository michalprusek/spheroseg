/**
 * Performance optimization utilities for React components
 */

import { ComponentType, memo } from 'react';

/**
 * Custom memo comparison function that performs deep equality check
 * on specific props while ignoring functions and callbacks
 */
export function arePropsEqual<P extends Record<string, any>>(
  prevProps: P,
  nextProps: P,
  propsToCompare?: (keyof P)[]
): boolean {
  const keys = propsToCompare || (Object.keys(prevProps) as (keyof P)[]);
  
  return keys.every((key) => {
    const prev = prevProps[key];
    const next = nextProps[key];
    
    // Skip function comparisons (they're usually callbacks)
    if (typeof prev === 'function' && typeof next === 'function') {
      return true;
    }
    
    // Deep equality for objects
    if (typeof prev === 'object' && typeof next === 'object') {
      return JSON.stringify(prev) === JSON.stringify(next);
    }
    
    return prev === next;
  });
}

/**
 * Enhanced memo wrapper with custom comparison
 */
export function withMemo<P extends object>(
  Component: ComponentType<P>,
  propsToCompare?: (keyof P)[]
): ComponentType<P> {
  return memo(Component, (prevProps, nextProps) =>
    arePropsEqual(prevProps, nextProps, propsToCompare)
  );
}

/**
 * Debounce hook for expensive operations
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Throttle hook for rate limiting
 */
export function useThrottle<T>(value: T, interval: number): T {
  const [throttledValue, setThrottledValue] = React.useState(value);
  const lastUpdated = React.useRef(Date.now());

  React.useEffect(() => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdated.current;

    if (timeSinceLastUpdate >= interval) {
      lastUpdated.current = now;
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastUpdated.current = Date.now();
        setThrottledValue(value);
      }, interval - timeSinceLastUpdate);

      return () => clearTimeout(timer);
    }
  }, [value, interval]);

  return throttledValue;
}

/**
 * Virtual list hook for rendering large lists efficiently
 */
export function useVirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = React.useState(0);

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex + 1);
  const totalHeight = items.length * itemHeight;
  const offsetY = startIndex * itemHeight;

  return {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll: (e: React.UIEvent<HTMLElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  ref: React.RefObject<Element>,
  options?: IntersectionObserverInit
): boolean {
  const [isIntersecting, setIsIntersecting] = React.useState(false);

  React.useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [ref, options]);

  return isIntersecting;
}

// Import React for hooks
import * as React from 'react';