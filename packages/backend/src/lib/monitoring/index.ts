export * from './performanceMonitoring';

// Initialize performance monitoring
import { createPerformanceMonitoring } from './performanceMonitoring';

// Create and export the default instance
export const performanceMonitoring = createPerformanceMonitoring({
  enabled: process.env.NODE_ENV === 'production' || process.env.ENABLE_MONITORING === 'true',
  consoleLogging: process.env.NODE_ENV === 'development' && process.env.ENABLE_MONITORING === 'true',
});
