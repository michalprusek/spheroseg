import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { vi } from 'vitest';
import { LanguageProvider, useLanguage, Language } from '../LanguageContext';

// Mock dependencies
vi.mock('../AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
  })),
}));

vi.mock('i18next', () => ({
  init: vi.fn(),
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  t: vi.fn((key) => `translated:${key}`),
  language: 'en',
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
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { preferred_language: 'en' } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

// Mock navigator.language
Object.defineProperty(window.navigator, 'language', {
  writable: true,
  value: 'en-US',
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    store,
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Create a test component to access the context
const TestLanguageConsumer = () => {
  const { language, setLanguage, t, availableLanguages } = useLanguage();

  return (
    <div>
      <div data-testid="current-language">{language}</div>
      <div data-testid="available-languages">{availableLanguages.join(',')}</div>
      <div data-testid="translated-text">{t('test.key', undefined, 'fallback-text')}</div>
      <button data-testid="change-language-en" onClick={() => setLanguage('en')}>
        Set English
      </button>
      <button data-testid="change-language-cs" onClick={() => setLanguage('cs')}>
        Set Czech
      </button>
    </div>
  );
};

const renderWithLanguageProvider = () => {
  return render(
    <LanguageProvider>
      <TestLanguageConsumer />
    </LanguageProvider>,
  );
};

describe('LanguageContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('initializes with English as default language', async () => {
    renderWithLanguageProvider();

    // Initial language should be English
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');

    // Should have available languages
    expect(screen.getByTestId('available-languages')).toHaveTextContent('en,cs,de,es,fr,zh');
  });

  it('loads language from localStorage if available', async () => {
    // Set language in localStorage
    localStorage.setItem('language', 'cs');

    renderWithLanguageProvider();

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Language should be loaded from localStorage
    expect(screen.getByTestId('current-language')).toHaveTextContent('cs');
  });

  it('detects browser language when localStorage is empty', async () => {
    // Change navigator language
    Object.defineProperty(window.navigator, 'language', {
      value: 'fr-FR',
    });

    renderWithLanguageProvider();

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Since detection uses just the language part, it should detect 'fr'
    expect(screen.getByTestId('current-language')).toHaveTextContent('fr');

    // Should save detected language to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'fr');
  });

  it('changes language when setLanguage is called', async () => {
    const i18n = await import('i18next');

    renderWithLanguageProvider();

    // Initial language should be English
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');

    // Click button to change language to Czech
    await act(async () => {
      screen.getByTestId('change-language-cs').click();
    });

    // Language state should be updated
    expect(screen.getByTestId('current-language')).toHaveTextContent('cs');

    // i18n.changeLanguage should be called
    expect(i18n.changeLanguage).toHaveBeenCalledWith('cs');

    // localStorage should be updated
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'cs');
  });

  it('provides translation function that handles fallbacks', async () => {
    const i18n = await import('i18next');
    vi.mocked(i18n.t).mockImplementation((key) => {
      // Simulate missing translation
      if (key === 'test.key') {
        return key; // i18next returns the key when translation is missing
      }
      return `translated:${key}`;
    });

    renderWithLanguageProvider();

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should show fallback for missing translation
    expect(screen.getByTestId('translated-text')).toHaveTextContent('fallback-text');
  });

  it('attempts alternative translation keys for missing translations', async () => {
    const i18n = await import('i18next');
    vi.mocked(i18n.t).mockImplementation((key) => {
      // Simulate missing translation for original key but success for alternative
      if (key === 'test.key') {
        return key; // Original key fails
      }
      if (key === 'key') {
        return 'translated from alternative key'; // Last segment succeeds
      }
      return `translated:${key}`;
    });

    renderWithLanguageProvider();

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Should try alternative keys and find a match
    expect(screen.getByTestId('translated-text')).toHaveTextContent('translated from alternative key');
  });

  it('updates user language preference when authenticated', async () => {
    // Mock authenticated user
    const authModule = await import('../AuthContext');
    vi.mocked(authModule.useAuth).mockReturnValue({
      user: { id: 'user-123', email: 'test@example.com' },
    } as any);

    const apiClient = await import('@/lib/apiClient');

    renderWithLanguageProvider();

    // Change language
    await act(async () => {
      screen.getByTestId('change-language-cs').click();
    });

    // Should call API to update preference
    expect(apiClient.default.put).toHaveBeenCalledWith('/users/me', {
      preferred_language: 'cs',
    });
  });
});
EOF < /dev/llnu;
