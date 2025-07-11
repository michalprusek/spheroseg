/**
 * Shared utilities index
 * Re-exports all polygon utilities from the consolidated polygonUtils module
 */

// Import and re-export everything from the consolidated polygon utilities
export * from './polygonUtils';

// Default export for convenience
export { default as polygonUtils } from './polygonUtils';

// Export path utilities
export * from './pathUtils';
