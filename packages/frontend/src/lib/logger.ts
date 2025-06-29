// Re-export logger from utils
export * from '@/utils/logger';

// For backward compatibility, re-export createNamespacedLogger as createLogger
export { createNamespacedLogger as createLogger } from '@/utils/logger';

// Re-export default logger
export { default } from '@/utils/logger';