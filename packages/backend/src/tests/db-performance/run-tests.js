/**
 * Database Performance Test Runner
 * Executes all test scenarios and generates reports
 */

const setup = require('./setup');
const config = require('./config');
const {
  UserAuthScenario,
  ProjectListingScenario,
  ImageOperationsScenario,
  SegmentationScenario,
  ComplexQueriesScenario,
  TransactionScenario
} = require('./scenarios');
const path = require('path');
const fs = require('fs').promises;

/**
 * Main function to run all tests
 */
async function runTests() {
  console.log('=== Starting Database Performance Tests ===');
  console.log(`Configuration: ${config.execution.concurrentUsers} concurrent users, ${config.execution.duration}s duration`);
  
  // Create test data
  let testData;
  try {
    console.log('Setting up test data...');
    await setup.cleanupTestDatabase(); // Start fresh
    testData = await setup.generateAllTestData();
    console.log('Test data created successfully');
  } catch (error) {
    console.error('Error setting up test data:', error);
    process.exit(1);
  }
  
  // Create results directory
  const resultsDir = path.join(__dirname, '../../../test-results/db-performance');
  try {
    await fs.mkdir(resultsDir, { recursive: true });
  } catch (error) {
    console.error('Error creating results directory:', error);
  }
  
  // Create summary file
  const summaryPath = path.join(resultsDir, 'summary.html');
  
  // Collect scenario results
  const scenarioResults = [];
  
  // Run individual scenarios
  try {
    // Get a dedicated client for tests
    const client = await setup.getClient();
    
    // Run each scenario
    const scenarios = [
      new UserAuthScenario(client, testData),
      new ProjectListingScenario(client, testData),
      new ImageOperationsScenario(client, testData),
      new SegmentationScenario(client, testData),
      new ComplexQueriesScenario(client, testData),
      new TransactionScenario(client, testData)
    ];
    
    for (const scenario of scenarios) {
      // Run the scenario
      await scenario.run();
      
      // Save metrics and generate report
      const reportPath = await scenario.saveMetrics();
      
      // Extract metrics for summary
      const metrics = scenario.metricsCollector.metrics.summary;
      scenarioResults.push({
        name: scenario.name,
        reportPath,
        metrics,
        timestamp: new Date().toISOString()
      });
    }
    
    // Release the client
    client.release();
    
  } catch (error) {
    console.error('Error running test scenarios:', error);
  } finally {
    // Generate summary report
    await generateSummaryReport(summaryPath, scenarioResults);
    
    // Clean up
    await setup.closePool();
  }
  
  console.log('=== Database Performance Tests Complete ===');
  console.log(`Summary report available at: ${summaryPath}`);
  
  // Return 0 for success
  return 0;
}

/**
 * Generate a summary report for all tests
 * @param {string} filePath Path to save the summary report
 * @param {Array} results Array of scenario results
 */
async function generateSummaryReport(filePath, results) {
  // Generate HTML for the summary report
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Performance Test Summary</title>
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
    .chart-container {
      width: 100%;
      height: 400px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Database Performance Test Summary</h1>
      <p>Tests run on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="card">
      <h2>Test Scenarios</h2>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Queries</th>
            <th>QPS</th>
            <th>Avg Duration</th>
            <th>P95 Duration</th>
            <th>Error Rate</th>
            <th>Slow Queries</th>
            <th>Report</th>
          </tr>
        </thead>
        <tbody>
          ${results.map(result => {
            const metrics = result.metrics;
            const reportFileName = path.basename(result.reportPath);
            return `
              <tr>
                <td>${result.name}</td>
                <td>${metrics.totalQueries}</td>
                <td>${metrics.queriesPerSecond.toFixed(2)}</td>
                <td>${metrics.averageDuration.toFixed(2)} ms</td>
                <td>${metrics.p95Duration.toFixed(2)} ms</td>
                <td class="${metrics.errorRate > 0 ? 'danger' : 'success'}">${metrics.errorRate.toFixed(2)}%</td>
                <td class="${metrics.slowQueries > 0 ? 'warning' : 'success'}">${metrics.slowQueries}</td>
                <td><a href="./${reportFileName}" target="_blank">Details</a></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="card">
      <h2>Performance Comparison</h2>
      <p>Average query duration by scenario:</p>
      <div class="chart-container">
        <!-- We'd include a chart here with a JS library like Chart.js -->
        <img src="performance-chart-placeholder.png" alt="Performance Chart" style="display: none;">
        <div style="width: 100%; height: 300px; display: flex; align-items: flex-end; border-bottom: 1px solid #ddd; border-left: 1px solid #ddd;">
          ${results.map((result, index) => {
            const height = Math.min(280, Math.max(20, result.metrics.averageDuration * 5));
            return `
              <div style="flex: 1; margin: 0 10px; display: flex; flex-direction: column; align-items: center;">
                <div style="width: 40px; height: ${height}px; background-color: hsl(${210 + index * 30}, 70%, 60%);"></div>
                <div style="margin-top: 10px; font-size: 12px; text-align: center;">${result.name.replace('Scenario', '')}</div>
                <div style="font-size: 10px;">${result.metrics.averageDuration.toFixed(2)} ms</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>Slowest Operations</h2>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Query Type</th>
            <th>Avg Duration</th>
          </tr>
        </thead>
        <tbody>
          ${results.flatMap(result => {
            // Get top 3 slowest query types for each scenario
            const queryTypes = Object.entries(result.metrics.queryDurationsByType)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 3);
            
            return queryTypes.map(([type, duration]) => `
              <tr>
                <td>${result.name}</td>
                <td>${type}</td>
                <td>${duration.toFixed(2)} ms</td>
              </tr>
            `);
          }).join('')}
        </tbody>
      </table>
    </div>
    
    <div class="card">
      <h2>Recommendations</h2>
      <ul>
        ${results.some(r => r.metrics.slowQueries > 0) ? 
          '<li>Consider adding indexes to improve performance of slow queries</li>' : 
          '<li>No slow queries detected - current indexing strategy appears effective</li>'}
        ${results.some(r => r.metrics.p95Duration > config.thresholds.responseTimeP95) ? 
          '<li>Some queries exceed the P95 response time threshold - review and optimize</li>' : 
          '<li>Query response times are within acceptable thresholds</li>'}
        ${results.some(r => r.metrics.errorRate > 0) ? 
          '<li>Errors detected - review error handling and query validation</li>' : 
          '<li>No errors detected during testing</li>'}
        <li>Consider implementing query caching for frequently accessed data</li>
        <li>Review connection pool settings based on test results</li>
      </ul>
    </div>
  </div>
</body>
</html>
  `;
  
  // Write the HTML to file
  try {
    await fs.writeFile(filePath, html);
    console.log(`Summary report written to ${filePath}`);
  } catch (error) {
    console.error('Error writing summary report:', error);
  }
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runTests()
    .then(code => process.exit(code))
    .catch(err => {
      console.error('Unhandled error:', err);
      process.exit(1);
    });
}

module.exports = {
  runTests
};