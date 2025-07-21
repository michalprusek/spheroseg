/**
 * Database Monitoring Middleware
 *
 * Express middleware that exposes database metrics endpoints
 * for monitoring and diagnostics purposes.
 */

import { Request, Response, NextFunction } from 'express';
import dbMonitoring from '../db/monitoring';

/**
 * Generate an HTML dashboard for database metrics visualization
 */
function generateMetricsDashboard(req: Request): string {
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Database Monitoring Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; line-height: 1.5; max-width: 1200px; margin: 0 auto; padding: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
    th { background-color: #f8f9fa; }
    .card { background: white; border-radius: 8px; padding: 15px; margin-bottom: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
    h2 { margin-top: 0; color: #333; }
    pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; }
    .number { font-family: monospace; text-align: right; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500; }
    .badge-slow { background: #ffecec; color: #e74c3c; }
    .badge-normal { background: #edfff2; color: #27ae60; }
    .actions { display: flex; gap: 10px; margin-bottom: 20px; }
    .btn { padding: 8px 16px; border-radius: 4px; border: none; cursor: pointer; font-weight: 500; }
    .btn-primary { background: #3498db; color: white; }
    .btn-secondary { background: #ecf0f1; color: #34495e; }
    .btn-danger { background: #e74c3c; color: white; }
    .flex-between { display: flex; justify-content: space-between; align-items: center; }
    .chart-container { height: 200px; margin-bottom: 20px; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.1/dist/chart.min.js"></script>
</head>
<body>
  <h1>Database Monitoring Dashboard</h1>
  
  <div class="actions">
    <a href="${baseUrl}/api/db-metrics" class="btn btn-primary">Raw Metrics</a>
    <a href="${baseUrl}/api/db-metrics/dashboard" class="btn btn-secondary">Refresh Dashboard</a>
    <button onclick="resetStats()" class="btn btn-danger">Reset Statistics</button>
  </div>
  
  <div class="card">
    <div class="flex-between">
      <h2>Connection Pool</h2>
      <span id="pool-update-time"></span>
    </div>
    <div class="chart-container">
      <canvas id="poolChart"></canvas>
    </div>
  </div>
  
  <div class="card">
    <div class="flex-between">
      <h2>Query Distribution</h2>
      <span id="query-update-time"></span>
    </div>
    <div class="chart-container">
      <canvas id="queryDistributionChart"></canvas>
    </div>
  </div>
  
  <div class="card">
    <h2>Top Slow Queries</h2>
    <table id="slow-queries">
      <thead>
        <tr>
          <th>Pattern</th>
          <th>Operation</th>
          <th>Tables</th>
          <th>Executions</th>
          <th>Avg (ms)</th>
          <th>Max (ms)</th>
          <th>Min (ms)</th>
          <th>Last Executed</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td colspan="8">Loading...</td>
        </tr>
      </tbody>
    </table>
  </div>
  
  <script>
    // Function to fetch and update dashboard data
    async function updateDashboard() {
      try {
        const response = await fetch('${baseUrl}/api/db-metrics/data');
        const data = await response.json();
        
        // Update timestamps
        document.getElementById('pool-update-time').textContent = new Date().toLocaleTimeString();
        document.getElementById('query-update-time').textContent = new Date().toLocaleTimeString();
        
        // Update pool chart
        updatePoolChart(data.poolStats);
        
        // Update query distribution chart
        updateQueryDistributionChart(data.queryFrequency);
        
        // Update slow queries table
        updateSlowQueriesTable(data.slowQueries);
      } catch (error) {
        console.error('Failed to update dashboard:', error);
      }
    }
    
    // Initialize pool chart
    let poolChart;
    function initPoolChart() {
      const ctx = document.getElementById('poolChart').getContext('2d');
      poolChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Total', 'Active', 'Idle', 'Waiting'],
          datasets: [{
            label: 'Connections',
            data: [0, 0, 0, 0],
            backgroundColor: ['#3498db', '#27ae60', '#f39c12', '#e74c3c']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                precision: 0
              }
            }
          }
        }
      });
    }
    
    // Update pool chart with new data
    function updatePoolChart(poolStats) {
      if (poolChart) {
        poolChart.data.datasets[0].data = [
          poolStats.total || 0,
          (poolStats.total - poolStats.idle) || 0,
          poolStats.idle || 0,
          poolStats.waiting || 0
        ];
        poolChart.update();
      }
    }
    
    // Initialize query distribution chart
    let queryDistributionChart;
    function initQueryDistributionChart() {
      const ctx = document.getElementById('queryDistributionChart').getContext('2d');
      queryDistributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: [],
          datasets: [{
            data: [],
            backgroundColor: [
              '#3498db', '#27ae60', '#f39c12', '#e74c3c', 
              '#9b59b6', '#1abc9c', '#d35400', '#2c3e50'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right'
            }
          }
        }
      });
    }
    
    // Update query distribution chart with new data
    function updateQueryDistributionChart(queryFrequency) {
      if (queryDistributionChart) {
        const labels = Object.keys(queryFrequency);
        const data = labels.map(label => queryFrequency[label]);
        
        queryDistributionChart.data.labels = labels;
        queryDistributionChart.data.datasets[0].data = data;
        queryDistributionChart.update();
      }
    }
    
    // Update slow queries table with new data
    function updateSlowQueriesTable(slowQueries) {
      const tbody = document.getElementById('slow-queries').getElementsByTagName('tbody')[0];
      
      // Clear existing rows
      tbody.innerHTML = '';
      
      if (slowQueries.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 8;
        cell.textContent = 'No slow queries detected yet.';
        return;
      }
      
      // Add new rows
      slowQueries.forEach(query => {
        const row = tbody.insertRow();
        
        // Pattern
        const patternCell = row.insertCell(0);
        patternCell.innerHTML = \`<pre>\${query.normalized.substring(0, 80)}...</pre>\`;
        
        // Operation
        const opCell = row.insertCell(1);
        opCell.textContent = query.operation;
        
        // Tables
        const tablesCell = row.insertCell(2);
        tablesCell.textContent = query.tables.join(', ');
        
        // Executions
        const execCell = row.insertCell(3);
        execCell.textContent = query.totalExecutions;
        execCell.className = 'number';
        
        // Avg Duration
        const avgCell = row.insertCell(4);
        avgCell.textContent = query.avgDurationMs.toFixed(2);
        avgCell.className = 'number';
        
        // Add visual indicator for slow queries
        const badgeClass = query.avgDurationMs > 500 ? 'badge-slow' : 'badge-normal';
        avgCell.innerHTML += \` <span class="badge \${badgeClass}">\${query.avgDurationMs > 500 ? 'Slow' : 'OK'}</span>\`;
        
        // Max Duration
        const maxCell = row.insertCell(5);
        maxCell.textContent = query.maxDurationMs.toFixed(2);
        maxCell.className = 'number';
        
        // Min Duration
        const minCell = row.insertCell(6);
        minCell.textContent = query.minDurationMs.toFixed(2);
        minCell.className = 'number';
        
        // Last Executed
        const lastCell = row.insertCell(7);
        lastCell.textContent = new Date(query.lastExecuted).toLocaleString();
      });
    }
    
    // Reset all stats
    async function resetStats() {
      if (confirm('Are you sure you want to reset all database statistics? This cannot be undone.')) {
        try {
          await fetch('${baseUrl}/api/db-metrics/reset', { method: 'POST' });
          alert('Statistics have been reset.');
          updateDashboard();
        } catch (error) {
          alert('Failed to reset statistics: ' + error.message);
        }
      }
    }
    
    // Initialize charts and load data
    document.addEventListener('DOMContentLoaded', function() {
      initPoolChart();
      initQueryDistributionChart();
      updateDashboard();
      
      // Update dashboard every 30 seconds
      setInterval(updateDashboard, 30000);
    });
  </script>
</body>
</html>`;
}

/**
 * Database metrics dashboard endpoint
 */
export function dbMetricsDashboard(req: Request, res: Response) {
  res.set('Content-Type', 'text/html');
  res.send(generateMetricsDashboard(req));
}

/**
 * Database metrics raw data endpoint
 */
export async function dbMetricsEndpoint(_req: Request, res: Response) {
  res.set('Content-Type', dbMonitoring.getContentType());
  const metrics = await dbMonitoring.getMetrics();
  res.send(metrics);
}

/**
 * Dashboard data API endpoint
 */
export function dbMetricsData(_req: Request, res: Response) {
  // Collect pool statistics (using any because we're accessing internal properties)
  const pool = (dbMonitoring as any).pool || {};
  const poolStats = {
    total: pool.totalCount || 0,
    idle: pool.idleCount || 0,
    waiting: pool.waitingCount || 0,
  };

  // Get top slow queries
  const slowQueries = dbMonitoring.getTopSlowQueries(10);

  // Get query frequency stats
  const queryFrequency = dbMonitoring.getQueryFrequencyStats();

  res.json({
    poolStats,
    slowQueries,
    queryFrequency,
  });
}

/**
 * Reset database metrics
 */
export function resetDbMetrics(_req: Request, res: Response) {
  dbMonitoring.resetPatternStats();
  res.json({ success: true, message: 'Database metrics have been reset' });
}

/**
 * Database metrics router middleware
 */
export function dbMonitoringMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/db-metrics') {
    return dbMetricsEndpoint(req, res);
  }

  if (req.path === '/api/db-metrics/dashboard') {
    return dbMetricsDashboard(req, res);
  }

  if (req.path === '/api/db-metrics/data') {
    return dbMetricsData(req, res);
  }

  if (req.path === '/api/db-metrics/reset' && req.method === 'POST') {
    return resetDbMetrics(req, res);
  }

  next();
}

export default dbMonitoringMiddleware;
