/**
 * Swagger Middleware Tests
 *
 * This file contains tests for the Swagger middleware.
 */

import request from 'supertest';
import express from 'express';

// Mock logger to avoid issues
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

// Mock config to avoid directory creation issues
jest.mock('../../config', () => ({
  env: 'test',
  isDevelopment: false,
  isProduction: false,
  isTest: true,
  server: {
    port: 3000,
    host: 'localhost',
    corsOrigins: ['http://localhost:3000'],
    publicUrl: 'http://localhost:3000',
  },
}));

import { applySwagger } from '../swaggerMiddleware';

describe('Swagger Middleware', () => {
  let app: express.Application;
  let logger: any;

  beforeEach(() => {
    // Get the mocked logger
    logger = require('../../utils/logger');

    // Create a new Express app for each test
    app = express();

    // Apply Swagger middleware
    applySwagger(app);

    // Add a simple route for testing
    app.get('/test', (req, res) => {
      res.status(200).json({ message: 'Test successful' });
    });
  });

  it('should log that Swagger is disabled', () => {
    expect(logger.info).toHaveBeenCalledWith('Swagger middleware disabled in development mode');
  });

  it('should not interfere with regular routes', async () => {
    const response = await request(app).get('/test');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Test successful');
  });
});
