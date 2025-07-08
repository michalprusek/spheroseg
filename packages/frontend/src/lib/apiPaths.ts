/**
 * Centralized API path configuration
 * This file provides a single point of truth for all API endpoints
 */

// Core API endpoints
export const API_PATHS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh',
    ME: '/api/users/me',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
  },
  USERS: {
    ME: '/api/users/me',
    PROFILE: '/api/users/me/profile',
    SETTINGS: '/api/users/me/settings',
    STATS: '/api/user-stats/me/statistics',
    BY_ID: (id: string) => `/api/users/${id}`,
  },
  PROJECTS: {
    LIST: '/api/projects',
    CREATE: '/api/projects',
    BY_ID: (id: string) => `/api/projects/${id}`,
    IMAGES: (id: string) => `/api/projects/${id}/images`,
    EXPORT: (id: string) => `/api/projects/${id}/export`,
    SHARE: (id: string) => `/api/projects/${id}/share`,
  },
  IMAGES: {
    UPLOAD: '/api/images/upload',
    BY_ID: (id: string) => `/api/images/${id}`,
    SEGMENT: (id: string) => `/api/images/${id}/segment`,
  },
  SEGMENTATION: {
    START: '/api/segmentation/start',
    STATUS: (id: string) => `/api/segmentation/${id}/status`,
    RESULT: (id: string) => `/api/segmentation/${id}/result`,
    BATCH: '/api/segmentation/batch',
  },
  ACCESS_REQUESTS: {
    CREATE: '/api/access-requests',
  },
  SYSTEM: {
    HEALTH: '/api/health',
    STATUS: '/api/status',
    METRICS: '/api/metrics',
  },
};

/**
 * Ensures API path always uses the correct format
 * Handles both direct API calls and proxied calls
 *
 * @param path - The API path to format
 * @returns The formatted API path
 */
export const formatApiPath = (path: string): string => {
  // If path already starts with /api, just return it
  if (path.startsWith('/api/')) {
    return path;
  }

  // Otherwise, ensure path starts with / and add /api prefix
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `/api${normalizedPath}`;
};

/**
 * Utility function for building URL parameters
 * @param params - The parameters to include in the URL
 * @returns A string of URL parameters
 */
export const buildUrlParams = (params: Record<string, string | number | boolean | undefined>): string => {
  const validParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);

  return validParams.length ? `?${validParams.join('&')}` : '';
};

export default API_PATHS;
