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
vi.mock('@/i18n', () => {
  // Global state that can be controlled by tests
  let currentTestLanguage = 'en';
  
  // Define translations inside the mock factory
  const allTranslations = {
    en: { 
      'hello': 'Hello',
      'greeting.welcome': 'Welcome',
      'greeting.morning': 'Good morning',
      'greeting.evening': 'Good evening',
      'items.zero': 'No items',
      'items.one': 'One item',
      'items.other': '{{count}} items',
      'params': 'Hello, {{name}}! Today is {{date, date}}',
      'nested.deeply.key': 'Deeply nested key',
    },
    cs: {
      'hello': 'Ahoj',
      'greeting.welcome': 'Vítejte',
      'greeting.morning': 'Dobré ráno',
      'greeting.evening': 'Dobrý večer',
      'items.zero': 'Žádné položky',
      'items.one': 'Jedna položka',
      'items.few': '{{count}} položky',
      'items.many': '{{count}} položek',
      'items.other': '{{count}} položek',
      'params': 'Ahoj, {{name}}! Dnes je {{date, date}}',
      'nested.deeply.key': 'Hluboce vnořený klíč',
    },
    de: { hello: 'Hallo', 'greeting.welcome': 'Willkommen' },
    es: { hello: 'Hola', 'greeting.welcome': 'Bienvenido' },
    fr: { hello: 'Bonjour', 'greeting.welcome': 'Bienvenue' },
    zh: { hello: '你好', 'greeting.welcome': '欢迎' },
  };
  
  const mockTFunction = vi.fn().mockImplementation((key, options, fallback) => {
    if (!key) return key;
    
    // Always get current language from global state - this ensures reactivity
    const currentLang = (global as any).__testCurrentLanguage || currentTestLanguage;
    const translations = allTranslations[currentLang] || allTranslations.en;
    
    // Debug logging for language mismatch
    if (key === 'hello') {
      console.log('[mockTFunction] Key:', key, 'currentTestLanguage:', currentTestLanguage, 'GlobalLang:', (global as any).__testCurrentLanguage, 'FinalLang:', currentLang, 'Translation:', translations[key]);
    }
    
    // Return the translation, fallback, or key
    if (translations[key]) {
      let translated = translations[key];
      
      // Handle parameters in translation strings
      if (options && typeof translated === 'string') {
        Object.entries(options).forEach(([paramKey, paramValue]) => {
          if (!paramKey.startsWith('_')) {
            const regex = new RegExp(`{{${paramKey}}}`, 'g');
            translated = translated.replace(regex, String(paramValue));
            
            // Handle date formatting
            const dateRegex = new RegExp(`{{${paramKey},\\s*datetime}}`, 'g');
            if (paramValue instanceof Date && dateRegex.test(translated)) {
              translated = translated.replace(dateRegex, paramValue.toLocaleDateString());
            }
          }
        });
      }
      
      return translated;
    }
    
    // If translation not found, return fallback or key
    if (fallback) return fallback;
    if (options?.defaultValue) return options.defaultValue;
    return key;
  });
  
  const i18nInstance = {
    isInitialized: true,
    get language() { 
      return (global as any).__testCurrentLanguage || currentTestLanguage; 
    },
    changeLanguage: vi.fn().mockImplementation(async (lang) => {
      currentTestLanguage = lang;
      (global as any).__testCurrentLanguage = lang;
      return Promise.resolve();
    }),
    t: mockTFunction,
    options: {
      resources: {
        en: { translation: allTranslations.en },
        cs: { translation: allTranslations.cs },
        de: { translation: allTranslations.de },
        es: { translation: allTranslations.es },
        fr: { translation: allTranslations.fr },
        zh: { translation: allTranslations.zh }
      }
    }
  };
  
  // Store global references for test control - make them accessible
  (global as any).__testCurrentLanguage = currentTestLanguage;
  (global as any).__testMockTFunction = mockTFunction;
  (global as any).__testSetLanguage = (lang: string) => { 
    currentTestLanguage = lang;
    (global as any).__testCurrentLanguage = lang;
  };
  (global as any).__testTranslations = allTranslations;
  
  return {
    i18nInitializedPromise: Promise.resolve(i18nInstance),
    default: i18nInstance,
  };
});

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const createIcon = (name: string) => {
    const Icon = React.forwardRef((props: any, ref: any) => {
      // Convert camelCase to kebab-case for CSS class names  
      // Handle specific mappings for common patterns
      let kebabName = name
        .replace(/([A-Z][a-z])/g, '-$1')  // Insert dash before capital letters followed by lowercase
        .replace(/([a-z])([A-Z])/g, '$1-$2')  // Insert dash between lowercase and uppercase
        .toLowerCase()
        .replace(/^-/, '');  // Remove leading dash
      
      const className = `lucide lucide-${kebabName} ${props.className || ''}`.trim();
      
      return React.createElement('svg', { 
        ...props, 
        ref, 
        'data-testid': `${name}-icon`,
        className
      });
    });
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
    // Icons needed by ProjectImageProcessor tests
    LoaderCircle: createIcon('LoaderCircle'),
    CircleCheckBig: createIcon('CircleCheckBig'),
    TriangleAlert: createIcon('TriangleAlert'),
    // Add any other icons that are used in the codebase
  };
});

// Mock react-i18next with actual translation mappings
const mockTranslations: Record<string, string> = {
  // Basic test translations
  'hello': 'Hello',
  'greeting.welcome': 'Welcome',
  
  // Common translations
  'Export Options': 'Export Options',
  'Include Project Metadata': 'Include Project Metadata',
  'Include Segmentation': 'Include Segmentation',
  'Include Object Metrics': 'Include Object Metrics',
  'Include Original Images': 'Include Original Images',
  'Select Export Format': 'Select Export Format',
  'Select Metrics Format': 'Select Metrics Format',
  'Export Metrics Only': 'Export Metrics Only',
  
  // Export specific translations
  'export.title': 'Export Options',
  'export.options.includeMetadata': 'Include Project Metadata',
  'export.options.includeSegmentation': 'Include Segmentation',
  'export.options.includeObjectMetrics': 'Include Object Metrics',
  'export.options.includeImages': 'Include Original Images',
  'export.options.selectExportFormat': 'Select Export Format',
  'export.options.selectMetricsFormat': 'Select Metrics Format',
  'export.options.exportMetricsOnly': 'Export Metrics Only',
  'export.metricsRequireSegmentation': 'Metrics require segmentation to be completed',
  'export.selectImagesForExport': 'Select images for export',
  'export.formats.COCO': 'COCO JSON',
  'export.formats.YOLO': 'YOLO TXT',
  'export.formats.MASK': 'Mask (TIFF)',
  'export.formats.POLYGONS': 'Polygons (JSON)',
  'export.formats.DATUMARO': 'Datumaro',
  'export.formats.CVAT_MASKS': 'CVAT Masks',
  'export.formats.CVAT_YAML': 'CVAT YAML',
  'export.formatDescriptions.COCO': 'Common Objects in Context format',
  'export.formatDescriptions.YOLO': 'You Only Look Once format',
  'export.formatDescriptions.MASK': 'Binary mask images',
  'export.formatDescriptions.POLYGONS': 'Raw polygon coordinates',
  'export.metricsFormats.EXCEL': 'Excel (.xlsx)',
  'export.metricsFormats.CSV': 'CSV (.csv)',
  'export.options.metricsFormatDescription.EXCEL': 'Excel spreadsheet with multiple worksheets',
  'export.options.metricsFormatDescription.CSV': 'Comma-separated values file',
  
  // Common UI elements
  'common.loading': 'Loading...',
  'common.error': 'Error',
  'common.success': 'Success',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.close': 'Close',
  'common.open': 'Open',
  'common.view': 'View',
  'common.download': 'Download',
  'common.upload': 'Upload',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.sort': 'Sort',
  'common.refresh': 'Refresh',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.previous': 'Previous',
  'common.continue': 'Continue',
  'common.submit': 'Submit',
  'common.reset': 'Reset',
  'common.clear': 'Clear',
  'common.select': 'Select',
  'common.confirm': 'Confirm',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.ok': 'OK',
  'common.apply': 'Apply',
  'common.copy': 'Copy',
  'common.paste': 'Paste',
  'common.cut': 'Cut',
  'common.undo': 'Undo',
  'common.redo': 'Redo',
  'common.zoom': 'Zoom',
  'common.zoomIn': 'Zoom In',
  'common.zoomOut': 'Zoom Out',
  'common.fullscreen': 'Fullscreen',
  'common.exit': 'Exit',
  'common.help': 'Help',
  'common.settings': 'Settings',
  'common.preferences': 'Preferences',
  'common.options': 'Options',
  'common.tools': 'Tools',
  'common.info': 'Information',
  'common.warning': 'Warning',
  'common.notice': 'Notice',
  
  // Auth translations
  'auth.login': 'Login',
  'auth.logout': 'Logout',
  'auth.register': 'Register',
  'auth.email': 'Email',
  'auth.password': 'Password',
  
  // Project translations
  'project.name': 'Project Name',
  'project.description': 'Description',
  'project.images': 'Images',
  'project.create': 'Create Project',
  'project.delete': 'Delete Project',
  
  // Navigation - comprehensive keys
  'nav.home': 'Home',
  'nav.projects': 'Projects',
  'nav.profile': 'Profile',
  'nav.settings': 'Settings',
  'navigation.dashboard': 'Dashboard',
  'navigation.projects': 'Projects',
  'navigation.profile': 'Profile',
  'navigation.settings': 'Settings',
  'navigation.home': 'Home',
  'navigation.about': 'About',
  'navigation.contact': 'Contact',
  'navigation.help': 'Help',
  'navigation.login': 'Login',
  'navigation.logout': 'Logout',
  'navigation.register': 'Register',
};

vi.mock('react-i18next', () => {
  return {
    useTranslation: () => ({
      t: vi.fn().mockImplementation((key: string, params?: any) => {
        if (!key) return key;
        
        // Use the global mock function from i18n mock
        if ((global as any).__testMockTFunction) {
          return (global as any).__testMockTFunction(key, params);
        }
        
        // Fallback to mockTranslations
        let translation = mockTranslations[key] || key;
        
        // Handle parameter replacement
        if (params && typeof translation === 'string') {
          Object.entries(params).forEach(([paramKey, paramValue]) => {
            if (!paramKey.startsWith('_')) {
              const regex = new RegExp(`{{${paramKey}}}`, 'g');
              translation = translation.replace(regex, String(paramValue));
              
              // Simple date format simulation
              const dateRegex = new RegExp(`{{${paramKey}, date}}`, 'g');
              if (paramValue instanceof Date && dateRegex.test(translation)) {
                translation = translation.replace(dateRegex, paramValue.toLocaleDateString());
              }
            }
          });
        }
        
        return translation;
      }),
      i18n: {
        changeLanguage: vi.fn().mockImplementation((lang) => {
          currentTestLanguage = lang;
          (global as any).__testCurrentLanguage = lang;
          return Promise.resolve();
        }),
        get language() { 
          return (global as any).__testCurrentLanguage || 'en';
        },
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
  };
});

// Mock i18next
vi.mock('i18next', () => {
  const mockI18next = {
    use: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    changeLanguage: vi.fn().mockImplementation((lang) => {
      currentTestLanguage = lang;
      (global as any).__testCurrentLanguage = lang;
      return Promise.resolve();
    }),
    t: vi.fn().mockImplementation((key: string, params?: any) => {
      // Use the global mock function from i18n mock
      if ((global as any).__testMockTFunction) {
        return (global as any).__testMockTFunction(key, params);
      }
      // Fallback to simple translation
      const translation = mockTranslations[key] || key;
      
      if (params && typeof translation === 'string') {
        return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
          return params[param] || match;
        });
      }
      return translation;
    }),
    get language() { 
      return (global as any).__testCurrentLanguage || 'en';
    },
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
    updateUserProfile: vi.fn().mockResolvedValue({
      id: '1',
      user_id: '1',
      username: 'testuser',
      full_name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    deleteAvatar: vi.fn().mockResolvedValue({ message: 'Avatar deleted' }),
    getUserProfile: vi.fn().mockResolvedValue({
      id: '1',
      user_id: '1',
      username: 'testuser',
      full_name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }),
    uploadAvatar: vi.fn().mockResolvedValue({ avatar_url: 'https://example.com/avatar.jpg' }),
    getUserProfileWithSettings: vi.fn().mockResolvedValue({
      profile: {
        id: '1',
        user_id: '1',
        username: 'testuser',
        full_name: 'Test User',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      settings: {},
    }),
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

// Mock @/services/api/client (for useAuthApi and other services)
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock Socket.IO
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  })),
}));

// Mock UnifiedWebSocketService
vi.mock('@/services/unifiedWebSocketService', () => ({
  UnifiedWebSocketService: {
    getInstance: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      joinRoom: vi.fn().mockResolvedValue(undefined),
      leaveRoom: vi.fn().mockResolvedValue(undefined),
      isConnected: vi.fn().mockReturnValue(false),
      enableBatching: vi.fn(),
      setQueueOptions: vi.fn(),
    }))
  }
}));

// Mock lib logger (re-exports from utils/logger)
vi.mock('@/lib/logger', () => {
  const mockLogs: any[] = [];
  let mockLevel = 1; // INFO level by default
  return {
    default: {
      debug: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 0) { // DEBUG level
          mockLogs.push({ level: 0, message, data, timestamp: new Date().toISOString() });
        }
      }),
      info: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 1) { // INFO level
          mockLogs.push({ level: 1, message, data, timestamp: new Date().toISOString() });
        }
      }),
      warn: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 2) { // WARN level
          mockLogs.push({ level: 2, message, data, timestamp: new Date().toISOString() });
        }
      }),
      error: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 3) { // ERROR level
          mockLogs.push({ level: 3, message, data, timestamp: new Date().toISOString() });
        }
      }),
      setLevel: vi.fn((level: number) => mockLevel = level),
    },
    createLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setLevel: vi.fn(),
    })),
    createNamespacedLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setLevel: vi.fn(),
    })),
    getLogger: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      setLevel: vi.fn(),
    })),
    getLogs: vi.fn(() => mockLogs),
    clearLogs: vi.fn(() => mockLogs.length = 0),
  };
});

// Mock unified logger system
vi.mock('@/utils/logging/unifiedLogger', () => {
  const mockLogs: any[] = [];
  let mockLevel = 1; // INFO level by default

  return {
    default: {
      debug: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 0) { // DEBUG level
          mockLogs.push({ level: 0, message, data, timestamp: new Date().toISOString() });
        }
      }),
      info: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 1) { // INFO level
          mockLogs.push({ level: 1, message, data, timestamp: new Date().toISOString() });
        }
      }),
      warn: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 2) { // WARN level
          mockLogs.push({ level: 2, message, data, timestamp: new Date().toISOString() });
        }
      }),
      error: vi.fn((message: string, error?: any, context?: any) => {
        if (mockLevel <= 3) { // ERROR level
          mockLogs.push({ level: 3, message, error, context, timestamp: new Date().toISOString() });
        }
      }),
      getLogs: vi.fn(() => [...mockLogs]),
      clearLogs: vi.fn(() => mockLogs.length = 0),
      getLevel: vi.fn(() => mockLevel),
      setLevel: vi.fn((level: number) => mockLevel = level),
      child: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        getLogs: vi.fn(() => []),
        clearLogs: vi.fn(),
        getLevel: vi.fn(() => mockLevel),
        setLevel: vi.fn((level: number) => mockLevel = level),
      })),
    },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    getLogs: vi.fn(() => []),
    clearLogs: vi.fn(),
    getLevel: vi.fn(() => 1),
    setLevel: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    getLogs: vi.fn(() => []),
    clearLogs: vi.fn(),
    getLevel: vi.fn(() => 1),
    setLevel: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      NONE: 4,
    },
  };
});

// Mock legacy logger (re-exports from unified logger)
vi.mock('@/utils/logger', async (importOriginal) => {
  const actual = await importOriginal();
  const mockLogs: any[] = [];
  let mockLevel = 1; // INFO level by default

  return {
    ...actual,
    default: {
      debug: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 0) { // DEBUG level
          mockLogs.push({ level: 0, message, data, timestamp: new Date().toISOString() });
        }
      }),
      info: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 1) { // INFO level
          mockLogs.push({ level: 1, message, data, timestamp: new Date().toISOString() });
        }
      }),
      warn: vi.fn((message: string, data?: any) => {
        if (mockLevel <= 2) { // WARN level
          mockLogs.push({ level: 2, message, data, timestamp: new Date().toISOString() });
        }
      }),
      error: vi.fn((message: string, error?: any, context?: any) => {
        if (mockLevel <= 3) { // ERROR level
          mockLogs.push({ level: 3, message, error, context, timestamp: new Date().toISOString() });
        }
      }),
      getLogs: vi.fn(() => [...mockLogs]),
      clearLogs: vi.fn(() => mockLogs.length = 0),
      getLevel: vi.fn(() => mockLevel),
      setLevel: vi.fn((level: number) => mockLevel = level),
      child: vi.fn(() => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        getLogs: vi.fn(() => []),
        clearLogs: vi.fn(),
        getLevel: vi.fn(() => mockLevel),
        setLevel: vi.fn((level: number) => mockLevel = level),
      })),
    },
  createLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    getLogs: vi.fn(() => []),
    clearLogs: vi.fn(),
    getLevel: vi.fn(() => 1),
    setLevel: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
  getLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    getLogs: vi.fn(() => []),
    clearLogs: vi.fn(),
    getLevel: vi.fn(() => 1),
    setLevel: vi.fn(),
    child: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  })),
  createNamespacedLogger: vi.fn(() => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    setLevel: vi.fn(),
  })),
    LogLevel: {
      DEBUG: 0,
      INFO: 1,
      WARN: 2,
      ERROR: 3,
      NONE: 4,
    },
  };
});

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

// Don't mock LanguageContext here - let individual tests handle it as needed

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
// This fixes the "clearInterval is not defined" error in jsdom
if (typeof global !== 'undefined') {
  // Use the actual timer functions from Node.js
  global.setTimeout = global.setTimeout || setTimeout;
  global.clearTimeout = global.clearTimeout || clearTimeout;
  global.setInterval = global.setInterval || setInterval;
  global.clearInterval = global.clearInterval || clearInterval;
  
  // Also make them available as window properties for jsdom compatibility
  if (typeof globalThis !== 'undefined') {
    globalThis.setTimeout = global.setTimeout;
    globalThis.clearTimeout = global.clearTimeout;
    globalThis.setInterval = global.setInterval;
    globalThis.clearInterval = global.clearInterval;
  }
}

// Ensure they're available on window for jsdom
if (typeof window !== 'undefined') {
  window.setTimeout = window.setTimeout || global.setTimeout || setTimeout;
  window.clearTimeout = window.clearTimeout || global.clearTimeout || clearTimeout;
  window.setInterval = window.setInterval || global.setInterval || setInterval;
  window.clearInterval = window.clearInterval || global.clearInterval || clearInterval;
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

// Mock the main config file
vi.mock('@/config', () => ({
  default: {
    apiUrl: '/api',
    apiBaseUrl: '/api',
    apiAuthPrefix: '/api/auth',
    apiUsersPrefix: '/api/users',
    isDevelopment: true,
    isProduction: false,
  }
}));

// Mock zod for validation tests
vi.mock('zod', () => {
  // Create a mock ZodError class
  class ZodError extends Error {
    constructor(issues: any[]) {
      super('Validation error');
      this.name = 'ZodError';
      this.issues = issues || [];
    }
    issues: any[];
  }
  
  // Make ZodError available on the constructor for instanceof checks
  ZodError.prototype.constructor = ZodError;

  // Create a chainable mock validator
  const createChainableMock = () => ({
    email: () => createChainableMock(),
    min: () => createChainableMock(),
    max: () => createChainableMock(),
    optional: () => createChainableMock(),
    refine: () => createChainableMock(),
    safeParse: vi.fn((value: any) => ({
      success: true,
      data: value,
    })),
    parse: vi.fn((value: any) => value),
  });
  
  return {
    z: {
      ZodError,
      string: () => createChainableMock(),
      number: () => createChainableMock(),
      boolean: () => createChainableMock(),
      object: () => createChainableMock(),
      array: () => createChainableMock(),
      enum: (values: any[], options?: any) => ({
        ...createChainableMock(),
        _values: values,
        options,
      }),
      literal: (value: any) => createChainableMock(),
      union: (...schemas: any[]) => createChainableMock(),
      undefined: () => createChainableMock(),
      null: () => createChainableMock(),
      any: () => createChainableMock(),
    },
  };
});

// Mock app.config.validated
vi.mock('@/config/app.config.validated', () => {
  const { z } = require('zod');
  
  // Create a proper mock config that can be mutated during tests
  let mockAppConfig = {
    app: {
      name: 'SpheroSeg',
      fullName: 'Spheroid Segmentation Platform',
      description: 'Advanced platform for spheroid segmentation and analysis',
      version: '1.0.0',
    },
    contact: {
      email: 'spheroseg@utia.cas.cz',
      supportEmail: 'support@spheroseg.com',
      privacyEmail: 'spheroseg@utia.cas.cz',
      developer: {
        name: 'Michal Průšek',
        title: 'Bc. Michal Průšek',
        email: 'prusemic@cvut.cz',
      },
    },
    organization: {
      primary: {
        name: 'FNSPE CTU in Prague',
        nameShort: 'FNSPE CTU',
        url: 'https://www.fjfi.cvut.cz/',
      },
      supervisor: {
        name: 'UTIA CAS',
        fullName: 'Institute of Information Theory and Automation',
        url: 'https://www.utia.cas.cz/',
      },
      collaborator: {
        name: 'UCT Prague',
        department: 'Department of Biochemistry and Microbiology',
        url: 'https://www.uct.cz/',
      },
    },
    social: {
      github: {
        url: 'https://github.com/michalprusek/spheroseg',
        username: 'michalprusek',
      },
      twitter: {
        url: 'https://twitter.com/spheroseg',
        username: '@spheroseg',
      },
    },
    api: {
      baseUrl: '/api',
      timeout: 30000,
      retryAttempts: 3,
    },
    features: {
      enableRegistration: true,
      enableGoogleAuth: false,
      enableGithubAuth: false,
      enableExperimentalFeatures: false,
      maintenanceMode: false,
    },
    ui: {
      defaultTheme: 'system' as const,
      defaultLanguage: 'en',
      supportedLanguages: ['en', 'cs', 'de', 'es', 'fr', 'zh'],
      animationsEnabled: true,
      maxFileUploadSize: 10 * 1024 * 1024, // 10MB
      acceptedImageFormats: ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
    },
    legal: {
      privacyPolicyUrl: '/privacy-policy',
      termsOfServiceUrl: '/terms-of-service',
      cookiePolicyUrl: '/cookie-policy',
      lastUpdated: '2025-01-07',
    },
    analytics: {
      enabled: false,
      googleAnalyticsId: undefined,
      sentryDsn: undefined,
    },
    development: {
      enableDevTools: true,
      enableLogging: true,
      logLevel: 'info' as const,
    },
  };

  // Create a mock schema with proper validation simulation
  const MockAppConfigSchema = {
    parse: vi.fn((data: any) => {
      // Simulate validation by checking for obvious invalid data
      if (data.contact?.email && !data.contact.email.includes('@')) {
        throw new z.ZodError([{ message: 'Invalid email' }]);
      }
      if (data.organization?.primary?.url && !data.organization.primary.url.startsWith('http')) {
        throw new z.ZodError([{ message: 'Invalid URL' }]);
      }
      if (data.app?.version && !/^\d+\.\d+\.\d+$/.test(data.app.version)) {
        throw new z.ZodError([{ message: 'Invalid version format' }]);
      }
      if (data.social?.twitter?.username && !data.social.twitter.username.startsWith('@')) {
        throw new z.ZodError([{ message: 'Invalid Twitter username' }]);
      }
      if (data.legal?.lastUpdated && !/^\d{4}-\d{2}-\d{2}$/.test(data.legal.lastUpdated)) {
        throw new z.ZodError([{ message: 'Invalid date format' }]);
      }
      if (data.api?.timeout && data.api.timeout <= 0) {
        throw new z.ZodError([{ message: 'Invalid timeout' }]);
      }
      if (data.api?.retryAttempts && (data.api.retryAttempts < 0 || data.api.retryAttempts > 5)) {
        throw new z.ZodError([{ message: 'Invalid retry attempts' }]);
      }
      if (data.ui?.defaultLanguage && data.ui.defaultLanguage.length !== 2) {
        throw new z.ZodError([{ message: 'Invalid language code' }]);
      }
      if (data.ui?.supportedLanguages && data.ui.supportedLanguages.length === 0) {
        throw new z.ZodError([{ message: 'Empty supported languages' }]);
      }
      return data;
    }),
    shape: {
      app: { 
        parse: vi.fn((data: any) => {
          if (data.version && !/^\d+\.\d+\.\d+$/.test(data.version)) {
            throw new z.ZodError([{ message: 'Invalid version format' }]);
          }
          return data;
        }) 
      },
      contact: { parse: vi.fn((data: any) => data) },
      organization: { parse: vi.fn((data: any) => data) },
      social: { parse: vi.fn((data: any) => data) },
      api: { parse: vi.fn((data: any) => data) },
      features: { parse: vi.fn((data: any) => data) },
      ui: { parse: vi.fn((data: any) => data) },
      legal: { parse: vi.fn((data: any) => data) },
      analytics: { parse: vi.fn((data: any) => data) },
      development: { parse: vi.fn((data: any) => data) },
    },
  };

  return {
    appConfig: mockAppConfig,
    // Mock getConfig that returns actual sections from mock config or full config
    getConfig: vi.fn((section?: string) => {
      if (!section) {
        return mockAppConfig;
      }
      return mockAppConfig[section as keyof typeof mockAppConfig] || {};
    }),
    // Mock updateConfig that actually updates the mock
    updateConfig: vi.fn((section: string, updates: any) => {
      if (mockAppConfig[section as keyof typeof mockAppConfig]) {
        Object.assign(mockAppConfig[section as keyof typeof mockAppConfig], updates);
      }
    }),
    // Helper functions
    getContactEmail: vi.fn(() => mockAppConfig.contact.email),
    getSupportEmail: vi.fn(() => mockAppConfig.contact.supportEmail),
    getAppName: vi.fn(() => mockAppConfig.app.name),
    getAppFullName: vi.fn(() => mockAppConfig.app.fullName),
    getOrganizationName: vi.fn(() => mockAppConfig.organization.primary.name),
    getGithubUrl: vi.fn(() => mockAppConfig.social.github.url),
    // Mock schema export
    AppConfigSchema: MockAppConfigSchema,
    // Keep backward-compatible exports for existing tests
    getCopyrightText: vi.fn(() => '© 2025 SpheroSeg Team. All rights reserved.'),
    isFeatureEnabled: vi.fn((feature: string) => false),
    getDefaultTheme: vi.fn(() => 'system' as const),
    getSupportedLanguages: vi.fn(() => ['en', 'cs', 'de', 'es', 'fr', 'zh']),
    getAllowedImageTypes: vi.fn(() => ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp']),
    getMaxFileSize: vi.fn(() => 10 * 1024 * 1024),
  };
});


// Mock @radix-ui components - comprehensive mock for all radix-optimized exports
vi.mock('@/lib/radix-optimized', () => ({
  // Checkbox components
  CheckboxRoot: ({ children, ...props }: any) => 
    React.createElement('input', { type: 'checkbox', 'data-testid': 'checkbox-root', ...props }, children),
  CheckboxIndicator: ({ children }: any) => 
    React.createElement('span', { 'data-testid': 'checkbox-indicator' }, children),

  // Dialog components - fixed structure
  DialogRoot: ({ children, open }: any) => 
    open !== false ? React.createElement('div', { 'data-testid': 'dialog-root' }, children) : null,
  DialogTrigger: ({ children, asChild, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'dialog-trigger', ...props }, children),
  DialogPortal: ({ children }: any) => 
    React.createElement('div', { 'data-testid': 'dialog-portal' }, children),
  DialogOverlay: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dialog-overlay', ...props }, children),
  DialogContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dialog-content', role: 'dialog', ...props }, children),
  DialogTitle: ({ children, ...props }: any) => 
    React.createElement('h2', { 'data-testid': 'dialog-title', ...props }, children),
  DialogDescription: ({ children, ...props }: any) => 
    React.createElement('p', { 'data-testid': 'dialog-description', ...props }, children),
  DialogClose: ({ children, asChild, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'dialog-close', ...props }, children),

  // Select components - proper hierarchy that avoids DOM nesting issues
  SelectRoot: ({ children, value, onValueChange, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'select-root', 'data-value': value, ...props }, children),
  SelectGroup: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'select-group', ...props }, children),
  SelectValue: ({ placeholder, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'select-value', ...props }, placeholder),
  SelectTrigger: ({ children, asChild, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'select-trigger', ...props }, children),
  SelectContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'select-content', role: 'listbox', ...props }, children),
  SelectLabel: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'select-label', ...props }, children),
  SelectItem: ({ children, value, ...props }: any) => 
    React.createElement('div', { 'data-testid': `select-item-${value}`, 'data-value': value, role: 'option', ...props }, children),
  SelectSeparator: (props: any) => 
    React.createElement('div', { 'data-testid': 'select-separator', ...props }),
  SelectScrollUpButton: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'select-scroll-up', ...props }, children),
  SelectScrollDownButton: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'select-scroll-down', ...props }, children),
  SelectViewport: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'select-viewport', ...props }, children),
  SelectIcon: ({ children, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'select-icon', ...props }, children),
  SelectPortal: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'select-portal', ...props }, children),
  SelectItemText: ({ children, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'select-item-text', ...props }, children),
  SelectItemIndicator: ({ children, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'select-item-indicator', ...props }, children),

  // Dropdown Menu components
  DropdownMenuRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-root', ...props }, children),
  DropdownMenuTrigger: ({ children, asChild, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'dropdown-menu-trigger', ...props }, children),
  DropdownMenuContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-content', role: 'menu', ...props }, children),
  DropdownMenuItem: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-item', role: 'menuitem', ...props }, children),
  DropdownMenuCheckboxItem: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-checkbox-item', role: 'menuitemcheckbox', ...props }, children),
  DropdownMenuRadioItem: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-radio-item', role: 'menuitemradio', ...props }, children),
  DropdownMenuLabel: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-label', ...props }, children),
  DropdownMenuSeparator: (props: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-separator', ...props }),
  DropdownMenuGroup: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-group', role: 'group', ...props }, children),
  DropdownMenuPortal: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-portal', ...props }, children),
  DropdownMenuSub: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-sub', ...props }, children),
  DropdownMenuSubContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-sub-content', ...props }, children),
  DropdownMenuSubTrigger: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'dropdown-menu-sub-trigger', ...props }, children),
  DropdownMenuRadioGroup: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'dropdown-menu-radio-group', role: 'radiogroup', ...props }, children),
  DropdownMenuItemIndicator: ({ children, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'dropdown-menu-item-indicator', ...props }, children),

  // Toast components
  ToastProvider: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'toast-provider', ...props }, children),
  ToastRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'toast-root', role: 'status', ...props }, children),
  ToastAction: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'toast-action', ...props }, children),
  ToastClose: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'toast-close', ...props }, children),
  ToastViewport: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'toast-viewport', ...props }, children),
  ToastTitle: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'toast-title', ...props }, children),
  ToastDescription: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'toast-description', ...props }, children),

  // Tooltip components
  TooltipProvider: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tooltip-provider', ...props }, children),
  TooltipRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tooltip-root', ...props }, children),
  TooltipTrigger: ({ children, asChild, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'tooltip-trigger', ...props }, children),
  TooltipContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tooltip-content', role: 'tooltip', ...props }, children),
  TooltipArrow: (props: any) => 
    React.createElement('div', { 'data-testid': 'tooltip-arrow', ...props }),
  TooltipPortal: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tooltip-portal', ...props }, children),

  // Other components (Tabs, Progress, RadioGroup, Switch, ScrollArea, AlertDialog, Label, Slot)
  TabsRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tabs-root', ...props }, children),
  TabsList: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tabs-list', role: 'tablist', ...props }, children),
  TabsTrigger: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'tabs-trigger', role: 'tab', ...props }, children),
  TabsContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'tabs-content', role: 'tabpanel', ...props }, children),

  ProgressRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'progress-root', role: 'progressbar', ...props }, children),
  ProgressIndicator: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'progress-indicator', ...props }, children),

  RadioGroupRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'radio-group-root', role: 'radiogroup', ...props }, children),
  RadioGroupItem: ({ children, ...props }: any) => 
    React.createElement('input', { type: 'radio', 'data-testid': 'radio-group-item', ...props }, children),
  RadioGroupIndicator: ({ children, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'radio-group-indicator', ...props }, children),

  SwitchRoot: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'switch-root', role: 'switch', ...props }, children),
  SwitchThumb: ({ children, ...props }: any) => 
    React.createElement('span', { 'data-testid': 'switch-thumb', ...props }, children),

  ScrollAreaRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'scroll-area-root', ...props }, children),
  ScrollAreaViewport: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'scroll-area-viewport', ...props }, children),
  ScrollAreaScrollbar: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'scroll-area-scrollbar', ...props }, children),
  ScrollAreaThumb: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'scroll-area-thumb', ...props }, children),
  ScrollAreaCorner: (props: any) => 
    React.createElement('div', { 'data-testid': 'scroll-area-corner', ...props }),

  AlertDialogRoot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'alert-dialog-root', ...props }, children),
  AlertDialogTrigger: ({ children, asChild, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'alert-dialog-trigger', ...props }, children),
  AlertDialogPortal: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'alert-dialog-portal', ...props }, children),
  AlertDialogOverlay: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'alert-dialog-overlay', ...props }, children),
  AlertDialogContent: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'alert-dialog-content', role: 'alertdialog', ...props }, children),
  AlertDialogTitle: ({ children, ...props }: any) => 
    React.createElement('h2', { 'data-testid': 'alert-dialog-title', ...props }, children),
  AlertDialogDescription: ({ children, ...props }: any) => 
    React.createElement('p', { 'data-testid': 'alert-dialog-description', ...props }, children),
  AlertDialogAction: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'alert-dialog-action', ...props }, children),
  AlertDialogCancel: ({ children, ...props }: any) => 
    React.createElement('button', { 'data-testid': 'alert-dialog-cancel', ...props }, children),

  Label: ({ children, ...props }: any) => 
    React.createElement('label', { 'data-testid': 'label', ...props }, children),
  LabelRoot: ({ children, ...props }: any) => 
    React.createElement('label', { 'data-testid': 'label-root', ...props }, children),

  Slot: ({ children, ...props }: any) => 
    React.createElement('div', { 'data-testid': 'slot', ...props }, children),
}));


// Mock @/services/api/client
vi.mock('@/services/api/client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    request: vi.fn().mockResolvedValue({ data: {} }),
    upload: vi.fn().mockResolvedValue({ data: {} }),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    addRequestInterceptor: vi.fn(),
    addResponseInterceptor: vi.fn(),
  },
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    request: vi.fn().mockResolvedValue({ data: {} }),
    upload: vi.fn().mockResolvedValue({ data: {} }),
    cancel: vi.fn(),
    cancelAll: vi.fn(),
    addRequestInterceptor: vi.fn(),
    addResponseInterceptor: vi.fn(),
  },
  uploadClient: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
  isApiSuccess: vi.fn().mockReturnValue(true),
  isApiError: vi.fn().mockReturnValue(false),
}));

// Import and configure shared test utilities
import { 
  globalTestReporter
} from '../../shared/test-utils/test-reporter';
import { MockFactory } from '../../shared/test-utils/mock-utilities';
import { globalPerformanceMonitor } from '../../shared/test-utils/performance-testing';

// Configure shared test utilities for frontend
MockFactory.configure({
  autoReset: true,
  trackCalls: true,
  enableLogging: false, // Keep quiet in tests
});

// Suppress React act() warnings globally in tests
// Store the original console methods to avoid infinite loops
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

// Override console.warn to filter React warnings
console.warn = (...args) => {
  // Filter out React act() warnings for better test output
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('Warning: An update') || 
    args[0].includes('act(...)')
  )) {
    return; // Ignore React update warnings in tests
  }
  originalConsoleWarn.apply(console, args);
};

// Override console.error to filter React warnings (some warnings come through error)
console.error = (...args) => {
  // Filter out React act() warnings for better test output
  if (args[0] && typeof args[0] === 'string' && (
    args[0].includes('Warning: An update') || 
    args[0].includes('act(...)')
  )) {
    return; // Ignore React update warnings in tests
  }
  originalConsoleError.apply(console, args);
};

// Global test hooks for shared utilities
beforeEach(() => {
  // Start performance monitoring for each test
  globalPerformanceMonitor.clear();
  globalPerformanceMonitor.recordMemoryUsage('test_start');
});

afterEach(() => {
  // Reset all mocks after each test if auto-reset is enabled
  if (MockFactory.getAllMocks().size > 0) {
    MockFactory.resetAllMocks();
  }
  
  // Record end memory usage
  globalPerformanceMonitor.recordMemoryUsage('test_end');
});

// Add a cleanup hook for test reporting
afterAll(() => {
  // Generate and log final test report if any tests were recorded
  const stats = globalTestReporter.getStats();
  if (stats.total > 0) {
    console.log('\n--- Frontend Test Suite Report ---');
    console.log(`Total: ${stats.total}, Passed: ${stats.passed}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
    
    // Export full report for CI/CD integration
    const report = globalTestReporter.generateJSONReport();
    // Note: In real CI/CD, this would be written to a file
    // require('fs').writeFileSync('./test-results/frontend-report.json', report);
  }
});
