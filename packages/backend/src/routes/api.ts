/**
 * Centralizovaný API router pro sjednocení všech endpointů
 *
 * Tento soubor definuje všechny API endpointy aplikace a zajišťuje
 * jejich konzistentní strukturu a chování.
 */

import express from 'express';
import { Router } from 'express';
import logger from '../utils/logger';
import { getMetrics } from '../monitoring';

// Importy routerů
import projectRoutes from './projects';
import userRoutes from './users';
import userStatsRoutes from './userStats';
import performanceRoutes from './performance';

// Vytvoření hlavního routeru
const router = Router();

// Logovací middleware pro všechny API požadavky
router.use((req, res, next) => {
  logger.debug(`API Request: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Definice API verzí
const API_V1_PREFIX = '/api/v1';

// Veřejné endpointy (bez autentizace)
router.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    service: 'backend-v2',
  });
});

// Metriky
router.get('/api/metrics', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', 'text/plain');
    res.send(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Registrace endpointů
router.use('/projects', projectRoutes);
router.use('/users', userRoutes);
router.use('/users', userStatsRoutes);
router.use('/metrics/performance', performanceRoutes);

// Fallback pro neznámé API endpointy
router.use('*', (req, res) => {
  res.status(404).json({
    error: 'API endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString(),
  });
});

export default router;
