/**
 * Database Metrics Routes
 *
 * API routes specifically for database monitoring and metrics
 */

import express from 'express';
import { authenticate as authMiddleware, requireAdmin } from '../security/middleware/auth';
import dbMonitoring from '../db/monitoring';
import exportPatterns from '../db/monitoring/exportPatterns';
import logger from '../utils/logger';

const router = express.Router();

/**
 * GET /api/db-metrics/top-slow
 * Returns the top slow query patterns
 * Requires admin privileges
 */
router.get('/top-slow', authMiddleware, requireAdmin, (req, res) => {
  try {
    // Get query parameter for limit (optional)
    const limit = req.query["limit"] ? parseInt(req.query["limit"] as string, 10) : 10;

    // Get top slow queries
    const slowQueries = dbMonitoring.getTopSlowQueries(limit);

    res.status(200).json({
      success: true,
      count: slowQueries.length,
      data: slowQueries,
    });
  } catch (error) {
    logger.error('Error retrieving top slow queries', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve top slow queries',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/db-metrics/by-table/:table
 * Returns query patterns for a specific table
 * Requires admin privileges
 */
router.get('/by-table/:table', authMiddleware, requireAdmin, (req, res) => {
  try {
    const { table } = req.params;

    // Get queries for the specified table
    const tableQueries = dbMonitoring.getQueryPatternsByTable(table);

    res.status(200).json({
      success: true,
      count: tableQueries.length,
      table,
      data: tableQueries,
    });
  } catch (error) {
    logger.error('Error retrieving table query patterns', {
      error,
      table: req.params["table"],
    });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve table query patterns',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/db-metrics/frequency
 * Returns query frequency statistics
 * Requires admin privileges
 */
router.get('/frequency', authMiddleware, requireAdmin, (req, res) => {
  try {
    // Get query frequency stats
    const frequencyStats = dbMonitoring.getQueryFrequencyStats();

    res.status(200).json({
      success: true,
      data: frequencyStats,
    });
  } catch (error) {
    logger.error('Error retrieving query frequency statistics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve query frequency statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/db-metrics/export
 * Exports query patterns to a JSON file
 * Requires admin privileges
 */
router.post('/export', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { path } = req.body;

    // Default path if not provided
    const exportPath = path || 'monitoring/data/query_patterns.json';

    // Export patterns
    await exportPatterns.exportPatternsToJson(exportPath);

    res.status(200).json({
      success: true,
      message: 'Query patterns exported successfully',
      path: exportPath,
    });
  } catch (error) {
    logger.error('Error exporting query patterns', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to export query patterns',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/db-metrics/export-dashboard
 * Exports Grafana dashboard for query metrics
 * Requires admin privileges
 */
router.post('/export-dashboard', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { outputDir } = req.body;

    // Export to Grafana
    await exportPatterns.exportToGrafana(outputDir);

    res.status(200).json({
      success: true,
      message: 'Grafana dashboard exported successfully',
    });
  } catch (error) {
    logger.error('Error exporting Grafana dashboard', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to export Grafana dashboard',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/db-metrics/reset
 * Resets query pattern statistics
 * Requires admin privileges
 */
router.post('/reset', authMiddleware, requireAdmin, (req, res) => {
  try {
    // Reset pattern statistics
    dbMonitoring.resetPatternStats();

    res.status(200).json({
      success: true,
      message: 'Query pattern statistics reset successfully',
    });
  } catch (error) {
    logger.error('Error resetting query pattern statistics', { error });
    res.status(500).json({
      success: false,
      message: 'Failed to reset query pattern statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
