/**
 * Simplified Segmentation Workflow Integration Tests
 * 
 * This test file focuses on the full segmentation workflow without external dependencies:
 * - Project and image setup
 * - Segmentation triggering
 * - Checking segmentation status
 * - Retrieving segmentation results
 * - Modifying segmentation results
 * - Exporting segmentation data in different formats
 */

import request from 'supertest';
import express, { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

describe('Segmentation Workflow Integration', () => {
  // Test data
  const testUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: 'TestPassword123!',
    username: 'testuser'
  };
  
  const testToken = 'test-auth-token';
  
  // Define types
  interface Polygon {
    id: string;
    type: string;
    modified?: boolean;
    points: { x: number; y: number }[];
  }
  
  interface SegmentationData {
    polygons: Polygon[];
    version?: number;
    lastModified?: string;
  }
  
  interface SegmentationJob {
    imageId: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    timestamp: number;
  }
  
  // Storage
  const projects = new Map<string, any>();
  const images = new Map<string, any>();
  const segmentations = new Map<string, SegmentationData>();
  const segmentationJobs: SegmentationJob[] = [];
  
  // Define COCO types
  interface CocoImage {
    id: string;
    file_name: string;
    width: number;
    height: number;
    date_captured: string;
  }
  
  interface CocoAnnotation {
    id: number;
    image_id: string;
    category_id: number;
    segmentation: number[][];
    area: number;
    bbox: number[];
    iscrowd: number;
  }
  
  interface CocoExport {
    info: any;
    licenses: any[];
    categories: any[];
    images: CocoImage[];
    annotations: CocoAnnotation[];
  }
  
  // Define metrics type
  interface SegmentationMetric {
    imageId: string;
    imageName: string;
    polygonId: string;
    area: number;
    perimeter: number;
    circularity: number;
  }
  
  // Test IDs
  let projectId: string;
  let imageId: string;
  
  // Express app
  let app: express.Application;
  
  beforeAll(() => {
    // Create IDs
    projectId = 'project-123';
    imageId = 'image-123';
    
    // Create test project
    projects.set(projectId, {
      id: projectId,
      name: 'Test Project',
      description: 'Test project for segmentation',
      user_id: testUser.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Create test image
    images.set(imageId, {
      id: imageId,
      project_id: projectId,
      user_id: testUser.id,
      name: 'test-image.jpg',
      storage_path: '/uploads/test-project/test-image.jpg',
      thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
      segmentationStatus: 'not_started',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
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
    
    // Image retrieval
    router.get('/images/:imageId', authMiddleware, (req, res) => {
      const { imageId } = req.params;
      const { includeSegmentation } = req.query;
      
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      const image = { ...images.get(imageId) };
      
      // Add segmentation data if requested
      if (includeSegmentation === 'true' && segmentations.has(imageId)) {
        image.segmentation = segmentations.get(imageId);
      }
      
      res.status(200).json(image);
    });
    
    // Segmentation triggering
    router.post('/segmentation/trigger', authMiddleware, (req, res) => {
      const { imageId, projectId } = req.body;
      
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      if (!projects.has(projectId)) {
        return res.status(404).json({ message: 'Project not found' });
      }
      
      const image = images.get(imageId);
      
      if (image.project_id !== projectId) {
        return res.status(400).json({ message: 'Image does not belong to project' });
      }
      
      // Update image status
      image.segmentationStatus = 'queued';
      images.set(imageId, image);
      
      // Add to job queue
      segmentationJobs.push({
        imageId,
        status: 'queued',
        timestamp: Date.now()
      });
      
      res.status(202).json({ message: 'Segmentation queued' });
    });
    
    // Segmentation status
    router.get('/segmentation/status', authMiddleware, (req, res) => {
      const { projectId } = req.query;
      
      // Filter jobs by project if requested
      let queueLength = 0;
      let processingCount = 0;
      
      segmentationJobs.forEach(job => {
        if (job.status === 'queued') queueLength++;
        if (job.status === 'processing') processingCount++;
      });
      
      res.status(200).json({
        queueLength,
        processingCount,
        totalJobs: segmentationJobs.length
      });
    });
    
    // Image segmentation status
    router.get('/images/:imageId/segmentation/status', authMiddleware, (req, res) => {
      const { imageId } = req.params;
      
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      const image = images.get(imageId);
      
      // Find related segmentation job if any
      const job = segmentationJobs.find(job => job.imageId === imageId);
      const status = job ? job.status : image.segmentationStatus;
      
      res.status(200).json({
        status,
        lastUpdated: job ? new Date(job.timestamp).toISOString() : null
      });
    });
    
    // Process segmentation job
    router.post('/complete-segmentation/:imageId', authMiddleware, (req, res) => {
      const { imageId } = req.params;
      
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      const image = images.get(imageId);
      
      // Update image status
      image.segmentationStatus = 'completed';
      images.set(imageId, image);
      
      // Update job status
      for (const job of segmentationJobs) {
        if (job.imageId === imageId) {
          job.status = 'completed';
        }
      }
      
      // Create default segmentation result
      if (!segmentations.has(imageId)) {
        segmentations.set(imageId, {
          polygons: [
            {
              id: uuidv4(),
              type: 'external',
              points: [
                { x: 100, y: 100 },
                { x: 200, y: 100 },
                { x: 200, y: 200 },
                { x: 100, y: 200 }
              ]
            },
            {
              id: uuidv4(),
              type: 'internal',
              points: [
                { x: 125, y: 125 },
                { x: 175, y: 125 },
                { x: 175, y: 175 },
                { x: 125, y: 175 }
              ]
            }
          ],
          version: 1,
          lastModified: new Date().toISOString()
        });
      }
      
      res.status(200).json({ message: 'Segmentation completed' });
    });
    
    // Get segmentation data
    router.get('/images/:imageId/segmentation', authMiddleware, (req, res) => {
      const { imageId } = req.params;
      
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      if (!segmentations.has(imageId)) {
        return res.status(404).json({ message: 'Segmentation not found' });
      }
      
      res.status(200).json(segmentations.get(imageId));
    });
    
    // Update segmentation data
    router.put('/images/:imageId/segmentation', authMiddleware, (req, res) => {
      const { imageId } = req.params;
      const { polygons } = req.body;
      
      if (!images.has(imageId)) {
        return res.status(404).json({ message: 'Image not found' });
      }
      
      // Update segmentation
      const currentData = segmentations.get(imageId);
      const currentVersion = currentData && currentData.version ? currentData.version : 0;
      
      segmentations.set(imageId, { 
        polygons,
        lastModified: new Date().toISOString(),
        version: currentVersion + 1
      });
      
      res.status(200).json({ updated: true });
    });
    
    // Export in COCO format
    router.get('/export/coco', authMiddleware, (req, res) => {
      const { projectId, imageIds } = req.query;
      
      // Generate COCO format
      const cocoData: CocoExport = {
        info: {
          description: 'SpheroSeg Export',
          version: '1.0',
          year: new Date().getFullYear(),
          date_created: new Date().toISOString()
        },
        licenses: [
          {
            id: 1,
            name: 'Custom License',
            url: 'https://example.com/license'
          }
        ],
        categories: [
          {
            id: 1,
            name: 'spheroid',
            supercategory: 'cell'
          }
        ],
        images: [],
        annotations: []
      };
      
      // Parse image IDs
      const imageIdList: string[] = Array.isArray(imageIds) 
        ? imageIds.map(id => String(id))
        : typeof imageIds === 'string' 
          ? [imageIds] 
          : [];
      
      // Add images to COCO
      let annotationId = 1;
      
      imageIdList.forEach(id => {
        if (images.has(id) && segmentations.has(id)) {
          const image = images.get(id);
          
          // Add image
          cocoData.images.push({
            id: image.id,
            file_name: image.name,
            width: 800,
            height: 600,
            date_captured: image.created_at
          });
          
          // Add annotations
          const segData = segmentations.get(id);
          if (!segData || !segData.polygons) return;
          
          segData.polygons.forEach((polygon: Polygon) => {
            // Convert points to COCO format
            const segmentation = [
              polygon.points.flatMap(p => [p.x, p.y])
            ];
            
            // Calculate bounding box
            const xs = polygon.points.map(p => p.x);
            const ys = polygon.points.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const width = Math.max(...xs) - minX;
            const height = Math.max(...ys) - minY;
            
            // Calculate area (simple approximation)
            const area = width * height;
            
            cocoData.annotations.push({
              id: annotationId++,
              image_id: image.id,
              category_id: 1,
              segmentation,
              area,
              bbox: [minX, minY, width, height],
              iscrowd: 0
            });
          });
        }
      });
      
      res.status(200).json(cocoData);
    });
    
    // Export metrics
    router.get('/export/metrics', authMiddleware, (req, res) => {
      // Log request
      console.log(`Exporting metrics for ${req.query.imageIds}`);
      const { projectId, imageIds } = req.query;
      
      // Parse image IDs
      const imageIdList: string[] = Array.isArray(imageIds) 
        ? imageIds.map(id => String(id))
        : typeof imageIds === 'string' 
          ? [imageIds] 
          : [];
      
      // Generate metrics
      const metrics: SegmentationMetric[] = [];
      
      imageIdList.forEach(id => {
        if (images.has(id) && segmentations.has(id)) {
          const image = images.get(id);
          const segData = segmentations.get(id);
          
          if (!segData || !segData.polygons) return;
          
          segData.polygons.forEach((polygon: Polygon) => {
            // Calculate area (simple approximation)
            const xs = polygon.points.map(p => p.x);
            const ys = polygon.points.map(p => p.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const width = Math.max(...xs) - minX;
            const height = Math.max(...ys) - minY;
            const area = width * height;
            
            // Calculate perimeter (simple approximation)
            const perimeter = 2 * (width + height);
            
            // Calculate circularity
            const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
            
            metrics.push({
              imageId: id,
              imageName: image.name,
              polygonId: polygon.id,
              area,
              perimeter,
              circularity
            });
          });
        }
      });
      
      res.status(200).json(metrics);
    });
    
    // Mount router
    app.use('/api', router);
  });
  
  describe('1. Segmentation Basic Operations', () => {
    it('should trigger segmentation for an image', async () => {
      const response = await request(app)
        .post('/api/segmentation/trigger')
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          imageId,
          projectId
        });
      
      expect(response.status).toBe(202);
      expect(response.body).toHaveProperty('message');
    });
    
    it('should check segmentation queue status', async () => {
      const response = await request(app)
        .get('/api/segmentation/status')
        .set('Authorization', `Bearer ${testToken}`)
        .query({ projectId });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('queueLength');
      expect(response.body).toHaveProperty('processingCount');
    });
    
    it('should retrieve segmentation status for a specific image', async () => {
      const response = await request(app)
        .get(`/api/images/${imageId}/segmentation/status`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status');
      expect(['pending', 'processing', 'completed', 'failed', 'queued', 'not_started']).toContain(
        response.body.status
      );
    });
  });
  
  describe('2. Completing Segmentation Process', () => {
    it('should complete the segmentation process', async () => {
      const response = await request(app)
        .post(`/api/complete-segmentation/${imageId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Segmentation completed');
      
      // Verify image status was updated
      const imageResponse = await request(app)
        .get(`/api/images/${imageId}`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(imageResponse.body.segmentationStatus).toBe('completed');
    });
    
    it('should retrieve segmentation results', async () => {
      const response = await request(app)
        .get(`/api/images/${imageId}/segmentation`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('polygons');
      expect(Array.isArray(response.body.polygons)).toBe(true);
      expect(response.body.polygons.length).toBeGreaterThan(0);
    });
  });
  
  describe('3. Segmentation Result Modification', () => {
    it('should modify segmentation results', async () => {
      // Get current segmentation
      const getResponse = await request(app)
        .get(`/api/images/${imageId}/segmentation`)
        .set('Authorization', `Bearer ${testToken}`);
      
      // Create modified polygon data
      const originalPolygons = getResponse.body.polygons;
      const modifiedPolygons = originalPolygons.map((polygon: any) => {
        // Add a new property to identify the modified version
        return {
          ...polygon,
          modified: true
        };
      });
      
      // Add a new polygon
      modifiedPolygons.push({
        id: uuidv4(),
        type: 'external',
        modified: true,
        points: [
          { x: 150, y: 150 },
          { x: 200, y: 150 },
          { x: 200, y: 200 },
          { x: 150, y: 200 },
        ]
      });
      
      // Update segmentation results
      const updateResponse = await request(app)
        .put(`/api/images/${imageId}/segmentation`)
        .set('Authorization', `Bearer ${testToken}`)
        .send({
          polygons: modifiedPolygons
        });
      
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body).toHaveProperty('updated', true);
      
      // Verify the update
      const verifyResponse = await request(app)
        .get(`/api/images/${imageId}/segmentation`)
        .set('Authorization', `Bearer ${testToken}`);
      
      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body).toHaveProperty('polygons');
      expect(Array.isArray(verifyResponse.body.polygons)).toBe(true);
      expect(verifyResponse.body.polygons).toHaveLength(modifiedPolygons.length);
      
      // Check for the modified flag
      const hasModified = verifyResponse.body.polygons.some(
        (polygon: any) => polygon.modified === true
      );
      expect(hasModified).toBe(true);
    });
  });
  
  describe('4. Segmentation Export', () => {
    it('should export segmentation results in COCO format', async () => {
      // Make sure we have segmentation data
      if (!segmentations.has(imageId)) {
        // Complete segmentation if not already done
        await request(app)
          .post(`/api/complete-segmentation/${imageId}`)
          .set('Authorization', `Bearer ${testToken}`);
      }
      const response = await request(app)
        .get(`/api/export/coco`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({
          projectId,
          imageIds: imageId
        });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('images');
      expect(response.body).toHaveProperty('annotations');
      expect(Array.isArray(response.body.images)).toBe(true);
      expect(Array.isArray(response.body.annotations)).toBe(true);
    });
    
    it('should export segmentation metrics', async () => {
      // Make sure we have segmentation data
      if (!segmentations.has(imageId)) {
        // Complete segmentation if not already done
        await request(app)
          .post(`/api/complete-segmentation/${imageId}`)
          .set('Authorization', `Bearer ${testToken}`);
      }
      const response = await request(app)
        .get(`/api/export/metrics`)
        .set('Authorization', `Bearer ${testToken}`)
        .query({
          projectId,
          imageIds: imageId
        });
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const firstMetric = response.body[0];
        expect(firstMetric).toHaveProperty('imageId');
        expect(firstMetric).toHaveProperty('polygonId');
        expect(firstMetric).toHaveProperty('area');
      }
    });
  });
});