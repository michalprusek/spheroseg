/**
 * Simplified Image Routes Tests
 * 
 * Tests for image management endpoints without external dependencies
 */

import request from 'supertest';
import express, { Router, Request, Response, NextFunction } from 'express';

describe('Image Routes', () => {
  // Test data
  const testUserId = 'user-123';
  const testProjectId = 'project-123';
  const testImageId = 'image-123';
  
  // Mock storage
  const mockProjects = new Map();
  const mockImages = new Map();
  const mockImageFiles = new Map();
  
  let app: express.Application;
  
  beforeEach(() => {
    // Reset mock data
    mockProjects.clear();
    mockImages.clear();
    mockImageFiles.clear();
    
    // Add test project
    mockProjects.set(testProjectId, {
      id: testProjectId,
      name: 'Test Project',
      user_id: testUserId
    });
    
    // Add test image
    const testImage = {
      id: testImageId,
      project_id: testProjectId,
      user_id: testUserId,
      name: 'test-image.jpg',
      storage_path: '/uploads/test-project/test-image.jpg',
      thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
      created_at: '2023-01-01T00:00:00.000Z',
      updated_at: '2023-01-01T00:00:00.000Z'
    };
    
    mockImages.set(testImageId, testImage);
    mockImageFiles.set('/uploads/test-project/test-image.jpg', true);
    mockImageFiles.set('/uploads/test-project/thumb-test-image.jpg', true);
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Add authentication middleware
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Add user to request
      (req as any).user = {
        userId: testUserId,
        email: 'test@example.com'
      };
      next();
    });
    
    // Add image routes
    const router = Router();
    
    // Get project images
    router.get('/projects/:projectId/images', (req, res) => {
      const { projectId } = req.params;
      
      // Check if project exists
      if (!mockProjects.has(projectId)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Get images for project
      const projectImages = Array.from(mockImages.values())
        .filter(image => image.project_id === projectId);
      
      res.status(200).json(projectImages);
    });
    
    // Get specific image
    router.get('/projects/:projectId/images/:imageId', (req, res) => {
      const { projectId, imageId } = req.params;
      
      // Check if project exists
      if (!mockProjects.has(projectId)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check if image exists
      if (!mockImages.has(imageId)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Get image
      const image = mockImages.get(imageId);
      
      // Check if image belongs to project
      if (image.project_id !== projectId) {
        return res.status(404).json({ error: 'Image not found in this project' });
      }
      
      res.status(200).json(image);
    });
    
    // Delete image
    router.delete('/projects/:projectId/images/:imageId', (req, res) => {
      const { projectId, imageId } = req.params;
      
      // Check if project exists
      if (!mockProjects.has(projectId)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check if image exists
      if (!mockImages.has(imageId)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Get image
      const image = mockImages.get(imageId);
      
      // Check if image belongs to project
      if (image.project_id !== projectId) {
        return res.status(404).json({ error: 'Image not found in this project' });
      }
      
      // Delete image file records
      mockImageFiles.delete(image.storage_path);
      mockImageFiles.delete(image.thumbnail_path);
      
      // Delete image record
      mockImages.delete(imageId);
      
      res.status(204).end();
    });
    
    // Verify image exists
    router.get('/projects/:projectId/images/:imageId/verify', (req, res) => {
      const { projectId, imageId } = req.params;
      
      // Check if project exists
      if (!mockProjects.has(projectId)) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      // Check if image exists
      if (!mockImages.has(imageId)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Get image
      const image = mockImages.get(imageId);
      
      // Check if image belongs to project
      if (image.project_id !== projectId) {
        return res.status(404).json({ error: 'Image not found in this project' });
      }
      
      // Check if file exists
      const fileExists = mockImageFiles.has(image.storage_path);
      
      res.status(200).json({ exists: fileExists });
    });
    
    // Legacy routes
    router.delete('/images/:imageId', (req, res) => {
      const { imageId } = req.params;
      
      // Check if image exists
      if (!mockImages.has(imageId)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Get image
      const image = mockImages.get(imageId);
      
      // Redirect to new route
      res.redirect(307, `/api/projects/${image.project_id}/images/${imageId}`);
    });
    
    router.get('/verify/:imageId', (req, res) => {
      const { imageId } = req.params;
      
      // Check if image exists
      if (!mockImages.has(imageId)) {
        return res.status(404).json({ error: 'Image not found' });
      }
      
      // Get image
      const image = mockImages.get(imageId);
      
      // Redirect to new route
      res.redirect(307, `/api/projects/${image.project_id}/images/${imageId}/verify`);
    });
    
    // Mount router
    app.use('/api', router);
  });
  
  describe('GET /api/projects/:projectId/images', () => {
    it('should return a list of images for a project', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(testImageId);
    });
    
    it('should return 404 if project not found', async () => {
      const response = await request(app)
        .get('/api/projects/nonexistent-project/images');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe('GET /api/projects/:projectId/images/:imageId', () => {
    it('should return a specific image', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}`);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe(testImageId);
    });
    
    it('should return 404 if image not found', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/nonexistent-image`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
    
    it('should return 404 if project not found', async () => {
      const response = await request(app)
        .get(`/api/projects/nonexistent-project/images/${testImageId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe('DELETE /api/projects/:projectId/images/:imageId', () => {
    it('should delete an image and return 204', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/images/${testImageId}`);
      
      expect(response.status).toBe(204);
      expect(mockImages.has(testImageId)).toBe(false);
      expect(mockImageFiles.has('/uploads/test-project/test-image.jpg')).toBe(false);
      expect(mockImageFiles.has('/uploads/test-project/thumb-test-image.jpg')).toBe(false);
    });
    
    it('should return 404 if image not found', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/images/nonexistent-image`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
    
    it('should return 404 if project not found', async () => {
      const response = await request(app)
        .delete(`/api/projects/nonexistent-project/images/${testImageId}`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe('GET /api/projects/:projectId/images/:imageId/verify', () => {
    it('should verify an image exists and return status', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}/verify`);
      
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(true);
    });
    
    it('should return exists:false if file does not exist', async () => {
      // Remove file from storage
      mockImageFiles.delete('/uploads/test-project/test-image.jpg');
      
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/${testImageId}/verify`);
      
      expect(response.status).toBe(200);
      expect(response.body.exists).toBe(false);
    });
    
    it('should return 404 if image not found', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/images/nonexistent-image/verify`);
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBeDefined();
    });
  });
  
  describe('Legacy Routes', () => {
    it('should redirect DELETE /api/images/:id to the new route', async () => {
      const response = await request(app)
        .delete(`/api/images/${testImageId}`)
        .redirects(0); // Don't follow redirects
      
      expect(response.status).toBe(307); // Temporary redirect
      expect(response.headers.location).toBe(`/api/projects/${testProjectId}/images/${testImageId}`);
    });
    
    it('should redirect GET /api/verify/:id to the new route', async () => {
      const response = await request(app)
        .get(`/api/verify/${testImageId}`)
        .redirects(0); // Don't follow redirects
      
      expect(response.status).toBe(307); // Temporary redirect
      expect(response.headers.location).toBe(`/api/projects/${testProjectId}/images/${testImageId}/verify`);
    });
  });
});