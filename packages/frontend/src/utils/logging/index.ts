/**
 * Logging Module
 * 
 * Re-exports the unified logger for convenient imports
 */

export * from './unifiedLogger';
export { default } from './unifiedLogger';

// Convenience exports
export { 
  createLogger,
  createNamespacedLogger,
  getLogger,
  setGlobalLogLevel,
  setConsoleEnabled,
  setServerShippingEnabled,
  overrideConsole,
  restoreConsole,
  LogLevel,
  LogLevel as LEVELS
} from './unifiedLogger';