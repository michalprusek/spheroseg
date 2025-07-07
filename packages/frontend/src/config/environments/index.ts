import { developmentConfig } from './development';
import { stagingConfig } from './staging';
import { productionConfig } from './production';
import type { Config } from '../index';

/**
 * Environment-specific configurations
 */
export const environments: Record<string, Partial<Config>> = {
  development: developmentConfig,
  staging: stagingConfig,
  production: productionConfig,
};

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(environment: string): Partial<Config> {
  return environments[environment] || {};
}

/**
 * Detect current environment
 */
export function detectEnvironment(): string {
  // Check Vite environment variable first
  if (import.meta.env?.VITE_APP_ENV) {
    return import.meta.env.VITE_APP_ENV;
  }
  
  // Check NODE_ENV
  if (import.meta.env?.NODE_ENV) {
    return import.meta.env.NODE_ENV;
  }
  
  // Check hostname patterns
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'development';
  }
  
  if (hostname.includes('staging') || hostname.includes('stage')) {
    return 'staging';
  }
  
  if (hostname.includes('.local') || hostname.includes('.dev')) {
    return 'development';
  }
  
  // Default to production for any other domain
  return 'production';
}

/**
 * Environment-specific feature flags
 */
export const environmentFeatures = {
  development: {
    showDebugInfo: true,
    enableHotReload: true,
    mockApi: false,
    verboseLogging: true,
  },
  staging: {
    showDebugInfo: true,
    enableHotReload: false,
    mockApi: false,
    verboseLogging: true,
  },
  production: {
    showDebugInfo: false,
    enableHotReload: false,
    mockApi: false,
    verboseLogging: false,
  },
};

/**
 * Get environment-specific feature flags
 */
export function getEnvironmentFeatures(environment?: string): typeof environmentFeatures.development {
  const env = environment || detectEnvironment();
  return environmentFeatures[env as keyof typeof environmentFeatures] || environmentFeatures.production;
}