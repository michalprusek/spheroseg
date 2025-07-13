import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import app from '../../app';
import pool from '../../config/database';
import { generateToken } from '../../utils/auth';
import fs from 'fs/promises';
import path from 'path';

describe('API Endpoints Integration Tests', () => {
  let authToken: string;
  let testUserId: string;
  let testProjectId: string;
  let testImageId: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       RETURNING id`,
      ['test@example.com', 'hashed_password', 'Test User']
    );
    testUserId = userResult.rows[0].id;
    authToken = generateToken({ id: testUserId, email: 'test@example.com' });
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.end();
  });

  describe('Auth Endpoints', () => {
    it('POST /api/auth/register - should register new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'newuser@example.com',
          password: 'SecurePass123!',
          name: 'New User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe('newuser@example.com');

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', ['newuser@example.com']);
    });

    it('POST /api/auth/login - should login existing user', async () => {
      // First create a user with known password
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'TestPass123!',
          name: 'Login User',
        });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'TestPass123!',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.headers['set-cookie']).toBeDefined();

      // Cleanup
      await pool.query('DELETE FROM users WHERE email = $1', ['login@example.com']);
    });

    it('POST /api/auth/logout - should logout user', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Logged out successfully');
    });

    it('GET /api/auth/me - should return current user', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user.id).toBe(testUserId);
      expect(response.body.user.email).toBe('test@example.com');
    });
  });

  describe('Project Endpoints', () => {
    beforeEach(async () => {
      // Create test project
      const projectResult = await pool.query(
        `INSERT INTO projects (name, description, user_id, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        ['Test Project', 'Test Description', testUserId]
      );
      testProjectId = projectResult.rows[0].id;
    });

    afterEach(async () => {
      // Cleanup
      if (testProjectId) {
        await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
      }
    });

    it('GET /api/projects - should list user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.projects).toBeInstanceOf(Array);
      expect(response.body.projects.length).toBeGreaterThan(0);
      expect(response.body.projects[0].name).toBe('Test Project');
    });

    it('POST /api/projects - should create new project', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'New Project',
          description: 'New project description',
        });

      expect(response.status).toBe(201);
      expect(response.body.project.name).toBe('New Project');
      expect(response.body.project.user_id).toBe(testUserId);

      // Cleanup
      await pool.query('DELETE FROM projects WHERE id = $1', [response.body.project.id]);
    });

    it('GET /api/projects/:id - should get project details', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.project.id).toBe(testProjectId);
      expect(response.body.project.name).toBe('Test Project');
    });

    it('PUT /api/projects/:id - should update project', async () => {
      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Project',
          description: 'Updated description',
        });

      expect(response.status).toBe(200);
      expect(response.body.project.name).toBe('Updated Project');
      expect(response.body.project.description).toBe('Updated description');
    });

    it('DELETE /api/projects/:id - should delete project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Project deleted successfully');

      // Verify deletion
      const checkResult = await pool.query(
        'SELECT id FROM projects WHERE id = $1',
        [testProjectId]
      );
      expect(checkResult.rows.length).toBe(0);

      // Prevent cleanup error
      testProjectId = null;
    });
  });

  describe('Image Endpoints', () => {
    beforeEach(async () => {
      // Create test project and image
      const projectResult = await pool.query(
        `INSERT INTO projects (name, description, user_id, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        ['Image Test Project', 'Test Description', testUserId]
      );
      testProjectId = projectResult.rows[0].id;

      const imageResult = await pool.query(
        `INSERT INTO images (filename, filepath, project_id, user_id, width, height, filesize, segmentation_status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        ['test.jpg', 'images/test.jpg', testProjectId, testUserId, 1920, 1080, 1024000, 'without_segmentation']
      );
      testImageId = imageResult.rows[0].id;
    });

    afterEach(async () => {
      // Cleanup
      if (testImageId) {
        await pool.query('DELETE FROM images WHERE id = $1', [testImageId]);
      }
      if (testProjectId) {
        await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
      }
    });

    it('GET /api/projects/:id/images - should list project images', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.images).toBeInstanceOf(Array);
      expect(response.body.images.length).toBe(1);
      expect(response.body.images[0].filename).toBe('test.jpg');
    });

    it('POST /api/projects/:id/images/upload - should upload image', async () => {
      // Create a test image file
      const testImagePath = path.join(__dirname, 'test-upload.jpg');
      await fs.writeFile(testImagePath, Buffer.from('fake-image-data'));

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/images/upload`)
        .set('Authorization', `Bearer ${authToken}`)
        .attach('images', testImagePath);

      expect(response.status).toBe(201);
      expect(response.body.images).toBeInstanceOf(Array);
      expect(response.body.images.length).toBeGreaterThan(0);

      // Cleanup
      await fs.unlink(testImagePath);
      for (const image of response.body.images) {
        await pool.query('DELETE FROM images WHERE id = $1', [image.id]);
      }
    });

    it('GET /api/images/:id - should get image details', async () => {
      const response = await request(app)
        .get(`/api/images/${testImageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.image.id).toBe(testImageId);
      expect(response.body.image.filename).toBe('test.jpg');
    });

    it('DELETE /api/images/:id - should delete image', async () => {
      const response = await request(app)
        .delete(`/api/images/${testImageId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Image deleted successfully');

      // Verify deletion
      const checkResult = await pool.query(
        'SELECT id FROM images WHERE id = $1',
        [testImageId]
      );
      expect(checkResult.rows.length).toBe(0);

      // Prevent cleanup error
      testImageId = null;
    });
  });

  describe('Segmentation Endpoints', () => {
    beforeEach(async () => {
      // Create test project and image
      const projectResult = await pool.query(
        `INSERT INTO projects (name, description, user_id, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        ['Segmentation Test Project', 'Test Description', testUserId]
      );
      testProjectId = projectResult.rows[0].id;

      const imageResult = await pool.query(
        `INSERT INTO images (filename, filepath, project_id, user_id, width, height, filesize, segmentation_status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        ['seg-test.jpg', 'images/seg-test.jpg', testProjectId, testUserId, 1920, 1080, 1024000, 'without_segmentation']
      );
      testImageId = imageResult.rows[0].id;
    });

    afterEach(async () => {
      // Cleanup
      await pool.query('DELETE FROM segmentation_results WHERE image_id = $1', [testImageId]);
      await pool.query('DELETE FROM images WHERE id = $1', [testImageId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    });

    it('POST /api/images/:id/segment - should queue image for segmentation', async () => {
      const response = await request(app)
        .post(`/api/images/${testImageId}/segment`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('queued for segmentation');
      expect(response.body.taskId).toBeDefined();

      // Verify queue entry
      const queueResult = await pool.query(
        'SELECT status FROM segmentation_queue WHERE image_id = $1',
        [testImageId]
      );
      expect(queueResult.rows[0].status).toBe('queued');
    });

    it('GET /api/images/:id/segmentation - should get segmentation results', async () => {
      // Create mock segmentation result
      await pool.query(
        `INSERT INTO segmentation_results (image_id, polygons, created_at) 
         VALUES ($1, $2, NOW())`,
        [testImageId, JSON.stringify([
          { id: '1', points: [[0, 0], [100, 0], [100, 100], [0, 100]], label: 'Cell 1' }
        ])]
      );

      const response = await request(app)
        .get(`/api/images/${testImageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.segmentation).toBeDefined();
      expect(response.body.segmentation.polygons).toBeInstanceOf(Array);
      expect(response.body.segmentation.polygons[0].label).toBe('Cell 1');
    });

    it('PUT /api/images/:id/segmentation - should update segmentation results', async () => {
      const newPolygons = [
        { id: '1', points: [[0, 0], [200, 0], [200, 200], [0, 200]], label: 'Updated Cell' },
        { id: '2', points: [[300, 300], [400, 300], [400, 400], [300, 400]], label: 'New Cell' }
      ];

      const response = await request(app)
        .put(`/api/images/${testImageId}/segmentation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ polygons: newPolygons });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Segmentation updated successfully');

      // Verify update
      const result = await pool.query(
        'SELECT polygons FROM segmentation_results WHERE image_id = $1',
        [testImageId]
      );
      const savedPolygons = JSON.parse(result.rows[0].polygons);
      expect(savedPolygons.length).toBe(2);
      expect(savedPolygons[0].label).toBe('Updated Cell');
    });
  });

  describe('Export Endpoints', () => {
    beforeEach(async () => {
      // Create test data
      const projectResult = await pool.query(
        `INSERT INTO projects (name, description, user_id, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        ['Export Test Project', 'Test Description', testUserId]
      );
      testProjectId = projectResult.rows[0].id;

      const imageResult = await pool.query(
        `INSERT INTO images (filename, filepath, project_id, user_id, width, height, filesize, segmentation_status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING id`,
        ['export-test.jpg', 'images/export-test.jpg', testProjectId, testUserId, 1920, 1080, 1024000, 'completed']
      );
      testImageId = imageResult.rows[0].id;

      // Add segmentation results
      await pool.query(
        `INSERT INTO segmentation_results (image_id, polygons, created_at) 
         VALUES ($1, $2, NOW())`,
        [testImageId, JSON.stringify([
          { id: '1', points: [[0, 0], [100, 0], [100, 100], [0, 100]], label: 'Cell 1' }
        ])]
      );
    });

    afterEach(async () => {
      await pool.query('DELETE FROM segmentation_results WHERE image_id = $1', [testImageId]);
      await pool.query('DELETE FROM images WHERE id = $1', [testImageId]);
      await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    });

    it('POST /api/projects/:id/export - should export project data', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'COCO',
          includeMetadata: true,
          includeImages: false,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/zip');
      expect(response.headers['content-disposition']).toContain('attachment');
    });

    it('POST /api/images/:id/export - should export single image data', async () => {
      const response = await request(app)
        .post(`/api/images/${testImageId}/export`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'JSON',
          includeMetrics: true,
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.body).toHaveProperty('image');
      expect(response.body).toHaveProperty('segmentation');
      expect(response.body).toHaveProperty('metrics');
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should return 401 for unauthorized requests', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(401);
      expect(response.body.message).toContain('Authentication required');
    });

    it('should return 403 for forbidden resources', async () => {
      // Create another user's project
      const otherUserResult = await pool.query(
        `INSERT INTO users (email, password_hash, name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        ['other@example.com', 'hashed_password', 'Other User']
      );
      const otherUserId = otherUserResult.rows[0].id;

      const projectResult = await pool.query(
        `INSERT INTO projects (name, description, user_id, created_at) 
         VALUES ($1, $2, $3, NOW()) 
         RETURNING id`,
        ['Other User Project', 'Test Description', otherUserId]
      );
      const otherProjectId = projectResult.rows[0].id;

      // Try to access other user's project
      const response = await request(app)
        .get(`/api/projects/${otherProjectId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);

      // Cleanup
      await pool.query('DELETE FROM projects WHERE id = $1', [otherProjectId]);
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });

    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required 'name' field
          description: 'Test Description',
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      // Make multiple requests quickly
      const requests = [];
      for (let i = 0; i < 150; i++) {
        requests.push(
          request(app)
            .get('/api/projects')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);

      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.message).toContain('Too many requests');
    });
  });
});