import { vi } from 'vitest';
import React from 'react';

// Set React Router future flags before any tests run
window.REACT_ROUTER_FUTURE_FLAGS = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
  v7_normalizeFormMethod: true,
};

// Patch console.warn to filter out React Router future flags warnings
const originalWarn = console.warn;
console.warn = function (...args) {
  // Filter React Router warnings
  if (args[0] && typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return; // Ignore these warnings
  }
  originalWarn.apply(console, args);
};

// Also override window.console.warn for handling cases where window is used
if (typeof window !== 'undefined') {
  const originalWindowWarn = window.console.warn;
  window.console.warn = function (...args) {
    // Filter React Router warnings
    if (args[0] && typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
      return; // Ignore these warnings
    }
    originalWindowWarn.apply(window.console, args);
  };
}

// This file runs before any test files, ensuring the flags are set
console.log('React Router Future Flags set and warnings patched in test-setup.ts');

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key} ${JSON.stringify(params)}`;
      }
      return key;
    },
    i18n: {
      changeLanguage: vi.fn().mockResolvedValue(undefined),
      language: 'en',
      languages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
      isInitialized: true,
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

// Mock i18next
vi.mock('i18next', () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue(undefined),
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    t: vi.fn((key) => key),
    language: 'en',
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
    options: {
      resources: {},
    },
  },
}));
