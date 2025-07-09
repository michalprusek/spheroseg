/**
 * Performance Tests for Critical API Endpoints
 *
 * This file contains performance tests for the most critical API endpoints
 * in the application. It measures response times and throughput under load.
 */

import request from 'supertest';
import { app } from '../server';
import pool from '../db';
import { createTestUser, deleteTestUser, createTestProject, createTestImage } from './testUtils';

// Test configuration
const PERFORMANCE_CONFIG = {
  // Number of requests to send for each endpoint
  requestCount: 10,
  // Maximum acceptable average response time in milliseconds
  maxAvgResponseTime: 200,
  // Maximum acceptable 95th percentile response time in milliseconds
  max95thPercentileResponseTime: 500,
  // Maximum acceptable time for concurrent requests in milliseconds
  maxConcurrentRequestTime: 1000,
  // Maximum acceptable time for individual requests in milliseconds
  maxIndividualRequestTime: 100,
};

// Helper function to calculate statistics
const calculateStats = (responseTimes: number[]) => {
  const sortedTimes = [...responseTimes].sort((a, b) => a - b);
  const sum = sortedTimes.reduce((acc, time) => acc + time, 0);
  const avg = sum / sortedTimes.length;
  const min = sortedTimes[0];
  const max = sortedTimes[sortedTimes.length - 1];
  const median = sortedTimes[Math.floor(sortedTimes.length / 2)];
  const percentile95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];

  return {
    avg,
    min,
    max,
    median,
    percentile95,
  };
};

// Helper function to run performance test for an endpoint
const runPerformanceTest = async (
  method: 'get' | 'post' | 'put' | 'delete',
  endpoint: string,
  token?: string,
  body?: any
) => {
  const responseTimes: number[] = [];

  for (let i = 0; i < PERFORMANCE_CONFIG.requestCount; i++) {
    const startTime = Date.now();

    let req = request(app)[method](endpoint);

    if (token) {
      req = req.set('Authorization', `Bearer ${token}`);
    }

    if (body && (method === 'post' || method === 'put')) {
      req = req.send(body);
    }

    await req;

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    responseTimes.push(responseTime);
  }

  return calculateStats(responseTimes);
};

describe('API Performance Tests', () => {
  let testUser: any;
  let authToken: string;
  let projectId: string;
  let imageId: string;

  beforeAll(async () => {
    // Create test user
    testUser = await createTestUser();
    // Get auth token
    const response = await request(app).post('/api/auth/login').send({
      email: testUser.email,
      password: 'testpassword',
    });
    authToken = response.body.token;

    // Create test project
    const project = await createTestProject(testUser.id);
    projectId = project.id;

    // Create test image
    const image = await createTestImage(projectId);
    imageId = image.id;
  });

  afterAll(async () => {
    // Clean up
    await deleteTestUser(testUser.id);
    await pool.end();
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const startTime = Date.now();

      // Make 10 concurrent requests
      const requests = Array(10)
        .fill(0)
        .map(() => request(app).get('/api/projects').set('Authorization', `Bearer ${authToken}`));

      await Promise.all(requests);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Expect the total time to be less than the configured maximum
      expect(duration).toBeLessThan(PERFORMANCE_CONFIG.maxConcurrentRequestTime);
    });
  });

  describe('Project Endpoints Performance', () => {
    it('should handle project listing efficiently', async () => {
      const startTime = Date.now();

      await request(app).get('/api/projects').set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Expect the response time to be less than the configured maximum
      expect(duration).toBeLessThan(PERFORMANCE_CONFIG.maxIndividualRequestTime);
    });

    it('should handle project detail retrieval efficiently', async () => {
      const startTime = Date.now();

      await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Expect the response time to be less than the configured maximum
      expect(duration).toBeLessThan(PERFORMANCE_CONFIG.maxIndividualRequestTime);
    });

    it('should have acceptable performance for project listing', async () => {
      const stats = await runPerformanceTest('get', '/api/projects', authToken);

      console.log('GET /api/projects performance stats:', stats);

      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime);
    });

    it('should have acceptable performance for project detail retrieval', async () => {
      const stats = await runPerformanceTest('get', `/api/projects/${projectId}`, authToken);

      console.log(`GET /api/projects/${projectId} performance stats:`, stats);

      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime);
    });
  });

  describe('Image Endpoints Performance', () => {
    it('should have acceptable performance for project images listing', async () => {
      const stats = await runPerformanceTest('get', `/api/projects/${projectId}/images`, authToken);

      console.log(`GET /api/projects/${projectId}/images performance stats:`, stats);

      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime);
    });

    it('should have acceptable performance for image detail retrieval', async () => {
      const stats = await runPerformanceTest('get', `/api/images/${imageId}`, authToken);

      console.log(`GET /api/images/${imageId} performance stats:`, stats);

      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime);
    });
  });

  describe('Segmentation Endpoints Performance', () => {
    it('should have acceptable performance for segmentation retrieval', async () => {
      const stats = await runPerformanceTest(
        'get',
        `/api/images/${imageId}/segmentation`,
        authToken
      );

      console.log(`GET /api/images/${imageId}/segmentation performance stats:`, stats);

      // Segmentation retrieval might be slower due to data size
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime * 1.5);
      expect(stats.percentile95).toBeLessThan(
        PERFORMANCE_CONFIG.max95thPercentileResponseTime * 1.5
      );
    });

    it('should have acceptable performance for segmentation triggering', async () => {
      const stats = await runPerformanceTest(
        'post',
        `/api/images/${imageId}/segmentation`,
        authToken
      );

      console.log(`POST /api/images/${imageId}/segmentation performance stats:`, stats);

      // Segmentation triggering might be slower due to processing
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime * 2);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime * 2);
    });
  });

  describe('User Endpoints Performance', () => {
    it('should have acceptable performance for user profile retrieval', async () => {
      const stats = await runPerformanceTest('get', '/api/users/profile', authToken);

      console.log('GET /api/users/profile performance stats:', stats);

      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime);
    });

    it('should have acceptable performance for user statistics retrieval', async () => {
      const stats = await runPerformanceTest('get', '/api/users/me/statistics', authToken);

      console.log('GET /api/users/me/statistics performance stats:', stats);

      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime);
    });
  });

  describe('Authentication Endpoints Performance', () => {
    it('should have acceptable performance for login', async () => {
      const stats = await runPerformanceTest('post', '/api/auth/login', undefined, {
        email: testUser.email,
        password: 'testpassword',
      });

      console.log('POST /api/auth/login performance stats:', stats);

      // Authentication might be slower due to password hashing
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime * 2);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime * 2);
    });
  });

  describe('Status Endpoint Performance', () => {
    it('should have acceptable performance for status check', async () => {
      const stats = await runPerformanceTest('get', '/api/health');

      console.log('GET /api/health performance stats:', stats);

      // Status endpoint should be very fast
      expect(stats.avg).toBeLessThan(PERFORMANCE_CONFIG.maxAvgResponseTime / 2);
      expect(stats.percentile95).toBeLessThan(PERFORMANCE_CONFIG.max95thPercentileResponseTime / 2);
    });
  });
});
