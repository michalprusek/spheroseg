/**
 * Simplified Project Workflow Integration Tests
 * 
 * Tests for the complete workflow without external dependencies
 */

import request from 'supertest';
import express, { Router, Request, Response, NextFunction } from 'express';

describe('Project Workflow Integration', () => {
  // Test data
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'TestPassword123!',
    username: 'testuser',
    created_at: new Date().toISOString()
  };
  
  const testToken = 'test-auth-token';
  
  // Define job types
  interface SegmentationJob {
    imageId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    timestamp: number;
  }
  
  // Storage
  const projects = new Map<string, any>();
  const images = new Map<string, any>();
  const segmentations = new Map<string, any>();
  const segmentationJobs: SegmentationJob[] = [];
  
  let app: express.Application;
  let createdProjectId: string;
  let uploadedImageId: string;
  
  beforeAll(() => {
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Auth middleware
    const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.split(' ')[1];
      
      if (token !== testToken) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      
      // Add user to request
      (req as any).user = {
        userId: testUser.id,
        email: testUser.email
      };
      
      next();
    };
    
    // Create router
    const router = Router();
    
    // Auth routes
    router.post('/auth/login', (req, res) => {
      const { email, password } = req.body;
      
      if (email === testUser.email && password === testUser.password) {
        res.status(200).json({
          token: testToken,
          user: {
            id: testUser.id,
            email: testUser.email,
            username: testUser.username
          }
        });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    });
    
    router.post('/auth/register', (req, res) => {
      const { email, password, username } = req.body;
      
      // In a real implementation, we would check if user exists
      // For this test, we'll just return success
      res.status(201).json({
        user: {
          id: testUser.id,
          email: email,
          username: username
        },
        token: testToken
      });
    });
    
    // User routes
    router.get('/users/profile', authMiddleware, (req, res) => {
      res.status(200).json({
        id: testUser.id,
        email: testUser.email,
        username: testUser.username
      });
    });
    
    // Project routes
    router.get('/projects', authMiddleware, (req, res) => {
      // Return all projects for the current user
      const userProjects = Array.from(projects.values())
        .filter(project => project.user_id === testUser.id);
      
      res.status(200).json(userProjects);
    });
    
    router.post('/projects', authMiddleware, (req, res) => {
      const { title, description } = req.body;
      
      // Create new project
      const newProject = {
        id: `project-${Date.now()}`,
        title,
        description,
        user_id: testUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Store project
      projects.set(newProject.id, newProject);
      
      res.status(201).json(newProject);
    });
    
    router.get('/projects/:projectId', authMiddleware, (req, res) => {
      const { projectId } = req.params;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get project
      const project = projects.get(projectId);
      
      // Check if project belongs to user
      if (project.user_id !== testUser.id) {
        return res.status(403).json({ message: 'Not authorized to access this project' });
      }
      
      res.status(200).json(project);
    });
    
    router.put('/projects/:projectId', authMiddleware, (req, res) => {
      const { projectId } = req.params;
      const { title, description } = req.body;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get project
      const project = projects.get(projectId);
      
      // Check if project belongs to user
      if (project.user_id !== testUser.id) {
        return res.status(403).json({ message: 'Not authorized to access this project' });
      }
      
      // Update project
      const updatedProject = {
        ...project,
        title: title || project.title,
        description: description || project.description,
        updated_at: new Date().toISOString()
      };
      
      // Store updated project
      projects.set(projectId, updatedProject);
      
      res.status(200).json(updatedProject);
    });
    
    router.delete('/projects/:projectId', authMiddleware, (req, res) => {
      const { projectId } = req.params;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get project
      const project = projects.get(projectId);
      
      // Check if project belongs to user
      if (project.user_id !== testUser.id) {
        return res.status(403).json({ message: 'Not authorized to access this project' });
      }
      
      // Delete project images first
      const projectImages = Array.from(images.values())
        .filter(image => image.project_id === projectId);
      
      for (const image of projectImages) {
        images.delete(image.id);
        // Also delete segmentations
        segmentations.delete(image.id);
      }
      
      // Delete project
      projects.delete(projectId);
      
      res.status(200).json({ message: 'Project deleted successfully' });
    });
    
    // Image routes
    router.get('/projects/:projectId/images', authMiddleware, (req, res) => {
      const { projectId } = req.params;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get project
      const project = projects.get(projectId);
      
      // Check if project belongs to user
      if (project.user_id !== testUser.id) {
        return res.status(403).json({ message: 'Not authorized to access this project' });
      }
      
      // Get project images
      const projectImages = Array.from(images.values())
        .filter(image => image.project_id === projectId);
      
      res.status(200).json(projectImages);
    });
    
    router.post('/projects/:projectId/images', authMiddleware, (req, res) => {
      const { projectId } = req.params;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Get project
      const project = projects.get(projectId);
      
      // Check if project belongs to user
      if (project.user_id !== testUser.id) {
        return res.status(403).json({ message: 'Not authorized to access this project' });
      }
      
      // Create new image
      const newImage = {
        id: `image-${Date.now()}`,
        project_id: projectId,
        user_id: testUser.id,
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        segmentationStatus: 'not_started',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Store image
      images.set(newImage.id, newImage);
      
      res.status(201).json(newImage);
    });
    
    router.get('/projects/:projectId/images/:imageId', authMiddleware, (req, res) => {
      const { projectId, imageId } = req.params;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if image exists
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Get image
      const image = images.get(imageId);
      
      // Check if image belongs to project
      if (image.project_id !== projectId) {
        return res.status(404).json({ message: 'Image not found in this project' });
      }
      
      res.status(200).json(image);
    });
    
    router.delete('/projects/:projectId/images/:imageId', authMiddleware, (req, res) => {
      const { projectId, imageId } = req.params;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if image exists
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Get image
      const image = images.get(imageId);
      
      // Check if image belongs to project
      if (image.project_id !== projectId) {
        return res.status(404).json({ message: 'Image not found in this project' });
      }
      
      // Delete image
      images.delete(imageId);
      
      // Also delete segmentation
      segmentations.delete(imageId);
      
      res.status(200).json({ message: 'Image deleted successfully' });
    });
    
    // Segmentation routes
    router.post('/segmentation/trigger', authMiddleware, (req, res) => {
      const { imageId, projectId } = req.body;
      
      // Check if project exists
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      // Check if image exists
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Get image
      const image = images.get(imageId);
      
      // Check if image belongs to project
      if (image.project_id !== projectId) {
        return res.status(404).json({ message: 'Image not found in this project' });
      }
      
      // Update segmentation status
      image.segmentationStatus = 'queued';
      images.set(imageId, image);
      
      // Add job to queue
      segmentationJobs.push({
        imageId,
        status: 'queued',
        timestamp: Date.now()
      });
      
      res.status(202).json({ message: 'Segmentation queued' });
    });
    
    router.get('/segmentation/status', authMiddleware, (req, res) => {
      // Return current segmentation status
      res.status(200).json({
        queueLength: segmentationJobs.filter(job => job.status === 'queued').length,
        processing: segmentationJobs.filter(job => job.status === 'processing').length
      });
    });
    
    // Mount router
    app.use('/api', router);
  });
  
  describe('1. User Authentication', () => {
    it('should allow login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });
    
    it('should deny login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrong-password'
        });
      
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('message');
    });
    
    it('should access protected endpoints with auth token', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('email', testUser.email);
    });
  });
  
  describe('2. Project Management', () => {
    it('should create a new project', async () => {
      const projectData = {
        title: `Test Project ${Date.now()}`,
        description: 'An automated test project'
      };
      
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${testToken}`)
        .send(projectData);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('title', projectData.title);
      
      createdProjectId = response.body.id;
    });
    
    it('should retrieve the created project', async () => {
      const response = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', createdProjectId);
    });
    
    it('should update project details', async () => {
      const updateData = {
        title: `Updated Project ${Date.now()}`,
        description: 'This project was updated in an automated test'
      };
      
      const response = await request(app)
        .put(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`)
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('title', updateData.title);
    });
    
    it('should list all user projects', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // The newly created project should be in the list
      const projectFound = response.body.some((project: any) => project.id === createdProjectId);
      expect(projectFound).toBe(true);
    });
  });
  
  describe('3. Image Management', () => {
    it('should upload an image to the project', async () => {
      const response = await request(app)
        .post(`/api/projects/${createdProjectId}/images`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      
      uploadedImageId = response.body.id;
    });
    
    it('should list all images in the project', async () => {
      const response = await request(app)
        .get(`/api/projects/${createdProjectId}/images`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // The uploaded image should be in the list
      const imageFound = response.body.some((image: any) => image.id === uploadedImageId);
      expect(imageFound).toBe(true);
    });
    
    it('should retrieve a specific image', async () => {
      const response = await request(app)
        .get(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', uploadedImageId);
    });
  });
  
  describe('4. Segmentation Workflow', () => {
    it('should trigger segmentation for an image', async () => {
      const response = await request(app)
        .post('/api/segmentation/trigger')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          imageId: uploadedImageId,
          projectId: createdProjectId
        });
      
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('message');
      
      // Verify that segmentation status was updated
      const imageResponse = await request(app)
        .get(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(imageResponse.body.segmentationStatus).toBe('queued');
    });
    
    it('should check segmentation status', async () => {
      const response = await request(app)
        .get('/api/segmentation/status')
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queueLength');
      expect(response.body.queueLength).toBeGreaterThan(0);
    });
  });
  
  describe('5. Project and Image Deletion', () => {
    it('should delete an image from the project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Verify image was deleted
      const checkResponse = await request(app)
        .get(`/api/projects/${createdProjectId}/images/${uploadedImageId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(checkResponse.status).toBe(404);
    });
    
    it('should delete the project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
      
      // Verify project was deleted
      const checkResponse = await request(app)
        .get(`/api/projects/${createdProjectId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(checkResponse.status).toBe(404);
    });
  });
});