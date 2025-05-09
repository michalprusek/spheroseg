export * from './performanceMonitoring';
export * from './usePerformanceMonitoring';

// Initialize performance monitoring
import { createPerformanceMonitoring } from './performanceMonitoring';

// Create and export the default instance
export const performanceMonitoring = createPerformanceMonitoring({
  enabled: import.meta.env.PROD || import.meta.env.VITE_ENABLE_MONITORING === 'true',
  endpoint: `${import.meta.env.VITE_API_BASE_URL || ''}/metrics`,
  consoleLogging: import.meta.env.DEV && import.meta.env.VITE_ENABLE_MONITORING === 'true',
});
