/**
 * localStorage Cleanup Utility
 * Fixes corrupted localStorage values and prevents future corruption
 */

import logger from '@/utils/logger';

interface CleanupResult {
  cleaned: string[];
  errors: string[];
  spaceFreed: number;
}

/**
 * Clean corrupted localStorage values
 * Specifically handles the exponentially escaped string issue
 */
export function cleanCorruptedLocalStorage(): CleanupResult {
  const result: CleanupResult = {
    cleaned: [],
    errors: [],
    spaceFreed: 0,
  };

  try {
    // Check all localStorage keys
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      try {
        const value = localStorage.getItem(key);
        if (!value) return;

        const originalSize = value.length;
        let shouldClean = false;
        let cleanedValue = value;

        // Check for corrupted theme/language values
        if (key === 'theme' || key === 'language') {
          // Valid values for these keys
          const validThemeValues = ['system', 'light', 'dark'];
          const validLanguageValues = ['en', 'cs', 'de', 'es', 'fr', 'zh'];
          const validValues = key === 'theme' ? validThemeValues : validLanguageValues;

          // Check if value is corrupted (excessive escaping)
          if (value.includes('\\') || value.includes('"')) {
            shouldClean = true;
            
            // Try to extract the actual value from corrupted string
            let actualValue = value;
            
            // Remove all escape characters and quotes
            actualValue = actualValue.replace(/\\/g, '').replace(/"/g, '');
            
            // If the cleaned value is valid, use it
            if (validValues.includes(actualValue)) {
              cleanedValue = JSON.stringify(actualValue);
              logger.info(`[LocalStorageCleanup] Cleaned ${key}: ${value.substring(0, 50)}... -> ${cleanedValue}`);
            } else {
              // Use default value
              cleanedValue = JSON.stringify(key === 'theme' ? 'system' : 'en');
              logger.warn(`[LocalStorageCleanup] Reset ${key} to default: ${cleanedValue}`);
            }
          } else {
            // Check if it's a valid JSON string
            try {
              const parsed = JSON.parse(value);
              if (typeof parsed === 'string' && validValues.includes(parsed)) {
                // Value is already properly formatted
                shouldClean = false;
              } else if (validValues.includes(value)) {
                // Value is plain string, convert to JSON
                cleanedValue = JSON.stringify(value);
                shouldClean = true;
                logger.info(`[LocalStorageCleanup] Normalized ${key}: ${value} -> ${cleanedValue}`);
              } else {
                // Invalid value, use default
                cleanedValue = JSON.stringify(key === 'theme' ? 'system' : 'en');
                shouldClean = true;
                logger.warn(`[LocalStorageCleanup] Invalid ${key} value: ${value}, using default`);
              }
            } catch {
              // Not valid JSON, check if it's a plain valid value
              if (validValues.includes(value)) {
                cleanedValue = JSON.stringify(value);
                shouldClean = true;
                logger.info(`[LocalStorageCleanup] Converted ${key} to JSON: ${value} -> ${cleanedValue}`);
              } else {
                // Use default
                cleanedValue = JSON.stringify(key === 'theme' ? 'system' : 'en');
                shouldClean = true;
                logger.warn(`[LocalStorageCleanup] Reset invalid ${key}: ${value} -> ${cleanedValue}`);
              }
            }
          }
        }

        // Check for extremely large values (>100KB per item)
        if (originalSize > 100 * 1024) {
          shouldClean = true;
          logger.warn(`[LocalStorageCleanup] Found large item ${key}: ${originalSize} bytes`);
          
          // For non-critical keys, remove them
          if (!['theme', 'language', 'auth_token', 'refresh_token'].includes(key)) {
            localStorage.removeItem(key);
            result.spaceFreed += originalSize;
            result.cleaned.push(`${key} (removed - too large)`);
            return;
          }
        }

        // Apply cleaning if needed
        if (shouldClean) {
          localStorage.setItem(key, cleanedValue);
          result.spaceFreed += originalSize - cleanedValue.length;
          result.cleaned.push(key);
        }
      } catch (error) {
        logger.error(`[LocalStorageCleanup] Error processing key ${key}:`, error);
        result.errors.push(`${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Clean up old/unnecessary items
    const cleanupPatterns = [
      { pattern: /^debug-/, maxAge: 1 * 60 * 60 * 1000 }, // 1 hour for debug data
      { pattern: /^temp-/, maxAge: 1 * 60 * 60 * 1000 }, // 1 hour for temp data
      { pattern: /^test-/, maxAge: 1 * 60 * 60 * 1000 }, // 1 hour for test data
      { pattern: /^cache-/, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours for cache
      { pattern: /^image-cache-/, maxAge: 24 * 60 * 60 * 1000 }, // 24 hours for image cache
      { pattern: /^analytics-/, maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days for analytics
      { pattern: /^performance-/, maxAge: 7 * 24 * 60 * 60 * 1000 }, // 7 days for performance
    ];

    const now = Date.now();
    keys.forEach(key => {
      cleanupPatterns.forEach(({ pattern, maxAge }) => {
        if (pattern.test(key)) {
          try {
            const value = localStorage.getItem(key);
            if (value) {
              try {
                const data = JSON.parse(value);
                if (data.timestamp && now - data.timestamp > maxAge) {
                  localStorage.removeItem(key);
                  result.spaceFreed += value.length;
                  result.cleaned.push(`${key} (expired)`);
                  logger.debug(`[LocalStorageCleanup] Removed expired ${key}`);
                }
              } catch {
                // If we can't parse it, it's probably corrupted - remove it
                localStorage.removeItem(key);
                result.spaceFreed += value.length;
                result.cleaned.push(`${key} (corrupted)`);
                logger.debug(`[LocalStorageCleanup] Removed corrupted ${key}`);
              }
            }
          } catch (error) {
            logger.error(`[LocalStorageCleanup] Error cleaning ${key}:`, error);
            result.errors.push(`${key}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        }
      });
    });

    logger.info(`[LocalStorageCleanup] Cleanup complete. Cleaned ${result.cleaned.length} items, freed ${result.spaceFreed} bytes`);
  } catch (error) {
    logger.error('[LocalStorageCleanup] Fatal error during cleanup:', error);
    result.errors.push(`Fatal: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return result;
}

/**
 * Get localStorage usage statistics
 */
export function getLocalStorageStats() {
  let totalSize = 0;
  const itemSizes: { key: string; size: number }[] = [];

  try {
    Object.keys(localStorage).forEach(key => {
      const value = localStorage.getItem(key) || '';
      const size = (key.length + value.length) * 2; // UTF-16 encoding
      totalSize += size;
      itemSizes.push({ key, size });
    });

    // Sort by size descending
    itemSizes.sort((a, b) => b.size - a.size);

    const maxSize = 5 * 1024 * 1024; // 5MB typical browser limit
    const usagePercent = (totalSize / maxSize) * 100;

    return {
      totalSize,
      maxSize,
      usagePercent,
      availableSpace: maxSize - totalSize,
      itemCount: itemSizes.length,
      largestItems: itemSizes.slice(0, 10),
    };
  } catch (error) {
    logger.error('[LocalStorageCleanup] Error getting stats:', error);
    return null;
  }
}

/**
 * Emergency clear - removes all non-essential localStorage items
 */
export function emergencyClearLocalStorage(): void {
  const essentialKeys = [
    'auth_token',
    'refresh_token',
    'theme',
    'language',
    'user_id',
  ];

  try {
    const keys = Object.keys(localStorage);
    let cleared = 0;

    keys.forEach(key => {
      if (!essentialKeys.includes(key)) {
        localStorage.removeItem(key);
        cleared++;
      }
    });

    logger.warn(`[LocalStorageCleanup] Emergency clear removed ${cleared} non-essential items`);
  } catch (error) {
    logger.error('[LocalStorageCleanup] Emergency clear failed:', error);
  }
}