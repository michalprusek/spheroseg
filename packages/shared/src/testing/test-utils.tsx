/**
 * Common Test Utilities
 * 
 * Provides utilities for testing React components and hooks
 */

import React from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { vi } from 'vitest';
import { TestWrapper } from './mocks/components';

// Custom render function with providers
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
): RenderResult {
  return render(ui, { wrapper: TestWrapper, ...options });
}

// Render hook with providers
export function renderHookWithProviders<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: {
    initialProps?: TProps;
    wrapper?: React.ComponentType<{ children: React.ReactNode }>;
  }
) {
  const Wrapper = options?.wrapper || TestWrapper;
  
  let result: TResult;
  function TestComponent(props: TProps) {
    result = hook(props);
    return null;
  }

  const { rerender, unmount } = render(
    <Wrapper>
      <TestComponent {...(options?.initialProps || {} as TProps)} />
    </Wrapper>
  );

  return {
    result: () => result!,
    rerender: (newProps?: TProps) =>
      rerender(
        <Wrapper>
          <TestComponent {...(newProps || options?.initialProps || {} as TProps)} />
        </Wrapper>
      ),
    unmount,
  };
}

// Async utilities
export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 50
): Promise<void> {
  const startTime = Date.now();
  
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

// Mock timers utilities
export const advanceTimersByTime = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};

export const runAllTimers = async () => {
  await vi.runAllTimersAsync();
};

// Event simulation utilities
export const simulateResize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { writable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, value: height });
  window.dispatchEvent(new Event('resize'));
};

export const simulateNetworkChange = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { writable: true, value: online });
  window.dispatchEvent(new Event(online ? 'online' : 'offline'));
};

export const simulateVisibilityChange = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { writable: true, value: hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

// Error boundary for tests
export class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error, errorInfo: React.ErrorInfo) => void },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div data-testid="error-boundary-fallback">
          <h1>Test Error</h1>
          <p>{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

// Performance testing utilities
export const measureRenderTime = async (
  component: React.ReactElement
): Promise<number> => {
  const startTime = performance.now();
  const { unmount } = render(component);
  const endTime = performance.now();
  unmount();
  return endTime - startTime;
};

export const measureReRenderTime = async (
  component: React.ReactElement,
  updatedProps: any
): Promise<{ initial: number; update: number }> => {
  const startTime = performance.now();
  const { rerender, unmount } = render(component);
  const initialTime = performance.now() - startTime;

  const updateStartTime = performance.now();
  rerender(React.cloneElement(component, updatedProps));
  const updateTime = performance.now() - updateStartTime;

  unmount();
  return { initial: initialTime, update: updateTime };
};

// Accessibility testing utilities
export const checkA11y = async (
  component: React.ReactElement
): Promise<string[]> => {
  const { container } = render(component);
  const violations: string[] = [];

  // Check for basic accessibility issues
  // In real implementation, you would use axe-core here
  
  // Check for alt text on images
  const images = container.querySelectorAll('img');
  images.forEach(img => {
    if (!img.getAttribute('alt')) {
      violations.push(`Image missing alt text: ${img.outerHTML}`);
    }
  });

  // Check for labels on form inputs
  const inputs = container.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    const id = input.getAttribute('id');
    if (id) {
      const label = container.querySelector(`label[for="${id}"]`);
      if (!label) {
        violations.push(`Input missing label: ${input.outerHTML}`);
      }
    }
  });

  // Check for button text
  const buttons = container.querySelectorAll('button');
  buttons.forEach(button => {
    if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
      violations.push(`Button missing text or aria-label: ${button.outerHTML}`);
    }
  });

  return violations;
};

// Snapshot testing utilities
export const createStableSnapshot = (component: React.ReactElement) => {
  // Mock dates and random values for stable snapshots
  const originalDate = Date;
  const originalMath = Math.random;
  
  global.Date = class extends Date {
    constructor() {
      super('2024-01-01T00:00:00.000Z');
    }
    static now() {
      return 1704067200000; // 2024-01-01
    }
  } as any;
  
  Math.random = () => 0.5;

  const { container } = render(component);
  const snapshot = container.innerHTML;

  // Restore originals
  global.Date = originalDate;
  Math.random = originalMath;

  return snapshot;
};

// Export everything
export * from './setup';
export * from './mocks/api';
export * from './mocks/components';
export * from './mocks/files';
export { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';