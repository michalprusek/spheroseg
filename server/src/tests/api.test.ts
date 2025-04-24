import request from 'supertest';
import { app } from '../server';
import { db } from '../db';
import { createTestUser, deleteTestUser } from './testUtils';

describe('API Endpoints', () => {
  let testUser: any;
  let authToken: string;

  beforeAll(async () => {
    // Create test user
    testUser = await createTestUser();
    // Get auth token
    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'testpassword'
      });
    authToken = response.body.token;
  });

  afterAll(async () => {
    // Clean up test user
    await deleteTestUser(testUser.id);
    // Close database connection
    await db.end();
  });

  describe('Authentication', () => {
    test('POST /api/auth/login - should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'testpassword'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe(testUser.email);
    });

    test('POST /api/auth/login - should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Projects', () => {
    let projectId: string;

    test('POST /api/projects - should create a new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Project',
          description: 'Test Description'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Project');
      projectId = response.body.id;
    });

    test('GET /api/projects - should list user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0]).toHaveProperty('id');
      expect(response.body[0]).toHaveProperty('name');
    });

    test('GET /api/projects/:id - should get project details', async () => {
      const response = await request(app)
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(projectId);
      expect(response.body.name).toBe('Test Project');
    });

    test('DELETE /api/projects/:id - should delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Images', () => {
    let projectId: string;
    let imageId: string;

    beforeAll(async () => {
      // Create a project for testing images
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Image Test Project',
          description: 'Test Description'
        });
      projectId = response.body.id;
    });

    afterAll(async () => {
      // Clean up project
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('POST /api/images - should upload an image', async () => {
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', 'test_image.png')
        .field('projectId', projectId);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('url');
      imageId = response.body.id;
    });

    test('GET /api/images/:id - should get image details', async () => {
      const response = await request(app)
        .get(`/api/images/${imageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(imageId);
      expect(response.body).toHaveProperty('url');
    });

    test('DELETE /api/images/:id - should delete image', async () => {
      const response = await request(app)
        .delete(`/api/images/${imageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Segmentation', () => {
    let projectId: string;
    let imageId: string;

    beforeAll(async () => {
      // Create a project and upload an image for testing segmentation
      const projectResponse = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Segmentation Test Project',
          description: 'Test Description'
        });
      projectId = projectResponse.body.id;

      const imageResponse = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', 'test_image.png')
        .field('projectId', projectId);
      imageId = imageResponse.body.id;
    });

    afterAll(async () => {
      // Clean up
      await request(app)
        .delete(`/api/images/${imageId}`)
        .set('Authorization', `Bearer ${authToken}`);
      await request(app)
        .delete(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${authToken}`);
    });

    test('POST /api/segmentation - should perform segmentation', async () => {
      const response = await request(app)
        .post('/api/segmentation')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          imageId: imageId,
          projectId: projectId
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success');
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('polygons');
      expect(Array.isArray(response.body.polygons)).toBe(true);
    });

    test('GET /api/segmentation/:id - should get segmentation results', async () => {
      const response = await request(app)
        .get(`/api/segmentation/${imageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('polygons');
      expect(Array.isArray(response.body.polygons)).toBe(true);
    });
  });
});