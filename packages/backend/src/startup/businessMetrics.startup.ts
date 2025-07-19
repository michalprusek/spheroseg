/**
 * Business Metrics Startup Module
 * 
 * Initializes business metrics collection and alerting on application startup
 */

import logger from '../utils/logger';
import { initializeBusinessMetrics } from '../utils/businessMetrics';
import { 
  AlertHandlerFactory, 
  ThrottledAlertHandler, 
  CompositeAlertHandler,
  createDefaultAlertConfig 
} from '../utils/alertHandlers';
import { getRedis } from '../config/redis';

export async function initializeBusinessMetricsSystem(): Promise<void> {
  try {
    logger.info('Initializing business metrics system...');
    
    // Get Redis client
    const redis = getRedis();
    
    if (!redis) {
      logger.warn('Redis not available, business metrics system will not be initialized');
      return;
    }
    
    // Initialize business metrics service
    const metricsService = initializeBusinessMetrics(redis);
    
    // Create alert configuration from environment
    const alertConfig = createDefaultAlertConfig();
    
    // Create alert handlers
    const handlers = AlertHandlerFactory.createHandlers(alertConfig);
    
    // Wrap handlers with throttling to prevent spam
    const throttledHandlers = handlers.map(handler => 
      new ThrottledAlertHandler(handler, 15).handle.bind(new ThrottledAlertHandler(handler, 15))
    );
    
    // Create composite handler
    const compositeHandler = new CompositeAlertHandler(throttledHandlers);
    
    // Register the composite handler
    metricsService.registerAlertHandler(alert => compositeHandler.handle(alert));
    
    // Log configured alert channels
    const enabledChannels = [];
    if (alertConfig.email?.enabled) enabledChannels.push('email');
    if (alertConfig.slack?.enabled) enabledChannels.push('slack');
    if (alertConfig.webhook?.enabled) enabledChannels.push('webhook');
    if (alertConfig.console?.enabled) enabledChannels.push('console');
    
    logger.info('Business metrics initialized', {
      alertChannels: enabledChannels,
      metricsCount: Array.from(metricsService['metrics'].keys()).length,
    });
    
    // Collect initial metrics after a short delay
    setTimeout(async () => {
      logger.info('Collecting initial business metrics...');
      for (const metricName of metricsService['metrics'].keys()) {
        try {
          await metricsService.collectMetric(metricName);
        } catch (error) {
          logger.error('Failed to collect initial metric', {
            metric: metricName,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }, 5000);
    
  } catch (error) {
    logger.error('Failed to initialize business metrics', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Don't throw - business metrics are not critical for app startup
  }
}

export default {
  initializeBusinessMetricsSystem,
};