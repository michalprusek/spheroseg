/**
 * Unified Authentication Service
 *
 * This service consolidates all authentication functionality into a single,
 * comprehensive API for managing user authentication, tokens, and sessions.
 */

import { createLogger } from '@/utils/logging/unifiedLogger';
import { handleError, AppError, ErrorType } from '@/utils/error/unifiedErrorHandler';
import cacheService, { CacheLayer } from '@/services/unifiedCacheService';
import apiClient from '@/lib/apiClient';
import { apiPaths } from '@/lib/apiPaths';

const logger = createLogger('UnifiedAuthService');

// ===========================
// Types and Interfaces
// ===========================

export interface User {
  id: string;
  email: string;
  username: string;
  role: 'admin' | 'user' | 'guest';
  avatar?: string;
  preferences?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  username: string;
  confirmPassword?: string;
}

export interface AuthConfig {
  tokenStorageKey: string;
  refreshTokenStorageKey: string;
  userStorageKey: string;
  persistentLoginKey: string;
  tokenRefreshThreshold: number; // Minutes before expiry to refresh
  maxRetries: number;
  cookieDomain?: string;
  cookiePath?: string;
  cookieSecure?: boolean;
  cookieSameSite?: 'strict' | 'lax' | 'none';
}

export interface AuthEventPayload {
  type: 'login' | 'logout' | 'refresh' | 'expire' | 'error';
  user?: User;
  error?: Error;
}

// ===========================
// Default Configuration
// ===========================

const DEFAULT_CONFIG: AuthConfig = {
  tokenStorageKey: 'spheroseg_access_token',
  refreshTokenStorageKey: 'spheroseg_refresh_token',
  userStorageKey: 'spheroseg_user',
  persistentLoginKey: 'login_persistent',
  tokenRefreshThreshold: 5, // 5 minutes
  maxRetries: 3,
  cookiePath: '/',
  cookieSecure: process.env.NODE_ENV === 'production',
  cookieSameSite: 'lax',
};

// ===========================
// Service Class
// ===========================

class UnifiedAuthService {
  private config: AuthConfig = DEFAULT_CONFIG;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private tokenRefreshTimer: NodeJS.Timeout | null = null;
  private eventListeners: Map<string, Set<(payload: AuthEventPayload) => void>> = new Map();
  private requestQueue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  constructor() {
    this.setupStorageSync();
    this.restoreSession();
  }

  /**
   * Configure the auth service
   */
  public configure(config: Partial<AuthConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Auth service configured', config);
  }

  /**
   * Login user with credentials
   */
  public async login(credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      logger.info('Attempting login', { email: credentials.email });

      const response = await apiClient.post(apiPaths.auth.login, {
        email: credentials.email,
        password: credentials.password,
      });

      const { user, access_token, refresh_token, expires_in } = response.data;

      const tokens: AuthTokens = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in || 3600,
        tokenType: 'Bearer',
      };

      // Store tokens and user
      await this.storeAuthData(user, tokens, credentials.rememberMe);

      // Setup token refresh
      this.scheduleTokenRefresh(tokens.expiresIn);

      // Emit login event
      this.emitAuthEvent({
        type: 'login',
        user,
      });

      logger.info('Login successful', { userId: user.id });

      return { user, tokens };
    } catch (error) {
      logger.error('Login failed', error);
      throw handleError(error, {
        context: 'login',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  /**
   * Register new user
   */
  public async register(credentials: RegisterCredentials): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      logger.info('Attempting registration', { email: credentials.email });

      // Validate passwords match
      if (credentials.confirmPassword && credentials.password !== credentials.confirmPassword) {
        throw new AppError('Passwords do not match', ErrorType.VALIDATION);
      }

      const response = await apiClient.post(apiPaths.auth.register, {
        email: credentials.email,
        password: credentials.password,
        username: credentials.username,
      });

      const { user, access_token, refresh_token, expires_in } = response.data;

      const tokens: AuthTokens = {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in || 3600,
        tokenType: 'Bearer',
      };

      // Store tokens and user
      await this.storeAuthData(user, tokens, true);

      // Setup token refresh
      this.scheduleTokenRefresh(tokens.expiresIn);

      // Emit login event
      this.emitAuthEvent({
        type: 'login',
        user,
      });

      logger.info('Registration successful', { userId: user.id });

      return { user, tokens };
    } catch (error) {
      logger.error('Registration failed', error);
      throw handleError(error, {
        context: 'register',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  /**
   * Logout user
   */
  public async logout(): Promise<void> {
    try {
      logger.info('Attempting logout');

      // Get current user for event
      const user = this.getCurrentUser();

      // Call logout endpoint (optional - some backends track sessions)
      try {
        await apiClient.post(apiPaths.auth.logout);
      } catch (error) {
        // Ignore logout endpoint errors - we'll clear local data anyway
        logger.warn('Logout endpoint failed, clearing local data', error);
      }

      // Clear all auth data
      await this.clearAuthData();

      // Cancel token refresh
      this.cancelTokenRefresh();

      // Clear cache
      await cacheService.deleteByTag('user-data');

      // Emit logout event
      this.emitAuthEvent({
        type: 'logout',
        user: user || undefined,
      });

      logger.info('Logout successful');
    } catch (error) {
      logger.error('Logout failed', error);
      throw handleError(error, {
        context: 'logout',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  /**
   * Refresh authentication tokens
   */
  public async refreshTokens(): Promise<AuthTokens> {
    // If refresh is already in progress, wait for it
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performTokenRefresh();

    try {
      const tokens = await this.refreshPromise;
      this.refreshPromise = null;

      // Process queued requests
      this.processRequestQueue(true);

      return tokens;
    } catch (error) {
      this.refreshPromise = null;

      // Process queued requests with error
      this.processRequestQueue(false);

      throw error;
    }
  }

  /**
   * Get current access token
   */
  public getAccessToken(): string | null {
    // Try multiple storage locations
    const token =
      localStorage.getItem(this.config.tokenStorageKey) ||
      sessionStorage.getItem(this.config.tokenStorageKey) ||
      this.getCookie('auth_token');

    if (token && this.isTokenValid(token)) {
      return token;
    }

    return null;
  }

  /**
   * Get current refresh token
   */
  public getRefreshToken(): string | null {
    return (
      localStorage.getItem(this.config.refreshTokenStorageKey) ||
      sessionStorage.getItem(this.config.refreshTokenStorageKey) ||
      this.getCookie('refresh_token')
    );
  }

  /**
   * Get current user
   */
  public getCurrentUser(): User | null {
    try {
      const userStr =
        localStorage.getItem(this.config.userStorageKey) || sessionStorage.getItem(this.config.userStorageKey);

      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch (error) {
      logger.error('Failed to parse user data', error);
    }

    return null;
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.getAccessToken() && !!this.getCurrentUser();
  }

  /**
   * Add authentication event listener
   */
  public addEventListener(event: string, callback: (payload: AuthEventPayload) => void): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }

    this.eventListeners.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(event)?.delete(callback);
    };
  }

  /**
   * Request password reset
   */
  public async requestPasswordReset(email: string): Promise<void> {
    try {
      logger.info('Requesting password reset', { email });

      await apiClient.post(apiPaths.auth.forgotPassword, { email });

      logger.info('Password reset requested successfully');
    } catch (error) {
      logger.error('Password reset request failed', error);
      throw handleError(error, {
        context: 'requestPasswordReset',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  /**
   * Reset password with token
   */
  public async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      logger.info('Resetting password');

      await apiClient.post(apiPaths.auth.resetPassword, {
        token,
        password: newPassword,
      });

      logger.info('Password reset successful');
    } catch (error) {
      logger.error('Password reset failed', error);
      throw handleError(error, {
        context: 'resetPassword',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  /**
   * Update user profile
   */
  public async updateProfile(updates: Partial<User>): Promise<User> {
    try {
      logger.info('Updating user profile', { userId: updates.id });

      const response = await apiClient.patch('/api/users/me', updates);
      const updatedUser = response.data;

      // Update stored user
      const currentUser = this.getCurrentUser();
      if (currentUser) {
        const mergedUser = { ...currentUser, ...updatedUser };
        this.storeUser(mergedUser);
      }

      logger.info('Profile updated successfully');

      return updatedUser;
    } catch (error) {
      logger.error('Profile update failed', error);
      throw handleError(error, {
        context: 'updateProfile',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  /**
   * Queue request for retry after token refresh
   */
  public queueRequest(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ resolve, reject });
    });
  }

  // ===========================
  // Private Helper Methods
  // ===========================

  private async performTokenRefresh(): Promise<AuthTokens> {
    try {
      const refreshToken = this.getRefreshToken();

      if (!refreshToken) {
        throw new AppError('No refresh token available', ErrorType.AUTHENTICATION);
      }

      logger.info('Refreshing tokens');

      const response = await apiClient.post(apiPaths.auth.refresh, {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken, expires_in } = response.data;

      const tokens: AuthTokens = {
        accessToken: access_token,
        refreshToken: newRefreshToken || refreshToken,
        expiresIn: expires_in || 3600,
        tokenType: 'Bearer',
      };

      // Store new tokens
      this.storeTokens(tokens);

      // Reschedule token refresh
      this.scheduleTokenRefresh(tokens.expiresIn);

      // Emit refresh event
      this.emitAuthEvent({
        type: 'refresh',
        user: this.getCurrentUser() || undefined,
      });

      logger.info('Token refresh successful');

      return tokens;
    } catch (error) {
      logger.error('Token refresh failed', error);

      // Clear auth data on refresh failure
      await this.clearAuthData();

      // Emit expire event
      this.emitAuthEvent({
        type: 'expire',
        error: error as Error,
      });

      throw handleError(error, {
        context: 'refreshTokens',
        type: ErrorType.AUTHENTICATION,
      });
    }
  }

  private async storeAuthData(user: User, tokens: AuthTokens, rememberMe?: boolean): Promise<void> {
    const storage = rememberMe ? localStorage : sessionStorage;

    // Store tokens
    storage.setItem(this.config.tokenStorageKey, tokens.accessToken);
    storage.setItem(this.config.refreshTokenStorageKey, tokens.refreshToken);

    // Store user
    storage.setItem(this.config.userStorageKey, JSON.stringify(user));

    // Set persistent login flag
    if (rememberMe) {
      localStorage.setItem(this.config.persistentLoginKey, 'true');
    }

    // Also set cookies as fallback
    if (this.config.cookieDomain) {
      this.setCookie('auth_token', tokens.accessToken, {
        expires: new Date(Date.now() + tokens.expiresIn * 1000),
        domain: this.config.cookieDomain,
        path: this.config.cookiePath,
        secure: this.config.cookieSecure,
        sameSite: this.config.cookieSameSite,
      });
    }

    // Cache user data
    await cacheService.set(`user:${user.id}`, user, {
      ttl: tokens.expiresIn * 1000,
      layer: [CacheLayer.MEMORY],
      tags: ['user-data', `user-${user.id}`],
    });
  }

  private storeTokens(tokens: AuthTokens): void {
    const isPersistent = localStorage.getItem(this.config.persistentLoginKey) === 'true';
    const storage = isPersistent ? localStorage : sessionStorage;

    storage.setItem(this.config.tokenStorageKey, tokens.accessToken);
    storage.setItem(this.config.refreshTokenStorageKey, tokens.refreshToken);
  }

  private storeUser(user: User): void {
    const isPersistent = localStorage.getItem(this.config.persistentLoginKey) === 'true';
    const storage = isPersistent ? localStorage : sessionStorage;

    storage.setItem(this.config.userStorageKey, JSON.stringify(user));
  }

  private async clearAuthData(): Promise<void> {
    // Clear from all storages
    [localStorage, sessionStorage].forEach((storage) => {
      storage.removeItem(this.config.tokenStorageKey);
      storage.removeItem(this.config.refreshTokenStorageKey);
      storage.removeItem(this.config.userStorageKey);
    });

    localStorage.removeItem(this.config.persistentLoginKey);

    // Clear cookies
    this.deleteCookie('auth_token');
    this.deleteCookie('refresh_token');
  }

  private scheduleTokenRefresh(expiresIn: number): void {
    this.cancelTokenRefresh();

    // Schedule refresh before token expires
    const refreshTime = (expiresIn - this.config.tokenRefreshThreshold * 60) * 1000;

    if (refreshTime > 0) {
      this.tokenRefreshTimer = setTimeout(() => {
        this.refreshTokens().catch((error) => {
          logger.error('Scheduled token refresh failed', error);
        });
      }, refreshTime);
    }
  }

  private cancelTokenRefresh(): void {
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
  }

  private isTokenValid(token: string): boolean {
    try {
      // Decode JWT without verification (for client-side check)
      const parts = token.split('.');
      if (parts.length !== 3) return false;

      const payload = JSON.parse(atob(parts[1]));
      const exp = payload.exp;

      if (!exp) return true; // No expiration

      // Check if token is expired
      return Date.now() < exp * 1000;
    } catch (error) {
      return false;
    }
  }

  private processRequestQueue(success: boolean): void {
    const queue = [...this.requestQueue];
    this.requestQueue = [];

    queue.forEach(({ resolve, reject }) => {
      if (success) {
        resolve(undefined);
      } else {
        reject(new AppError('Token refresh failed', ErrorType.AUTHENTICATION));
      }
    });
  }

  private setupStorageSync(): void {
    // Sync auth state across tabs
    window.addEventListener('storage', (event) => {
      if (event.key === this.config.tokenStorageKey || event.key === this.config.userStorageKey) {
        // Auth state changed in another tab
        if (!event.newValue) {
          // User logged out in another tab
          this.emitAuthEvent({
            type: 'logout',
          });
        } else {
          // User logged in or token refreshed in another tab
          const user = this.getCurrentUser();
          if (user) {
            this.emitAuthEvent({
              type: 'login',
              user,
            });
          }
        }
      }
    });
  }

  private restoreSession(): void {
    // Check if we have valid session
    if (this.isAuthenticated()) {
      const token = this.getAccessToken();
      if (token) {
        // Calculate remaining time and schedule refresh
        try {
          const parts = token.split('.');
          const payload = JSON.parse(atob(parts[1]));
          const exp = payload.exp;

          if (exp) {
            const expiresIn = Math.max(0, exp - Date.now() / 1000);
            this.scheduleTokenRefresh(expiresIn);
          }
        } catch (error) {
          logger.error('Failed to parse token for refresh scheduling', error);
        }
      }
    }
  }

  private emitAuthEvent(payload: AuthEventPayload): void {
    const listeners = this.eventListeners.get('authStateChange') || new Set();
    listeners.forEach((callback) => {
      try {
        callback(payload);
      } catch (error) {
        logger.error('Auth event listener error', error);
      }
    });

    // Also emit as DOM event for non-React components
    window.dispatchEvent(new CustomEvent('auth-state-change', { detail: payload }));
  }

  private setCookie(name: string, value: string, options: any = {}): void {
    let cookie = `${name}=${encodeURIComponent(value)}`;

    if (options.expires) {
      cookie += `; expires=${options.expires.toUTCString()}`;
    }
    if (options.path) {
      cookie += `; path=${options.path}`;
    }
    if (options.domain) {
      cookie += `; domain=${options.domain}`;
    }
    if (options.secure) {
      cookie += '; secure';
    }
    if (options.sameSite) {
      cookie += `; samesite=${options.sameSite}`;
    }

    document.cookie = cookie;
  }

  private getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
    return match ? decodeURIComponent(match[2]) : null;
  }

  private deleteCookie(name: string): void {
    this.setCookie(name, '', {
      expires: new Date(0),
      path: this.config.cookiePath,
      domain: this.config.cookieDomain,
    });
  }
}

// ===========================
// Singleton Instance
// ===========================

const authService = new UnifiedAuthService();

// ===========================
// Export
// ===========================

export default authService;
