/**
 * Legacy Error Utilities
 *
 * DEPRECATED: This file is maintained for backward compatibility.
 * Please use '@/utils/error' for new code.
 */

// Re-export from unified error handler
export {
  tryCatch,
  getErrorMessage as formatError,
  getErrorMessage as getAxiosErrorMessage,
} from './error/unifiedErrorHandler';
