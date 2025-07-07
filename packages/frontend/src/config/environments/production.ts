import type { Config } from '../index';

/**
 * Production environment configuration
 */
export const productionConfig: Partial<Config> = {
  api: {
    baseUrl: 'https://api.spheroseg.com',
    timeout: 30000,
    retryAttempts: 3,
  },
  
  websocket: {
    url: 'wss://api.spheroseg.com',
    reconnectAttempts: 5,
    reconnectDelay: 5000,
  },
  
  assets: {
    baseUrl: 'https://assets.spheroseg.com',
    maxUploadSize: 50 * 1024 * 1024, // 50MB
  },
  
  ml: {
    baseUrl: 'https://ml.spheroseg.com',
    processingTimeout: 300000, // 5 minutes
  },
  
  app: {
    environment: 'production',
    debug: false,
    logLevel: 'error',
  },
  
  features: {
    enableAnalytics: true,
    enablePushNotifications: true,
    enableOfflineMode: true,
    enableBetaFeatures: false,
    enableDebugTools: false,
    enablePerformanceMonitoring: true,
    enableErrorReporting: true,
    maxConcurrentUploads: 5,
  },
  
  ui: {
    theme: {
      default: 'system',
      allowUserSelection: true,
    },
    notifications: {
      defaultDuration: 5000,
      maxVisible: 3,
    },
  },
  
  cache: {
    enabled: true,
    ttl: {
      default: 5 * 60 * 1000, // 5 minutes
      images: 60 * 60 * 1000, // 1 hour
      userData: 10 * 60 * 1000, // 10 minutes
      staticAssets: 24 * 60 * 60 * 1000, // 24 hours
    },
    maxSize: {
      memory: 100 * 1024 * 1024, // 100MB
      localStorage: 20 * 1024 * 1024, // 20MB
      indexedDB: 500 * 1024 * 1024, // 500MB
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
      reportUri: 'https://api.spheroseg.com/csp-report',
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
        enabled: true,
        // token should be set via environment variable
      },
      custom: {
        enabled: true,
        endpoint: 'https://analytics.spheroseg.com/track',
      },
    },
  },
  
  external: {
    sentry: {
      enabled: true,
      // dsn should be set via environment variable
      environment: 'production',
      tracesSampleRate: 0.1,
    },
    opentelemetry: {
      enabled: true,
      endpoint: 'https://telemetry.spheroseg.com',
      serviceName: 'spheroseg-frontend-prod',
    },
  },
};