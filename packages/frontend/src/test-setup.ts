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

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      interceptors: {
        request: {
          use: vi.fn(),
          eject: vi.fn(),
        },
        response: {
          use: vi.fn(),
          eject: vi.fn(),
        },
      },
    })),
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(() => ({
      data: undefined,
      error: null,
      isError: false,
      isLoading: false,
      isSuccess: true,
      refetch: vi.fn(),
    })),
    useMutation: vi.fn(() => ({
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isLoading: false,
      isError: false,
      isSuccess: false,
      error: null,
      data: undefined,
    })),
  };
});

// Mock userProfileService
vi.mock('@/services/userProfileService', () => ({
  userProfileService: {
    getUserSetting: vi.fn().mockResolvedValue('en'),
    saveUserSetting: vi.fn().mockResolvedValue(undefined),
    getLanguage: vi.fn().mockResolvedValue('en'),
    setLanguage: vi.fn().mockResolvedValue(undefined),
    getTheme: vi.fn().mockResolvedValue('light'),
    setTheme: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock @/lib/apiClient
vi.mock('@/lib/apiClient', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    setLanguage: vi.fn(),
    t: vi.fn((key) => key),
    availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  }),
  LanguageProvider: ({ children }) => children,
}));

// Mock useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    refreshToken: vi.fn(),
  }),
  AuthProvider: ({ children }) => children,
}));

// Mock useTheme hook
vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
  }),
  ThemeProvider: ({ children }) => children,
}));
