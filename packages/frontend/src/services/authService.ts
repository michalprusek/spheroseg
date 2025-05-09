/**
 * Auth service for managing user authentication and refresh tokens
 */
import axios from 'axios';
import logger from '@/utils/logger';
import { jwtDecode } from 'jwt-decode';
import httpClient from '@/utils/httpClient';
import { API_PATHS, formatApiPath } from '@/lib/apiPaths';

// Token storage keys
const ACCESS_TOKEN_KEY = 'spheroseg_access_token';
const REFRESH_TOKEN_KEY = 'spheroseg_refresh_token';
const LAST_ROUTE_KEY = 'spheroseg_last_route';
const SESSION_PERSIST_KEY = 'spheroseg_session_persist';

// Token interface
interface TokenData {
  exp: number;  // Expiration timestamp
  userId: string;
  email: string;
  type: string;
}

/**
 * Retrieves the access token from localStorage
 * @param validate Whether to validate the token format
 * @param removeIfInvalid Whether to remove the token from localStorage if it's invalid
 * @returns {string | null} The access token or null if not found or invalid
 */
export const getAccessToken = (validate = false, removeIfInvalid = false): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);

    // If no token found, return null
    if (!token) return null;

    // If validation is requested, check token format
    if (validate) {
      // Use the comprehensive validation function
      if (!isValidToken(token, false)) {
        logger.warn('[authService] Retrieved invalid token format, returning null');

        // Optionally remove the invalid token
        if (removeIfInvalid) {
          logger.info('[authService] Removing invalid token from localStorage');
          localStorage.removeItem(ACCESS_TOKEN_KEY);
        }

        return null;
      }
    }

    return token;
  } catch (error) {
    logger.error('[authService] Error retrieving access token:', error);
    return null;
  }
};

/**
 * Retrieves the refresh token from localStorage
 * @returns {string | null} The refresh token or null if not found
 */
export const getRefreshToken = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  } catch (error) {
    logger.error('[authService] Error retrieving refresh token:', error);
    return null;
  }
};

/**
 * Sets the access token in localStorage
 * @param {string} token - The access token to set
 */
export const setAccessToken = (token: string): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
  } catch (error) {
    logger.error('[authService] Error setting access token:', error);
  }
};

/**
 * Sets the refresh token in localStorage
 * @param {string} token - The refresh token to set
 */
export const setRefreshToken = (token: string): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(REFRESH_TOKEN_KEY, token);
  } catch (error) {
    logger.error('[authService] Error setting refresh token:', error);
  }
};

/**
 * Removes both access and refresh tokens from localStorage
 */
export const removeTokens = (): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_PERSIST_KEY);

    // Remove cookies
    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=strict`;
    document.cookie = `login_persistent=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; samesite=strict`;
  } catch (error) {
    logger.error('[authService] Error removing tokens:', error);
  }
};

/**
 * Sets both access and refresh tokens in localStorage
 * @param {string} accessToken - The access token to set
 * @param {string} refreshToken - The refresh token to set
 */
export const setTokens = (accessToken: string, refreshToken: string): void => {
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);

  // Nastavíme session persistence na true - uživatel zůstane přihlášen
  localStorage.setItem(SESSION_PERSIST_KEY, 'true');

  // Nastavíme cookie s delší platností (7 dní) pro udržení přihlášení
  try {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7); // 7 dní

    document.cookie = `auth_token=${accessToken}; path=/; expires=${expirationDate.toUTCString()}; samesite=strict`;
    document.cookie = `login_persistent=true; path=/; expires=${expirationDate.toUTCString()}; samesite=strict`;
  } catch (error) {
    console.error('Error setting auth cookies:', error);
  }
};

/**
 * Validates if a token is properly formatted
 * @param token The token to validate
 * @param logErrors Whether to log validation errors
 * @returns True if the token is valid, false otherwise
 */
export const isValidToken = (token: string | null, logErrors = true): boolean => {
  if (!token) {
    if (logErrors) logger.debug('[authService] No token provided for validation');
    return false;
  }

  try {
    // Check if token has the correct format (at least 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length < 3) {
      if (logErrors) logger.warn('[authService] Invalid token format: missing parts');
      return false;
    }

    // Check if each part is non-empty
    if (parts.some(part => !part)) {
      if (logErrors) logger.warn('[authService] Invalid token format: empty part');
      return false;
    }

    // Check if the token can be decoded (basic structure validation)
    try {
      // Just try to decode the payload (middle part)
      const payload = JSON.parse(atob(parts[1]));

      // Check if payload has required fields
      if (!payload.exp) {
        if (logErrors) logger.warn('[authService] Invalid token: missing expiration');
        return false;
      }

      // In development mode, be more lenient with token validation
      if (process.env.NODE_ENV === 'development') {
        return true;
      }

      // In production, ensure userId and type are present
      if (!payload.userId || !payload.type) {
        if (logErrors) logger.warn('[authService] Invalid token: missing userId or type');
        return false;
      }

      return true;
    } catch (error) {
      if (logErrors) logger.warn('[authService] Invalid token: cannot decode payload');
      return false;
    }
  } catch (error) {
    if (logErrors) logger.warn('[authService] Token validation error:', error);
    return false;
  }
};

/**
 * Check if access token is expired
 * @returns {boolean} True if expired, false otherwise
 */
export const isAccessTokenExpired = (): boolean => {
  const token = getAccessToken();
  if (!token) {
    logger.debug('[authService] No token found, considering expired');
    return true;
  }

  // First validate token format (without logging errors to avoid duplicate logs)
  if (!isValidToken(token, false)) {
    logger.warn('[authService] Token validation failed, considering expired');
    return true;
  }

  try {
    const decodedToken = jwtDecode<TokenData>(token);
    const currentTime = Math.floor(Date.now() / 1000);

    // Check if expiration is present
    if (!decodedToken.exp) {
      logger.warn('[authService] Token missing expiration claim, considering expired');
      return true;
    }

    // Add 30-second buffer to avoid edge cases
    const isExpired = decodedToken.exp <= currentTime + 30;

    if (isExpired) {
      logger.debug('[authService] Token is expired or expiring soon');
    }

    return isExpired;
  } catch (error) {
    logger.error('[authService] Error checking token expiration:', error);
    return true;
  }
};

/**
 * Refresh the access token using a refresh token
 * @returns {Promise<boolean>} True if refresh was successful, false otherwise
 */
export const refreshAccessToken = async (): Promise<boolean> => {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    logger.warn('[authService] No refresh token found');

    // Try to use cookie-based auth as fallback for development mode
    if (process.env.NODE_ENV === 'development') {
      try {
        // In development mode, request a new development token with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 2000); // Further reduced timeout to 2 seconds for faster response

        try {
          // Use direct axios call with no baseUrl to avoid any interceptor issues
          const response = await axios({
            method: 'post',
            url: API_PATHS.AUTH.LOGIN, // Using centralized API paths
            data: { email: 'test@example.com', password: 'password123' },
            signal: controller.signal,
            timeout: 2000,
            // Explicitly avoid using any httpClient settings
            headers: {
              'Content-Type': 'application/json'
            },
            // Disable any authorization headers
            withCredentials: false
          });

          // Update tokens in localStorage
          const { accessToken, refreshToken } = response.data;
          setTokens(accessToken, refreshToken);

          // Set up cookie as well
          document.cookie = `auth_token=${accessToken}; path=/; samesite=strict; max-age=3600`;

          logger.info('[authService] Development mode login successful');
          return true;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (devError) {
        logger.error('[authService] Failed to perform development login:', devError);
        return false;
      }
    }

    return false;
  }

  try {
    logger.info('[authService] Refreshing access token');

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      logger.warn('[authService] Refresh token request timed out');
      controller.abort();
    }, 2000); // Further reduced timeout to 2 seconds

    try {
      // Use direct axios call with no middleware/interceptors to prevent circular dependencies
      const response = await axios({
        method: 'post',
        url: API_PATHS.AUTH.REFRESH, // Using centralized API paths
        data: { refreshToken },
        signal: controller.signal,
        timeout: 2000,
        headers: {
          'Content-Type': 'application/json'
        },
        // Explicitly avoid using any authorization headers
        withCredentials: false
      });

      // Update tokens in localStorage
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      setTokens(accessToken, newRefreshToken);

      // Set up cookie with longer expiration
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 dní
      document.cookie = `auth_token=${accessToken}; path=/; expires=${expirationDate.toUTCString()}; samesite=strict`;

      logger.info('[authService] Token refresh successful');
      return true;
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      logger.error('[authService] Token refresh aborted due to timeout');
    } else {
      logger.error('[authService] Failed to refresh token:', error);
    }

    // Clear tokens on refresh failure
    removeTokens();

    // Try to use cookie-based auth as fallback for development mode
    if (process.env.NODE_ENV === 'development') {
      try {
        // In development mode, request a new development token with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, 2000); // Further reduced timeout

        try {
          // Use direct axios call with no middleware/interceptors
          const response = await axios({
            method: 'post',
            url: '/api/dev-login', // Keep dev-login endpoint as is (only used in development)
            data: { email: 'test@example.com', password: 'password123' },
            signal: controller.signal,
            timeout: 2000,
            headers: {
              'Content-Type': 'application/json'
            },
            // Explicitly avoid using any authorization headers
            withCredentials: false
          });

          // Update tokens in localStorage
          const { accessToken, refreshToken } = response.data;
          setTokens(accessToken, refreshToken);

          // Set up cookie as well
          document.cookie = `auth_token=${accessToken}; path=/; samesite=strict; max-age=3600`;

          logger.info('[authService] Development mode login successful');
          return true;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (devError) {
        logger.error('[authService] Failed to perform development login:', devError);
        return false;
      }
    }

    return false;
  }
};

/**
 * For backward compatibility
 * @deprecated Use getAccessToken instead
 * @param validate Whether to validate the token format
 * @param removeIfInvalid Whether to remove the token from localStorage if it's invalid
 * @returns {string | null} The access token or null if not found or invalid
 */
export const getToken = (validate = false, removeIfInvalid = false): string | null => {
  return getAccessToken(validate, removeIfInvalid);
};

/**
 * Saves the current route for restoration after refresh
 * @param route The current route/path to save
 */
export const saveCurrentRoute = (route: string): void => {
  try {
    if (typeof window === 'undefined') return;
    if (!route || route === '/sign-in' || route === '/sign-up' || route === '/request-access') return;

    localStorage.setItem(LAST_ROUTE_KEY, route);
    logger.info(`[authService] Saved current route: ${route}`);
  } catch (error) {
    logger.error('[authService] Error saving current route:', error);
  }
};

/**
 * Gets the last visited route for restoration after refresh
 * @returns The last visited route or null if none was saved
 */
export const getLastRoute = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(LAST_ROUTE_KEY);
  } catch (error) {
    logger.error('[authService] Error getting last route:', error);
    return null;
  }
};

/**
 * Clears the saved route
 */
export const clearLastRoute = (): void => {
  try {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(LAST_ROUTE_KEY);
  } catch (error) {
    logger.error('[authService] Error clearing last route:', error);
  }
};

/**
 * For backward compatibility
 * @deprecated Use setAccessToken instead
 */
export const setToken = setAccessToken;

/**
 * For backward compatibility
 * @deprecated Use removeTokens instead
 */
export const removeToken = removeTokens;
