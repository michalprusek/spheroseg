import React from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { vi } from 'vitest';

// Mock all context providers
const MockLanguageProvider = ({ children }: { children: React.ReactNode }) => {
  const mockContextValue = {
    language: 'en',
    setLanguage: vi.fn(),
    t: vi.fn((key: string) => key),
    availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  };

  return (
    <div data-testid="mock-language-provider">
      {React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            ...mockContextValue,
          });
        }
        return child;
      })}
    </div>
  );
};

const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="mock-auth-provider">{children}</div>;
};

const MockThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="mock-theme-provider">{children}</div>;
};

// Create wrapper with all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockAuthProvider>
      <MockThemeProvider>
        <MockLanguageProvider>{children}</MockLanguageProvider>
      </MockThemeProvider>
    </MockAuthProvider>
  );
};

// Custom render function
const customRender = (ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) =>
  rtlRender(ui, { wrapper: AllTheProviders, ...options });

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
