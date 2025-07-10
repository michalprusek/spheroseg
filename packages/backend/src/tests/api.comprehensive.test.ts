import request from 'supertest';
import { app } from '../server';
import pool from '../db';
import { createTestUser, deleteTestUser, createTestProject, createTestImage } from './testUtils';
import path from 'path';
import fs from 'fs';

describe('Comprehensive API Tests', () => {
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
  });

  afterAll(async () => {
    // Clean up
    await deleteTestUser(testUser.id);
    await pool.closePool();
  });

  describe('Authentication Endpoints', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'testpassword',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    it('should not login with invalid credentials', async () => {
      const response = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: 'wrongpassword',
      });

      expect(response.status).toBe(401);
    });

    it('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email');
      expect(response.body.email).toBe(testUser.email);
    });

    it('should not get user profile with invalid token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('Project Endpoints', () => {
    it('should get all projects for the user', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });

    it('should get a specific project by ID', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body.id).toBe(projectId);
    });

    it('should create a new project', async () => {
      const newProject = {
        name: 'New Test Project',
        description: 'This is a new test project',
      };

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newProject);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body.name).toBe(newProject.name);
      expect(response.body.description).toBe(newProject.description);

      // Clean up - delete the created project
      await request(app)
        .delete(`/api/projects/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should update a project', async () => {
      const updatedProject = {
        name: 'Updated Test Project',
        description: 'This is an updated test project',
      };

      const response = await request(app)
        .put(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updatedProject);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body.name).toBe(updatedProject.name);
      expect(response.body.description).toBe(updatedProject.description);
    });
  });

  describe('Image Endpoints', () => {
    it('should upload an image to a project', async () => {
      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-image.jpg');
      fs.writeFileSync(
        testImagePath,
        Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
      );

      const response = await request(app)
        .post(`/api/projects/${projectId}/images`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', testImagePath);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('url');

      // Save the image ID for later tests
      imageId = response.body.id;

      // Clean up the test image file
      fs.unlinkSync(testImagePath);
    });

    it('should get all images for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}/images`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
      expect(response.body[0]).toHaveProperty('url');
    });

    it('should get a specific image by ID', async () => {
      const response = await request(app)
        .get(`/api/images/${imageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('url');
      expect(response.body.id).toBe(imageId);
    });

    it('should delete an image', async () => {
      // First, create a new test image
      const testImage = await createTestImage(projectId);

      const response = await request(app)
        .delete(`/api/images/${testImage.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('deleted');
    });
  });

  describe('Segmentation Endpoints', () => {
    it('should trigger segmentation for an image', async () => {
      const response = await request(app)
        .post(`/api/images/${imageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('queued');
    });

    it('should get segmentation status for an image', async () => {
      const response = await request(app)
        .get(`/api/images/${imageId}/segmentation/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      // Status could be 'pending', 'processing', 'completed', or 'failed'
      expect(['none', 'pending', 'processing', 'completed', 'failed']).toContain(
        response.body.status
      );
    });

    // Note: We can't reliably test getting segmentation results as they might not be ready yet
    // This would require mocking the segmentation service or waiting for the segmentation to complete
  });

  describe('Export Endpoints', () => {
    it('should export images in COCO format', async () => {
      const response = await request(app)
        .post('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageIds: [imageId],
          format: 'COCO',
        });

      // The export might not be ready immediately, so we just check if the request was accepted
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Export started');
    });

    it('should get export status', async () => {
      // First, start an export
      const exportResponse = await request(app)
        .post('/api/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageIds: [imageId],
          format: 'COCO',
        });

      // Get the export ID from the response
      const exportId = exportResponse.body.exportId;

      const response = await request(app)
        .get(`/api/export/${exportId}/status`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      // Status could be 'pending', 'processing', 'completed', or 'failed'
      expect(['pending', 'processing', 'completed', 'failed']).toContain(response.body.status);
    });
  });

  describe('User Statistics Endpoints', () => {
    it('should get user statistics', async () => {
      const response = await request(app)
        .get('/api/users/me/statistics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('projectsCount');
      expect(response.body).toHaveProperty('imagesCount');
      expect(response.body).toHaveProperty('segmentedImagesCount');
    });
  });

  describe('Health Check Endpoint', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(response.body.status).toBe('ok');
    });
  });
});
