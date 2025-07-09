/**
 * Database Monitoring - Query Pattern Export
 *
 * Provides functionality to export query patterns and statistics
 * to various formats for external analysis and visualization.
 */

import fs from 'fs';
import path from 'path';
import dbMonitoring from './index';
import logger from '../../utils/logger';

/**
 * Export query patterns to JSON file
 */
export async function exportPatternsToJson(filePath: string): Promise<void> {
  try {
    // Get all slow queries without limiting
    const patterns = dbMonitoring.getTopSlowQueries(1000);

    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to file
    fs.writeFileSync(
      filePath,
      JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          patterns,
        },
        null,
        2
      )
    );

    logger.info('Query patterns exported to JSON', {
      filePath,
      patternCount: patterns.length,
    });
  } catch (error) {
    logger.error('Failed to export query patterns to JSON', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Generate Grafana dashboard JSON for query patterns
 */
export function generateGrafanaDashboard(): Record<string, unknown> {
  // Get statistics
  const topSlowQueries = dbMonitoring.getTopSlowQueries(10);
  const frequencyStats = dbMonitoring.getQueryFrequencyStats();

  // Create operation distribution panel
  const operationPanels = [];
  if (Object.keys(frequencyStats).length > 0) {
    operationPanels.push({
      id: 1,
      gridPos: {
        h: 8,
        w: 12,
        x: 0,
        y: 0,
      },
      type: 'piechart',
      title: 'Query Operations Distribution',
      targets: [
        {
          expr: 'db_query_pattern_total',
          legendFormat: '{{operation}}',
          refId: 'A',
        },
      ],
    });
  }

  // Create top slow queries panel
  const tablePanels = [];
  if (topSlowQueries.length > 0) {
    tablePanels.push({
      id: 2,
      gridPos: {
        h: 8,
        w: 24,
        x: 0,
        y: 8,
      },
      type: 'table',
      title: 'Top Slow Queries',
      targets: [
        {
          expr: 'topk(10, avg by (pattern_id, operation) (db_query_duration_seconds))',
          legendFormat: '{{pattern_id}}',
          refId: 'A',
        },
      ],
      transformations: [
        {
          id: 'organize',
          options: {
            renameByName: {
              Value: 'Avg Duration (s)',
              pattern_id: 'Pattern ID',
              operation: 'Operation',
            },
          },
        },
      ],
    });
  }

  // Create histogram panel
  const histogramPanels = [];
  histogramPanels.push({
    id: 3,
    gridPos: {
      h: 8,
      w: 12,
      x: 12,
      y: 0,
    },
    type: 'histogram',
    title: 'Query Duration Distribution',
    targets: [
      {
        expr: 'db_query_duration_seconds_bucket',
        legendFormat: '{{le}}',
        refId: 'A',
      },
    ],
  });

  // Create basic dashboard structure
  const dashboard = {
    annotations: {
      list: [],
    },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    id: null,
    links: [],
    liveNow: false,
    panels: [
      ...operationPanels,
      ...histogramPanels,
      ...tablePanels,
      {
        id: 4,
        gridPos: {
          h: 8,
          w: 24,
          x: 0,
          y: 16,
        },
        type: 'timeseries',
        title: 'Query Throughput Over Time',
        targets: [
          {
            expr: 'rate(db_query_throughput_total[5m])',
            legendFormat: '{{operation}}',
            refId: 'A',
          },
        ],
      },
      {
        id: 5,
        gridPos: {
          h: 8,
          w: 24,
          x: 0,
          y: 24,
        },
        type: 'timeseries',
        title: 'Slow Queries Over Time',
        targets: [
          {
            expr: 'rate(db_slow_query_total[5m])',
            legendFormat: '{{table}}',
            refId: 'A',
          },
        ],
      },
      {
        id: 6,
        gridPos: {
          h: 8,
          w: 24,
          x: 0,
          y: 32,
        },
        type: 'timeseries',
        title: 'Connection Pool Status',
        targets: [
          {
            expr: 'db_connection_pool',
            legendFormat: '{{state}}',
            refId: 'A',
          },
        ],
      },
    ],
    refresh: '5s',
    schemaVersion: 38,
    style: 'dark',
    tags: ['database', 'postgres', 'monitoring'],
    templating: {
      list: [],
    },
    time: {
      from: 'now-1h',
      to: 'now',
    },
    timepicker: {},
    timezone: '',
    title: 'Database Performance Dashboard',
    uid: 'db-perf-dash',
    version: 1,
    weekStart: '',
  };

  return dashboard;
}

/**
 * Export query patterns and dashboard to Grafana
 */
export async function exportToGrafana(
  outputDir: string = path.join(process.cwd(), 'monitoring/grafana/dashboards')
): Promise<void> {
  try {
    // Generate dashboard JSON
    const dashboard = generateGrafanaDashboard();

    // Create directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write dashboard to file
    const dashboardPath = path.join(outputDir, 'db_performance_dashboard.json');
    fs.writeFileSync(dashboardPath, JSON.stringify(dashboard, null, 2));

    // Export patterns to a separate file
    const patternsPath = path.join(outputDir, 'db_query_patterns.json');
    await exportPatternsToJson(patternsPath);

    logger.info('Database dashboard and patterns exported for Grafana', {
      dashboardPath,
      patternsPath,
    });
  } catch (error) {
    logger.error('Failed to export database dashboard for Grafana', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export default {
  exportPatternsToJson,
  generateGrafanaDashboard,
  exportToGrafana,
};
