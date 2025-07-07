import React, { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import i18n from '@/i18n/test-config';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * Unified Testing Utilities
 * Comprehensive testing helpers for SpherosegV4
 */

// Test providers wrapper
interface ProvidersProps {
  children: ReactNode;
  initialRoute?: string;
  routerType?: 'browser' | 'memory';
}

// Default test query client
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// All providers wrapper
export function AllProviders({ 
  children, 
  initialRoute = '/',
  routerType = 'memory'
}: ProvidersProps) {
  const queryClient = createTestQueryClient();
  const Router = routerType === 'browser' ? BrowserRouter : MemoryRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <Router initialEntries={[initialRoute]}>
          <ThemeProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </ThemeProvider>
        </Router>
      </I18nextProvider>
    </QueryClientProvider>
  );
}

// Custom render function
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialRoute?: string;
  routerType?: 'browser' | 'memory';
  withProviders?: boolean;
}

export function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
): RenderResult & { user: ReturnType<typeof userEvent.setup> } {
  const {
    initialRoute = '/',
    routerType = 'memory',
    withProviders = true,
    ...renderOptions
  } = options || {};

  const user = userEvent.setup();

  if (!withProviders) {
    return {
      ...render(ui, renderOptions),
      user,
    };
  }

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AllProviders initialRoute={initialRoute} routerType={routerType}>
      {children}
    </AllProviders>
  );

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    user,
  };
}

// Re-export everything from testing library
export * from '@testing-library/react';
export { customRender as render };

// Test data generators
export * from './generators';

// Mock utilities
export * from './mocks';

// Test helpers
export * from './helpers';

// Assertion utilities
export * from './assertions';

// Test fixtures
export * from './fixtures';