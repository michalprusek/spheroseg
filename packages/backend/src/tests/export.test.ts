import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';
import { app } from '../server';
import pool from '../db';
import { createTestUser, deleteTestUser, createTestProject, createTestImage } from './testUtils';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';

// Mock the metricsService
jest.mock('../services/metricsService', () => ({
  calculateMetrics: jest.fn().mockReturnValue({
    area: 100,
    perimeter: 40,
    circularity: 0.8,
    equivalentDiameter: 11.28,
    aspectRatio: 1.2,
    solidity: 0.9,
    convexity: 0.95,
    compactness: 0.8,
    sphericity: 0.9,
  }),
  calculatePolygonArea: jest.fn().mockReturnValue(100),
  calculatePerimeter: jest.fn().mockReturnValue(40),
  calculateBoundingBox: jest.fn().mockReturnValue({ x: 0, y: 0, width: 10, height: 10 }),
  calculateConvexHull: jest.fn().mockImplementation((points) => points),
}));

describe('Export API Tests', () => {
  let testUser: any;
  let authToken: string;
  let projectId: string;
  let imageId: string;
  let testImagePath: string;

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

    // Create a test image file
    testImagePath = path.join(__dirname, 'test-image.jpg');
    fs.writeFileSync(testImagePath, Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));

    // Upload the test image
    const imageResponse = await request(app)
      .post(`/api/projects/${projectId}/images`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('image', testImagePath);

    imageId = imageResponse.body.id;

    // Create a test segmentation result
    await pool.query(
      'INSERT INTO segmentation_results (id, image_id, user_id, status, polygons, metrics) VALUES ($1, $2, $3, $4, $5, $6)',
      [
        'test-segmentation-id',
        imageId,
        testUser.id,
        'completed',
        {
          polygons: [
            {
              type: 'external',
              points: [
                { x: 10, y: 10 },
                { x: 20, y: 10 },
                { x: 20, y: 20 },
                { x: 10, y: 20 },
              ],
            },
            {
              type: 'internal',
              points: [
                { x: 12, y: 12 },
                { x: 18, y: 12 },
                { x: 18, y: 18 },
                { x: 12, y: 18 },
              ],
            },
          ],
        },
        {
          area: 100,
          perimeter: 40,
          circularity: 0.8,
          objectCount: 1,
        },
      ],
    );
  });

  afterAll(async () => {
    // Clean up
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await deleteTestUser(testUser.id);
    await pool.end();
  });

  it('should export project data in JSON format', async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}/export`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        includeMetadata: 'true',
        includeSegmentation: 'true',
        includeMetrics: 'true',
        format: 'json',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('project');
    expect(response.body.project).toHaveProperty('id', projectId);
    expect(response.body).toHaveProperty('images');
    expect(response.body.images).toHaveLength(1);
    expect(response.body.images[0]).toHaveProperty('id', imageId);
    expect(response.body.images[0]).toHaveProperty('segmentation');
    expect(response.body.images[0].segmentation).toHaveProperty('polygons');
    expect(response.body.images[0]).toHaveProperty('metrics');
  });

  it('should export project data in COCO format', async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}/export`)
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        includeMetadata: 'true',
        includeSegmentation: 'true',
        includeMetrics: 'true',
        format: 'coco',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('info');
    expect(response.body).toHaveProperty('images');
    expect(response.body).toHaveProperty('annotations');
    expect(response.body).toHaveProperty('categories');
    expect(response.body.images).toHaveLength(1);
    expect(response.body.annotations).toHaveLength(2); // One external, one internal polygon
    expect(response.body.categories).toHaveLength(2); // 'spheroid' and 'hole' categories
  });

  it('should export project metrics as Excel', async () => {
    const response = await request(app)
      .get(`/api/projects/${projectId}/export/metrics`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toMatch(
      /application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/,
    );
    expect(response.header['content-disposition']).toMatch(/attachment; filename=/);
  });

  it('should export selected images as ZIP', async () => {
    const response = await request(app)
      .post('/api/export/images')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        imageIds: [imageId],
        includeMetadata: true,
        includeSegmentation: true,
        includeMetrics: true,
        includeImages: true,
        format: 'json',
      });

    expect(response.status).toBe(200);
    expect(response.header['content-type']).toBe('application/zip');
    expect(response.header['content-disposition']).toMatch(/attachment; filename=/);

    // Verify ZIP content
    const zip = await JSZip.loadAsync(response.body);
    const files = Object.keys(zip.files);

    // Check if ZIP contains expected folders and files
    expect(files.some((file) => file.includes('metadata.json'))).toBe(true);
    expect(files.some((file) => file.includes('segmentations/'))).toBe(true);
    expect(files.some((file) => file.includes('metrics.xlsx'))).toBe(true);
    expect(files.some((file) => file.includes('visualizations/'))).toBe(true);
  });

  it('should return 404 if project does not exist', async () => {
    const response = await request(app)
      .get('/api/projects/00000000-0000-0000-0000-000000000000/export')
      .set('Authorization', `Bearer ${authToken}`)
      .query({
        includeMetadata: 'true',
        includeSegmentation: 'true',
        includeMetrics: 'true',
        format: 'json',
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Project not found or access denied');
  });

  it('should return 401 if not authenticated', async () => {
    const response = await request(app).get(`/api/projects/${projectId}/export`).query({
      includeMetadata: 'true',
      includeSegmentation: 'true',
      includeMetrics: 'true',
      format: 'json',
    });

    expect(response.status).toBe(401);
  });
});
