/**
 * Application configuration
 * Centralizes environment variables and configuration settings
 */

import logger from '@/utils/logger';

// API configuration
// In Docker, we need to use relative URLs for API calls from the browser
// We use environment variables if available, otherwise fallback to defaults
const apiUrl = import.meta.env.VITE_API_URL || '/api'; // API URL for direct browser requests
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'; // Base URL for API client
const apiAuthPrefix = import.meta.env.VITE_API_AUTH_PREFIX || '/api/auth'; // Auth endpoints
const apiUsersPrefix = import.meta.env.VITE_API_USERS_PREFIX || '/api/users'; // Users endpoints

// Debug mode
const isDevelopment = import.meta.env.MODE === 'development';
const isProduction = import.meta.env.MODE === 'production';

// Log configuration once during initialization
if (isDevelopment) {
  logger.debug('[config] Application configuration:', {
    environment: import.meta.env.MODE,
    apiUrl,
    apiBaseUrl,
    apiAuthPrefix,
    apiUsersPrefix,
    envVariables: {
      VITE_API_URL: import.meta.env.VITE_API_URL,
      VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
      VITE_API_AUTH_PREFIX: import.meta.env.VITE_API_AUTH_PREFIX,
      VITE_API_USERS_PREFIX: import.meta.env.VITE_API_USERS_PREFIX,
    },
  });
}

// Export configuration
export default {
  apiUrl,
  apiBaseUrl,
  apiAuthPrefix,
  apiUsersPrefix,
  isDevelopment,
  isProduction,
};
