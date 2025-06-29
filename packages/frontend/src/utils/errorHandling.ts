/**
 * Legacy Error Handling
 * 
 * DEPRECATED: This file is maintained for backward compatibility.
 * Please use '@/utils/error' for new code.
 */

// Re-export everything from unified error handler
export * from './error/unifiedErrorHandler';

// Import for legacy compatibility
import { handleError as unifiedHandleError } from './error/unifiedErrorHandler';
import { toast } from 'sonner';

// Legacy function names
export const handleError = unifiedHandleError;
export const showError = (message: string) => toast.error(message);