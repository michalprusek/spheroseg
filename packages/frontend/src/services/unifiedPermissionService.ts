/**
 * Unified Permission Service
 *
 * This service consolidates all permission and authorization functionality
 * into a single, comprehensive API for managing access control.
 */

import { createLogger } from '@/utils/logging/unifiedLogger';
import { handleError, AppError, ErrorType } from '@/utils/error/unifiedErrorHandler';
import cacheService, { CacheLayer } from '@/services/unifiedCacheService';
import authService from '@/services/unifiedAuthService';
import type { User } from '@/services/unifiedAuthService';

const logger = createLogger('UnifiedPermissionService');

// ===========================
// Types and Interfaces
// ===========================

export enum Role {
  ADMIN = 'admin',
  USER = 'user',
  GUEST = 'guest',
}

export enum Permission {
  // System permissions
  SYSTEM_ADMIN = 'system:admin',
  SYSTEM_MANAGE_USERS = 'system:manage_users',
  SYSTEM_VIEW_LOGS = 'system:view_logs',

  // Project permissions
  PROJECT_CREATE = 'project:create',
  PROJECT_VIEW_ALL = 'project:view_all',
  PROJECT_VIEW_OWN = 'project:view_own',
  PROJECT_VIEW_SHARED = 'project:view_shared',
  PROJECT_EDIT_ALL = 'project:edit_all',
  PROJECT_EDIT_OWN = 'project:edit_own',
  PROJECT_EDIT_SHARED = 'project:edit_shared',
  PROJECT_DELETE_ALL = 'project:delete_all',
  PROJECT_DELETE_OWN = 'project:delete_own',
  PROJECT_SHARE = 'project:share',
  PROJECT_EXPORT = 'project:export',

  // Image permissions
  IMAGE_UPLOAD = 'image:upload',
  IMAGE_VIEW = 'image:view',
  IMAGE_EDIT = 'image:edit',
  IMAGE_DELETE = 'image:delete',
  IMAGE_SEGMENT = 'image:segment',
  IMAGE_DOWNLOAD = 'image:download',

  // Segmentation permissions
  SEGMENTATION_CREATE = 'segmentation:create',
  SEGMENTATION_VIEW = 'segmentation:view',
  SEGMENTATION_EDIT = 'segmentation:edit',
  SEGMENTATION_DELETE = 'segmentation:delete',
  SEGMENTATION_APPROVE = 'segmentation:approve',

  // User permissions
  USER_VIEW_PROFILE = 'user:view_profile',
  USER_EDIT_PROFILE = 'user:edit_profile',
  USER_CHANGE_PASSWORD = 'user:change_password',
  USER_DELETE_ACCOUNT = 'user:delete_account',
}

export interface ResourcePermission {
  resource: string;
  resourceId: string;
  permission: Permission;
  granted: boolean;
  conditions?: Record<string, any>;
}

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
  inherits?: Role[];
}

export interface UserPermissions {
  userId: string;
  role: Role;
  permissions: Permission[];
  resourcePermissions: ResourcePermission[];
}

export interface PermissionCheck {
  permission: Permission;
  resource?: string;
  resourceId?: string;
  context?: Record<string, any>;
}

export interface PermissionConfig {
  cacheEnabled: boolean;
  cacheTTL: number;
  strictMode: boolean; // Deny by default if permission not found
  logPermissionChecks: boolean;
}

// ===========================
// Default Configuration
// ===========================

const DEFAULT_CONFIG: PermissionConfig = {
  cacheEnabled: true,
  cacheTTL: 5 * 60 * 1000, // 5 minutes
  strictMode: true,
  logPermissionChecks: false,
};

// Default role-permission mappings
const DEFAULT_ROLE_PERMISSIONS: RolePermissions[] = [
  {
    role: Role.ADMIN,
    permissions: [
      Permission.SYSTEM_ADMIN,
      Permission.SYSTEM_MANAGE_USERS,
      Permission.SYSTEM_VIEW_LOGS,
      Permission.PROJECT_CREATE,
      Permission.PROJECT_VIEW_ALL,
      Permission.PROJECT_EDIT_ALL,
      Permission.PROJECT_DELETE_ALL,
      Permission.PROJECT_SHARE,
      Permission.PROJECT_EXPORT,
      Permission.IMAGE_UPLOAD,
      Permission.IMAGE_VIEW,
      Permission.IMAGE_EDIT,
      Permission.IMAGE_DELETE,
      Permission.IMAGE_SEGMENT,
      Permission.IMAGE_DOWNLOAD,
      Permission.SEGMENTATION_CREATE,
      Permission.SEGMENTATION_VIEW,
      Permission.SEGMENTATION_EDIT,
      Permission.SEGMENTATION_DELETE,
      Permission.SEGMENTATION_APPROVE,
      Permission.USER_VIEW_PROFILE,
      Permission.USER_EDIT_PROFILE,
      Permission.USER_CHANGE_PASSWORD,
      Permission.USER_DELETE_ACCOUNT,
    ],
  },
  {
    role: Role.USER,
    permissions: [
      Permission.PROJECT_CREATE,
      Permission.PROJECT_VIEW_OWN,
      Permission.PROJECT_VIEW_SHARED,
      Permission.PROJECT_EDIT_OWN,
      Permission.PROJECT_EDIT_SHARED,
      Permission.PROJECT_DELETE_OWN,
      Permission.PROJECT_SHARE,
      Permission.PROJECT_EXPORT,
      Permission.IMAGE_UPLOAD,
      Permission.IMAGE_VIEW,
      Permission.IMAGE_EDIT,
      Permission.IMAGE_DELETE,
      Permission.IMAGE_SEGMENT,
      Permission.IMAGE_DOWNLOAD,
      Permission.SEGMENTATION_CREATE,
      Permission.SEGMENTATION_VIEW,
      Permission.SEGMENTATION_EDIT,
      Permission.SEGMENTATION_DELETE,
      Permission.USER_VIEW_PROFILE,
      Permission.USER_EDIT_PROFILE,
      Permission.USER_CHANGE_PASSWORD,
      Permission.USER_DELETE_ACCOUNT,
    ],
  },
  {
    role: Role.GUEST,
    permissions: [
      Permission.PROJECT_VIEW_SHARED,
      Permission.IMAGE_VIEW,
      Permission.SEGMENTATION_VIEW,
      Permission.USER_VIEW_PROFILE,
    ],
  },
];

// ===========================
// Service Class
// ===========================

class UnifiedPermissionService {
  private config: PermissionConfig = DEFAULT_CONFIG;
  private rolePermissions: Map<Role, RolePermissions> = new Map();
  private permissionCache: Map<string, boolean> = new Map();

  constructor() {
    this.initializeRolePermissions();
  }

  /**
   * Configure the permission service
   */
  public configure(config: Partial<PermissionConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('Permission service configured', config);
  }

  /**
   * Check if user has a specific permission
   */
  public async hasPermission(check: PermissionCheck, user?: User | null): Promise<boolean> {
    try {
      // Get current user if not provided
      const currentUser = user || authService.getCurrentUser();
      if (!currentUser) {
        return false;
      }

      // Create cache key
      const cacheKey = this.createCacheKey(currentUser.id, check);

      // Check cache first
      if (this.config.cacheEnabled) {
        const cached = await this.getFromCache(cacheKey);
        if (cached !== null) {
          if (this.config.logPermissionChecks) {
            logger.debug('Permission check (cached)', { check, result: cached });
          }
          return cached;
        }
      }

      // Check resource-specific permissions first
      if (check.resource && check.resourceId) {
        const resourcePermission = await this.checkResourcePermission(currentUser, check);

        if (resourcePermission !== null) {
          await this.saveToCache(cacheKey, resourcePermission);
          if (this.config.logPermissionChecks) {
            logger.debug('Permission check (resource)', { check, result: resourcePermission });
          }
          return resourcePermission;
        }
      }

      // Check role-based permissions
      const rolePermission = this.checkRolePermission(currentUser.role as Role, check.permission);

      await this.saveToCache(cacheKey, rolePermission);

      if (this.config.logPermissionChecks) {
        logger.debug('Permission check (role)', { check, result: rolePermission });
      }

      return rolePermission;
    } catch (error) {
      logger.error('Permission check failed', error);
      return this.config.strictMode ? false : true;
    }
  }

  /**
   * Check multiple permissions at once
   */
  public async hasPermissions(checks: PermissionCheck[], user?: User | null): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const check of checks) {
      const key = `${check.permission}:${check.resource || ''}:${check.resourceId || ''}`;
      results[key] = await this.hasPermission(check, user);
    }

    return results;
  }

  /**
   * Check if user has any of the specified permissions
   */
  public async hasAnyPermission(permissions: Permission[], user?: User | null): Promise<boolean> {
    for (const permission of permissions) {
      if (await this.hasPermission({ permission }, user)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all of the specified permissions
   */
  public async hasAllPermissions(permissions: Permission[], user?: User | null): Promise<boolean> {
    for (const permission of permissions) {
      if (!(await this.hasPermission({ permission }, user))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get all permissions for a user
   */
  public async getUserPermissions(userId?: string): Promise<UserPermissions> {
    const user = userId ? await this.fetchUser(userId) : authService.getCurrentUser();

    if (!user) {
      throw new AppError('User not found', ErrorType.NOT_FOUND);
    }

    // Get role permissions
    const rolePerms = this.rolePermissions.get(user.role as Role);
    const permissions = rolePerms?.permissions || [];

    // Get resource-specific permissions
    const resourcePermissions = await this.fetchResourcePermissions(user.id);

    return {
      userId: user.id,
      role: user.role as Role,
      permissions,
      resourcePermissions,
    };
  }

  /**
   * Check if user is owner of a resource
   */
  public async isResourceOwner(resource: string, resourceId: string, userId?: string): Promise<boolean> {
    try {
      const currentUserId = userId || authService.getCurrentUser()?.id;
      if (!currentUserId) return false;

      // Check cache
      const cacheKey = `owner:${resource}:${resourceId}:${currentUserId}`;
      const cached = await cacheService.get<boolean>(cacheKey, {
        layer: [CacheLayer.MEMORY],
      });

      if (cached !== null) return cached;

      // Fetch ownership info from backend
      const isOwner = await this.fetchResourceOwnership(resource, resourceId, currentUserId);

      // Cache result
      await cacheService.set(cacheKey, isOwner, {
        ttl: this.config.cacheTTL,
        layer: [CacheLayer.MEMORY],
        tags: ['permissions', `resource-${resource}-${resourceId}`],
      });

      return isOwner;
    } catch (error) {
      logger.error('Ownership check failed', error);
      return false;
    }
  }

  /**
   * Get resource-specific permissions
   */
  public async getResourcePermissions(resource: string, resourceId: string, userId?: string): Promise<Permission[]> {
    const user = userId ? await this.fetchUser(userId) : authService.getCurrentUser();

    if (!user) return [];

    // Admin has all permissions
    if (user.role === Role.ADMIN) {
      return Object.values(Permission);
    }

    // Check if owner
    const isOwner = await this.isResourceOwner(resource, resourceId, user.id);

    // Get permissions based on ownership and role
    const permissions: Permission[] = [];

    if (resource === 'project') {
      if (isOwner) {
        permissions.push(
          Permission.PROJECT_VIEW_OWN,
          Permission.PROJECT_EDIT_OWN,
          Permission.PROJECT_DELETE_OWN,
          Permission.PROJECT_SHARE,
          Permission.PROJECT_EXPORT,
        );
      } else {
        // Check if shared with user
        const sharedPermissions = await this.fetchSharedPermissions(resource, resourceId, user.id);
        permissions.push(...sharedPermissions);
      }
    }

    return permissions;
  }

  /**
   * Grant permission to a user for a resource
   */
  public async grantPermission(
    userId: string,
    permission: Permission,
    resource?: string,
    resourceId?: string,
  ): Promise<void> {
    // This would typically call a backend API
    logger.info('Granting permission', { userId, permission, resource, resourceId });

    // Clear cache
    await this.clearUserCache(userId);
  }

  /**
   * Revoke permission from a user
   */
  public async revokePermission(
    userId: string,
    permission: Permission,
    resource?: string,
    resourceId?: string,
  ): Promise<void> {
    // This would typically call a backend API
    logger.info('Revoking permission', { userId, permission, resource, resourceId });

    // Clear cache
    await this.clearUserCache(userId);
  }

  /**
   * Clear permission cache
   */
  public async clearCache(): Promise<void> {
    this.permissionCache.clear();
    await cacheService.deleteByTag('permissions');
    logger.info('Permission cache cleared');
  }

  /**
   * Clear cache for specific user
   */
  public async clearUserCache(userId: string): Promise<void> {
    // Clear memory cache
    for (const key of this.permissionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.permissionCache.delete(key);
      }
    }

    // Clear persistent cache
    await cacheService.deleteByTag(`user-permissions-${userId}`);
  }

  // ===========================
  // Private Helper Methods
  // ===========================

  private initializeRolePermissions(): void {
    DEFAULT_ROLE_PERMISSIONS.forEach((rp) => {
      this.rolePermissions.set(rp.role, rp);
    });
  }

  private checkRolePermission(role: Role, permission: Permission): boolean {
    const rolePerms = this.rolePermissions.get(role);
    if (!rolePerms) return false;

    // Check direct permissions
    if (rolePerms.permissions.includes(permission)) {
      return true;
    }

    // Check inherited permissions
    if (rolePerms.inherits) {
      for (const inheritedRole of rolePerms.inherits) {
        if (this.checkRolePermission(inheritedRole, permission)) {
          return true;
        }
      }
    }

    return false;
  }

  private async checkResourcePermission(user: User, check: PermissionCheck): Promise<boolean | null> {
    // Special handling for resource-specific permissions
    if (check.resource === 'project') {
      // Check if user is owner
      const isOwner = await this.isResourceOwner(check.resource, check.resourceId!, user.id);

      // Map permission to ownership-based permission
      if (isOwner) {
        switch (check.permission) {
          case Permission.PROJECT_VIEW_ALL:
          case Permission.PROJECT_VIEW_OWN:
            return true;
          case Permission.PROJECT_EDIT_ALL:
          case Permission.PROJECT_EDIT_OWN:
            return true;
          case Permission.PROJECT_DELETE_ALL:
          case Permission.PROJECT_DELETE_OWN:
            return true;
          default:
            return null; // Fall back to role check
        }
      } else {
        // Check shared permissions
        const sharedPerms = await this.fetchSharedPermissions(check.resource, check.resourceId!, user.id);

        return sharedPerms.includes(check.permission);
      }
    }

    return null; // No resource-specific handling
  }

  private createCacheKey(userId: string, check: PermissionCheck): string {
    return `${userId}:${check.permission}:${check.resource || ''}:${check.resourceId || ''}`;
  }

  private async getFromCache(key: string): Promise<boolean | null> {
    // Check memory cache first
    if (this.permissionCache.has(key)) {
      return this.permissionCache.get(key)!;
    }

    // Check persistent cache
    const cached = await cacheService.get<boolean>(`permission:${key}`, {
      layer: [CacheLayer.MEMORY],
    });

    return cached;
  }

  private async saveToCache(key: string, value: boolean): Promise<void> {
    // Save to memory cache
    this.permissionCache.set(key, value);

    // Save to persistent cache if enabled
    if (this.config.cacheEnabled) {
      const [userId] = key.split(':');

      await cacheService.set(`permission:${key}`, value, {
        ttl: this.config.cacheTTL,
        layer: [CacheLayer.MEMORY],
        tags: ['permissions', `user-permissions-${userId}`],
      });
    }
  }

  // ===========================
  // Backend API Integration
  // ===========================

  private async fetchUser(userId: string): Promise<User | null> {
    // This would typically fetch from backend
    // For now, return current user if ID matches
    const currentUser = authService.getCurrentUser();
    return currentUser?.id === userId ? currentUser : null;
  }

  private async fetchResourcePermissions(userId: string): Promise<ResourcePermission[]> {
    // This would typically fetch from backend
    // For now, return empty array
    return [];
  }

  private async fetchResourceOwnership(resource: string, resourceId: string, userId: string): Promise<boolean> {
    // This would typically check with backend
    // For now, return false
    return false;
  }

  private async fetchSharedPermissions(resource: string, resourceId: string, userId: string): Promise<Permission[]> {
    // This would typically fetch from backend
    // For now, return basic shared permissions
    return [Permission.PROJECT_VIEW_SHARED, Permission.IMAGE_VIEW, Permission.SEGMENTATION_VIEW];
  }
}

// ===========================
// Singleton Instance
// ===========================

const permissionService = new UnifiedPermissionService();

// ===========================
// Export
// ===========================

export default permissionService;

// Named exports for convenience
export const {
  hasPermission,
  hasPermissions,
  hasAnyPermission,
  hasAllPermissions,
  getUserPermissions,
  isResourceOwner,
  getResourcePermissions,
  grantPermission,
  revokePermission,
  clearCache,
} = permissionService;
