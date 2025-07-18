/**
 * ML Metrics Adapter
 *
 * This service adapts ML service metrics to be exposed through the backend's Prometheus endpoint.
 * It periodically fetches metrics from the ML service and updates local Prometheus metrics.
 */

import { Registry, Gauge, Counter, Histogram } from 'prom-client';
import axios from 'axios';
import logger from '../utils/logger';

// ML service metrics endpoint
const ML_METRICS_URL = process.env.ML_METRICS_URL || 'http://ml-service:9090/metrics';

// Polling interval in milliseconds
const POLLING_INTERVAL = parseInt(process.env.ML_METRICS_POLLING_INTERVAL || '30000', 10);

// Create metrics objects
const ML_TASK_COUNT = new Counter({
  name: 'ml_tasks_total',
  help: 'Total number of ML tasks processed (proxy from ML service)',
  labelNames: ['model', 'status', 'type'],
});

const ML_TASK_DURATION = new Histogram({
  name: 'ml_task_duration_seconds',
  help: 'Duration of ML tasks in seconds (proxy from ML service)',
  labelNames: ['model', 'type'],
  buckets: [0.1, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300],
});

const ML_TASK_QUEUE_SIZE = new Gauge({
  name: 'ml_task_queue_size',
  help: 'Number of ML tasks in queue (proxy from ML service)',
  labelNames: ['queue'],
});

const ML_GPU_UTILIZATION = new Gauge({
  name: 'ml_gpu_utilization',
  help: 'GPU utilization percentage (proxy from ML service)',
  labelNames: ['gpu_id'],
});

const ML_MEMORY_UTILIZATION = new Gauge({
  name: 'ml_memory_utilization',
  help: 'Memory utilization percentage (proxy from ML service)',
});

const ML_CPU_UTILIZATION = new Gauge({
  name: 'ml_cpu_utilization',
  help: 'CPU utilization percentage (proxy from ML service)',
});

/**
 * Extract metric value from Prometheus metrics text
 * @param metrics Prometheus metrics text
 * @param metricName Name of the metric to extract
 * @param labels Labels to match
 * @returns Metric value or null if not found
 */
function extractMetricValue(
  metrics: string,
  metricName: string,
  labels: Record<string, string> = {}
): number | null {
  const lines = metrics.split('\n');
  const metricLines = lines.filter(
    (line) => line.startsWith(metricName) && !line.startsWith(`${metricName}_`)
  );

  if (metricLines.length === 0) {
    return null;
  }

  // Match lines with all specified labels
  const labelEntries = Object.entries(labels);
  if (labelEntries.length > 0) {
    for (const line of metricLines) {
      let allLabelsMatch = true;

      for (const [labelName, labelValue] of labelEntries) {
        const labelRegex = new RegExp(`${labelName}="${labelValue}"`);
        if (!labelRegex.test(line)) {
          allLabelsMatch = false;
          break;
        }
      }

      if (allLabelsMatch) {
        const valueMatch = line.match(/\s([0-9.]+)(\s|$)/);
        if (valueMatch) {
          return parseFloat(valueMatch[1]);
        }
      }
    }

    return null;
  }

  // No labels specified, just get the first metric value
  const valueMatch = metricLines[0].match(/\s([0-9.]+)(\s|$)/);
  if (valueMatch) {
    return parseFloat(valueMatch[1]);
  }

  return null;
}

/**
 * Extract all metrics with the same prefix and their labels
 * @param metrics Prometheus metrics text
 * @param metricPrefix Prefix of metrics to extract
 * @returns Array of {labels, value} objects
 */
function extractMetricsWithLabels(
  metrics: string,
  metricPrefix: string
): Array<{ labels: Record<string, string>; value: number }> {
  const result: Array<{ labels: Record<string, string>; value: number }> = [];
  const lines = metrics.split('\n');
  const metricLines = lines.filter(
    (line) => line.startsWith(metricPrefix) && !line.startsWith(`${metricPrefix}_`)
  );

  for (const line of metricLines) {
    const labelsMatch = line.match(/{([^}]+)}/);
    const valueMatch = line.match(/\s([0-9.]+)(\s|$)/);

    if (valueMatch) {
      const value = parseFloat(valueMatch[1]);
      const labels: Record<string, string> = {};

      if (labelsMatch) {
        const labelPairs = labelsMatch[1].split(',');
        for (const pair of labelPairs) {
          const [name, quotedValue] = pair.split('=');
          if (name && quotedValue) {
            // Remove quotes from the value
            const value = quotedValue.replace(/^"(.*)"$/, '$1');
            labels[name.trim()] = value;
          }
        }
      }

      result.push({ labels, value });
    }
  }

  return result;
}

/**
 * Fetch metrics from ML service and update local metrics
 */
async function fetchAndUpdateMlMetrics(): Promise<void> {
  try {
    const response = await axios.get(ML_METRICS_URL, {
      timeout: 5000,
      headers: { Accept: 'text/plain' },
    });

    if (response.status === 200) {
      const metricsText = response.data;

      // Update task count metrics
      const taskCounts = extractMetricsWithLabels(metricsText, 'ml_segmentation_tasks_total');
      for (const { labels } of taskCounts) {
        ML_TASK_COUNT.labels({
          model: labels.model || 'unknown',
          status: labels.status || 'unknown',
          type: 'segmentation',
        }).inc(0); // Create the metric with initial value if it doesn't exist
      }

      // Update task duration metrics
      const taskDurations = extractMetricsWithLabels(
        metricsText,
        'ml_segmentation_duration_seconds_sum'
      );
      for (const { labels, value } of taskDurations) {
        // We need both _sum and _count to calculate average
        const count = extractMetricValue(
          metricsText,
          'ml_segmentation_duration_seconds_count',
          labels
        );
        if (count !== null && count > 0) {
          // Calculate average
          const average = value / count;
          ML_TASK_DURATION.labels({
            model: labels.model || 'unknown',
            type: 'segmentation',
          }).observe(average);
        }
      }

      // Update queue size metrics
      const queueSizes = extractMetricsWithLabels(metricsText, 'ml_task_queue_size');
      for (const { labels, value } of queueSizes) {
        ML_TASK_QUEUE_SIZE.labels({
          queue: labels.queue || 'unknown',
        }).set(value);
      }

      // Update GPU utilization metrics
      const gpuUtils = extractMetricsWithLabels(metricsText, 'ml_gpu_utilization_percent');
      for (const { labels, value } of gpuUtils) {
        ML_GPU_UTILIZATION.labels({
          gpu_id: labels.gpu_id || '0',
        }).set(value);
      }

      // Update memory utilization metric
      const memUtil = extractMetricValue(metricsText, 'ml_memory_utilization_percent');
      if (memUtil !== null) {
        ML_MEMORY_UTILIZATION.set(memUtil);
      }

      // Update CPU utilization metric
      const cpuUtil = extractMetricValue(metricsText, 'ml_cpu_utilization_percent');
      if (cpuUtil !== null) {
        ML_CPU_UTILIZATION.set(cpuUtil);
      }

      logger.debug('Updated ML metrics from ML service');
    }
  } catch (error) {
    logger.warn(
      `Failed to fetch ML metrics: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Start metrics polling
 */
function startMetricsPolling(): ReturnType<typeof setTimeout> {
  // Fetch metrics immediately
  fetchAndUpdateMlMetrics();

  // Then set up interval
  return setInterval(fetchAndUpdateMlMetrics, POLLING_INTERVAL);
}

let pollingInterval: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the ML metrics adapter
 * @param registry Prometheus registry to register metrics with
 */
export function initMlMetricsAdapter(registry: Registry): void {
  // Register metrics with the registry
  registry.registerMetric(ML_TASK_COUNT);
  registry.registerMetric(ML_TASK_DURATION);
  registry.registerMetric(ML_TASK_QUEUE_SIZE);
  registry.registerMetric(ML_GPU_UTILIZATION);
  registry.registerMetric(ML_MEMORY_UTILIZATION);
  registry.registerMetric(ML_CPU_UTILIZATION);

  // Start polling for metrics
  if (!pollingInterval) {
    pollingInterval = startMetricsPolling();
    logger.info(`ML metrics adapter initialized, polling every ${POLLING_INTERVAL / 1000} seconds`);
  }
}

/**
 * Stop metrics polling
 */
export function stopMlMetricsAdapter(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    logger.info('ML metrics adapter stopped');
  }
}

export default {
  initMlMetricsAdapter,
  stopMlMetricsAdapter,
};
