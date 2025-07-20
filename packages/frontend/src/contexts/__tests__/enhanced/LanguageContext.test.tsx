import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LanguageProvider, useLanguage, Language } from '../../LanguageContext';
import '@testing-library/jest-dom';

// Use the global mocks from test-setup.ts - no need to override them

// Mock AuthContext
let mockUser = { id: 'test-user-id' };
let mockIsAuthenticated = true;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
  })),
}));

// Mock API client
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ status: 200, data: { preferred_language: 'en' } }),
    put: vi.fn().mockResolvedValue({ status: 200, data: { success: true } }),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

// Mock userProfileService
vi.mock('@/services/userProfileService', () => ({
  default: {
    loadSettingFromDatabase: vi.fn().mockResolvedValue('en'),
    setUserSetting: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock logger
vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Simple test component
const TestComponent: React.FC = () => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();

  return (
    <div>
      <div data-testid="language-section">
        <span data-testid="current-language">{language}</span>
      </div>

      <div data-testid="translation-section">
        <p data-testid="translated-hello">{t('hello')}</p>
        <p data-testid="translated-welcome">{t('greeting.welcome')}</p>
        <p data-testid="translated-morning">{t('greeting.morning')}</p>
        <p data-testid="translated-evening">{t('greeting.evening')}</p>
        <p data-testid="translated-deeply-nested">{t('nested.deeply.key')}</p>
        <p data-testid="translated-missing">{t('missing.key')}</p>
        <p data-testid="translated-with-fallback">{t('missing.key', {}, 'Fallback Text')}</p>
        <p data-testid="translated-empty-key">{t('')}</p>
        <p data-testid="translated-null-key">{t(null as unknown as string)}</p>
        <p data-testid="translated-undefined-key">{t(undefined as unknown as string)}</p>
        <p data-testid="translated-with-params">{t('params', { name: 'Tester', date: new Date() })}</p>
        <p data-testid="translated-zero-items">{t('items.zero')}</p>
        <p data-testid="translated-one-item">{t('items.one')}</p>
        <p data-testid="translated-many-items">{t('items.other', { count: 5 })}</p>
      </div>

      <div data-testid="available-languages">
        <ul>
          {availableLanguages.map((lang) => (
            <li key={lang} data-testid={`lang-${lang}`}>
              {lang}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="language-switcher">
        <div className="buttons">
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              data-testid={`set-${lang}`}
              onClick={() => setLanguage(lang as Language)}
              className={language === lang ? 'active' : ''}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>

        <div>
          <button
            data-testid="quick-switch-cs"
            onClick={() => {
              setLanguage('cs');
              setTimeout(() => setLanguage('en'), 10);
            }}
          >
            Quick Switch CS → EN
          </button>

          <button data-testid="invalid-language" onClick={() => setLanguage('invalid' as Language)}>
            Set Invalid Language
          </button>
        </div>
      </div>
    </div>
  );
};

// Component to test error boundaries
const LanguageConsumer: React.FC = () => {
  const language = useLanguage();
  return <div data-testid="language-consumer-success">Language consumer working</div>;
};

describe('LanguageContext (Enhanced)', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};

  // Mock navigator
  let navigatorLanguageMock: string = 'en-US';

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => localStorageMock[key] || null),
        setItem: vi.fn((key, value) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key) => delete localStorageMock[key]),
        clear: vi.fn(() => (localStorageMock = {})),
      },
      writable: true,
    });

    // Mock navigator.language
    Object.defineProperty(navigator, 'language', {
      get: () => navigatorLanguageMock,
      configurable: true,
    });

    // Reset mocks
    vi.clearAllMocks();

    // Reset mock user
    mockUser = { id: 'test-user-id' };
    mockIsAuthenticated = true;

    // Reset current language for each test using global state
    if ((global as any).__testSetLanguage) {
      (global as any).__testSetLanguage('en');
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default language', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization and translation to load
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
      expect(screen.getByTestId('translated-hello').textContent).toBe('Hello');
    });

    // Verify initial English language
    expect(screen.getByTestId('current-language').textContent).toBe('en');
  });

  it('should handle language changes', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Change to Czech
    fireEvent.click(screen.getByTestId('set-cs'));

    // Verify language changed in UI
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('cs');
    });

    // For context changes, we need to ensure translations are working
    await waitFor(() => {
      expect(screen.getByTestId('translated-hello').textContent).toBe('Ahoj');
      expect(screen.getByTestId('translated-welcome').textContent).toBe('Vítejte');
    });

    // Verify localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'cs');
  });

  it('should handle complex translations with parameters', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization (following exact pattern of working test)
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Change to Czech (following exact pattern of working test)
    fireEvent.click(screen.getByTestId('set-cs'));

    // Verify language changed in UI (following exact pattern of working test)
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('cs');
    });

    // For context changes, we need to ensure translations are working (following exact pattern of working test)
    await waitFor(() => {
      expect(screen.getByTestId('translated-hello').textContent).toBe('Ahoj');
      expect(screen.getByTestId('translated-welcome').textContent).toBe('Vítejte');
    });

    // Then check parameter interpolation in Czech
    const withParamsEl = screen.getByTestId('translated-with-params');
    await waitFor(() => {
      expect(withParamsEl.textContent).toContain('Ahoj, Tester!');
      expect(withParamsEl.textContent).toContain('Dnes je');
    });
  });

  it('should handle nested translation keys correctly', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization and English translation
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
      expect(screen.getByTestId('translated-hello').textContent).toBe('Hello');
    });

    // Check deeply nested key
    expect(screen.getByTestId('translated-deeply-nested').textContent).toBe('Deeply nested key');

    // Change to Czech
    fireEvent.click(screen.getByTestId('set-cs'));

    // Check deeply nested key in Czech
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('cs');
      expect(screen.getByTestId('translated-hello').textContent).toBe('Ahoj');
      expect(screen.getByTestId('translated-deeply-nested').textContent).toBe('Hluboce vnořený klíč');
    });
  });

  it('should handle missing translations and fallbacks properly', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization and English translation
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
      expect(screen.getByTestId('translated-hello').textContent).toBe('Hello');
    });

    // Missing key should return key itself
    expect(screen.getByTestId('translated-missing').textContent).toBe('missing.key');

    // Missing key with fallback should return fallback
    expect(screen.getByTestId('translated-with-fallback').textContent).toBe('Fallback Text');

    // Empty/null/undefined keys should be handled gracefully
    expect(screen.getByTestId('translated-empty-key').textContent).toBe('');
    expect(screen.getByTestId('translated-null-key').textContent).not.toBe('null');
    expect(screen.getByTestId('translated-undefined-key').textContent).not.toBe('undefined');
  });

  it('should ignore invalid language selections', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization with English
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('en');
    });

    // Try to set invalid language
    fireEvent.click(screen.getByTestId('invalid-language'));

    // Language should remain unchanged
    expect(screen.getByTestId('current-language').textContent).toBe('en');
  });

  it('should handle pluralization based on count', async () => {
    render(
      <LanguageProvider>
        <TestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization and English translation
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
      expect(screen.getByTestId('translated-hello').textContent).toBe('Hello');
    });

    // Check English pluralization
    expect(screen.getByTestId('translated-zero-items').textContent).toBe('No items');
    expect(screen.getByTestId('translated-one-item').textContent).toBe('One item');
    expect(screen.getByTestId('translated-many-items').textContent).toBe('5 items');

    // Change to Czech which has more complex pluralization rules
    fireEvent.click(screen.getByTestId('set-cs'));

    // Check Czech pluralization (our mock is simplified)
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('cs');
      expect(screen.getByTestId('translated-hello').textContent).toBe('Ahoj');
      expect(screen.getByTestId('translated-zero-items').textContent).toBe('Žádné položky');
      expect(screen.getByTestId('translated-one-item').textContent).toBe('Jedna položka');
      expect(screen.getByTestId('translated-many-items').textContent).toBe('5 položek');
    });
  });
});