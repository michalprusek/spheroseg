/**
 * API routes for Prometheus metrics
 */
const express = require('express');
const { metricsEndpoint } = require('../middleware/metricsMiddleware');

const router = express.Router();

/**
 * GET /api/metrics - Return Prometheus metrics
 * 
 * This endpoint exposes all collected metrics in Prometheus format.
 * It is used by monitoring systems for collecting performance data.
 */
router.get('/', metricsEndpoint);

module.exports = router;
