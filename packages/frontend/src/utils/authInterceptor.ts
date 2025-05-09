/**
 * Auth interceptor for axios
 *
 * This interceptor automatically handles token refresh when receiving 401 errors,
 * and adds the current access token to all outgoing requests.
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  getAccessToken,
  isAccessTokenExpired,
  refreshAccessToken,
  removeTokens
} from '@/services/authService';
import logger from '@/utils/logger';

// Keep track of the refresh token promise to prevent multiple refresh calls
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

// Queue of failed requests to retry after token refresh
const failedQueue: {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
  config: AxiosRequestConfig;
}[] = [];

/**
 * Process the queue of failed requests
 * @param token The new access token
 * @param error Error if token refresh failed
 */
const processQueue = (error: Error | null, token: string | null = null): void => {
  failedQueue.forEach(request => {
    if (error) {
      request.reject(error);
    } else {
      // Add the new token to the request
      if (token && request.config.headers) {
        request.config.headers['Authorization'] = `Bearer ${token}`;
      }

      // Set a cookie for server-side authentication as well
      if (token) {
        document.cookie = `auth_token=${token}; path=/; samesite=strict; max-age=3600`;
      }

      request.resolve(axios(request.config));
    }
  });

  // Clear the queue
  failedQueue.length = 0;
};

/**
 * Setup authentication interceptors for an axios instance
 * @param httpClient The axios instance to setup interceptors for
 */
export const setupAuthInterceptors = (httpClient: AxiosInstance): void => {
  // Request interceptor to add the authentication token
  httpClient.interceptors.request.use(
    async config => {
      // Comprehensive check for all auth-related endpoints
      // Include any endpoint that deals with authentication to prevent circular dependencies
      const isAuthEndpoint =
        config.url?.includes('/api/auth/') ||
        config.url?.includes('/api/users/me') ||
        config.url?.includes('/login') ||
        config.url?.includes('/signup') ||
        config.url?.includes('/logout');

      // If this is an auth-related request, skip token handling completely
      if (isAuthEndpoint) {
        logger.debug('[authInterceptor] Skipping token handling for auth endpoint:', config.url);
        return config;
      }

      // Check if we need to refresh the token before sending the request
      // Only for non-auth endpoints and when the token is actually expired
      if (isAccessTokenExpired() && !config.url?.includes('/api/auth/refresh')) {
        logger.debug('[authInterceptor] Access token expired, refreshing before request');

        // Only refresh once even if multiple requests are made
        if (!isRefreshing) {
          isRefreshing = true;

          // Set a timeout for the refresh operation with a hard limit
          const refreshTimeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => {
              logger.warn("[authInterceptor] Token refresh timed out");
              resolve(false);
            }, 2000); // Further reduced timeout to 2 seconds for faster response
          });

          // Race the refresh operation against the timeout
          refreshPromise = Promise.race([refreshAccessToken(), refreshTimeoutPromise]);

          try {
            const success = await refreshPromise;
            isRefreshing = false;
            refreshPromise = null;

            if (!success) {
              logger.warn('[authInterceptor] Failed to refresh token before request');
              // Will proceed with the request without a valid token
              // This allows public endpoints to work while still capturing 401s for protected endpoints
            }
          } catch (error) {
            isRefreshing = false;
            refreshPromise = null;
            logger.error('[authInterceptor] Error refreshing token:', error);
            // Will proceed with the request, which may fail with 401 if it needs authentication
          }
        } else if (refreshPromise) {
          // Wait for the ongoing refresh but with a shorter timeout
          logger.debug('[authInterceptor] Waiting for ongoing token refresh');

          // Use a very short timeout for waiting on existing refresh
          const waitTimeoutPromise = new Promise<void>((resolve) => {
            setTimeout(() => {
              logger.warn("[authInterceptor] Waiting for token refresh timed out");
              resolve();
            }, 1000); // Very short timeout for waiting on existing refresh
          });

          // Don't block the request for too long waiting for refresh
          await Promise.race([refreshPromise.then(() => {}), waitTimeoutPromise]);
        }
      }

      // Add the access token to the request headers if it exists and is not a refresh request
      const token = getAccessToken(true, true); // Validate token and remove if invalid
      if (token) {
        if (!config.headers) {
          config.headers = {};
        }
        config.headers['Authorization'] = `Bearer ${token}`;
      }

      // Always allow the request to proceed, even without a token
      // This helps with public endpoints and development mode

      return config;
    },
    error => {
      return Promise.reject(error);
    }
  );

  // Response interceptor to handle authentication errors
  httpClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };
      if (!originalRequest) {
        return Promise.reject(error);
      }

      // Comprehensive check for all auth-related endpoints
      // Include any endpoint that deals with authentication to prevent circular dependencies
      const isAuthEndpoint =
        originalRequest.url?.includes('/api/auth/') ||
        originalRequest.url?.includes('/api/users/me') ||
        originalRequest.url?.includes('/login') ||
        originalRequest.url?.includes('/signup') ||
        originalRequest.url?.includes('/logout');

      // If this is an auth-related request, skip token handling completely
      if (isAuthEndpoint) {
        logger.debug('[authInterceptor] Skipping token refresh for auth endpoint:', originalRequest.url);
        return Promise.reject(error);
      }

      // Handle 401 errors (Unauthorized) but not for auth endpoints to avoid infinite loops
      if (error.response?.status === 401 && !originalRequest._retry) {
        logger.debug('[authInterceptor] Received 401, attempting token refresh');

        // Check if we're already refreshing
        if (isRefreshing) {
          try {
            // Wait for the refresh to complete with a timeout
            const timeoutPromise = new Promise<void>((resolve) => {
              setTimeout(() => {
                logger.warn("[authInterceptor] Waiting for token refresh timed out in 401 handler");
                resolve();
              }, 1000); // Further reduced to 1 second timeout for faster response
            });

            // Add the request to the queue and wait for completion or timeout
            const refreshPromiseWithTimeout = Promise.race([
              new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject, config: originalRequest });
              }),
              timeoutPromise.then(() => {
                return Promise.reject(new Error('Token refresh timeout'));
              })
            ]);

            return refreshPromiseWithTimeout;
          } catch (err) {
            return Promise.reject(err);
          }
        }

        // Mark this request as retried
        originalRequest._retry = true;
        isRefreshing = true;

        try {
          // Set a hard timeout for the refresh operation
          const refreshTimeoutPromise = new Promise<boolean>((resolve) => {
            setTimeout(() => {
              logger.warn("[authInterceptor] Token refresh timed out in 401 handler");
              resolve(false);
            }, 2000); // Reduced to 2 second timeout for faster response
          });

          // Race the refresh against a strict timeout
          const success = await Promise.race([refreshAccessToken(), refreshTimeoutPromise]);
          isRefreshing = false;

          if (success) {
            logger.debug('[authInterceptor] Token refresh successful, retrying request');

            // Update token in the original request
            const newToken = getAccessToken();
            if (newToken && originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            }

            // Process any queued requests
            processQueue(null, newToken);

            // Add a timeout for the retry request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => {
              logger.warn("[authInterceptor] Request retry timed out");
              controller.abort();
            }, 3000);

            try {
              // Clone the original request and add the abort signal
              const retryConfig = { ...originalRequest, signal: controller.signal };
              return await axios(retryConfig);
            } catch (retryError) {
              if (retryError.name === 'AbortError') {
                logger.error('[authInterceptor] Request retry aborted due to timeout');
                return Promise.reject(new Error('Request retry timed out'));
              }
              return Promise.reject(retryError);
            } finally {
              clearTimeout(timeoutId);
            }
          } else {
            logger.warn('[authInterceptor] Token refresh failed');
            processQueue(new Error('Failed to refresh token'));
            removeTokens();

            // Redirect to login or dispatch an event
            window.dispatchEvent(new CustomEvent('auth:expired'));

            return Promise.reject(error);
          }
        } catch (refreshError) {
          logger.error('[authInterceptor] Error during token refresh:', refreshError);
          isRefreshing = false;
          processQueue(refreshError as Error);
          removeTokens();

          // Redirect to login or dispatch an event
          window.dispatchEvent(new CustomEvent('auth:expired'));

          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );
};

export default setupAuthInterceptors;