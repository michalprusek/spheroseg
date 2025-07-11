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

// Mock i18n.ts module to avoid initialization
vi.mock('@/i18n', () => ({
  i18nInitializedPromise: Promise.resolve({
    language: 'en',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    t: vi.fn((key) => key),
    isInitialized: true,
  }),
  default: {
    language: 'en',
    changeLanguage: vi.fn().mockResolvedValue(undefined),
    t: vi.fn((key) => key),
    isInitialized: true,
  },
}));

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
  Trans: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  I18nextProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, {}, children),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));

// Mock i18next
vi.mock('i18next', () => {
  const mockI18next = {
    use: vi.fn(),
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
    isInitialized: true,
    options: {
      resources: {},
      lng: 'en',
    },
  };
  
  // Make use() return the instance for chaining
  mockI18next.use.mockReturnValue(mockI18next);
  
  return {
    default: mockI18next,
  };
});

// Mock axios with proper structure
const mockAxiosInstance = {
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
};

// Create AxiosError class
class MockAxiosError extends Error {
  isAxiosError = true;
  code?: string;
  config?: any;
  request?: any;
  response?: any;
  
  constructor(message: string, code?: string, config?: any, request?: any, response?: any) {
    super(message);
    this.name = 'AxiosError';
    this.code = code;
    this.config = config;
    this.request = request;
    this.response = response;
  }
}

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      get: vi.fn().mockResolvedValue({ data: {} }),
      post: vi.fn().mockResolvedValue({ data: {} }),
      put: vi.fn().mockResolvedValue({ data: {} }),
      delete: vi.fn().mockResolvedValue({ data: {} }),
      patch: vi.fn().mockResolvedValue({ data: {} }),
      isAxiosError: vi.fn((error) => error && error.isAxiosError === true),
      AxiosError: MockAxiosError,
    },
    AxiosError: MockAxiosError,
    isAxiosError: vi.fn((error) => error && error.isAxiosError === true),
  };
});

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
vi.mock('@/services/userProfileService', () => {
  const mockService = {
    getUserSetting: vi.fn().mockResolvedValue('en'),
    saveUserSetting: vi.fn().mockResolvedValue(undefined),
    getLanguage: vi.fn().mockResolvedValue('en'),
    setLanguage: vi.fn().mockResolvedValue(undefined),
    getTheme: vi.fn().mockResolvedValue('light'),
    setTheme: vi.fn().mockResolvedValue(undefined),
  };
  return {
    userProfileService: mockService,
    default: mockService,
  };
});

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

// Mock Worker for polygon operations
vi.mock('../workers/polygonWorker.ts', () => ({
  default: vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  })),
}));

// Mock Worker constructor globally
import { MockWorker } from './__mocks__/polygonWorker';
global.Worker = MockWorker as any;

// Mock LanguageContext with proper provider
const mockLanguageContext = React.createContext({
  language: 'en',
  setLanguage: vi.fn(),
  t: vi.fn((key) => key),
  availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
});

vi.mock('@/contexts/LanguageContext', () => {
  return {
    useLanguage: () => {
      const context = React.useContext(mockLanguageContext);
      if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
      }
      return context;
    },
    LanguageProvider: ({ children }: { children: React.ReactNode }) => {
      return React.createElement(
        mockLanguageContext.Provider,
        {
          value: {
            language: 'en',
            setLanguage: vi.fn(),
            t: vi.fn((key) => key),
            availableLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
          },
        },
        children
      );
    },
  };
});

// Mock useAuth hook with proper React component
vi.mock('@/contexts/AuthContext', () => {
  return {
    useAuth: () => ({
      user: null,
      isAuthenticated: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshToken: vi.fn(),
    }),
    AuthProvider: ({ children }: { children: React.ReactNode }) => {
      return React.createElement('div', { 'data-testid': 'auth-provider' }, children);
    },
  };
});

// Mock useTheme hook with proper React component
vi.mock('@/contexts/ThemeContext', () => {
  return {
    useTheme: () => ({
      theme: 'light',
      setTheme: vi.fn(),
    }),
    ThemeProvider: ({ children }: { children: React.ReactNode }) => {
      return React.createElement('div', { 'data-testid': 'theme-provider' }, children);
    },
  };
});
