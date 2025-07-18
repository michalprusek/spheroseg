/**
 * Legacy Database Module - Optimized
 *
 * DEPRECATED: This module is being phased out in favor of the unified database module.
 * Please use 'db/unified' for new code.
 *
 * This file now re-exports from the unified module for backward compatibility.
 */

import logger from '../utils/logger';

// Re-export everything from unified
export * from './unified';
export { default } from './unified';

// Legacy named export for queryCache (for compatibility)
export const queryCache = {
  keys: () => [],
  get: () => undefined,
  set: () => {},
  del: () => {},
};

// Log deprecation warning
logger.warn('Using deprecated db/optimized module. Please migrate to db/unified.');
