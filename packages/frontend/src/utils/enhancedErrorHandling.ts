/**
 * Legacy Enhanced Error Handling
 * 
 * DEPRECATED: This file is maintained for backward compatibility.
 * Please use '@/utils/error' for new code.
 */

// Re-export from unified error handler
export * from './error/unifiedErrorHandler';
export { safeAsync, handleError as handleApiError } from './error/unifiedErrorHandler';

// Legacy NetworkErrorType enum for compatibility
export enum NetworkErrorType {
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  TIMEOUT = 'TIMEOUT',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CLIENT_ERROR = 'CLIENT_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// Re-export showEnhancedError as alias
import { handleError } from './error/unifiedErrorHandler';
export const showEnhancedError = (error: unknown) => handleError(error);