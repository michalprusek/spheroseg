/**
 * Server Monitoring Patch
 * 
 * This file contains a patch that integrates database monitoring
 * into the main server application. It should be imported in server.ts.
 */

import { Express } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { setupDatabaseMonitoring } from './db/monitoring/setupMonitoring';
import dbMetricsRoutes from './routes/dbMetrics';
import logger from './utils/logger';

/**
 * Set up all database monitoring components
 */
export function setupDatabaseMonitoringComponents(app: Express, io: SocketIOServer): void {
  try {
    // Initialize database monitoring
    setupDatabaseMonitoring(app);
    
    // Add database metrics routes
    app.use('/api/db-metrics', dbMetricsRoutes);
    
    logger.info('Database monitoring components successfully set up');
  } catch (error) {
    logger.error('Failed to set up database monitoring components', {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export default { setupDatabaseMonitoringComponents };