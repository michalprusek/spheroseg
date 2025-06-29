/**
 * Legacy Logger
 * 
 * DEPRECATED: This file is maintained for backward compatibility.
 * Please use '@/utils/logging' for new code.
 */

// Re-export everything from unified logger
export * from './logging/unifiedLogger';
export { default } from './logging/unifiedLogger';

// Maintain backward compatibility with specific exports
export { 
  createLogger,
  createNamespacedLogger,
  getLogger,
  LogLevel as LEVELS
} from './logging/unifiedLogger';