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

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const createIcon = (name: string) => {
    const Icon = React.forwardRef((props: any, ref: any) =>
      React.createElement('svg', { ...props, ref, 'data-testid': `${name}-icon` }),
    );
    Icon.displayName = name;
    return Icon;
  };

  return {
    Check: createIcon('Check'),
    X: createIcon('X'),
    Plus: createIcon('Plus'),
    Minus: createIcon('Minus'),
    Upload: createIcon('Upload'),
    Download: createIcon('Download'),
    Save: createIcon('Save'),
    Edit: createIcon('Edit'),
    Trash: createIcon('Trash'),
    Search: createIcon('Search'),
    Settings: createIcon('Settings'),
    User: createIcon('User'),
    Home: createIcon('Home'),
    Menu: createIcon('Menu'),
    ChevronLeft: createIcon('ChevronLeft'),
    ChevronRight: createIcon('ChevronRight'),
    ChevronUp: createIcon('ChevronUp'),
    ChevronDown: createIcon('ChevronDown'),
    Image: createIcon('Image'),
    Camera: createIcon('Camera'),
    File: createIcon('File'),
    Folder: createIcon('Folder'),
    Eye: createIcon('Eye'),
    EyeOff: createIcon('EyeOff'),
    Copy: createIcon('Copy'),
    Clipboard: createIcon('Clipboard'),
    RefreshCw: createIcon('RefreshCw'),
    AlertCircle: createIcon('AlertCircle'),
    Info: createIcon('Info'),
    HelpCircle: createIcon('HelpCircle'),
    Loader2: createIcon('Loader2'),
    Share2: createIcon('Share2'),
    MoreVertical: createIcon('MoreVertical'),
    MoreHorizontal: createIcon('MoreHorizontal'),
    Maximize2: createIcon('Maximize2'),
    Minimize2: createIcon('Minimize2'),
    ZoomIn: createIcon('ZoomIn'),
    ZoomOut: createIcon('ZoomOut'),
    Grid: createIcon('Grid'),
    List: createIcon('List'),
    Filter: createIcon('Filter'),
    Moon: createIcon('Moon'),
    Sun: createIcon('Sun'),
    Laptop: createIcon('Laptop'),
    Smartphone: createIcon('Smartphone'),
    Tablet: createIcon('Tablet'),
    Monitor: createIcon('Monitor'),
    Activity: createIcon('Activity'),
    BarChart: createIcon('BarChart'),
    PieChart: createIcon('PieChart'),
    Package: createIcon('Package'),
    Square: createIcon('Square'),
    Circle: createIcon('Circle'),
    Triangle: createIcon('Triangle'),
    Hexagon: createIcon('Hexagon'),
    Pentagon: createIcon('Pentagon'),
    Star: createIcon('Star'),
    Heart: createIcon('Heart'),
    LogOut: createIcon('LogOut'),
    LogIn: createIcon('LogIn'),
    Lock: createIcon('Lock'),
    Unlock: createIcon('Unlock'),
    Shield: createIcon('Shield'),
    Key: createIcon('Key'),
    Mail: createIcon('Mail'),
    MessageSquare: createIcon('MessageSquare'),
    Send: createIcon('Send'),
    Bell: createIcon('Bell'),
    BellOff: createIcon('BellOff'),
    Calendar: createIcon('Calendar'),
    Clock: createIcon('Clock'),
    Timer: createIcon('Timer'),
    Pause: createIcon('Pause'),
    Play: createIcon('Play'),
    StopCircle: createIcon('StopCircle'),
    SkipBack: createIcon('SkipBack'),
    SkipForward: createIcon('SkipForward'),
    Volume: createIcon('Volume'),
    Volume2: createIcon('Volume2'),
    VolumeX: createIcon('VolumeX'),
    Mic: createIcon('Mic'),
    MicOff: createIcon('MicOff'),
    Headphones: createIcon('Headphones'),
    Video: createIcon('Video'),
    VideoOff: createIcon('VideoOff'),
    Wifi: createIcon('Wifi'),
    WifiOff: createIcon('WifiOff'),
    Bluetooth: createIcon('Bluetooth'),
    Battery: createIcon('Battery'),
    BatteryCharging: createIcon('BatteryCharging'),
    Power: createIcon('Power'),
    Cpu: createIcon('Cpu'),
    Database: createIcon('Database'),
    HardDrive: createIcon('HardDrive'),
    Server: createIcon('Server'),
    Cloud: createIcon('Cloud'),
    CloudOff: createIcon('CloudOff'),
    Globe: createIcon('Globe'),
    Navigation: createIcon('Navigation'),
    Map: createIcon('Map'),
    MapPin: createIcon('MapPin'),
    Compass: createIcon('Compass'),
    Flag: createIcon('Flag'),
    Bookmark: createIcon('Bookmark'),
    Tag: createIcon('Tag'),
    Tags: createIcon('Tags'),
    Hash: createIcon('Hash'),
    At: createIcon('At'),
    Link: createIcon('Link'),
    LinkExternal: createIcon('LinkExternal'),
    Paperclip: createIcon('Paperclip'),
    Printer: createIcon('Printer'),
    FileText: createIcon('FileText'),
    FilePlus: createIcon('FilePlus'),
    FileMinus: createIcon('FileMinus'),
    FileCheck: createIcon('FileCheck'),
    FileX: createIcon('FileX'),
    FolderOpen: createIcon('FolderOpen'),
    FolderPlus: createIcon('FolderPlus'),
    FolderMinus: createIcon('FolderMinus'),
    Archive: createIcon('Archive'),
    Inbox: createIcon('Inbox'),
    Gift: createIcon('Gift'),
    Award: createIcon('Award'),
    Trophy: createIcon('Trophy'),
    Target: createIcon('Target'),
    Crosshair: createIcon('Crosshair'),
    Zap: createIcon('Zap'),
    Feather: createIcon('Feather'),
    Edit2: createIcon('Edit2'),
    Edit3: createIcon('Edit3'),
    Type: createIcon('Type'),
    Bold: createIcon('Bold'),
    Italic: createIcon('Italic'),
    Underline: createIcon('Underline'),
    Code: createIcon('Code'),
    Terminal: createIcon('Terminal'),
    Box: createIcon('Box'),
    Layers: createIcon('Layers'),
    Layout: createIcon('Layout'),
    Sidebar: createIcon('Sidebar'),
    Move: createIcon('Move'),
    CornerUpLeft: createIcon('CornerUpLeft'),
    CornerUpRight: createIcon('CornerUpRight'),
    CornerDownLeft: createIcon('CornerDownLeft'),
    CornerDownRight: createIcon('CornerDownRight'),
    TrendingUp: createIcon('TrendingUp'),
    TrendingDown: createIcon('TrendingDown'),
    ArrowUp: createIcon('ArrowUp'),
    ArrowDown: createIcon('ArrowDown'),
    ArrowLeft: createIcon('ArrowLeft'),
    ArrowRight: createIcon('ArrowRight'),
    ArrowUpRight: createIcon('ArrowUpRight'),
    ArrowDownRight: createIcon('ArrowDownRight'),
    ArrowDownLeft: createIcon('ArrowDownLeft'),
    ArrowUpLeft: createIcon('ArrowUpLeft'),
    Briefcase: createIcon('Briefcase'),
    DollarSign: createIcon('DollarSign'),
    CreditCard: createIcon('CreditCard'),
    Percent: createIcon('Percent'),
    Users: createIcon('Users'),
    UserPlus: createIcon('UserPlus'),
    UserMinus: createIcon('UserMinus'),
    UserCheck: createIcon('UserCheck'),
    UserX: createIcon('UserX'),
    Smile: createIcon('Smile'),
    Frown: createIcon('Frown'),
    Meh: createIcon('Meh'),
    ThumbsUp: createIcon('ThumbsUp'),
    ThumbsDown: createIcon('ThumbsDown'),
    MessageCircle: createIcon('MessageCircle'),
    Aperture: createIcon('Aperture'),
    MonitorSmartphone: createIcon('MonitorSmartphone'),
    RefreshCcw: createIcon('RefreshCcw'),
    SlidersHorizontal: createIcon('SlidersHorizontal'),
    ChevronsLeft: createIcon('ChevronsLeft'),
    ChevronsRight: createIcon('ChevronsRight'),
    Scissors: createIcon('Scissors'),
    MousePointer: createIcon('MousePointer'),
    MousePointer2: createIcon('MousePointer2'),
    Undo: createIcon('Undo'),
    Redo: createIcon('Redo'),
    Undo2: createIcon('Undo2'),
    Redo2: createIcon('Redo2'),
    GitMerge: createIcon('GitMerge'),
    GitBranch: createIcon('GitBranch'),
    Wrench: createIcon('Wrench'),
    Tool: createIcon('Tool'),
    Paintbrush: createIcon('Paintbrush'),
    Palette: createIcon('Palette'),
    Eraser: createIcon('Eraser'),
    Hand: createIcon('Hand'),
    Grab: createIcon('Grab'),
    PlusCircle: createIcon('PlusCircle'),
    MinusCircle: createIcon('MinusCircle'),
    CheckCircle: createIcon('CheckCircle'),
    XCircle: createIcon('XCircle'),
    AlertTriangle: createIcon('AlertTriangle'),
    CheckSquare: createIcon('CheckSquare'),
    CircleEllipsis: createIcon('CircleEllipsis'),
    ArrowUpDown: createIcon('ArrowUpDown'),
    ArrowLeftRight: createIcon('ArrowLeftRight'),
    Split: createIcon('Split'),
    Combine: createIcon('Combine'),
    Merge: createIcon('Merge'),
    RotateCw: createIcon('RotateCw'),
    RotateCcw: createIcon('RotateCcw'),
    FlipHorizontal: createIcon('FlipHorizontal'),
    FlipVertical: createIcon('FlipVertical'),
    Maximize: createIcon('Maximize'),
    Minimize: createIcon('Minimize'),
    Expand: createIcon('Expand'),
    Shrink: createIcon('Shrink'),
    FullScreen: createIcon('FullScreen'),
    Trash2: createIcon('Trash2'),
    Keyboard: createIcon('Keyboard'),
    FileSpreadsheet: createIcon('FileSpreadsheet'),
    BarChart3: createIcon('BarChart3'),
    PlusSquare: createIcon('PlusSquare'),
    MinusSquare: createIcon('MinusSquare'),
    FileJson: createIcon('FileJson'),
    FileImage: createIcon('FileImage'),
    FolderArchive: createIcon('FolderArchive'),
    Languages: createIcon('Languages'),
    UserCircle: createIcon('UserCircle'),
    UserCog: createIcon('UserCog'),
    LogInIcon: createIcon('LogInIcon'),
    UserPlusIcon: createIcon('UserPlusIcon'),
    GalleryVerticalEnd: createIcon('GalleryVerticalEnd'),
    ImagePlus: createIcon('ImagePlus'),
    LayoutGrid: createIcon('LayoutGrid'),
    LayoutList: createIcon('LayoutList'),
    // Add any other icons that are used in the codebase
  };
});

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

// Mock unified logger system
vi.mock('@/utils/logging/unifiedLogger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
  },
}));

// Mock legacy logger (re-exports from unified logger)
vi.mock('@/utils/logger', () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
  LogLevel: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4,
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
global.Worker = MockWorker as unknown;

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
        children,
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

// Ensure global timer functions are available for both global and window
if (typeof global !== 'undefined') {
  // Use the actual timer functions from Node.js
  global.setTimeout = global.setTimeout || setTimeout;
  global.clearTimeout = global.clearTimeout || clearTimeout;
  global.setInterval = global.setInterval || setInterval;
  global.clearInterval = global.clearInterval || clearInterval;
}

// Also ensure they're available on window for jsdom
if (typeof window !== 'undefined') {
  window.setTimeout = window.setTimeout || setTimeout;
  window.clearTimeout = window.clearTimeout || clearTimeout;
  window.setInterval = window.setInterval || setInterval;
  window.clearInterval = window.clearInterval || clearInterval;
}

// Mock window.indexedDB
if (typeof window !== 'undefined' && !window.indexedDB) {
  (window as Window & { indexedDB?: unknown }).indexedDB = {
    open: vi.fn().mockReturnValue({
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
      result: {
        close: vi.fn(),
        createObjectStore: vi.fn(),
        deleteObjectStore: vi.fn(),
        transaction: vi.fn().mockReturnValue({
          objectStore: vi.fn().mockReturnValue({
            add: vi.fn(),
            get: vi.fn(),
            put: vi.fn(),
            delete: vi.fn(),
            clear: vi.fn(),
            getAll: vi.fn(),
          }),
          oncomplete: null,
          onerror: null,
        }),
      },
    }),
    deleteDatabase: vi.fn(),
  };
}

// Mock app.config.validated
vi.mock('@/config/app.config.validated', () => ({
  appConfig: {
    organization: {
      name: 'SpherosegV4',
      tagline: 'Cell Segmentation Made Easy',
      supportEmail: 'support@spheroseg.com',
      supportPhone: '+1 (555) 123-4567',
      githubUrl: 'https://github.com/spheroseg/spheroseg',
      documentationUrl: 'https://docs.spheroseg.com',
    },
    legal: {
      privacyPolicyUrl: '/privacy',
      termsOfServiceUrl: '/terms',
      copyrightYear: 2024,
      copyrightHolder: 'SpherosegV4 Team',
    },
    features: {
      enableDemoMode: false,
      enableAnalytics: false,
      enableErrorReporting: false,
      maintenanceMode: false,
    },
    ui: {
      defaultTheme: 'light' as const,
      enableThemeToggle: true,
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
    },
    api: {
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
    },
    storage: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
      allowedImageExtensions: ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'],
    },
    segmentation: {
      maxPolygonsPerImage: 1000,
      minPolygonArea: 10,
      defaultPolygonColor: '#00ff00',
      vertexSize: 8,
      edgeWidth: 2,
    },
    export: {
      formats: {
        annotation: ['COCO', 'YOLO', 'JSON'] as const,
        metrics: ['EXCEL', 'CSV', 'JSON'] as const,
      },
      maxBatchSize: 100,
    },
  },
  getOrganizationName: () => 'SpherosegV4',
  getSupportEmail: () => 'support@spheroseg.com',
  getCopyrightText: () => '© 2024 SpherosegV4 Team. All rights reserved.',
  isFeatureEnabled: (feature: string) => false,
  getDefaultTheme: () => 'light' as const,
  getSupportedLanguages: () => ['en', 'cs', 'de', 'es', 'fr', 'zh'],
  getAllowedImageTypes: () => ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
  getMaxFileSize: () => 50 * 1024 * 1024,
}));

// Mock useUndoRedo hook
vi.mock('@/hooks/useUndoRedo', () => ({
  useUndoRedo: vi.fn((initialState) => ({
    state: initialState,
    setState: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    canUndo: false,
    canRedo: false,
    clearHistory: vi.fn(),
    setCurrentStateOnly: vi.fn(),
  })),
}));

// Mock @radix-ui components
vi.mock('@/lib/radix-optimized', () => ({
  SelectContent: ({ children }: any) => React.createElement('div', { 'data-testid': 'select-content' }, children),
  SelectItem: ({ children, value }: any) =>
    React.createElement('option', { value, 'data-testid': `select-item-${value}` }, children),
  SelectTrigger: ({ children }: any) => React.createElement('button', { 'data-testid': 'select-trigger' }, children),
  SelectValue: ({ placeholder }: any) => React.createElement('span', { 'data-testid': 'select-value' }, placeholder),
  SelectRoot: ({ children }: any) => React.createElement('div', { 'data-testid': 'select-root' }, children),
  DialogRoot: ({ children, open }: any) =>
    open !== false ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null,
  DialogTrigger: ({ children }: any) => React.createElement('button', { 'data-testid': 'dialog-trigger' }, children),
  DialogPortal: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog-portal' }, children),
  DialogOverlay: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog-overlay' }, children),
  DialogContent: ({ children }: any) => React.createElement('div', { 'data-testid': 'dialog-content' }, children),
  DialogTitle: ({ children }: any) => React.createElement('h2', { 'data-testid': 'dialog-title' }, children),
  DialogDescription: ({ children }: any) => React.createElement('p', { 'data-testid': 'dialog-description' }, children),
  DialogClose: ({ children }: any) => React.createElement('button', { 'data-testid': 'dialog-close' }, children),
}));
