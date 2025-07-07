import { z } from 'zod';

/**
 * Configuration schema using Zod for runtime validation
 */
const ConfigSchema = z.object({
  // API Configuration
  api: z.object({
    baseUrl: z.string().url().default('http://localhost:3001'),
    timeout: z.number().default(30000),
    retryAttempts: z.number().default(3),
    retryDelay: z.number().default(1000),
    endpoints: z.object({
      auth: z.string().default('/api/auth'),
      users: z.string().default('/api/users'),
      segmentation: z.string().default('/api/segmentation'),
      images: z.string().default('/api/images'),
      analytics: z.string().default('/api/analytics'),
    }),
  }),

  // WebSocket Configuration
  websocket: z.object({
    url: z.string().url().default('ws://localhost:3001'),
    reconnect: z.boolean().default(true),
    reconnectAttempts: z.number().default(5),
    reconnectDelay: z.number().default(3000),
    timeout: z.number().default(20000),
  }),

  // Assets Configuration
  assets: z.object({
    baseUrl: z.string().url().default('http://localhost:3002'),
    imagePrefix: z.string().default('/images'),
    staticPrefix: z.string().default('/static'),
    maxUploadSize: z.number().default(10 * 1024 * 1024), // 10MB
    allowedFormats: z.array(z.string()).default(['jpg', 'jpeg', 'png', 'webp', 'tiff']),
  }),

  // ML Service Configuration
  ml: z.object({
    baseUrl: z.string().url().default('http://localhost:5000'),
    processingTimeout: z.number().default(300000), // 5 minutes
    maxBatchSize: z.number().default(10),
    modelVersion: z.string().default('v1'),
  }),

  // Application Configuration
  app: z.object({
    name: z.string().default('SpherosegV4'),
    version: z.string().default('4.0.0'),
    environment: z.enum(['development', 'staging', 'production']).default('development'),
    debug: z.boolean().default(true),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  }),

  // Feature Flags
  features: z.object({
    enableAnalytics: z.boolean().default(false),
    enablePushNotifications: z.boolean().default(false),
    enableOfflineMode: z.boolean().default(false),
    enableBetaFeatures: z.boolean().default(false),
    enableDebugTools: z.boolean().default(true),
    enablePerformanceMonitoring: z.boolean().default(false),
    enableErrorReporting: z.boolean().default(true),
    maxConcurrentUploads: z.number().default(3),
    autoSaveInterval: z.number().default(30000), // 30 seconds
  }),

  // UI Configuration
  ui: z.object({
    theme: z.object({
      default: z.enum(['light', 'dark', 'system']).default('system'),
      allowUserSelection: z.boolean().default(true),
    }),
    language: z.object({
      default: z.string().default('en'),
      supported: z.array(z.string()).default(['en', 'cs', 'de', 'es', 'fr', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'zh']),
      detectBrowserLanguage: z.boolean().default(true),
    }),
    notifications: z.object({
      position: z.enum(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right']).default('top-right'),
      defaultDuration: z.number().default(5000),
      maxVisible: z.number().default(5),
    }),
    pagination: z.object({
      defaultPageSize: z.number().default(20),
      pageSizeOptions: z.array(z.number()).default([10, 20, 50, 100]),
    }),
  }),

  // Cache Configuration
  cache: z.object({
    enabled: z.boolean().default(true),
    ttl: z.object({
      default: z.number().default(5 * 60 * 1000), // 5 minutes
      images: z.number().default(30 * 60 * 1000), // 30 minutes
      userData: z.number().default(10 * 60 * 1000), // 10 minutes
      staticAssets: z.number().default(60 * 60 * 1000), // 1 hour
    }),
    maxSize: z.object({
      memory: z.number().default(50 * 1024 * 1024), // 50MB
      localStorage: z.number().default(10 * 1024 * 1024), // 10MB
      indexedDB: z.number().default(100 * 1024 * 1024), // 100MB
    }),
  }),

  // Security Configuration
  security: z.object({
    csrf: z.object({
      enabled: z.boolean().default(true),
      headerName: z.string().default('X-CSRF-Token'),
    }),
    cors: z.object({
      enabled: z.boolean().default(true),
      credentials: z.boolean().default(true),
    }),
    contentSecurityPolicy: z.object({
      enabled: z.boolean().default(true),
      reportUri: z.string().optional(),
    }),
  }),

  // Analytics Configuration
  analytics: z.object({
    enabled: z.boolean().default(false),
    providers: z.object({
      google: z.object({
        enabled: z.boolean().default(false),
        trackingId: z.string().optional(),
      }),
      mixpanel: z.object({
        enabled: z.boolean().default(false),
        token: z.string().optional(),
      }),
      custom: z.object({
        enabled: z.boolean().default(false),
        endpoint: z.string().url().optional(),
      }),
    }),
  }),

  // External Services
  external: z.object({
    sentry: z.object({
      enabled: z.boolean().default(false),
      dsn: z.string().optional(),
      environment: z.string().optional(),
      tracesSampleRate: z.number().default(0.1),
    }),
    opentelemetry: z.object({
      enabled: z.boolean().default(false),
      endpoint: z.string().url().optional(),
      serviceName: z.string().default('spheroseg-frontend'),
    }),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;

/**
 * Load configuration from environment variables
 */
function loadFromEnv(): Partial<Config> {
  const env = import.meta.env || {};
  
  return {
    api: {
      baseUrl: env.VITE_API_URL || env.VITE_API_BASE_URL,
      endpoints: {
        auth: env.VITE_API_AUTH_PREFIX,
        users: env.VITE_API_USERS_PREFIX,
      },
    },
    websocket: {
      url: env.VITE_WEBSOCKET_URL || env.VITE_WS_URL,
    },
    assets: {
      baseUrl: env.VITE_ASSETS_URL,
    },
    ml: {
      baseUrl: env.VITE_ML_SERVICE_URL,
    },
    app: {
      version: env.VITE_APP_VERSION,
      environment: env.VITE_APP_ENV || env.NODE_ENV,
      debug: env.VITE_DEBUG === 'true',
      logLevel: env.VITE_LOG_LEVEL,
    },
    features: {
      enableAnalytics: env.VITE_ENABLE_ANALYTICS === 'true',
      enablePushNotifications: env.VITE_ENABLE_PUSH_NOTIFICATIONS === 'true',
      enableOfflineMode: env.VITE_ENABLE_OFFLINE_MODE === 'true',
      enableBetaFeatures: env.VITE_ENABLE_BETA_FEATURES === 'true',
      enableDebugTools: env.VITE_ENABLE_DEBUG_TOOLS !== 'false',
      enablePerformanceMonitoring: env.VITE_ENABLE_PERFORMANCE_MONITORING === 'true',
      enableErrorReporting: env.VITE_ENABLE_ERROR_REPORTING !== 'false',
    },
    analytics: {
      enabled: env.VITE_ANALYTICS_ENABLED === 'true',
      providers: {
        google: {
          enabled: env.VITE_GA_ENABLED === 'true',
          trackingId: env.VITE_GA_TRACKING_ID,
        },
        mixpanel: {
          enabled: env.VITE_MIXPANEL_ENABLED === 'true',
          token: env.VITE_MIXPANEL_TOKEN,
        },
      },
    },
    external: {
      sentry: {
        enabled: env.VITE_SENTRY_ENABLED === 'true',
        dsn: env.VITE_SENTRY_DSN,
        environment: env.VITE_SENTRY_ENVIRONMENT,
      },
    },
  };
}

/**
 * Merge configurations with proper deep merging
 */
function deepMerge(target: any, source: any): any {
  if (!source) return target;
  
  const output = { ...target };
  
  Object.keys(source).forEach((key) => {
    if (source[key] === undefined) return;
    
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      output[key] = deepMerge(output[key] || {}, source[key]);
    } else {
      output[key] = source[key];
    }
  });
  
  return output;
}

/**
 * Configuration class for managing application settings
 */
class ConfigurationService {
  private config: Config;
  private listeners: Map<string, Set<(value: any) => void>> = new Map();

  constructor() {
    this.config = this.loadConfiguration();
  }

  /**
   * Load and validate configuration
   */
  private loadConfiguration(): Config {
    try {
      // Start with defaults
      const defaultConfig = ConfigSchema.parse({});
      
      // Load from environment
      const envConfig = loadFromEnv();
      
      // Load from localStorage (user preferences)
      const storedConfig = this.loadFromStorage();
      
      // Merge configurations (env > stored > defaults)
      const mergedConfig = deepMerge(deepMerge(defaultConfig, storedConfig), envConfig);
      
      // Validate final configuration
      const validatedConfig = ConfigSchema.parse(mergedConfig);
      
      // Apply development overrides
      if (validatedConfig.app.environment === 'development') {
        validatedConfig.app.debug = true;
        validatedConfig.features.enableDebugTools = true;
      }
      
      return validatedConfig;
    } catch (error) {
      console.error('Configuration validation failed:', error);
      // Return defaults if validation fails
      return ConfigSchema.parse({});
    }
  }

  /**
   * Load configuration from localStorage
   */
  private loadFromStorage(): Partial<Config> {
    try {
      const stored = localStorage.getItem('spheroseg-config');
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveToStorage(config: Partial<Config>): void {
    try {
      localStorage.setItem('spheroseg-config', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save configuration:', error);
    }
  }

  /**
   * Get entire configuration
   */
  getConfig(): Config {
    return this.config;
  }

  /**
   * Get configuration value by path
   */
  get<T = any>(path: string): T {
    const keys = path.split('.');
    let value: any = this.config;
    
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) break;
    }
    
    return value;
  }

  /**
   * Set configuration value by path
   */
  set(path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let target: any = this.config;
    
    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }
    
    const oldValue = target[lastKey];
    target[lastKey] = value;
    
    // Validate configuration
    try {
      this.config = ConfigSchema.parse(this.config);
      
      // Save to storage
      this.saveToStorage(this.config);
      
      // Notify listeners
      this.notifyListeners(path, value, oldValue);
    } catch (error) {
      // Revert on validation error
      target[lastKey] = oldValue;
      throw error;
    }
  }

  /**
   * Update multiple configuration values
   */
  update(updates: Partial<Config>): void {
    const oldConfig = { ...this.config };
    
    try {
      this.config = ConfigSchema.parse(deepMerge(this.config, updates));
      this.saveToStorage(this.config);
      
      // Notify listeners for changed values
      this.notifyChanges(oldConfig, this.config);
    } catch (error) {
      this.config = oldConfig;
      throw error;
    }
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(path: string, callback: (value: any) => void): () => void {
    if (!this.listeners.has(path)) {
      this.listeners.set(path, new Set());
    }
    
    this.listeners.get(path)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(path)?.delete(callback);
    };
  }

  /**
   * Notify listeners of changes
   */
  private notifyListeners(path: string, newValue: any, oldValue: any): void {
    if (newValue === oldValue) return;
    
    // Notify exact path listeners
    this.listeners.get(path)?.forEach((callback) => callback(newValue));
    
    // Notify parent path listeners
    const parts = path.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
      const parentPath = parts.slice(0, i).join('.');
      this.listeners.get(parentPath)?.forEach((callback) => {
        callback(this.get(parentPath));
      });
    }
  }

  /**
   * Notify all changes between old and new config
   */
  private notifyChanges(oldConfig: any, newConfig: any, path = ''): void {
    Object.keys(newConfig).forEach((key) => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof newConfig[key] === 'object' && newConfig[key] !== null && !Array.isArray(newConfig[key])) {
        this.notifyChanges(oldConfig?.[key] || {}, newConfig[key], currentPath);
      } else if (oldConfig?.[key] !== newConfig[key]) {
        this.notifyListeners(currentPath, newConfig[key], oldConfig?.[key]);
      }
    });
  }

  /**
   * Reset configuration to defaults
   */
  reset(): void {
    const oldConfig = { ...this.config };
    this.config = ConfigSchema.parse({});
    this.saveToStorage({});
    this.notifyChanges(oldConfig, this.config);
  }

  /**
   * Export configuration
   */
  export(): Config {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Import configuration
   */
  import(config: Partial<Config>): void {
    this.update(config);
  }

  /**
   * Validate configuration object
   */
  validate(config: unknown): config is Config {
    try {
      ConfigSchema.parse(config);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get configuration schema
   */
  getSchema() {
    return ConfigSchema;
  }
}

// Create singleton instance
export const configService = new ConfigurationService();

// Export convenience functions
export const config = configService.getConfig();
export const getConfig = () => configService.getConfig();
export const getConfigValue = <T = any>(path: string) => configService.get<T>(path);
export const setConfigValue = (path: string, value: any) => configService.set(path, value);
export const updateConfig = (updates: Partial<Config>) => configService.update(updates);
export const subscribeToConfig = (path: string, callback: (value: any) => void) => configService.subscribe(path, callback);
export const resetConfig = () => configService.reset();

// Export types
export type { Config };