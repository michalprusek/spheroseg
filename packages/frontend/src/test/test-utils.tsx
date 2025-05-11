import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { LanguageProvider } from '@/contexts/LanguageContext';

// Create a customRender function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'queries'> {
  withRouter?: boolean;
  withReactQuery?: boolean;
  withTheme?: boolean;
  withAuth?: boolean;
  withLanguage?: boolean;
  route?: string;
  queryClient?: QueryClient;
}

/**
 * Custom render function that wraps component with necessary providers
 * Use this instead of the regular render from @testing-library/react
 *
 * @example
 * // With all providers
 * const { container } = customRender(<MyComponent />, { withRouter: true, withTheme: true });
 *
 * // With specific route
 * const { container } = customRender(<MyComponent />, { withRouter: true, route: '/dashboard' });
 */
export function customRender(
  ui: ReactElement,
  {
    withRouter = false,
    withReactQuery = false,
    withTheme = false,
    withAuth = false,
    withLanguage = false,
    route = '/',
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          cacheTime: 0,
        },
      },
    }),
    ...renderOptions
  }: CustomRenderOptions = {},
) {
  // Setup the URL if using router
  if (withRouter) {
    window.history.pushState({}, 'Test page', route);
  }

  // Build nested providers
  const AllProviders = ({ children }: { children: React.ReactNode }) => {
    let result = <>{children}</>;

    if (withLanguage) {
      result = <LanguageProvider>{result}</LanguageProvider>;
    }

    if (withAuth) {
      result = <AuthProvider>{result}</AuthProvider>;
    }

    if (withTheme) {
      result = <ThemeProvider>{result}</ThemeProvider>;
    }

    if (withReactQuery) {
      result = <QueryClientProvider client={queryClient}>{result}</QueryClientProvider>;
    }

    if (withRouter) {
      result = <BrowserRouter>{result}</BrowserRouter>;
    }

    return result;
  };

  // Setup userEvent
  const user = userEvent.setup();

  return {
    user,
    queryClient,
    ...render(ui, { wrapper: AllProviders, ...renderOptions }),
  };
}

/**
 * Wait for a specific amount of time (useful for animations, transitions)
 * @param ms Milliseconds to wait
 */
export const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Create a mock for the IntersectionObserver
 * @param isIntersecting Whether the element is intersecting
 */
export function mockIntersectionObserver(isIntersecting = true) {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();

  window.IntersectionObserver = vi.fn().mockImplementation((callback) => {
    callback([{ isIntersecting }], { observe, unobserve, disconnect });

    return {
      observe,
      unobserve,
      disconnect,
    };
  });

  return { observe, unobserve, disconnect };
}

/**
 * Mock implementation of ResizeObserver
 */
export function mockResizeObserver() {
  const observe = vi.fn();
  const unobserve = vi.fn();
  const disconnect = vi.fn();

  window.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe,
    unobserve,
    disconnect,
  }));

  return { observe, unobserve, disconnect };
}

/**
 * Create a partial mock object with type safety
 */
export const createMock = <T extends object>(overrides: Partial<T> = {}): T => {
  return overrides as T;
};

/**
 * Simple method to mock a promise that resolves after a delay
 */
export const delayedPromise = <T,>(data: T, ms = 10) =>
  new Promise<T>((resolve) => setTimeout(() => resolve(data), ms));

export * from '@testing-library/react';
export { userEvent };
