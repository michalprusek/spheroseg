import express from 'express';
import { getMetrics, getMetricsContentType } from '../monitoring/unified';

const router = express.Router();

/**
 * GET /api/metrics
 * Returns Prometheus metrics from unified monitoring system
 */
router.get('/', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', getMetricsContentType());
    res.end(metrics);
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).send('Error getting metrics');
  }
});

/**
 * POST /api/metrics
 * Receives metrics from frontend
 * Note: Frontend metrics are now handled by PrometheusMetricsService
 */
router.post('/', (req, res) => {
  try {
    const { metrics } = req.body;

    if (!Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Invalid metrics format' });
    }

    // Frontend metrics are now processed by PrometheusMetricsService
    // This endpoint is kept for backward compatibility
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing metrics:', error);
    res.status(500).json({ error: 'Error processing metrics' });
  }
});

export default router;
