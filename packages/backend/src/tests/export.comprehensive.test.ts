import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';

// Mock dependencies
jest.mock('../middleware/authMiddleware', () => {
  return jest.fn((req: Express.Request, res: Express.Response, next: () => void) => {
    req.user = { userId: 'test-user-id' } as Express.User;
    next();
  });
});

jest.mock('../db', () => ({
  query: jest.fn().mockImplementation((query: string, params: any[]) => {
    // Mock project data
    if (query.includes('SELECT * FROM projects WHERE id')) {
      return {
        rows: [
          {
            id: 'test-project-id',
            user_id: 'test-user-id',
            title: 'Test Project',
            description: 'Test Description',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
    
    // Mock image data
    if (query.includes('SELECT * FROM images WHERE project_id')) {
      return {
        rows: [
          {
            id: 'test-image-id-1',
            project_id: 'test-project-id',
            user_id: 'test-user-id',
            name: 'test-image-1.jpg',
            storage_path: '/path/to/image-1.jpg',
            thumbnail_path: '/path/to/thumbnail-1.jpg',
            width: 800,
            height: 600,
            metadata: { format: 'image/jpeg', size: 102400 },
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'test-image-id-2',
            project_id: 'test-project-id',
            user_id: 'test-user-id',
            name: 'test-image-2.jpg',
            storage_path: '/path/to/image-2.jpg',
            thumbnail_path: '/path/to/thumbnail-2.jpg',
            width: 1024,
            height: 768,
            metadata: { format: 'image/jpeg', size: 153600 },
            status: 'completed',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
    
    // Mock segmentation results
    if (query.includes('SELECT * FROM segmentation_results WHERE image_id')) {
      return {
        rows: [
          {
            id: 'test-segmentation-id-1',
            image_id: 'test-image-id-1',
            user_id: 'test-user-id',
            status: 'completed',
            result_data: {
              polygons: [
                {
                  id: 'poly-1',
                  type: 'external',
                  points: [
                    { x: 100, y: 100 },
                    { x: 200, y: 100 },
                    { x: 200, y: 200 },
                    { x: 100, y: 200 }
                  ]
                },
                {
                  id: 'poly-2',
                  type: 'external',
                  points: [
                    { x: 300, y: 300 },
                    { x: 400, y: 300 },
                    { x: 400, y: 400 },
                    { x: 300, y: 400 }
                  ]
                }
              ]
            },
            metrics: {
              count: 2,
              totalArea: 20000,
              averageArea: 10000
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          },
          {
            id: 'test-segmentation-id-2',
            image_id: 'test-image-id-2',
            user_id: 'test-user-id',
            status: 'completed',
            result_data: {
              polygons: [
                {
                  id: 'poly-3',
                  type: 'external',
                  points: [
                    { x: 200, y: 200 },
                    { x: 300, y: 200 },
                    { x: 300, y: 300 },
                    { x: 200, y: 300 }
                  ]
                }
              ]
            },
            metrics: {
              count: 1,
              totalArea: 10000,
              averageArea: 10000
            },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ]
      };
    }
    
    // Default empty response
    return { rows: [] };
  })
}));

// Mock file system operations
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    promises: {
      ...actualFs.promises,
      readFile: jest.fn().mockImplementation((path: string) => {
        // Return fake image data for test images
        if (path.toString().includes('image')) {
          return Buffer.from('fake-image-data');
        }
        
        // Default behavior
        return actualFs.promises.readFile(path);
      }),
      access: jest.fn().mockResolvedValue(true),
      stat: jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 102400,
        mtime: new Date()
      })
    }
  };
});

// Import router
import projectsRouter from '../routes/projects';

describe('Export API Comprehensive Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/projects', projectsRouter);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/projects/:projectId/export', () => {
    it('should export project with COCO format annotations', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'true',
          format: 'COCO',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/zip/);
      
      // Verify the ZIP file content
      const zipBuffer = response.body;
      const zip = await JSZip.loadAsync(zipBuffer);
      
      // Check for COCO annotation file
      const hasCOCOFile = Object.keys(zip.files).some(name => 
        name.includes('annotations.json') || name.includes('coco')
      );
      expect(hasCOCOFile).toBeTruthy();
      
      // Verify COCO format content
      const cocoFiles = Object.keys(zip.files).filter(name => 
        name.includes('annotations.json') || name.includes('coco')
      );
      
      if (cocoFiles.length > 0) {
        const cocoFileContent = await zip.files[cocoFiles[0]].async('string');
        const cocoData = JSON.parse(cocoFileContent);
        
        expect(cocoData).toHaveProperty('images');
        expect(cocoData).toHaveProperty('annotations');
        expect(cocoData).toHaveProperty('categories');
        expect(Array.isArray(cocoData.images)).toBe(true);
        expect(cocoData.images.length).toBeGreaterThan(0);
      }
    });

    it('should export project with YOLO format annotations', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'false',
          format: 'YOLO',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/zip/);
      
      // Verify the ZIP file content
      const zipBuffer = response.body;
      const zip = await JSZip.loadAsync(zipBuffer);
      
      // YOLO format creates .txt files with class x_center y_center width height
      const txtFiles = Object.keys(zip.files).filter(name => 
        name.endsWith('.txt') && !name.includes('metadata')
      );
      
      expect(txtFiles.length).toBeGreaterThan(0);
      
      // Verify format of a YOLO annotation file
      if (txtFiles.length > 0) {
        const yoloFileContent = await zip.files[txtFiles[0]].async('string');
        const lines = yoloFileContent.split('\n').filter(line => line.trim());
        
        if (lines.length > 0) {
          const parts = lines[0].split(' ');
          expect(parts.length).toBeGreaterThanOrEqual(5); // class_id x_center y_center width height
          expect(Number.isFinite(parseFloat(parts[1]))).toBe(true); // x_center should be a number
        }
      }
    });

    it('should export project with MASK format segmentations', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'false',
          format: 'MASK',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/zip/);
      
      // Verify the ZIP file content
      const zipBuffer = response.body;
      const zip = await JSZip.loadAsync(zipBuffer);
      
      // Should have mask .png files
      const maskFiles = Object.keys(zip.files).filter(name => 
        name.includes('/masks/') && name.endsWith('.png')
      );
      
      expect(maskFiles.length).toBeGreaterThan(0);
    });
    
    it('should export project with polygon JSON format', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'false',
          format: 'POLYGONS',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/zip/);
      
      // Verify the ZIP file content
      const zipBuffer = response.body;
      const zip = await JSZip.loadAsync(zipBuffer);
      
      // Should have polygon JSON files
      const polygonFiles = Object.keys(zip.files).filter(name => 
        name.includes('polygons') && name.endsWith('.json')
      );
      
      expect(polygonFiles.length).toBeGreaterThan(0);
      
      // Verify polygon format
      if (polygonFiles.length > 0) {
        const polygonsContent = await zip.files[polygonFiles[0]].async('string');
        const polygonsData = JSON.parse(polygonsContent);
        
        // Check if it's an array of polygons or has a polygons array property
        const hasPolygons = Array.isArray(polygonsData) || 
                           (polygonsData.polygons && Array.isArray(polygonsData.polygons));
        expect(hasPolygons).toBe(true);
      }
    });
  });

  describe('GET /api/projects/:projectId/metrics', () => {
    it('should export project metrics in EXCEL format', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export/metrics')
        .query({
          format: 'EXCEL',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/);
      expect(response.body).toBeTruthy();
    });

    it('should export project metrics in CSV format', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export/metrics')
        .query({
          format: 'CSV',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/csv/);
      
      // Verify CSV structure
      const csvContent = response.text;
      const lines = csvContent.split('\n');
      
      // Should have header and at least one data line
      expect(lines.length).toBeGreaterThan(1);
      
      // Header should have common metric columns
      expect(lines[0]).toContain('Image Name');
      expect(lines[0]).toContain('Object ID');
      expect(lines[0]).toContain('Area');
    });
  });

  describe('Export error handling', () => {
    it('should return 404 if project does not exist', async () => {
      // Mock db to return empty rows
      const db = require('../db');
      db.query.mockImplementationOnce(() => ({ rows: [] }));

      const response = await request(app)
        .get('/api/projects/non-existent-project/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'true'
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });

    it('should handle invalid format parameter gracefully', async () => {
      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'true',
          format: 'INVALID_FORMAT',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      // Should revert to default format and not error out
      expect(response.status).toBe(200);
    });

    it('should handle file read errors gracefully', async () => {
      // Mock file read failure
      const fsPromises = require('fs').promises;
      fsPromises.readFile.mockRejectedValueOnce(new Error('File not found'));

      const response = await request(app)
        .get('/api/projects/test-project-id/export')
        .query({
          includeMetadata: 'true',
          includeSegmentation: 'true',
          includeMetrics: 'true',
          includeImages: 'true',
          format: 'COCO',
          imageIds: ['test-image-id-1', 'test-image-id-2']
        });

      // Should still create a ZIP with other available data
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/application\/zip/);
    });
  });
});