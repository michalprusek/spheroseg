import request from 'supertest';
import { app } from '../server';
import pool from '../db';
import { createTestUser, deleteTestUser, createTestProject } from './testUtils';
import path from 'path';
import fs from 'fs';

describe('Segmentation Service Tests', () => {
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
    fs.writeFileSync(
      testImagePath,
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
    );

    // Upload the test image
    const imageResponse = await request(app)
      .post(`/api/projects/${projectId}/images`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('image', testImagePath);

    imageId = imageResponse.body.id;
  });

  afterAll(async () => {
    // Clean up
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }
    await deleteTestUser(testUser.id);
    await pool.end();
  });

  it('should trigger segmentation for an image', async () => {
    const response = await request(app)
      .post(`/api/images/${imageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        parameters: {
          model_type: 'resunet',
          threshold: 0.5,
        },
      });

    expect(response.status).toBe(202);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain('queued');
  });

  it('should update segmentation status', async () => {
    // Get the image details
    await request(app).get(`/api/images/${imageId}`).set('Authorization', `Bearer ${authToken}`);

    // Mock the segmentation process
    const mockSegmentationResult = {
      polygons: [
        {
          id: `poly-${Date.now()}-1`,
          type: 'external',
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
            { x: 20, y: 20 },
            { x: 10, y: 20 },
          ],
        },
      ],
      metadata: {
        processedAt: new Date().toISOString(),
        modelType: 'resunet',
        source: 'resunet',
      },
    };

    // Update the segmentation status to 'processing'
    await request(app)
      .put(`/api/images/${imageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'processing' });

    // Get the updated status
    const statusResponse = await request(app)
      .get(`/api/images/${imageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toHaveProperty('status');
    expect(statusResponse.body.status).toBe('processing');

    // Update the segmentation status to 'completed'
    await request(app)
      .put(`/api/images/${imageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'completed' });

    // Save the segmentation result
    await request(app)
      .post(`/api/images/${imageId}/segmentation/result`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        result_data: {
          polygons: mockSegmentationResult.polygons,
          metadata: mockSegmentationResult.metadata,
        },
      });

    // Get the updated status
    const updatedStatusResponse = await request(app)
      .get(`/api/images/${imageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(updatedStatusResponse.status).toBe(200);
    expect(updatedStatusResponse.body).toHaveProperty('status');
    expect(updatedStatusResponse.body.status).toBe('completed');
  });

  it('should get segmentation result', async () => {
    // Get the segmentation result
    const response = await request(app)
      .get(`/api/images/${imageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('polygons');
    expect(Array.isArray(response.body.polygons)).toBe(true);
    expect(response.body.polygons.length).toBeGreaterThan(0);
    expect(response.body.polygons[0]).toHaveProperty('id');
    expect(response.body.polygons[0]).toHaveProperty('type');
    expect(response.body.polygons[0]).toHaveProperty('points');
    expect(response.body.polygons[0].type).toBe('external');

    // Check if metadata is present
    expect(response.body).toHaveProperty('metadata');
    expect(response.body.metadata).toHaveProperty('modelType');
    expect(response.body.metadata.modelType).toBe('resunet');
  });

  it('should calculate metrics for segmentation', async () => {
    // Get the metrics
    const response = await request(app)
      .get(`/api/images/${imageId}/metrics`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('area');
    expect(response.body).toHaveProperty('perimeter');
    expect(response.body).toHaveProperty('circularity');
    expect(response.body).toHaveProperty('objectCount');
    expect(response.body.objectCount).toBeGreaterThan(0);
  });

  it('should handle segmentation failure', async () => {
    // Create another test image
    const newImageResponse = await request(app)
      .post(`/api/projects/${projectId}/images`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('image', testImagePath);

    const newImageId = newImageResponse.body.id;

    // Trigger segmentation
    await request(app)
      .post(`/api/images/${newImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    // Update the segmentation status to 'processing'
    await request(app)
      .put(`/api/images/${newImageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'processing' });

    // Update the segmentation status to 'failed'
    await request(app)
      .put(`/api/images/${newImageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'failed', error: 'Test error message' });

    // Get the updated status
    const statusResponse = await request(app)
      .get(`/api/images/${newImageId}/segmentation/status`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(statusResponse.status).toBe(200);
    expect(statusResponse.body).toHaveProperty('status');
    expect(statusResponse.body.status).toBe('failed');
    expect(statusResponse.body).toHaveProperty('error');
    expect(statusResponse.body.error).toBe('Test error message');
  });
});
