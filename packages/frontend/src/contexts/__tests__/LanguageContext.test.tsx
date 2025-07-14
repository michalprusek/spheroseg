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

const mockI18n = {
  init: vi.fn().mockResolvedValue(undefined),
  changeLanguage: vi.fn().mockResolvedValue(undefined),
  t: vi.fn((key) => `translated:${key}`),
  language: 'en',
  use: vi.fn().mockReturnThis(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  exists: vi.fn().mockReturnValue(true),
  getResource: vi.fn(),
  addResourceBundle: vi.fn(),
  hasResourceBundle: vi.fn().mockReturnValue(true),
  getResourceBundle: vi.fn().mockReturnValue({}),
  loadNamespaces: vi.fn().mockResolvedValue(undefined),
  loadLanguages: vi.fn().mockResolvedValue(undefined),
  reloadResources: vi.fn().mockResolvedValue(undefined),
  isInitialized: true,
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
};

vi.mock('i18next', () => ({
  default: mockI18n,
  t: mockI18n.t,
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { preferred_language: 'en' } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

vi.mock('@/services/userProfileService', () => ({
  default: {
    loadSettingFromDatabase: vi.fn().mockResolvedValue('en'),
    setUserSetting: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../i18n', () => ({
  default: mockI18n,
  i18nInitializedPromise: Promise.resolve(),
}));

vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
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

    // Wait for initialization with multiple async cycles
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
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

    // Wait for initialization with multiple async cycles
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Since detection uses just the language part, it should detect 'fr'
    expect(screen.getByTestId('current-language')).toHaveTextContent('fr');

    // Should save detected language to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'fr');
  });

  it('changes language when setLanguage is called', async () => {
    renderWithLanguageProvider();

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Initial language should be English
    expect(screen.getByTestId('current-language')).toHaveTextContent('en');

    // Click button to change language to Czech
    await act(async () => {
      screen.getByTestId('change-language-cs').click();
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Language state should be updated
    expect(screen.getByTestId('current-language')).toHaveTextContent('cs');

    // i18n.changeLanguage should be called
    expect(mockI18n.changeLanguage).toHaveBeenCalledWith('cs');

    // localStorage should be updated
    expect(localStorage.setItem).toHaveBeenCalledWith('language', 'cs');
  });

  it('provides translation function that handles fallbacks', async () => {
    vi.mocked(mockI18n.t).mockImplementation((key) => {
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
    vi.mocked(mockI18n.t).mockImplementation((key) => {
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

    const userProfileService = await import('@/services/userProfileService');

    renderWithLanguageProvider();

    // Wait for initialization
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Change language
    await act(async () => {
      screen.getByTestId('change-language-cs').click();
    });

    // Should call service to update preference
    expect(userProfileService.default.setUserSetting).toHaveBeenCalledWith('language', 'cs', 'ui');
  });
});
