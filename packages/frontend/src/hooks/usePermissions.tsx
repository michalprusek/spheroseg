/**
 * React Hooks for Permission Management
 *
 * Provides React-friendly interfaces for the unified permission service
 * with automatic reactivity and caching.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import permissionService, {
  Permission,
  Role,
  PermissionCheck,
  UserPermissions,
} from '@/services/unifiedPermissionService';
import { useAuth } from '@/hooks/useUnifiedAuth';
import { createLogger } from '@/utils/logging/unifiedLogger';

const logger = createLogger('usePermissions');

// ===========================
// Types
// ===========================

export interface PermissionContextValue {
  permissions: Permission[];
  role: Role;
  isLoading: boolean;
  error: Error | null;

  // Permission checks
  hasPermission: (permission: Permission | PermissionCheck) => Promise<boolean>;
  hasAnyPermission: (permissions: Permission[]) => Promise<boolean>;
  hasAllPermissions: (permissions: Permission[]) => Promise<boolean>;

  // Resource checks
  isResourceOwner: (resource: string, resourceId: string) => Promise<boolean>;
  getResourcePermissions: (resource: string, resourceId: string) => Promise<Permission[]>;

  // Utils
  refreshPermissions: () => Promise<void>;
}

export interface PermissionProviderProps {
  children: React.ReactNode;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

// ===========================
// Context
// ===========================

const PermissionContext = createContext<PermissionContextValue | null>(null);

// ===========================
// Provider Component
// ===========================

export function PermissionProvider({
  children,
  cacheEnabled = true,
  cacheTTL = 5 * 60 * 1000,
}: PermissionProviderProps) {
  const { user, isAuthenticated } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<Role>(Role.GUEST);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Configure permission service
  useEffect(() => {
    permissionService.configure({
      cacheEnabled,
      cacheTTL,
    });
  }, [cacheEnabled, cacheTTL]);

  // Load user permissions
  const loadPermissions = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setPermissions([]);
      setRole(Role.GUEST);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const userPerms = await permissionService.getUserPermissions(user.id);
      setPermissions(userPerms.permissions);
      setRole(userPerms.role);
    } catch (err) {
      logger.error('Failed to load permissions', err);
      setError(err as Error);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  // Load permissions on mount and user change
  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  // Permission check methods
  const hasPermission = useCallback(
    async (permission: Permission | PermissionCheck): Promise<boolean> => {
      const check = typeof permission === 'string' ? { permission } : permission;

      return permissionService.hasPermission(check, user);
    },
    [user],
  );

  const hasAnyPermission = useCallback(
    async (permissions: Permission[]): Promise<boolean> => {
      return permissionService.hasAnyPermission(permissions, user);
    },
    [user],
  );

  const hasAllPermissions = useCallback(
    async (permissions: Permission[]): Promise<boolean> => {
      return permissionService.hasAllPermissions(permissions, user);
    },
    [user],
  );

  const isResourceOwner = useCallback(
    async (resource: string, resourceId: string): Promise<boolean> => {
      if (!user) return false;
      return permissionService.isResourceOwner(resource, resourceId, user.id);
    },
    [user],
  );

  const getResourcePermissions = useCallback(
    async (resource: string, resourceId: string): Promise<Permission[]> => {
      if (!user) return [];
      return permissionService.getResourcePermissions(resource, resourceId, user.id);
    },
    [user],
  );

  const refreshPermissions = useCallback(async () => {
    await permissionService.clearCache();
    await loadPermissions();
  }, [loadPermissions]);

  const value: PermissionContextValue = {
    permissions,
    role,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    isResourceOwner,
    getResourcePermissions,
    refreshPermissions,
  };

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

// ===========================
// Main Hook
// ===========================

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }

  return context;
}

// ===========================
// Specialized Hooks
// ===========================

/**
 * Hook for checking a single permission synchronously
 */
export function usePermission(permission: Permission | PermissionCheck): {
  hasPermission: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const { hasPermission: checkPermission } = usePermissions();
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await checkPermission(permission);

        if (!cancelled) {
          setHasPermission(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setHasPermission(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [permission, checkPermission]);

  return { hasPermission, isLoading, error };
}

/**
 * Hook for checking resource ownership
 */
export function useResourceOwnership(
  resource: string,
  resourceId: string,
): {
  isOwner: boolean;
  isLoading: boolean;
  error: Error | null;
} {
  const { isResourceOwner } = usePermissions();
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (!resource || !resourceId) {
        setIsOwner(false);
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const result = await isResourceOwner(resource, resourceId);

        if (!cancelled) {
          setIsOwner(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
          setIsOwner(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [resource, resourceId, isResourceOwner]);

  return { isOwner, isLoading, error };
}

/**
 * Hook for conditional rendering based on permissions
 */
export function useConditionalRender(
  permission: Permission | PermissionCheck,
  fallback?: React.ReactNode,
): {
  render: (children: React.ReactNode) => React.ReactNode;
  hasPermission: boolean;
  isLoading: boolean;
} {
  const { hasPermission, isLoading } = usePermission(permission);

  const render = useCallback(
    (children: React.ReactNode) => {
      if (isLoading) {
        return null; // Or loading indicator
      }

      return hasPermission ? children : fallback || null;
    },
    [hasPermission, isLoading, fallback],
  );

  return { render, hasPermission, isLoading };
}

/**
 * Hook for role-based rendering
 */
export function useRoleBasedRender(allowedRoles: Role | Role[]): {
  render: (children: React.ReactNode) => React.ReactNode;
  hasRole: boolean;
} {
  const { role } = usePermissions();

  const hasRole = useMemo(() => {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    return roles.includes(role);
  }, [role, allowedRoles]);

  const render = useCallback(
    (children: React.ReactNode) => {
      return hasRole ? children : null;
    },
    [hasRole],
  );

  return { render, hasRole };
}

// ===========================
// Permission Guard Components
// ===========================

export interface PermissionGuardProps {
  permission: Permission | PermissionCheck;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function PermissionGuard({ permission, fallback, children }: PermissionGuardProps) {
  const { render } = useConditionalRender(permission, fallback);
  return <>{render(children)}</>;
}

export interface RoleGuardProps {
  role: Role | Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ role, fallback, children }: RoleGuardProps) {
  const { render, hasRole } = useRoleBasedRender(role);
  return <>{hasRole ? children : fallback}</>;
}

export interface ResourceOwnerGuardProps {
  resource: string;
  resourceId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ResourceOwnerGuard({ resource, resourceId, fallback, children }: ResourceOwnerGuardProps) {
  const { isOwner, isLoading } = useResourceOwnership(resource, resourceId);

  if (isLoading) return null;

  return <>{isOwner ? children : fallback}</>;
}

// ===========================
// Higher Order Components
// ===========================

export interface WithPermissionsProps {
  permissions: PermissionContextValue;
}

export function withPermissions<P extends object>(
  Component: React.ComponentType<P & WithPermissionsProps>,
): React.ComponentType<Omit<P, 'permissions'>> {
  return function WithPermissionsComponent(props: Omit<P, 'permissions'>) {
    const permissions = usePermissions();
    return <Component {...(props as P)} permissions={permissions} />;
  };
}

// ===========================
// Utility Functions
// ===========================

/**
 * Create a permission-protected component
 */
export function createProtectedComponent<P extends object>(
  Component: React.ComponentType<P>,
  permission: Permission | PermissionCheck,
  fallback?: React.ComponentType,
): React.ComponentType<P> {
  return function ProtectedComponent(props: P) {
    const { hasPermission, isLoading } = usePermission(permission);

    if (isLoading) return null;

    if (!hasPermission) {
      return fallback ? React.createElement(fallback) : null;
    }

    return <Component {...props} />;
  };
}

/**
 * Create action handler that checks permissions
 */
export function createPermissionedAction<T extends (...args: any[]) => any>(
  action: T,
  permission: Permission | PermissionCheck,
  onDenied?: () => void,
): T {
  return (async (...args: Parameters<T>) => {
    const hasPermission = await permissionService.hasPermission(
      typeof permission === 'string' ? { permission } : permission,
    );

    if (!hasPermission) {
      logger.warn('Permission denied for action', { permission });
      onDenied?.();
      return;
    }

    return action(...args);
  }) as T;
}
