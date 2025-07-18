/**
 * Unified Authentication Hook
 *
 * Provides a React-friendly interface to the unified authentication service
 * with automatic state management and reactivity.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import authService, {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthEventPayload,
} from '@/services/unifiedAuthService';
import { createLogger } from '@/utils/logging/unifiedLogger';
import { toast } from 'sonner';
import { useCacheManager } from '@/hooks/useUnifiedCache';

const logger = createLogger('useUnifiedAuth');

// ===========================
// Types
// ===========================

export interface AuthContextValue {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;

  // Methods
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  clearError: () => void;

  // Utils
  hasRole: (role: string | string[]) => boolean;
  hasPermission: (permission: string) => boolean;
}

export interface AuthProviderProps {
  children: React.ReactNode;
  redirectPath?: string;
  onAuthStateChange?: (payload: AuthEventPayload) => void;
}

// ===========================
// Context
// ===========================

const AuthContext = createContext<AuthContextValue | null>(null);

// ===========================
// Provider Component
// ===========================

export function AuthProvider({ children, redirectPath = '/dashboard', onAuthStateChange }: AuthProviderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearByTag } = useCacheManager();

  const [user, setUser] = useState<User | null>(authService.getCurrentUser());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const savedPathRef = useRef<string | null>(null);

  // Initialize auth state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);

        // Check if we have valid auth
        if (authService.isAuthenticated()) {
          const currentUser = authService.getCurrentUser();
          setUser(currentUser);

          // Optionally validate token with backend
          try {
            await authService.refreshTokens();
          } catch (error) {
            // Token invalid, clear auth
            logger.warn('Token validation failed, clearing auth', error);
            setUser(null);
          }
        }
      } catch (error) {
        logger.error('Auth initialization failed', error);
        setError(error as Error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Listen to auth events
  useEffect(() => {
    const unsubscribe = authService.addEventListener('authStateChange', (payload) => {
      logger.info('Auth state changed', payload);

      switch (payload.type) {
        case 'login':
          setUser(payload.user || null);
          setError(null);

          // Navigate to saved path or default
          const targetPath = savedPathRef.current || redirectPath;
          savedPathRef.current = null;

          if (location.pathname === '/signin' || location.pathname === '/signup') {
            navigate(targetPath);
          }
          break;

        case 'logout':
          setUser(null);
          setError(null);

          // Save current path for post-login redirect
          if (location.pathname !== '/signin' && location.pathname !== '/signup') {
            savedPathRef.current = location.pathname;
          }

          navigate('/signin');
          break;

        case 'refresh':
          setUser(payload.user || null);
          break;

        case 'expire':
          setUser(null);
          setError(payload.error || null);

          toast.error('Your session has expired. Please sign in again.');
          navigate('/signin');
          break;

        case 'error':
          setError(payload.error || null);
          break;
      }

      // Call external handler
      onAuthStateChange?.(payload);
    });

    return unsubscribe;
  }, [navigate, location, redirectPath, onAuthStateChange]);

  // Methods
  const login = useCallback(
    async (credentials: LoginCredentials) => {
      try {
        setIsLoading(true);
        setError(null);

        const { user } = await authService.login(credentials);
        setUser(user);

        // Clear user-specific caches
        await clearByTag('user-data');

        toast.success(`Welcome back, ${user.username || user.email}!`);
      } catch (error) {
        const err = error as Error;
        setError(err);
        toast.error(err.message || 'Login failed');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [clearByTag],
  );

  const register = useCallback(async (credentials: RegisterCredentials) => {
    try {
      setIsLoading(true);
      setError(null);

      const { user } = await authService.register(credentials);
      setUser(user);

      toast.success('Registration successful! Welcome to SpherosegV4.');
    } catch (error) {
      const err = error as Error;
      setError(err);
      toast.error(err.message || 'Registration failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.logout();
      setUser(null);

      // Clear all user data from cache
      await clearByTag('user-data');

      toast.info('You have been logged out');
    } catch (error) {
      const err = error as Error;
      setError(err);
      toast.error('Logout failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [clearByTag]);

  const refreshTokens = useCallback(async () => {
    try {
      await authService.refreshTokens();
    } catch (error) {
      const err = error as Error;
      setError(err);
      throw err;
    }
  }, []);

  const updateProfile = useCallback(
    async (updates: Partial<User>) => {
      try {
        setIsLoading(true);
        setError(null);

        const updatedUser = await authService.updateProfile(updates);
        setUser(updatedUser);

        // Invalidate user cache
        await clearByTag(`user-${updatedUser.id}`);

        toast.success('Profile updated successfully');
      } catch (error) {
        const err = error as Error;
        setError(err);
        toast.error('Failed to update profile');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [clearByTag],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await authService.requestPasswordReset(email);

      toast.success('Password reset instructions sent to your email');
    } catch (error) {
      const err = error as Error;
      setError(err);
      toast.error('Failed to request password reset');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const resetPassword = useCallback(
    async (token: string, newPassword: string) => {
      try {
        setIsLoading(true);
        setError(null);

        await authService.resetPassword(token, newPassword);

        toast.success('Password reset successful. Please sign in with your new password.');
        navigate('/signin');
      } catch (error) {
        const err = error as Error;
        setError(err);
        toast.error('Failed to reset password');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [navigate],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const hasRole = useCallback(
    (role: string | string[]) => {
      if (!user) return false;

      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user],
  );

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false;

      // Admin has all permissions
      if (user.role === 'admin') return true;

      // Check specific permissions based on role
      // This is a simplified example - you might want to fetch permissions from backend
      const rolePermissions: Record<string, string[]> = {
        user: ['read:own', 'write:own', 'delete:own'],
        guest: ['read:public'],
      };

      return rolePermissions[user.role]?.includes(permission) || false;
    },
    [user],
  );

  const value: AuthContextValue = {
    user,
    isAuthenticated: !!user && authService.isAuthenticated(),
    isLoading,
    error,
    login,
    register,
    logout,
    refreshTokens,
    updateProfile,
    requestPasswordReset,
    resetPassword,
    clearError,
    hasRole,
    hasPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ===========================
// Hook
// ===========================

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

// ===========================
// Higher Order Component
// ===========================

export interface WithAuthProps {
  auth: AuthContextValue;
}

export function withAuth<P extends object>(
  Component: React.ComponentType<P & WithAuthProps>,
): React.ComponentType<Omit<P, 'auth'>> {
  return function WithAuthComponent(props: Omit<P, 'auth'>) {
    const auth = useAuth();
    return <Component {...(props as P)} auth={auth} />;
  };
}

// ===========================
// Protected Route Component
// ===========================

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string | string[];
  requiredPermission?: string;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requiredPermission,
  fallback,
  redirectTo = '/signin',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Save current location for post-login redirect
      const from = location.pathname + location.search;
      navigate(redirectTo, { state: { from } });
    }
  }, [isAuthenticated, isLoading, navigate, redirectTo, location]);

  if (isLoading) {
    return fallback || <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return fallback || <div>Access denied. Insufficient role.</div>;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return fallback || <div>Access denied. Insufficient permissions.</div>;
  }

  return <>{children}</>;
}

// ===========================
// Hooks for specific auth operations
// ===========================

/**
 * Hook for login form
 */
export function useLoginForm(options?: { onSuccess?: () => void; rememberMeDefault?: boolean }) {
  const { login } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rememberMe, setRememberMe] = useState(options?.rememberMeDefault ?? true);

  const handleSubmit = useCallback(
    async (credentials: Omit<LoginCredentials, 'rememberMe'>) => {
      setIsSubmitting(true);

      try {
        await login({ ...credentials, rememberMe });
        options?.onSuccess?.();
      } finally {
        setIsSubmitting(false);
      }
    },
    [login, rememberMe, options],
  );

  return {
    handleSubmit,
    isSubmitting,
    rememberMe,
    setRememberMe,
  };
}

/**
 * Hook for handling auth redirects
 */
export function useAuthRedirect() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectAfterLogin = useCallback(
    (defaultPath = '/dashboard') => {
      const from = location.state?.from || defaultPath;
      navigate(from, { replace: true });
    },
    [navigate, location],
  );

  const redirectToLogin = useCallback(
    (saveCurrentPath = true) => {
      const from = saveCurrentPath ? location.pathname + location.search : undefined;
      navigate('/signin', { state: from ? { from } : undefined });
    },
    [navigate, location],
  );

  return {
    redirectAfterLogin,
    redirectToLogin,
  };
}

/**
 * Hook for session management
 */
export function useSession() {
  const { user, refreshTokens } = useAuth();
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) {
      setSessionExpiry(null);
      return;
    }

    // Parse token to get expiry
    const token = authService.getAccessToken();
    if (token) {
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp) {
          setSessionExpiry(new Date(payload.exp * 1000));
        }
      } catch (error) {
        logger.error('Failed to parse token expiry', error);
      }
    }
  }, [user]);

  const extendSession = useCallback(async () => {
    try {
      await refreshTokens();
      toast.success('Session extended');
    } catch (error) {
      toast.error('Failed to extend session');
    }
  }, [refreshTokens]);

  const isSessionExpiringSoon = useCallback(
    (thresholdMinutes = 5) => {
      if (!sessionExpiry) return false;

      const now = new Date();
      const timeUntilExpiry = sessionExpiry.getTime() - now.getTime();
      const thresholdMs = thresholdMinutes * 60 * 1000;

      return timeUntilExpiry > 0 && timeUntilExpiry < thresholdMs;
    },
    [sessionExpiry],
  );

  return {
    sessionExpiry,
    extendSession,
    isSessionExpiringSoon,
  };
}
