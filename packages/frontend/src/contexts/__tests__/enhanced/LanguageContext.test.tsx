import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { LanguageProvider, useLanguage, Language } from '../../LanguageContext';
import '@testing-library/jest-dom';

// Mock translations with nested structures and plurals
vi.mock('@/translations/en', () => ({
  hello: 'Hello',
  greeting: {
    welcome: 'Welcome',
    morning: 'Good morning',
    evening: 'Good evening',
  },
  items: {
    zero: 'No items',
    one: 'One item',
    other: '{{count}} items',
  },
  params: 'Hello, {{name}}! Today is {{date, date}}',
  nested: {
    deeply: {
      key: 'Deeply nested key',
    },
  },
}));

vi.mock('@/translations/cs', () => ({
  hello: 'Ahoj',
  greeting: {
    welcome: 'Vítejte',
    morning: 'Dobré ráno',
    evening: 'Dobrý večer',
  },
  items: {
    zero: 'Žádné položky',
    one: 'Jedna položka',
    few: '{{count}} položky',
    many: '{{count}} položek',
    other: '{{count}} položek',
  },
  params: 'Ahoj, {{name}}! Dnes je {{date, date}}',
  nested: {
    deeply: {
      key: 'Hluboce vnořený klíč',
    },
  },
}));

// Mock other language files with minimal content
const simpleMock = { hello: 'Hello', greeting: { welcome: 'Welcome' } };
vi.mock('@/translations/de', () => simpleMock);
vi.mock('@/translations/es', () => simpleMock);
vi.mock('@/translations/fr', () => simpleMock);
vi.mock('@/translations/zh', () => simpleMock);

// Mock i18next with more detailed behavior
vi.mock('i18next', () => {
  // Store current language and translation data
  let currentLanguage = 'en';
  const translationData = {
    en: {
      hello: 'Hello',
      'greeting.welcome': 'Welcome',
      'greeting.morning': 'Good morning',
      'greeting.evening': 'Good evening',
      'items.zero': 'No items',
      'items.one': 'One item',
      'items.other': '{{count}} items',
      params: 'Hello, {{name}}! Today is {{date, date}}',
      'nested.deeply.key': 'Deeply nested key',
    },
    cs: {
      hello: 'Ahoj',
      'greeting.welcome': 'Vítejte',
      'greeting.morning': 'Dobré ráno',
      'greeting.evening': 'Dobrý večer',
      'items.zero': 'Žádné položky',
      'items.one': 'Jedna položka',
      'items.few': '{{count}} položky',
      'items.many': '{{count}} položek',
      'items.other': '{{count}} položek',
      params: 'Ahoj, {{name}}! Dnes je {{date, date}}',
      'nested.deeply.key': 'Hluboce vnořený klíč',
    },
    de: { hello: 'Hallo', 'greeting.welcome': 'Willkommen' },
    es: { hello: 'Hola', 'greeting.welcome': 'Bienvenido' },
    fr: { hello: 'Bonjour', 'greeting.welcome': 'Bienvenue' },
    zh: { hello: '你好', 'greeting.welcome': '欢迎' },
  };

  return {
    default: {
      init: vi.fn(),
      changeLanguage: vi.fn().mockImplementation((lang) => {
        currentLanguage = lang;
        return Promise.resolve();
      }),
      t: vi.fn().mockImplementation((key, options) => {
        const langs = translationData[currentLanguage] || translationData.en;

        // Handle parameters in translation strings
        if (langs[key] && options) {
          let translated = langs[key];
          if (typeof translated === 'string') {
            Object.entries(options).forEach(([paramKey, paramValue]) => {
              // Skip i18next internal options (they start with underscore)
              if (!paramKey.startsWith('_')) {
                const regex = new RegExp(`{{${paramKey}}}`, 'g');
                translated = translated.replace(regex, String(paramValue));

                // Simple date format simulation
                const dateRegex = new RegExp(`{{${paramKey}, date}}`, 'g');
                if (paramValue instanceof Date && dateRegex.test(translated)) {
                  translated = translated.replace(dateRegex, paramValue.toLocaleDateString());
                }
              }
            });
            return translated;
          }
        }

        // Return the translation, fallback, or key
        if (langs[key]) return langs[key];
        if (options?.defaultValue) return options.defaultValue;
        return key;
      }),
      language: vi.fn().mockImplementation(() => currentLanguage),
      options: {
        resources: {
          en: {},
          cs: {},
          de: {},
          es: {},
          fr: {},
          zh: {},
        },
      },
    },
  };
});

const i18next = vi.mocked(vi.importActual('i18next')).default;

// Setup configurable AuthContext mock
let mockUser = { id: 'test-user-id' };
let mockIsAuthenticated = true;

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: mockUser,
    isAuthenticated: mockIsAuthenticated,
  })),
  __updateMockUser: (user) => {
    mockUser = user;
  },
  __updateAuthenticated: (isAuthenticated) => {
    mockIsAuthenticated = isAuthenticated;
  },
}));

// Mock apiClient with more configurable behavior
let mockApiClientResponses = {
  get: {
    '/users/me': { status: 200, data: { preferred_language: 'en' } },
  },
  put: {
    '/users/me': { status: 200, data: { success: true } },
  },
};

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn().mockImplementation((url) => {
      const response = mockApiClientResponses.get[url];
      if (response) {
        return Promise.resolve(response);
      }
      return Promise.reject(new Error(`No mock response for GET ${url}`));
    }),
    put: vi.fn().mockImplementation((url, data) => {
      const response = mockApiClientResponses.put[url];
      if (response) {
        return Promise.resolve(response);
      }
      return Promise.reject(new Error(`No mock response for PUT ${url}`));
    }),
  },
  __setMockResponse: (method, url, response) => {
    mockApiClientResponses[method][url] = response;
  },
  __clearMocks: () => {
    mockApiClientResponses = {
      get: { '/users/me': { status: 200, data: { preferred_language: 'en' } } },
      put: { '/users/me': { status: 200, data: { success: true } } },
    };
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

// Create a test component with more comprehensive language testing
const AdvancedLanguageTestComponent: React.FC = () => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();

  // Get current date for testing date formatting
  const today = new Date();

  // Format with parameters
  const greetingWithParams = t('params', { name: 'Tester', date: today });

  // Test pluralization (only basic simulation in our mock)
  const zeroItems = t('items.zero');
  const oneItem = t('items.one');
  const manyItems = t('items.other', { count: 5 });

  return (
    <div>
      <div data-testid="language-section">
        <h2>Current Language: {language}</h2>
        <span data-testid="current-language">{language}</span>
      </div>

      <div data-testid="translation-section">
        <h3>Basic Translations</h3>
        <p data-testid="translated-hello">{t('hello')}</p>
        <p data-testid="translated-welcome">{t('greeting.welcome')}</p>
        <p data-testid="translated-morning">{t('greeting.morning')}</p>
        <p data-testid="translated-evening">{t('greeting.evening')}</p>

        <h3>Nested Translations</h3>
        <p data-testid="translated-deeply-nested">{t('nested.deeply.key')}</p>

        <h3>Missing Translation</h3>
        <p data-testid="translated-missing">{t('missing.key')}</p>
        <p data-testid="translated-with-fallback">{t('missing.key', {}, 'Fallback Text')}</p>

        <h3>Empty and Edge Cases</h3>
        <p data-testid="translated-empty-key">{t('')}</p>
        <p data-testid="translated-null-key">{t(null as any)}</p>
        <p data-testid="translated-undefined-key">{t(undefined as any)}</p>

        <h3>Translations with Parameters</h3>
        <p data-testid="translated-with-params">{greetingWithParams}</p>

        <h3>Pluralization</h3>
        <p data-testid="translated-zero-items">{zeroItems}</p>
        <p data-testid="translated-one-item">{oneItem}</p>
        <p data-testid="translated-many-items">{manyItems}</p>
      </div>

      <div data-testid="available-languages">
        <h3>Available Languages</h3>
        <ul>
          {availableLanguages.map((lang) => (
            <li key={lang} data-testid={`lang-${lang}`}>
              {lang}
            </li>
          ))}
        </ul>
      </div>

      <div data-testid="language-switcher">
        <h3>Language Switcher</h3>
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
  try {
    useLanguage();
    return <div data-testid="language-consumer-success">Language consumer working</div>;
  } catch (error) {
    return <div data-testid="language-consumer-error">Error: {(error as Error).message}</div>;
  }
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
    vi.mocked(i18next.changeLanguage).mockClear();
    vi.mocked(i18next.t).mockClear();
    vi.mocked(require('@/lib/apiClient').default.get).mockClear();
    vi.mocked(require('@/lib/apiClient').default.put).mockClear();

    // Reset mock user
    mockUser = { id: 'test-user-id' };
    mockIsAuthenticated = true;

    // Reset API mock responses to defaults
    require('@/lib/apiClient').__clearMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize and detect browser language correctly with various locales', async () => {
    // Test different browser language patterns
    const testCases = [
      { browserLang: 'cs-CZ', expectedLang: 'cs' },
      { browserLang: 'en-GB', expectedLang: 'en' },
      { browserLang: 'de-AT', expectedLang: 'de' },
      { browserLang: 'fr-CA', expectedLang: 'fr' },
      { browserLang: 'es', expectedLang: 'es' },
      { browserLang: 'zh-CN', expectedLang: 'zh' },
      { browserLang: 'it-IT', expectedLang: 'en' }, // Unsupported language defaults to English
      { browserLang: 'unknown', expectedLang: 'en' }, // Invalid language defaults to English
    ];

    for (const { browserLang, expectedLang } of testCases) {
      // Update navigator mock and clear localStorage
      navigatorLanguageMock = browserLang;
      localStorageMock = {};

      // Reset i18next mocks
      vi.mocked(i18next.changeLanguage).mockClear();

      const { unmount } = render(
        <LanguageProvider>
          <AdvancedLanguageTestComponent />
        </LanguageProvider>,
      );

      // Wait for language initialization
      await waitFor(() => {
        expect(screen.getByTestId('current-language').textContent).toBe(expectedLang);
      });

      // Verify i18next was called with expected language
      expect(i18next.changeLanguage).toHaveBeenCalledWith(expectedLang);

      // Clean up
      unmount();
    }
  });

  it('should handle user login/logout events and language preferences', async () => {
    // Start with no user
    mockUser = null;
    mockIsAuthenticated = false;

    // Set Czech in localStorage
    localStorageMock['language'] = 'cs';

    const { rerender } = render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Verify Czech is used from localStorage when not logged in
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('cs');
    });

    // Simulate user login with French language preference
    mockUser = { id: 'user-1' };
    mockIsAuthenticated = true;

    // Set API to return French preference
    require('@/lib/apiClient').__setMockResponse('get', '/users/me', {
      status: 200,
      data: { preferred_language: 'fr' },
    });

    // Rerender to trigger useEffect for user change
    rerender(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // API should be called to fetch user preferences
    await waitFor(() => {
      expect(require('@/lib/apiClient').default.get).toHaveBeenCalledWith('/users/me');
    });

    // Language should change to French from API preference
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('fr');
    });

    // Now simulate logout
    mockUser = null;
    mockIsAuthenticated = false;

    // Rerender to trigger useEffect for user change
    rerender(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // French should be preserved in localStorage after logout
    expect(localStorageMock['language']).toBe('fr');
    expect(screen.getByTestId('current-language').textContent).toBe('fr');
  });

  it('should handle language changes with API updates', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Verify initial English language
    expect(screen.getByTestId('current-language').textContent).toBe('en');
    expect(screen.getByTestId('translated-hello').textContent).toBe('Hello');

    // Clear previous calls
    vi.mocked(require('@/lib/apiClient').default.put).mockClear();

    // Change to Czech
    fireEvent.click(screen.getByTestId('set-cs'));

    // Verify language changed in UI
    expect(screen.getByTestId('current-language').textContent).toBe('cs');

    // For context changes, we need to ensure i18next translation is working
    expect(screen.getByTestId('translated-hello').textContent).toBe('Ahoj');
    expect(screen.getByTestId('translated-welcome').textContent).toBe('Vítejte');

    // Verify API update was called for the logged-in user
    expect(require('@/lib/apiClient').default.put).toHaveBeenCalledWith('/users/me', { preferred_language: 'cs' });

    // Verify localStorage was updated
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'cs');
  });

  it('should handle API errors gracefully when updating language preference', async () => {
    // Mock API to reject language preference update
    vi.mocked(require('@/lib/apiClient').default.put).mockRejectedValueOnce(new Error('Network error'));

    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Change to Czech, which will trigger API error
    fireEvent.click(screen.getByTestId('set-cs'));

    // Despite API error, language should change in UI and localStorage
    expect(screen.getByTestId('current-language').textContent).toBe('cs');
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'cs');

    // API should have been called but error should be handled
    expect(require('@/lib/apiClient').default.put).toHaveBeenCalledWith('/users/me', { preferred_language: 'cs' });

    // No error toast should be shown (silent failure for non-critical operation)
    expect(require('react-hot-toast').toast.error).not.toHaveBeenCalled();
  });

  it('should handle complex translations with parameters and formatting', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Check parameter interpolation
    const withParamsEl = screen.getByTestId('translated-with-params');
    expect(withParamsEl.textContent).toContain('Hello, Tester!');
    expect(withParamsEl.textContent).toContain('Today is');

    // Change to Czech
    fireEvent.click(screen.getByTestId('set-cs'));

    // Check parameters in Czech
    expect(withParamsEl.textContent).toContain('Ahoj, Tester!');
    expect(withParamsEl.textContent).toContain('Dnes je');
  });

  it('should handle nested translation keys correctly', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Check deeply nested key
    expect(screen.getByTestId('translated-deeply-nested').textContent).toBe('Deeply nested key');

    // Change to Czech
    fireEvent.click(screen.getByTestId('set-cs'));

    // Check deeply nested key in Czech
    expect(screen.getByTestId('translated-deeply-nested').textContent).toBe('Hluboce vnořený klíč');
  });

  it('should handle missing translations and fallbacks properly', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Missing key should return key itself
    expect(screen.getByTestId('translated-missing').textContent).toBe('missing.key');

    // Missing key with fallback should return fallback
    expect(screen.getByTestId('translated-with-fallback').textContent).toBe('Fallback Text');

    // Empty/null/undefined keys should be handled gracefully
    expect(screen.getByTestId('translated-empty-key').textContent).toBe('');
    expect(screen.getByTestId('translated-null-key').textContent).not.toBe('null'); // Should not display "null"
    expect(screen.getByTestId('translated-undefined-key').textContent).not.toBe('undefined'); // Should not display "undefined"
  });

  it('should handle rapid language changes correctly', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Click button that rapidly changes language from CS to EN
    fireEvent.click(screen.getByTestId('quick-switch-cs'));

    // First CS should be set
    expect(screen.getByTestId('current-language').textContent).toBe('cs');

    // After a short delay, it should change to EN
    await waitFor(() => {
      expect(screen.getByTestId('current-language').textContent).toBe('en');
    });

    // localStorage should have the final language (EN)
    expect(localStorage.setItem).toHaveBeenLastCalledWith('language', 'en');
  });

  it('should ignore invalid language selections', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
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

    // i18next.changeLanguage should not be called with invalid language
    expect(i18next.changeLanguage).not.toHaveBeenCalledWith('invalid');
  });

  it('should throw error when useLanguage is used outside LanguageProvider', () => {
    render(<LanguageConsumer />);

    // Should show error message
    expect(screen.getByTestId('language-consumer-error')).toBeInTheDocument();
    expect(screen.getByTestId('language-consumer-error').textContent).toContain(
      'useLanguage must be used within a LanguageProvider',
    );
  });

  it('should handle pluralization based on count', async () => {
    render(
      <LanguageProvider>
        <AdvancedLanguageTestComponent />
      </LanguageProvider>,
    );

    // Wait for initialization
    await waitFor(() => {
      expect(screen.getByTestId('current-language')).toBeInTheDocument();
    });

    // Check English pluralization
    expect(screen.getByTestId('translated-zero-items').textContent).toBe('No items');
    expect(screen.getByTestId('translated-one-item').textContent).toBe('One item');
    expect(screen.getByTestId('translated-many-items').textContent).toBe('5 items');

    // Change to Czech which has more complex pluralization rules
    fireEvent.click(screen.getByTestId('set-cs'));

    // Check Czech pluralization (our mock is simplified)
    expect(screen.getByTestId('translated-zero-items').textContent).toBe('Žádné položky');
    expect(screen.getByTestId('translated-one-item').textContent).toBe('Jedna položka');
    expect(screen.getByTestId('translated-many-items').textContent).toBe('5 položek');
  });
});
