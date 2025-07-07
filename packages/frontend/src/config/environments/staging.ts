import type { Config } from '../index';

/**
 * Staging environment configuration
 */
export const stagingConfig: Partial<Config> = {
  api: {
    baseUrl: 'https://api-staging.spheroseg.com',
    timeout: 45000,
    retryAttempts: 3,
  },
  
  websocket: {
    url: 'wss://api-staging.spheroseg.com',
    reconnectAttempts: 8,
    reconnectDelay: 3000,
  },
  
  assets: {
    baseUrl: 'https://assets-staging.spheroseg.com',
    maxUploadSize: 25 * 1024 * 1024, // 25MB
  },
  
  ml: {
    baseUrl: 'https://ml-staging.spheroseg.com',
    processingTimeout: 450000, // 7.5 minutes
  },
  
  app: {
    environment: 'staging',
    debug: true,
    logLevel: 'info',
  },
  
  features: {
    enableAnalytics: true,
    enablePushNotifications: true,
    enableOfflineMode: true,
    enableBetaFeatures: true,
    enableDebugTools: true,
    enablePerformanceMonitoring: true,
    enableErrorReporting: true,
    maxConcurrentUploads: 4,
  },
  
  ui: {
    theme: {
      default: 'system',
      allowUserSelection: true,
    },
    notifications: {
      defaultDuration: 6000,
      maxVisible: 4,
    },
  },
  
  cache: {
    enabled: true,
    ttl: {
      default: 3 * 60 * 1000, // 3 minutes
      images: 30 * 60 * 1000, // 30 minutes
      userData: 5 * 60 * 1000, // 5 minutes
      staticAssets: 12 * 60 * 60 * 1000, // 12 hours
    },
    maxSize: {
      memory: 75 * 1024 * 1024, // 75MB
      localStorage: 15 * 1024 * 1024, // 15MB
      indexedDB: 250 * 1024 * 1024, // 250MB
    },
  },
  
  security: {
    csrf: {
      enabled: true,
    },
    cors: {
      enabled: true,
      credentials: true,
    },
    contentSecurityPolicy: {
      enabled: true,
      reportUri: 'https://api-staging.spheroseg.com/csp-report',
    },
  },
  
  analytics: {
    enabled: true,
    providers: {
      google: {
        enabled: true,
        // trackingId should be set via environment variable
      },
      mixpanel: {
        enabled: false, // Disabled in staging
      },
      custom: {
        enabled: true,
        endpoint: 'https://analytics-staging.spheroseg.com/track',
      },
    },
  },
  
  external: {
    sentry: {
      enabled: true,
      // dsn should be set via environment variable
      environment: 'staging',
      tracesSampleRate: 0.5, // Higher sample rate for staging
    },
    opentelemetry: {
      enabled: true,
      endpoint: 'https://telemetry-staging.spheroseg.com',
      serviceName: 'spheroseg-frontend-staging',
    },
  },
};