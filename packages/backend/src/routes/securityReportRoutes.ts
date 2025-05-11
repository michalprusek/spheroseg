/**
 * Security Report Routes
 * These routes handle security violation reports from browsers
 */
import express from 'express';
import logger from '../utils/logger';
import { standardLimiter } from '../middleware/rateLimitMiddleware';

const router = express.Router();

/**
 * POST /api/security/report/csp
 * Endpoint for CSP violation reports
 */
router.post('/csp', standardLimiter, (req, res) => {
  const report = req.body['csp-report'] || req.body;

  logger.warn('CSP Violation', {
    report,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(204).end();
});

/**
 * POST /api/security/report/ct
 * Endpoint for Certificate Transparency violation reports
 */
router.post('/ct', standardLimiter, (req, res) => {
  logger.warn('Certificate Transparency Violation', {
    report: req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(204).end();
});

/**
 * POST /api/security/report/hpkp
 * Endpoint for HTTP Public Key Pinning violation reports
 */
router.post('/hpkp', standardLimiter, (req, res) => {
  logger.warn('HPKP Violation', {
    report: req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(204).end();
});

/**
 * POST /api/security/report/xss
 * Endpoint for XSS Auditor violation reports
 */
router.post('/xss', standardLimiter, (req, res) => {
  logger.warn('XSS Auditor Violation', {
    report: req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(204).end();
});

/**
 * POST /api/security/report/nel
 * Endpoint for Network Error Logging reports
 */
router.post('/nel', standardLimiter, (req, res) => {
  logger.warn('Network Error Logging Report', {
    report: req.body,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });

  res.status(204).end();
});

export default router;
