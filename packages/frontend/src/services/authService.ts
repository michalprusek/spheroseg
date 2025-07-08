/**
 * Auth service for managing user authentication and refresh tokens
 */
import axios from 'axios';
import logger from '@/utils/logger';
import { jwtDecode } from 'jwt-decode';
import apiClient from '@/lib/apiClient';
import { API_PATHS, formatApiPath } from '@/lib/apiPaths';

// Token storage keys
const ACCESS_TOKEN_KEY = 'spheroseg_access_token';
const REFRESH_TOKEN_KEY = 'spheroseg_refresh_token';
const LAST_ROUTE_KEY = 'spheroseg_last_route';
const SESSION_PERSIST_KEY = 'spheroseg_session_persist';

// Token interface
interface TokenData {
  exp: number; // Expiration timestamp
  userId: string;
  email: string;
  type: string;
}

/**
 * Retrieve token from cookie
 * @returns {string | null} The token or null if not found
 */
export const getTokenFromCookie = (): string | null => {
  try {
    if (typeof window === 'undefined' || !document.cookie) return null;

    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith('auth_token=')) {
        return cookie.substring('auth_token='.length);
      }
    }
    return null;
  } catch (error) {
    logger.error('[authService] Error retrieving token from cookie:', error);
    return null;
  }
};

/**
 * Retrieves the access token from localStorage or cookie
 * @param validate Whether to validate the token format
 * @param removeIfInvalid Whether to remove the token from localStorage if it's invalid
 * @returns {string | null} The access token or null if not found or invalid
 */
export const getAccessToken = (validate = false, removeIfInvalid = false): string | null => {
  try {
    if (typeof window === 'undefined') return null;

    // Try to get token from localStorage first
    let token = localStorage.getItem(ACCESS_TOKEN_KEY);
    
    // Log what we found in localStorage for debugging
    if (token) {
      logger.debug('[authService] Found token in localStorage:', { tokenLength: token.length, tokenPrefix: token.substring(0, 20) + '...' });
    } else {
      logger.debug('[authService] No token found in localStorage');
    }

    // If no token in localStorage, try to get from cookie
    if (!token) {
      token = getTokenFromCookie();

      // If token found in cookie but not in localStorage, sync to localStorage
      if (token) {
        logger.info('[authService] Token found in cookie but not in localStorage, syncing');
        localStorage.setItem(ACCESS_TOKEN_KEY, token);
      }
    }

    // If still no token found, return null
    if (!token) {
      logger.debug('[authService] No token found in localStorage or cookies');
      return null;
    }

    // If validation is requested, check token format
    if (validate) {
      // Use the comprehensive validation function
      if (!isValidToken(token, false)) {
        logger.warn('[authService] Retrieved invalid token format, returning null');

        // Optionally remove the invalid token
        if (removeIfInvalid) {
          logger.info('[authService] Removing invalid token from localStorage and cookie');
          localStorage.removeItem(ACCESS_TOKEN_KEY);
          const domain = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
          const sameSiteValue = process.env.NODE_ENV === 'production' ? 'lax' : 'lax';
          const secure = window.location.protocol === 'https:' ? '; secure' : '';
          document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}; samesite=${sameSiteValue}${secure}`;
        }

        return null;
      }
    }

    return token;
  } catch (error) {
    logger.error('[authService] Error retrieving access token:', error);

    // Při chybě zkusíme přečíst token přímo z cookie bez další logiky
    try {
      const cookieStr = document.cookie;
      const tokenMatch = cookieStr.match(/auth_token=([^;]+)/);
      if (tokenMatch && tokenMatch[1]) {
        return tokenMatch[1];
      }
    } catch (e) {
      // Pokud selže i záložní plán, vrátíme null
    }

    return null;
  }
};

/**
 * Retrieve refresh token from cookie
 * @returns {string | null} The refresh token or null if not found
 */
export const getRefreshTokenFromCookie = (): string | null => {
  try {
    if (typeof window === 'undefined' || !document.cookie) return null;

    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.startsWith('refresh_token=')) {
        return cookie.substring('refresh_token='.length);
      }
    }
    return null;
  } catch (error) {
    logger.error('[authService] Error retrieving refresh token from cookie:', error);
    return null;
  }
};

/**
 * Retrieves the refresh token from localStorage or cookie
 * @returns {string | null} The refresh token or null if not found
 */
export const getRefreshToken = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;

    // Try to get refresh token from localStorage first
    let refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    // If no refresh token in localStorage, try to get from cookie
    if (!refreshToken) {
      refreshToken = getRefreshTokenFromCookie();

      // If refresh token found in cookie but not in localStorage, sync to localStorage
      if (refreshToken) {
        logger.info('[authService] Refresh token found in cookie but not in localStorage, syncing');
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
    }

    return refreshToken;
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
 * Removes both access and refresh tokens from localStorage and cookies
 */
export const removeTokens = (): void => {
  try {
    if (typeof window === 'undefined') return;

    // Remove from localStorage
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_PERSIST_KEY);

    // Remove all auth cookies
    const domain = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
    const sameSiteValue = process.env.NODE_ENV === 'production' ? 'lax' : 'lax';
    const secure = window.location.protocol === 'https:' ? '; secure' : '';

    document.cookie = `auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}; samesite=${sameSiteValue}${secure}`;
    document.cookie = `refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}; samesite=${sameSiteValue}${secure}`;
    document.cookie = `login_persistent=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; domain=${domain}; samesite=${sameSiteValue}${secure}`;

    logger.info('[authService] Tokens removed from both localStorage and cookies');
  } catch (error) {
    logger.error('[authService] Error removing tokens:', error);
  }
};

/**
 * Sets both access and refresh tokens in localStorage and cookies
 * @param {string} accessToken - The access token to set
 * @param {string} refreshToken - The refresh token to set
 * @param {boolean} rememberMe - Whether to persist the session after browser closes
 */
export const setTokens = (accessToken: string, refreshToken: string, rememberMe: boolean = false): void => {
  // Set tokens in localStorage
  setAccessToken(accessToken);
  setRefreshToken(refreshToken);

  // Store remember me preference
  localStorage.setItem(SESSION_PERSIST_KEY, rememberMe ? 'true' : 'false');

  try {
    const domain = window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname;
    const sameSiteValue = process.env.NODE_ENV === 'production' ? 'lax' : 'lax';
    const secure = window.location.protocol === 'https:' ? '; secure' : '';

    if (rememberMe) {
      // If remember me is checked, set cookies with long expiration (30 days)
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30); // 30 days

      document.cookie = `auth_token=${accessToken}; path=/; expires=${expirationDate.toUTCString()}; domain=${domain}; samesite=${sameSiteValue}${secure}`;
      document.cookie = `refresh_token=${refreshToken}; path=/; expires=${expirationDate.toUTCString()}; domain=${domain}; samesite=${sameSiteValue}${secure}`;
      document.cookie = `login_persistent=true; path=/; expires=${expirationDate.toUTCString()}; domain=${domain}; samesite=${sameSiteValue}${secure}`;
    } else {
      // If remember me is NOT checked, use session cookies (no expires = session cookie)
      document.cookie = `auth_token=${accessToken}; path=/; domain=${domain}; samesite=${sameSiteValue}${secure}`;
      document.cookie = `refresh_token=${refreshToken}; path=/; domain=${domain}; samesite=${sameSiteValue}${secure}`;
      document.cookie = `login_persistent=false; path=/; domain=${domain}; samesite=${sameSiteValue}${secure}`;
    }

    logger.info(`[authService] Auth tokens set with rememberMe=${rememberMe}`);
  } catch (error) {
    logger.error('[authService] Error setting auth cookies:', error);
  }
};

/**
 * Checks if the session should persist based on remember me preference
 * @returns {boolean} True if session should persist, false otherwise
 */
export const shouldPersistSession = (): boolean => {
  try {
    const persistValue = localStorage.getItem(SESSION_PERSIST_KEY);
    return persistValue === 'true';
  } catch (error) {
    logger.error('[authService] Error checking session persistence:', error);
    return false;
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
    if (parts.some((part) => !part)) {
      if (logErrors) logger.warn('[authService] Invalid token format: empty part');
      return false;
    }

    // Check if the token can be decoded (basic structure validation)
    try {
      // Just try to decode the payload (middle part)
      const payload = JSON.parse(atob(parts[1]));

      // Méně striktní validace, aby se zabránilo falešným negativům
      // Pokud token má validní strukturu, považujeme ho za platný
      // Pokud nemá expiraci, budeme to řešit jinde

      // V development módu a pro účely debugu budeme méně přísní
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
            // Použití základních HTTP hlaviček
            headers: {
              'Content-Type': 'application/json',
            },
            // Je důležité mít withCredentials: true pro správné předávání cookies
            withCredentials: true,
          });

          // Update tokens in localStorage
          const { accessToken, refreshToken } = response.data;
          const rememberMe = shouldPersistSession();
          setTokens(accessToken, refreshToken, rememberMe);

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
    }, 10000); // Zvýšeno na 10 sekund pro větší toleranci při refreshi tokenů

    try {
      // Use direct axios call with no middleware/interceptors to prevent circular dependencies
      const response = await axios({
        method: 'post',
        url: API_PATHS.AUTH.REFRESH, // Using centralized API paths
        data: { refreshToken },
        signal: controller.signal,
        timeout: 10000, // Zvýšený timeout na 10 sekund
        headers: {
          'Content-Type': 'application/json',
        },
        // Je důležité mít withCredentials: true pro správné předávání cookies
        withCredentials: true,
      });

      // Update tokens in localStorage with the same remember me preference
      const { accessToken, refreshToken: newRefreshToken } = response.data;
      const rememberMe = shouldPersistSession();
      setTokens(accessToken, newRefreshToken, rememberMe);

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
            timeout: 10000, // Zvýšený timeout na 10 sekund
            headers: {
              'Content-Type': 'application/json',
            },
            // Je důležité mít withCredentials: true pro správné předávání cookies
            withCredentials: true,
          });

          // Update tokens in localStorage
          const { accessToken, refreshToken } = response.data;
          const rememberMe = shouldPersistSession();
          setTokens(accessToken, refreshToken, rememberMe);

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

/**
 * Request password reset for a user
 * @param email The email address to send the reset to
 * @returns Promise with the response
 */
export const requestPasswordReset = async (email: string): Promise<{ message: string; testUrl?: string }> => {
  try {
    logger.info('[authService] Requesting password reset for email:', email);

    const response = await apiClient.post(API_PATHS.AUTH.FORGOT_PASSWORD, {
      email,
    });

    logger.info('[authService] Password reset request successful');
    return response.data;
  } catch (error) {
    logger.error('[authService] Password reset request failed:', error);
    throw error;
  }
};
