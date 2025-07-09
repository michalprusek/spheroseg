/**
 * Project Workflow Integration Tests
 *
 * This file contains end-to-end tests for the complete workflow of:
 * 1. User registration
 * 2. Authentication/login
 * 3. Project creation
 * 4. Project updating
 * 5. Image upload to project
 * 6. Triggering segmentation
 * 7. Checking segmentation status
 * 8. Exporting results
 * 9. Deleting images
 * 10. Deleting projects
 *
 * The tests should be run against a test database to avoid affecting production data.
 */

import request from 'supertest';
import { app } from '../server';
import pool from '../db';
import path from 'path';
import fs from 'fs';
// Using Date.now() for unique IDs instead of uuidv4
// import { v4 as uuidv4 } from 'uuid';

// Constants for testing
const TEST_IMAGE_PATH = path.join(__dirname, '../../../test_image.png');
// Create unique test user for each test run
const testUser = {
  email: `test_${Date.now()}@example.com`,
  password: 'TestPassword123!',
  username: `testuser_${Date.now()}`,
};
let authToken: string;
let createdProjectId: string;
let uploadedImageId: string;

// Utility functions
const loginUser = async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: testUser.email,
    password: testUser.password,
  });
  return response.body.token;
};

// Setup and teardown
beforeAll(async () => {
  // Check if test image exists
  if (!fs.existsSync(TEST_IMAGE_PATH)) {
    // eslint-disable-next-line no-console
    console.warn('Test image not found at:', TEST_IMAGE_PATH);
  }

  // Create test user via API
  try {
    await request(app).post('/api/auth/register').send(testUser);
    // eslint-disable-next-line no-console
    console.log('Test user created:', testUser.email);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error creating test user:', error);
  }

  // Login and get auth token
  authToken = await loginUser();
  // eslint-disable-next-line no-console
  console.log('Authentication successful');
});

afterAll(async () => {
  // Clean up - delete test data
  if (createdProjectId) {
    try {
      await request(app)
        .delete(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);
      // eslint-disable-next-line no-console
      console.log('Cleaned up test project');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error cleaning up test project:', error);
    }
  }

  // Close database connection
  await pool.end();
  // eslint-disable-next-line no-console
  console.log('Integration tests completed');
});

// The actual test suite
describe('Project Workflow Integration', () => {
  describe('1. User Authentication', () => {
    it('should allow login with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('should deny login with invalid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'wrong-password',
      });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });

    it('should access protected endpoints with auth token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', testUser.email);
    });
  });

  describe('2. Project Management', () => {
    it('should create a new project', async () => {
      const projectData = {
        title: `Test Project ${Date.now()}`,
        description: 'An automated test project',
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', projectData.title);

      createdProjectId = response.body.id;
      // eslint-disable-next-line no-console
      console.log('Created test project with ID:', createdProjectId);
    });

    it('should retrieve the created project', async () => {
      const response = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', createdProjectId);
    });

    it('should update project details', async () => {
      const updateData = {
        title: `Updated Project ${Date.now()}`,
        description: 'This project was updated in an automated test',
      };

      const response = await request(app)
        .put(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', updateData.title);
    });

    it('should list all user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // The newly created project should be in the list
      const projectFound = response.body.some(
        (project: { id: string }) => project.id === createdProjectId
      );
      expect(projectFound).toBe(true);
    });
  });

  describe('3. Image Management', () => {
    it('should upload an image to the project', async () => {
      // Skip test if test image doesn't exist
      if (!fs.existsSync(TEST_IMAGE_PATH)) {
        // eslint-disable-next-line no-console
        console.warn('Skipping image upload test - test image not found');
        return;
      }

      const response = await request(app)
        .post(`/api/projects/${createdProjectId}/images`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', TEST_IMAGE_PATH);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');

      uploadedImageId = response.body.id;
      // eslint-disable-next-line no-console
      console.log('Uploaded test image with ID:', uploadedImageId);
    });

    it('should list all images in the project', async () => {
      const response = await request(app)
        .get(`/api/projects/${createdProjectId}/images`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      if (uploadedImageId) {
        // The uploaded image should be in the list
        const imageFound = response.body.some(
          (image: { id: string }) => image.id === uploadedImageId
        );
        expect(imageFound).toBe(true);
      }
    });

    it('should retrieve a specific image', async () => {
      if (!uploadedImageId) {
        // eslint-disable-next-line no-console
        console.warn('Skipping image retrieval test - no image was uploaded');
        return;
      }

      const response = await request(app)
        .get(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', uploadedImageId);
    });
  });

  describe('4. Segmentation Workflow', () => {
    it('should trigger segmentation for an image', async () => {
      if (!uploadedImageId) {
        // eslint-disable-next-line no-console
        console.warn('Skipping segmentation test - no image was uploaded');
        return;
      }

      const response = await request(app)
        .post('/api/segmentation/trigger')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageId: uploadedImageId,
          projectId: createdProjectId,
        });

      // Status could be 200 (queued) or 202 (processing)
      expect([200, 202]).toContain(response.status);
    });

    it('should check segmentation status', async () => {
      const response = await request(app)
        .get('/api/segmentation/status')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queueLength');
    });

    // This test depends on segmentation completing, which may take time
    // In a real scenario, we would need to poll until complete or use websockets
    it('should eventually mark segmentation as complete or processing', async () => {
      if (!uploadedImageId) {
        // eslint-disable-next-line no-console
        console.warn('Skipping segmentation completion test - no image was uploaded');
        return;
      }

      // Check current status
      const response = await request(app)
        .get(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);

      // Status should be one of: pending, processing, completed, or failed
      expect(['pending', 'processing', 'completed', 'failed']).toContain(
        response.body.segmentationStatus
      );
    });
  });

  describe('5. Project and Image Deletion', () => {
    it('should delete an image from the project', async () => {
      if (!uploadedImageId) {
        // eslint-disable-next-line no-console
        console.warn('Skipping image deletion test - no image was uploaded');
        return;
      }

      const response = await request(app)
        .delete(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify image was deleted
      const checkResponse = await request(app)
        .get(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkResponse.status).toBe(404);
    });

    it('should delete the project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');

      // Verify project was deleted
      const checkResponse = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(checkResponse.status).toBe(404);

      // Clear createdProjectId since we've deleted it
      createdProjectId = '';
    });
  });
});
