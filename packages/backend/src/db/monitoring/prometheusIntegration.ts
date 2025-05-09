/**
 * Database Monitoring - Prometheus Integration
 * 
 * Integrates the database monitoring module with the application's
 * Prometheus metrics registry for unified metrics collection.
 */

import { register as appRegistry } from '../../services/prometheusMetricsService';
import { Summary, Counter, Gauge } from 'prom-client';
import dbMonitoring from './index';
import logger from '../../utils/logger';
import { MetricType } from '../../../shared/monitoring/metricsTypes';

/**
 * Register database metrics with the application's Prometheus registry
 */
export function integrateWithAppMetrics(): void {
  try {
    // Get all metrics from the database registry
    const dbRegistry = dbMonitoring.registry;
    const dbMetrics = dbRegistry.getMetricsAsArray();
    
    // Register each database metric with the application registry
    for (const metric of dbMetrics) {
      appRegistry.registerMetric(metric);
    }
    
    // Create additional combined metrics from DatabaseQueryMetric
    const dbQuerySummary = new Summary({
      name: 'spheroseg_database_query_time',
      help: 'Database query execution time in milliseconds',
      labelNames: ['operation', 'table', 'status'],
      percentiles: [0.5, 0.75, 0.9, 0.95, 0.99],
      registers: [appRegistry]
    });
    
    const dbQueryCounter = new Counter({
      name: 'spheroseg_database_query_count',
      help: 'Number of database queries executed',
      labelNames: ['operation', 'table', 'status'],
      registers: [appRegistry]
    });
    
    const dbConnectionGauge = new Gauge({
      name: 'spheroseg_database_connections',
      help: 'Database connections metrics',
      labelNames: ['state'],
      registers: [appRegistry]
    });
    
    // Setup metric event listener if the monitoring module supports it
    if (typeof dbMonitoring.on === 'function') {
      // Listen for database query metrics
      dbMonitoring.on(MetricType.DATABASE_QUERY, (metric) => {
        dbQuerySummary.observe(
          { 
            operation: metric.operation,
            table: metric.table,
            status: metric.error ? 'error' : 'success'
          }, 
          metric.duration
        );
        
        dbQueryCounter.inc(
          { 
            operation: metric.operation,
            table: metric.table,
            status: metric.error ? 'error' : 'success'
          }, 
          1
        );
      });
    }
    
    logger.info('Database metrics integrated with application Prometheus registry', {
      metrics_count: dbMetrics.length
    });
  } catch (error) {
    logger.error('Failed to integrate database metrics with Prometheus registry', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Initialize database metrics collection
 */
export function initDbMetricsCollection(): void {
  // Initialize the database monitoring
  dbMonitoring.init();
  
  // Integrate with application metrics
  integrateWithAppMetrics();
  
  logger.info('Database metrics collection initialized');
}

export default {
  integrateWithAppMetrics,
  initDbMetricsCollection
};