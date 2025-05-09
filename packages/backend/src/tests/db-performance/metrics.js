/**
 * Database Performance Metrics Collection
 * Collects and analyzes performance metrics for database tests
 */

const fs = require('fs').promises;
const path = require('path');
const config = require('./config');

// Class for managing metrics collection
class MetricsCollector {
  constructor(testName) {
    this.testName = testName;
    this.metrics = {
      testName,
      startTime: new Date().toISOString(),
      endTime: null,
      queries: [], // Individual query metrics
      summary: {
        totalQueries: 0,
        totalDuration: 0,
        averageDuration: 0,
        minDuration: Number.MAX_VALUE,
        maxDuration: 0,
        p95Duration: 0,
        p99Duration: 0,
        queriesPerSecond: 0,
        errorCount: 0,
        errorRate: 0,
        slowQueries: 0,
        queryCountsByType: {},
        queryDurationsByType: {}
      }
    };
    
    // Create directories if they don't exist
    this.outputDir = path.join(__dirname, '../../../test-results/db-performance');
  }
  
  /**
   * Record a single query execution
   * @param {Object} query Query details
   */
  recordQuery(query) {
    // Add timestamp
    const queryWithTimestamp = {
      ...query,
      timestamp: new Date().toISOString()
    };
    
    // Store query metrics
    this.metrics.queries.push(queryWithTimestamp);
    
    // Update summary metrics
    this.metrics.summary.totalQueries++;
    this.metrics.summary.totalDuration += query.duration;
    
    // Track min/max duration
    if (query.duration < this.metrics.summary.minDuration) {
      this.metrics.summary.minDuration = query.duration;
    }
    if (query.duration > this.metrics.summary.maxDuration) {
      this.metrics.summary.maxDuration = query.duration;
    }
    
    // Update error count
    if (query.error) {
      this.metrics.summary.errorCount++;
    }
    
    // Track slow queries
    if (query.duration > config.monitoring.slowQueryThreshold) {
      this.metrics.summary.slowQueries++;
    }
    
    // Track query types
    const queryType = query.type || 'unknown';
    if (!this.metrics.summary.queryCountsByType[queryType]) {
      this.metrics.summary.queryCountsByType[queryType] = 0;
      this.metrics.summary.queryDurationsByType[queryType] = 0;
    }
    this.metrics.summary.queryCountsByType[queryType]++;
    this.metrics.summary.queryDurationsByType[queryType] += query.duration;
  }
  
  /**
   * Calculate final summary metrics
   */
  calculateSummary() {
    const { queries, summary } = this.metrics;
    
    // Set end time
    this.metrics.endTime = new Date().toISOString();
    
    // Calculate average
    summary.averageDuration = summary.totalQueries > 0 
      ? summary.totalDuration / summary.totalQueries 
      : 0;
    
    // Calculate error rate
    summary.errorRate = summary.totalQueries > 0 
      ? (summary.errorCount / summary.totalQueries) * 100 
      : 0;
    
    // Calculate queries per second
    const testDurationMs = new Date(this.metrics.endTime) - new Date(this.metrics.startTime);
    summary.queriesPerSecond = testDurationMs > 0 
      ? (summary.totalQueries / (testDurationMs / 1000)) 
      : 0;
    
    // Calculate percentiles
    if (queries.length > 0) {
      const sortedDurations = queries
        .map(q => q.duration)
        .sort((a, b) => a - b);
      
      const p95Index = Math.floor(sortedDurations.length * 0.95);
      const p99Index = Math.floor(sortedDurations.length * 0.99);
      
      summary.p95Duration = sortedDurations[p95Index];
      summary.p99Duration = sortedDurations[p99Index];
    }
    
    // Calculate average duration by query type
    for (const [type, count] of Object.entries(summary.queryCountsByType)) {
      const totalDuration = summary.queryDurationsByType[type];
      summary.queryDurationsByType[type] = totalDuration / count;
    }
    
    return summary;
  }
  
  /**
   * Save metrics to a file
   */
  async saveMetrics() {
    this.calculateSummary();
    
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `${this.testName}_${timestamp}.json`;
      const filePath = path.join(this.outputDir, filename);
      
      // Write metrics to file
      await fs.writeFile(filePath, JSON.stringify(this.metrics, null, 2));
      
      console.log(`Metrics saved to ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error saving metrics:', error);
      throw error;
    }
  }
  
  /**
   * Generate an HTML report from the metrics
   */
  async generateReport() {
    // Calculate final metrics
    this.calculateSummary();
    
    try {
      // Create directory if it doesn't exist
      await fs.mkdir(this.outputDir, { recursive: true });
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `${this.testName}_${timestamp}_report.html`;
      const filePath = path.join(this.outputDir, filename);
      
      // Generate HTML content
      const htmlContent = this.generateHtmlReport();
      
      // Write report to file
      await fs.writeFile(filePath, htmlContent);
      
      console.log(`Report generated at ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error generating report:', error);
      throw error;
    }
  }
  
  /**
   * Generate HTML report content
   * @returns {string} HTML report
   */
  generateHtmlReport() {
    const { summary } = this.metrics;
    const startTime = new Date(this.metrics.startTime);
    const endTime = new Date(this.metrics.endTime);
    const testDuration = ((endTime - startTime) / 1000).toFixed(2);
    
    // Get top 5 slowest queries
    const slowestQueries = [...this.metrics.queries]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);
    
    // Generate query type data for chart
    const queryTypeData = Object.entries(summary.queryCountsByType)
      .map(([type, count]) => ({
        type,
        count,
        averageDuration: summary.queryDurationsByType[type]
      }));
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DB Performance Test: ${this.testName}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      margin: 20px;
      color: #333;
    }
    h1, h2, h3 {
      color: #2c3e50;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .card {
      background: #fff;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      grid-gap: 15px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: #f8f9fa;
      border-radius: 5px;
      padding: 15px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: bold;
      margin: 5px 0;
    }
    .stat-label {
      font-size: 14px;
      color: #6c757d;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f8f9fa;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f1f1f1;
    }
    .success {
      color: #28a745;
    }
    .warning {
      color: #ffc107;
    }
    .danger {
      color: #dc3545;
    }
    .text-center {
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Database Performance Test Report</h1>
      <h2>${this.testName}</h2>
      <p>Test run on ${startTime.toLocaleString()} (Duration: ${testDuration}s)</p>
    </div>
    
    <div class="card">
      <h2>Summary</h2>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${summary.totalQueries}</div>
          <div class="stat-label">Total Queries</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.queriesPerSecond.toFixed(2)}</div>
          <div class="stat-label">Queries/Second</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.averageDuration.toFixed(2)}ms</div>
          <div class="stat-label">Average Duration</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${summary.p95Duration.toFixed(2)}ms</div>
          <div class="stat-label">P95 Duration</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${summary.errorRate > 0 ? 'danger' : 'success'}">${summary.errorRate.toFixed(2)}%</div>
          <div class="stat-label">Error Rate</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${summary.slowQueries > 0 ? 'warning' : 'success'}">${summary.slowQueries}</div>
          <div class="stat-label">Slow Queries</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>Query Types</h2>
      <table>
        <thead>
          <tr>
            <th>Query Type</th>
            <th>Count</th>
            <th>% of Total</th>
            <th>Avg. Duration (ms)</th>
          </tr>
        </thead>
        <tbody>
          ${queryTypeData.map(data => `
            <tr>
              <td>${data.type}</td>
              <td>${data.count}</td>
              <td>${((data.count / summary.totalQueries) * 100).toFixed(2)}%</td>
              <td>${data.averageDuration.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="card">
      <h2>Slowest Queries</h2>
      <table>
        <thead>
          <tr>
            <th>Query</th>
            <th>Type</th>
            <th>Duration (ms)</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${slowestQueries.map(query => `
            <tr>
              <td><code>${query.text.substring(0, 100)}${query.text.length > 100 ? '...' : ''}</code></td>
              <td>${query.type || 'unknown'}</td>
              <td>${query.duration.toFixed(2)}</td>
              <td>${query.error ? `<span class="danger">Error</span>` : `<span class="success">Success</span>`}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;
  }
}

module.exports = {
  MetricsCollector
};