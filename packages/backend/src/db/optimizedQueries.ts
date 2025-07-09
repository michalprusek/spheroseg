/**
 * Legacy Database Module - Optimized Queries
 *
 * DEPRECATED: This module is being phased out in favor of the unified database module.
 * Please use 'db/unified' for new code.
 *
 * This file now re-exports from the unified module for backward compatibility.
 */

import logger from '../utils/logger';

// Re-export from unified with legacy function names
export {
  cachedQuery as queryCached,
  withTransaction as executeTransaction,
  invalidateTableCache as invalidateCache,
  clearCacheByPattern,
} from './unified';

// Re-export everything else
export * from './unified';

// Log deprecation warning
logger.warn('Using deprecated db/optimizedQueries module. Please migrate to db/unified.');
