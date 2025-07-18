/**
 * Permission Error Handler
 * 
 * Specialized handling for permission-related errors in shared projects.
 * This module provides intelligent detection and handling of permission errors
 * to show appropriate toast notifications instead of generic error messages.
 */

import { AxiosError } from 'axios';
import { toast } from 'sonner';
import logger from '@/utils/logger';
import { ErrorType, ErrorSeverity } from './unifiedErrorHandler';
import { requestDeduplicator } from '@/utils/requestDeduplication';

export interface PermissionErrorInfo {
  isPermissionError: boolean;
  message: string;
  operation?: string;
  resource?: string;
}

// Track recent permission errors to prevent duplicates
const recentPermissionErrors = new Map<string, number>();
const PERMISSION_ERROR_COOLDOWN = 3000; // 3 seconds cooldown

// Track active toasts to prevent duplicates
const activeToasts = new Set<string>();

/**
 * Operations that require specific permissions
 */
export enum ProtectedOperation {
  VIEW_IMAGE = 'view_image',
  DELETE_IMAGE = 'delete_image',
  SAVE_SEGMENTATION = 'save_segmentation',
  RESEGMENT_IMAGE = 'resegment_image',
  EDIT_SEGMENTATION = 'edit_segmentation',
  EXPORT_DATA = 'export_data',
  UPLOAD_IMAGE = 'upload_image',
  CREATE_PROJECT = 'create_project',
  EDIT_PROJECT = 'edit_project',
  DELETE_PROJECT = 'delete_project',
  INVITE_USERS = 'invite_users',
  REMOVE_USERS = 'remove_users',
  CHANGE_PERMISSIONS = 'change_permissions',
}

/**
 * Map of API endpoints to operations
 */
const ENDPOINT_OPERATION_MAP: Record<string, ProtectedOperation> = {
  // Image operations
  '/images/view': ProtectedOperation.VIEW_IMAGE,
  '/images/': ProtectedOperation.DELETE_IMAGE,
  '/segmentation/resegment': ProtectedOperation.RESEGMENT_IMAGE,
  '/segmentation/save': ProtectedOperation.SAVE_SEGMENTATION,
  '/segmentation/edit': ProtectedOperation.EDIT_SEGMENTATION,
  
  // Project operations
  '/projects/create': ProtectedOperation.CREATE_PROJECT,
  '/projects/update': ProtectedOperation.EDIT_PROJECT,
  '/projects/edit': ProtectedOperation.EDIT_PROJECT,
  '/projects/delete': ProtectedOperation.DELETE_PROJECT,
  '/projects/export': ProtectedOperation.EXPORT_DATA,
  '/projects/images': ProtectedOperation.UPLOAD_IMAGE,
  '/projects/invite': ProtectedOperation.INVITE_USERS,
  '/projects/remove-user': ProtectedOperation.REMOVE_USERS,
  '/projects/permissions': ProtectedOperation.CHANGE_PERMISSIONS,
};

/**
 * Get localized permission message
 */
function getPermissionMessage(operation: ProtectedOperation): string {
  // Try to get the i18n instance if available
  const i18n = (window as any).i18n;
  
  if (i18n && i18n.t) {
    // Map operations to translation keys
    const translationKeyMap: Record<ProtectedOperation, string> = {
      [ProtectedOperation.VIEW_IMAGE]: 'errors.permissions.viewImage',
      [ProtectedOperation.DELETE_IMAGE]: 'errors.permissions.deleteImage',
      [ProtectedOperation.SAVE_SEGMENTATION]: 'errors.permissions.saveSegmentation',
      [ProtectedOperation.RESEGMENT_IMAGE]: 'errors.permissions.resegmentImage',
      [ProtectedOperation.EDIT_SEGMENTATION]: 'errors.permissions.editSegmentation',
      [ProtectedOperation.EXPORT_DATA]: 'errors.permissions.exportData',
      [ProtectedOperation.UPLOAD_IMAGE]: 'errors.permissions.uploadImage',
      [ProtectedOperation.CREATE_PROJECT]: 'errors.permissions.createProject',
      [ProtectedOperation.EDIT_PROJECT]: 'errors.permissions.editProject',
      [ProtectedOperation.DELETE_PROJECT]: 'errors.permissions.deleteProject',
      [ProtectedOperation.INVITE_USERS]: 'errors.permissions.inviteUsers',
      [ProtectedOperation.REMOVE_USERS]: 'errors.permissions.removeUsers',
      [ProtectedOperation.CHANGE_PERMISSIONS]: 'errors.permissions.changePermissions',
    };
    
    const key = translationKeyMap[operation];
    if (key) {
      const translated = i18n.t(key);
      // Only use translated message if it's not the key itself
      if (translated && translated !== key) {
        return translated;
      }
    }
  }
  
  // Fallback to hardcoded messages if i18n is not available
  return getFallbackMessage(operation);
}

/**
 * Fallback messages when i18n is not available
 */
function getFallbackMessage(operation: ProtectedOperation): string {
  const fallbackMessages: Record<ProtectedOperation, string> = {
    [ProtectedOperation.VIEW_IMAGE]: "You need at least 'viewer' permission to view this image",
    [ProtectedOperation.DELETE_IMAGE]: "You need 'edit' or 'owner' permission to delete images",
    [ProtectedOperation.SAVE_SEGMENTATION]: "You need 'edit' or 'owner' permission to save segmentation results",
    [ProtectedOperation.RESEGMENT_IMAGE]: "You need 'edit' or 'owner' permission to resegment images",
    [ProtectedOperation.EDIT_SEGMENTATION]: "You need 'edit' or 'owner' permission to edit segmentation",
    [ProtectedOperation.EXPORT_DATA]: "You need at least 'viewer' permission to export data",
    [ProtectedOperation.UPLOAD_IMAGE]: "You need 'edit' or 'owner' permission to upload images",
    [ProtectedOperation.CREATE_PROJECT]: "You need to be logged in to create projects",
    [ProtectedOperation.EDIT_PROJECT]: "You need 'owner' permission to edit project settings",
    [ProtectedOperation.DELETE_PROJECT]: "You need 'owner' permission to delete projects",
    [ProtectedOperation.INVITE_USERS]: "You need 'owner' permission to invite users to the project",
    [ProtectedOperation.REMOVE_USERS]: "You need 'owner' permission to remove users from the project",
    [ProtectedOperation.CHANGE_PERMISSIONS]: "You need 'owner' permission to change user permissions",
  };
  
  return fallbackMessages[operation] || "You don't have permission to perform this action";
}

/**
 * Check if this is a polling request that should not show permission errors
 */
function isPollingRequest(url: string): boolean {
  const pollingPatterns = [
    '/segmentation-results/',
    '/segmentation/status',
    '/segmentation$', // Matches /api/images/{id}/segmentation exactly
    '/queue-status/',
    '/processing-status/',
  ];
  
  return pollingPatterns.some(pattern => {
    if (pattern.endsWith('$')) {
      // Exact match pattern
      return url.endsWith(pattern.slice(0, -1));
    }
    return url.includes(pattern);
  });
}

/**
 * Detect if an error is a permission-related error
 */
export function detectPermissionError(error: unknown): PermissionErrorInfo {
  // Default response
  const defaultInfo: PermissionErrorInfo = {
    isPermissionError: false,
    message: '',
  };

  if (!error) return defaultInfo;

  // Check if it's an Axios error
  if (error instanceof Error && 'isAxiosError' in error) {
    const axiosError = error as AxiosError<any>;
    const status = axiosError.response?.status;
    const url = axiosError.config?.url || '';
    const method = axiosError.config?.method?.toUpperCase() || '';
    const responseMessage = axiosError.response?.data?.message || '';
    
    // Skip permission detection for polling requests
    if (isPollingRequest(url)) {
      logger.debug('Skipping permission detection for polling request', { url });
      return defaultInfo;
    }

    logger.debug('Checking for permission error', {
      status,
      url,
      method,
      responseMessage,
    });

    // Direct permission errors (403)
    if (status === 403) {
      const operation = detectOperation(url, method);
      return {
        isPermissionError: true,
        message: operation ? getPermissionMessage(operation) : "You don't have permission to perform this action",
        operation,
        resource: extractResource(url),
      };
    }

    // Server errors that might be permission-related
    if (status === 500) {
      // Check if the error message indicates a permission issue
      const lowerMessage = responseMessage.toLowerCase();
      if (
        lowerMessage.includes('permission') ||
        lowerMessage.includes('access denied') ||
        lowerMessage.includes('forbidden') ||
        lowerMessage.includes('unauthorized')
      ) {
        const operation = detectOperation(url, method);
        return {
          isPermissionError: true,
          message: operation ? getPermissionMessage(operation) : responseMessage,
          operation,
          resource: extractResource(url),
        };
      }

      // Special case: 500 errors on DELETE operations in shared projects often indicate permission issues
      if (method === 'DELETE' && url.includes('/projects/') && url.includes('/images/')) {
        return {
          isPermissionError: true,
          message: getPermissionMessage(ProtectedOperation.DELETE_IMAGE),
          operation: ProtectedOperation.DELETE_IMAGE,
          resource: 'image',
        };
      }
    }

    // 404 errors that are actually permission errors
    if (status === 404) {
      const lowerMessage = responseMessage.toLowerCase();
      if (
        lowerMessage.includes('access denied') ||
        lowerMessage.includes('permission') ||
        lowerMessage.includes('not authorized')
      ) {
        const operation = detectOperation(url, method);
        return {
          isPermissionError: true,
          message: responseMessage || (operation ? getPermissionMessage(operation) : "Resource not accessible"),
          operation,
          resource: extractResource(url),
        };
      }

      // Special handling for segmentation endpoints that return 404 when access is denied
      if (url.includes('/segmentation') && !url.includes('/segmentation-queue')) {
        const operation = url.includes('resegment') 
          ? ProtectedOperation.RESEGMENT_IMAGE 
          : ProtectedOperation.SAVE_SEGMENTATION;
        return {
          isPermissionError: true,
          message: getPermissionMessage(operation),
          operation,
          resource: 'segmentation',
        };
      }
    }
  }

  return defaultInfo;
}

/**
 * Detect the operation being performed based on URL and method
 */
function detectOperation(url: string, method: string): ProtectedOperation | undefined {
  const lowerUrl = url.toLowerCase();
  
  // Direct endpoint matches
  for (const [endpoint, operation] of Object.entries(ENDPOINT_OPERATION_MAP)) {
    if (lowerUrl.includes(endpoint)) {
      return operation;
    }
  }

  // Pattern-based detection
  if (method === 'DELETE') {
    if (lowerUrl.includes('/images/')) return ProtectedOperation.DELETE_IMAGE;
    if (lowerUrl.includes('/projects/')) return ProtectedOperation.DELETE_PROJECT;
  }

  if (method === 'POST') {
    if (lowerUrl.includes('/resegment')) return ProtectedOperation.RESEGMENT_IMAGE;
    if (lowerUrl.includes('/segmentation') && lowerUrl.includes('/save')) return ProtectedOperation.SAVE_SEGMENTATION;
    if (lowerUrl.includes('/upload')) return ProtectedOperation.UPLOAD_IMAGE;
  }

  if (method === 'PUT' || method === 'PATCH') {
    if (lowerUrl.includes('/projects/')) return ProtectedOperation.EDIT_PROJECT;
    if (lowerUrl.includes('/segmentation')) return ProtectedOperation.SAVE_SEGMENTATION;
  }
  
  if (method === 'GET') {
    if (lowerUrl.includes('/images/') && lowerUrl.includes('/view')) return ProtectedOperation.VIEW_IMAGE;
  }

  return undefined;
}

/**
 * Extract resource type from URL
 */
function extractResource(url: string): string {
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('/images/')) return 'image';
  if (lowerUrl.includes('/segmentation')) return 'segmentation';
  if (lowerUrl.includes('/projects/')) return 'project';
  if (lowerUrl.includes('/export')) return 'export';
  
  return 'resource';
}

/**
 * Handle permission error with appropriate toast notification
 */
export function handlePermissionError(error: unknown): boolean {
  const permissionInfo = detectPermissionError(error);
  
  if (permissionInfo.isPermissionError) {
    const operation = permissionInfo.operation || 'generic';
    const toastId = `permission-${operation}`;
    const now = Date.now();
    
    // Check if we recently showed this permission error
    const lastShown = recentPermissionErrors.get(toastId);
    if (lastShown && (now - lastShown) < PERMISSION_ERROR_COOLDOWN) {
      logger.debug('Suppressing duplicate permission error within cooldown', {
        operation,
        timeSinceLastShown: now - lastShown,
      });
      return true; // Still handled, just not shown again
    }
    
    // Check if toast is already active
    if (activeToasts.has(toastId)) {
      logger.debug('Permission toast already active', { toastId });
      return true; // Already showing this toast
    }
    
    logger.info('Permission error detected', {
      message: permissionInfo.message,
      operation: permissionInfo.operation,
      resource: permissionInfo.resource,
    });

    // Track this error
    recentPermissionErrors.set(toastId, now);
    activeToasts.add(toastId);
    
    // Clean up old entries
    setTimeout(() => {
      recentPermissionErrors.delete(toastId);
    }, PERMISSION_ERROR_COOLDOWN);

    // Show permission-specific toast with dismiss callback
    toast.warning(permissionInfo.message, {
      duration: 5000,
      id: toastId,
      onDismiss: () => {
        activeToasts.delete(toastId);
      },
      onAutoClose: () => {
        activeToasts.delete(toastId);
      },
    });

    return true; // Handled
  }

  return false; // Not a permission error
}

/**
 * Check if user has permission for an operation (client-side check)
 * This is a helper for UI elements to show/hide based on permissions
 */
export function hasPermission(userRole: string, operation: ProtectedOperation): boolean {
  // Owner has all permissions
  if (userRole === 'owner') return true;

  // Edit permissions
  if (userRole === 'edit') {
    const editAllowed = [
      ProtectedOperation.VIEW_IMAGE,
      ProtectedOperation.DELETE_IMAGE,
      ProtectedOperation.SAVE_SEGMENTATION,
      ProtectedOperation.RESEGMENT_IMAGE,
      ProtectedOperation.EDIT_SEGMENTATION,
      ProtectedOperation.UPLOAD_IMAGE,
      ProtectedOperation.EXPORT_DATA,
    ];
    return editAllowed.includes(operation);
  }

  // Viewer permissions (read-only)
  if (userRole === 'viewer') {
    const viewerAllowed = [
      ProtectedOperation.VIEW_IMAGE,
      ProtectedOperation.EXPORT_DATA,
    ];
    return viewerAllowed.includes(operation);
  }

  return false;
}

/**
 * Get user-friendly operation name
 */
export function getOperationName(operation: ProtectedOperation): string {
  const names: Record<ProtectedOperation, string> = {
    [ProtectedOperation.VIEW_IMAGE]: 'View Image',
    [ProtectedOperation.DELETE_IMAGE]: 'Delete Image',
    [ProtectedOperation.SAVE_SEGMENTATION]: 'Save Segmentation',
    [ProtectedOperation.RESEGMENT_IMAGE]: 'Resegment Image',
    [ProtectedOperation.EDIT_SEGMENTATION]: 'Edit Segmentation',
    [ProtectedOperation.EXPORT_DATA]: 'Export Data',
    [ProtectedOperation.UPLOAD_IMAGE]: 'Upload Image',
    [ProtectedOperation.CREATE_PROJECT]: 'Create Project',
    [ProtectedOperation.EDIT_PROJECT]: 'Edit Project',
    [ProtectedOperation.DELETE_PROJECT]: 'Delete Project',
    [ProtectedOperation.INVITE_USERS]: 'Invite Users',
    [ProtectedOperation.REMOVE_USERS]: 'Remove Users',
    [ProtectedOperation.CHANGE_PERMISSIONS]: 'Change Permissions',
  };
  
  return names[operation] || 'Perform Action';
}