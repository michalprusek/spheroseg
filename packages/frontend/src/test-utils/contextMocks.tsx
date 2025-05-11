/**
 * Context mock utilities for testing
 * This provides a consistent way to mock React contexts across all tests
 */
import React, { ReactNode } from 'react';
import { vi } from 'vitest';

/**
 * Mock for the AuthContext with configurable user state
 */
export const createAuthContextMock = (authenticated = true) => {
  const user = authenticated ? { id: 'test-user-id', email: 'test@example.com', name: 'Test User' } : null;

  const mockAuthContext = {
    user,
    token: authenticated ? 'mock-token' : null,
    loading: false,
    error: null,
    signIn: vi.fn().mockResolvedValue({ user }),
    signUp: vi.fn().mockResolvedValue({ user }),
    signOut: vi.fn().mockImplementation(() => {
      mockAuthContext.user = null;
      mockAuthContext.token = null;
      return Promise.resolve();
    }),
    forgotPassword: vi.fn().mockResolvedValue(true),
    resetPassword: vi.fn().mockResolvedValue(true),
  };

  vi.mock('@/contexts/AuthContext', () => ({
    useAuth: () => mockAuthContext,
    AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));

  return mockAuthContext;
};

/**
 * Mock for the ProfileContext with configurable profile state
 */
export const createProfileContextMock = (hasProfile = true) => {
  const profile = hasProfile
    ? {
        id: 'test-profile-id',
        user_id: 'test-user-id',
        username: 'testuser',
        full_name: 'Test User',
        title: 'Software Developer',
        organization: 'Test Organization',
        bio: 'This is a test bio',
        location: 'Test Location',
        avatar_url: 'https://example.com/avatar.jpg',
        preferred_language: 'en',
      }
    : null;

  const mockProfileContext = {
    profile,
    loading: false,
    error: null,
    updateProfile: vi.fn().mockResolvedValue(profile),
    refetchProfile: vi.fn().mockResolvedValue(profile),
  };

  vi.mock('@/contexts/ProfileContext', () => ({
    useProfile: () => mockProfileContext,
    ProfileProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));

  return mockProfileContext;
};

/**
 * Mock for the LanguageContext
 */
export const createLanguageContextMock = (language = 'en') => {
  // Map for translation function (simplistic implementation)
  const translations: Record<string, Record<string, string>> = {
    en: {
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.save': 'Save',
      'common.cancel': 'Cancel',
    },
    cs: {
      'common.loading': 'Načítání...',
      'common.error': 'Chyba',
      'common.save': 'Uložit',
      'common.cancel': 'Zrušit',
    },
  };

  const mockLanguageContext = {
    language,
    languages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
    setLanguage: vi.fn().mockImplementation((newLang: string) => {
      mockLanguageContext.language = newLang;
      return Promise.resolve();
    }),
    t: vi.fn((key: string) => translations[language]?.[key] || key),
  };

  vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => mockLanguageContext,
    LanguageProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));

  return mockLanguageContext;
};

/**
 * Mock for the ThemeContext
 */
export const createThemeContextMock = (initialTheme = 'light') => {
  const mockThemeContext = {
    theme: initialTheme,
    setTheme: vi.fn().mockImplementation((newTheme: string) => {
      mockThemeContext.theme = newTheme;
    }),
  };

  vi.mock('@/contexts/ThemeContext', () => ({
    useTheme: () => mockThemeContext,
    ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  }));

  return mockThemeContext;
};

/**
 * Setup all context mocks at once for complete testing environment
 */
export const setupAllContextMocks = () => {
  const authContext = createAuthContextMock();
  const profileContext = createProfileContextMock();
  const languageContext = createLanguageContextMock();
  const themeContext = createThemeContextMock();

  return {
    authContext,
    profileContext,
    languageContext,
    themeContext,
  };
};

/**
 * Create a test provider wrapper with all mocked contexts
 * This is useful for tests that need to render components with context
 */
export const AllContextsWrapper: React.FC<{ children: ReactNode }> = ({ children }) => {
  // This component doesn't actually provide any contexts
  // since we're mocking the contexts at the module level
  // But it maintains the same API as the real context providers
  return <>{children}</>;
};
