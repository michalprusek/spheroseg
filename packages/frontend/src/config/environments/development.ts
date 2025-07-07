import type { Config } from '../index';

/**
 * Development environment configuration
 */
export const developmentConfig: Partial<Config> = {
  api: {
    baseUrl: 'http://localhost:3001',
    timeout: 60000, // Longer timeout for development
  },
  
  websocket: {
    url: 'ws://localhost:3001',
    reconnectAttempts: 10,
  },
  
  assets: {
    baseUrl: 'http://localhost:3002',
  },
  
  ml: {
    baseUrl: 'http://localhost:5000',
    processingTimeout: 600000, // 10 minutes for development
  },
  
  app: {
    environment: 'development',
    debug: true,
    logLevel: 'debug',
  },
  
  features: {
    enableAnalytics: false,
    enablePushNotifications: false,
    enableOfflineMode: true,
    enableBetaFeatures: true,
    enableDebugTools: true,
    enablePerformanceMonitoring: true,
    enableErrorReporting: true,
  },
  
  ui: {
    notifications: {
      defaultDuration: 8000, // Longer duration for development
    },
  },
  
  cache: {
    enabled: true,
    ttl: {
      default: 1 * 60 * 1000, // 1 minute for faster development
      images: 5 * 60 * 1000, // 5 minutes
      userData: 2 * 60 * 1000, // 2 minutes
      staticAssets: 10 * 60 * 1000, // 10 minutes
    },
  },
  
  security: {
    csrf: {
      enabled: false, // Disabled for easier development
    },
    contentSecurityPolicy: {
      enabled: false, // Disabled for development tools
    },
  },
  
  analytics: {
    enabled: false,
  },
  
  external: {
    sentry: {
      enabled: false,
    },
    opentelemetry: {
      enabled: false,
    },
  },
};