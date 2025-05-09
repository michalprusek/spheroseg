import express from 'express';
import { client as prometheusClient } from '../lib/metrics/prometheusClient';
import { MetricType, Metric } from '@spheroseg/shared';
import { performanceMonitoring } from '../lib/monitoring';

const router = express.Router();

/**
 * GET /api/metrics
 * Returns Prometheus metrics
 */
router.get('/', async (req, res) => {
  try {
    if (!prometheusClient) {
      return res.status(404).send('Metrics not enabled');
    }

    res.set('Content-Type', prometheusClient.getContentType());
    res.end(await prometheusClient.getMetrics());
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).send('Error getting metrics');
  }
});

/**
 * POST /api/metrics
 * Receives metrics from frontend
 */
router.post('/', (req, res) => {
  try {
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Invalid metrics format' });
    }

    // Process each metric
    metrics.forEach((metric: Metric) => {
      switch (metric.type) {
        case MetricType.PAGE_LOAD:
          // Record to Prometheus if available
          if (prometheusClient) {
            const pageLoadHistogram = prometheusClient.getMetric('http_request_duration_ms');
            if (pageLoadHistogram) {
              pageLoadHistogram
                .labels({
                  method: 'GET',
                  route: metric.route,
                  status_code: '200',
                })
                .observe(metric.loadTime);
            }
          }
          break;

        case MetricType.API_REQUEST:
          // Record to Prometheus if available
          if (prometheusClient) {
            const apiRequestHistogram = prometheusClient.getMetric('http_request_duration_ms');
            if (apiRequestHistogram) {
              apiRequestHistogram
                .labels({
                  method: metric.method,
                  route: metric.endpoint,
                  status_code: metric.status.toString(),
                })
                .observe(metric.duration);
            }
          }
          break;

        // Add other metric types as needed
      }
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing metrics:', error);
    res.status(500).json({ error: 'Error processing metrics' });
  }
});

export default router;
