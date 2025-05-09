/**
 * Example Test Using Mock Helpers
 * 
 * This test demonstrates how to use the mock database, filesystem, and auth helpers
 * to create isolated, fast tests without external dependencies.
 */

import express from 'express';
import request from 'supertest';
import { Router } from 'express';
import {
  MockDatabase,
  createMockDatabase,
  createDbHelpers,
  MockFileSystem,
  createMockFileSystem,
  MockAuth,
  createMockAuthWithTestData
} from '../../test-utils';

describe('Example API with Mock Helpers', () => {
  // Test state
  let app: express.Application;
  let db: MockDatabase;
  let dbHelpers: ReturnType<typeof createDbHelpers>;
  let fs: MockFileSystem;
  let auth: MockAuth;
  
  beforeEach(() => {
    // Initialize mock database
    db = createMockDatabase();
    dbHelpers = createDbHelpers(db);
    
    // Initialize mock filesystem
    fs = createMockFileSystem();
    
    // Initialize mock auth
    auth = createMockAuthWithTestData();
    
    // Setup filesystem structure
    fs.addDirectory('/app/uploads');
    fs.addDirectory('/app/uploads/images');
    fs.addDirectory('/app/uploads/thumbnails');
    fs.addFile('/app/config.json', JSON.stringify({
      imageDirectory: '/app/uploads/images',
      thumbnailDirectory: '/app/uploads/thumbnails'
    }));
    
    // Setup test data
    const testUser = dbHelpers.createUser({
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      username: 'testuser'
    });
    
    const testProject = dbHelpers.createProject({
      id: 'test-project-id',
      name: 'Test Project',
      description: 'A test project',
      user_id: testUser.id
    });
    
    dbHelpers.createImage({
      id: 'test-image-id',
      name: 'test-image.jpg',
      project_id: testProject.id,
      user_id: testUser.id
    });
    
    // Create Express app
    app = express();
    app.use(express.json());
    
    // Create auth middleware
    const authMiddleware = auth.createAuthMiddleware();
    
    // Create router
    const router = Router();
    
    // Add GET /projects endpoint
    router.get('/projects', authMiddleware, (req, res) => {
      // Query database for projects belonging to the authenticated user
      db.query('SELECT * FROM projects WHERE user_id = $1', [(req as any).user.userId])
        .then(result => {
          res.status(200).json(result.rows);
          return; // Return void to satisfy TypeScript
        })
        .catch(err => {
          res.status(500).json({ error: err.message });
        });
    });
    
    // Add GET /projects/:id endpoint
    router.get('/projects/:id', authMiddleware, (req, res) => {
      const { id } = req.params;
      
      // Query database for project
      db.query('SELECT * FROM projects WHERE id = $1', [id])
        .then(result => {
          if (result.rows.length === 0) {
            res.status(404).json({ message: 'Project not found' });
            return;
          }
          
          const project = result.rows[0];
          
          // Check if user has access to project
          if (project.user_id !== (req as any).user.userId) {
            res.status(403).json({ message: 'Access denied' });
            return;
          }
          
          res.status(200).json(project);
          return;
        })
        .catch(err => {
          res.status(500).json({ error: err.message });
        });
    });
    
    // Add GET /projects/:id/images endpoint
    router.get('/projects/:id/images', authMiddleware, (req, res) => {
      const { id } = req.params;
      
      // Query database for project
      db.query('SELECT * FROM projects WHERE id = $1', [id])
        .then(result => {
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
          }
          
          const project = result.rows[0];
          
          // Check if user has access to project
          if (project.user_id !== (req as any).user.userId) {
            return res.status(403).json({ message: 'Access denied' });
          }
          
          // Query database for images belonging to project
          return db.query('SELECT * FROM images WHERE project_id = $1', [id])
            .then(imagesResult => {
              res.status(200).json(imagesResult.rows);
            });
        })
        .catch(err => {
          res.status(500).json({ error: err.message });
        });
    });
    
    // Add POST /images endpoint - demonstrates filesystem usage
    router.post('/images', authMiddleware, (req, res) => {
      const { projectId, imageData } = req.body;
      
      if (!projectId || !imageData) {
        return res.status(400).json({ message: 'Missing required fields' });
      }
      
      // Verify project exists and user has access
      db.query('SELECT * FROM projects WHERE id = $1', [projectId])
        .then(result => {
          if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Project not found' });
          }
          
          const project = result.rows[0];
          
          // Check if user has access to project
          if (project.user_id !== (req as any).user.userId) {
            return res.status(403).json({ message: 'Access denied' });
          }
          
          // Read config
          const configData = fs.readFileSync('/app/config.json', 'utf8');
          const config = JSON.parse(configData.toString());
          
          // Create image directory for project if it doesn't exist
          const imageDir = `${config.imageDirectory}/${projectId}`;
          const thumbnailDir = `${config.thumbnailDirectory}/${projectId}`;
          
          if (!fs.existsSync(imageDir)) {
            fs.mkdirSync(imageDir, { recursive: true });
          }
          
          if (!fs.existsSync(thumbnailDir)) {
            fs.mkdirSync(thumbnailDir, { recursive: true });
          }
          
          // Create image ID and paths
          const imageId = `image-${Date.now()}`;
          const imagePath = `${imageDir}/${imageId}.jpg`;
          const thumbnailPath = `${thumbnailDir}/${imageId}.jpg`;
          
          // Write image data to filesystem
          fs.writeFileSync(imagePath, imageData);
          fs.writeFileSync(thumbnailPath, imageData.substring(0, 100)); // Pretend this is a thumbnail
          
          // Create image record in database
          const imageRecord = {
            id: imageId,
            name: `${imageId}.jpg`,
            project_id: projectId,
            user_id: (req as any).user.userId,
            storage_path: imagePath,
            thumbnail_path: thumbnailPath,
            width: 800,
            height: 600,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          return db.query(
            'INSERT INTO images (id, name, project_id, user_id, storage_path, thumbnail_path, width, height, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
            [
              imageRecord.id,
              imageRecord.name,
              imageRecord.project_id,
              imageRecord.user_id,
              imageRecord.storage_path,
              imageRecord.thumbnail_path,
              imageRecord.width,
              imageRecord.height,
              imageRecord.created_at,
              imageRecord.updated_at
            ]
          )
            .then(insertResult => {
              res.status(201).json(insertResult.rows[0]);
            });
        })
        .catch(err => {
          res.status(500).json({ error: err.message });
        });
    });
    
    // Mount router
    app.use('/api', router);
  });
  
  describe('GET /api/projects', () => {
    it('should return projects belonging to authenticated user', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${tokenData.token}`);
      
      // Verify response
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe('test-project-id');
      expect(response.body[0].name).toBe('Test Project');
    });
    
    it('should return 401 if not authenticated', async () => {
      // Make request without authentication
      const response = await request(app)
        .get('/api/projects');
      
      // Verify response
      expect(response.status).toBe(401);
    });
  });
  
  describe('GET /api/projects/:id', () => {
    it('should return project if it belongs to authenticated user', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication
      const response = await request(app)
        .get('/api/projects/test-project-id')
        .set('Authorization', `Bearer ${tokenData.token}`);
      
      // Verify response
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-project-id');
      expect(response.body.name).toBe('Test Project');
    });
    
    it('should return 404 if project does not exist', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication
      const response = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${tokenData.token}`);
      
      // Verify response
      expect(response.status).toBe(404);
    });
    
    it('should return 403 if project belongs to different user', async () => {
      // Create another user
      const otherUser = dbHelpers.createUser({
        id: 'other-user-id',
        email: 'other@example.com',
        name: 'Other User',
        username: 'otheruser'
      });
      
      // Get auth token for other user
      const tokenData = auth.generateToken(otherUser.id);
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication
      const response = await request(app)
        .get('/api/projects/test-project-id')
        .set('Authorization', `Bearer ${tokenData.token}`);
      
      // Verify response
      expect(response.status).toBe(403);
    });
  });
  
  describe('GET /api/projects/:id/images', () => {
    it('should return images belonging to project', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication
      const response = await request(app)
        .get('/api/projects/test-project-id/images')
        .set('Authorization', `Bearer ${tokenData.token}`);
      
      // Verify response
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe('test-image-id');
      expect(response.body[0].project_id).toBe('test-project-id');
    });
  });
  
  describe('POST /api/images', () => {
    it('should create new image for project', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${tokenData.token}`)
        .send({
          projectId: 'test-project-id',
          imageData: 'base64-encoded-image-data'
        });
      
      // Verify response
      expect(response.status).toBe(201);
      expect(response.body.project_id).toBe('test-project-id');
      expect(response.body.user_id).toBe('test-user-id');
      
      // Verify image was created in database
      const queryResult = await db.query('SELECT * FROM images WHERE id = $1', [response.body.id]);
      expect(queryResult.rowCount).toBe(1);
      
      // Verify image files were created in filesystem
      const configData = fs.readFileSync('/app/config.json', 'utf8');
      const config = JSON.parse(configData.toString());
      
      const imagePath = `${config.imageDirectory}/test-project-id/${response.body.id}.jpg`;
      const thumbnailPath = `${config.thumbnailDirectory}/test-project-id/${response.body.id}.jpg`;
      
      expect(fs.existsSync(imagePath)).toBe(true);
      expect(fs.existsSync(thumbnailPath)).toBe(true);
    });
    
    it('should return 400 if missing required fields', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication but missing fields
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${tokenData.token}`)
        .send({
          projectId: 'test-project-id'
          // Missing imageData
        });
      
      // Verify response
      expect(response.status).toBe(400);
    });
    
    it('should return 404 if project does not exist', async () => {
      // Get auth token for test user
      const tokenData = auth.generateToken('test-user-id');
      
      if (!tokenData) {
        throw new Error('Failed to generate token');
      }
      
      // Make request with authentication but non-existent project
      const response = await request(app)
        .post('/api/images')
        .set('Authorization', `Bearer ${tokenData.token}`)
        .send({
          projectId: 'non-existent-id',
          imageData: 'base64-encoded-image-data'
        });
      
      // Verify response
      expect(response.status).toBe(404);
    });
  });
});