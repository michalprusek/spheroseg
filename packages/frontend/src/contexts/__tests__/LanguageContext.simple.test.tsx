import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

// All mocks are already set up in test-setup.ts
// We don't need to mock them again here

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage, Language } from '../LanguageContext';
import '@testing-library/jest-dom';

// Simple test component
const TestLanguageComponent = () => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();
  
  return (
    <div>
      <span data-testid="current-language">{language}</span>
      <span data-testid="hello-text">{t('hello')}</span>
      <span data-testid="available-count">{availableLanguages.length}</span>
      <button data-testid="switch-to-cs" onClick={() => setLanguage('cs')}>
        Switch to Czech
      </button>
    </div>
  );
};

describe('LanguageContext (Simple)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should provide language context', async () => {
    render(
      <LanguageProvider>
        <TestLanguageComponent />
      </LanguageProvider>
    );

    // Wait for the translation to be available (not just the key)
    await waitFor(() => {
      const helloText = screen.getByTestId('hello-text').textContent;
      // If we're getting the key 'hello', it means the context isn't ready yet
      expect(helloText).not.toBe('hello');
    });

    expect(screen.getByTestId('current-language').textContent).toBe('en');
    expect(screen.getByTestId('hello-text').textContent).toBe('Hello'); // Now returns proper translation
    expect(screen.getByTestId('available-count').textContent).toBe('6');
  });

  it('should handle language switching', async () => {
    render(
      <LanguageProvider>
        <TestLanguageComponent />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('switch-to-cs'));

    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('cs');
    });

    await waitFor(() => {
      expect(screen.getByTestId('hello-text').textContent).toBe('Ahoj'); // Should show Czech translation
    });
  });

  it('should throw error when used outside provider', () => {
    const TestComponent = () => {
      try {
        useLanguage();
        return <div data-testid="success">Success</div>;
      } catch (error) {
        return <div data-testid="error">Error: {error.message}</div>;
      }
    };

    render(<TestComponent />);
    
    expect(screen.getByTestId('error')).toBeInTheDocument();
    expect(screen.getByTestId('error').textContent).toContain('useLanguage must be used within a LanguageProvider');
  });
});