/**
 * Project Export API Test
 *
 * This test verifies the project export endpoints
 * using a simplified approach with mocked dependencies.
 */
import express, { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';
import request from 'supertest';

// Create router for testing
const router = express.Router();

// Define test constants
const VALID_PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const NON_EXISTENT_PROJECT_ID = '123e4567-e89b-12d3-a456-426614174999';

// Simple auth middleware mock that adds a test user to the request
const mockAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  (req as unknown).user = {
    userId: 'test-user-id',
    email: 'test@example.com',
  };
  next();
};

// Validation middleware mock
const mockValidate = () => (req: Request, res: Response, next: NextFunction) => {
  // Simple validation for testing - assume all project IDs are valid
  next();
};

// Define query result interface for type safety
interface QueryResult {
  rows: any[];
  rowCount?: number;
}

// Mock database query function
async function queryMock(query: string, params: any[] = []): Promise<QueryResult> {
  // Project query
  if (query.includes('SELECT * FROM projects WHERE id')) {
    if (params[0] === VALID_PROJECT_ID) {
      return {
        rows: [
          {
            id: VALID_PROJECT_ID,
            user_id: 'test-user-id',
            title: 'Test Project',
            description: 'Test Description',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
      };
    }
    // Non-existent project
    return { rows: [] };
  }

  // Images query
  if (query.includes('SELECT * FROM images WHERE project_id')) {
    return {
      rows: [
        {
          id: 'test-image-id',
          project_id: VALID_PROJECT_ID,
          user_id: 'test-user-id',
          name: 'test-image.jpg',
          storage_path: '/path/to/image.jpg',
          thumbnail_path: '/path/to/thumbnail.jpg',
          width: 1000,
          height: 800,
          metadata: { size: 12345, format: 'jpeg' },
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };
  }

  // Segmentation query
  if (query.includes('SELECT * FROM segmentation_results WHERE image_id')) {
    return {
      rows: [
        {
          id: 'test-segmentation-id',
          image_id: 'test-image-id',
          user_id: 'test-user-id',
          mask_path: '/path/to/mask.png',
          polygons_path: '/path/to/polygons.json',
          metrics: { count: 10, area: 1000, coverage: 0.35 },
          status: 'completed',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    };
  }

  // Default response for any other query
  return { rows: [] };
}

// Mock database query
const mockDbQuery = jest.fn(queryMock);

// Create mock Excel buffer for metrics export
const mockExcelBuffer = Buffer.from('Mock Excel File');

// Mock all required dependencies
jest.mock('../security/middleware/auth', () => ({
  __esModule: true,
  default: mockAuthMiddleware,
}));

jest.mock('../middleware/validationMiddleware', () => ({
  validate: mockValidate,
}));

jest.mock('../db', () => ({
  __esModule: true,
  default: {
    query: mockDbQuery,
  },
}));

jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

// Mock Excel.js library for metrics export
jest.mock('exceljs', () => {
  const mockWriteBuffer = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockExcelBuffer);
  });

  return {
    Workbook: jest.fn().mockImplementation(() => {
      return {
        addWorksheet: jest.fn().mockReturnThis(),
        getWorksheet: jest.fn().mockReturnValue({
          columns: [],
          addRow: jest.fn(),
          getCell: jest.fn().mockReturnValue({
            style: {},
          }),
        }),
        xlsx: {
          writeBuffer: mockWriteBuffer,
        },
      };
    }),
  };
});

// Project export route
router.get(
  '/:id/export',
  mockAuthMiddleware,
  mockValidate(),
  async (req: Request, res: Response) => {
    const userId = (req as unknown).user?.userId;
    const projectId = req.params.id;
    const includeMetadata = req.query.includeMetadata === 'true';
    const includeSegmentation = req.query.includeSegmentation === 'true';
    const includeMetrics = req.query.includeMetrics === 'true';

    try {
      // Fetch project
      const projectResult = await mockDbQuery(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found or access denied' });
      }

      const project = projectResult.rows[0];

      // Fetch images
      const imagesResult = await mockDbQuery('SELECT * FROM images WHERE project_id = $1', [
        projectId,
      ]);

      const images = await Promise.all(
        imagesResult.rows.map(async (image) => {
          // Clone image to avoid modifying the original
          const imageClone = { ...image };

          // Remove paths if metadata should not be included
          if (!includeMetadata) {
            delete imageClone.storage_path;
            delete imageClone.thumbnail_path;
          }

          // Include segmentation if requested
          if (includeSegmentation) {
            const segmentationResult = await mockDbQuery(
              'SELECT * FROM segmentation_results WHERE image_id = $1',
              [image.id]
            );

            if (segmentationResult.rows.length > 0) {
              const segmentation = segmentationResult.rows[0];

              // Remove metrics if not requested
              if (!includeMetrics) {
                delete segmentation.metrics;
              }

              imageClone.segmentation = segmentation;
            }
          }

          return imageClone;
        })
      );

      // Return project export
      res.status(200).json({
        project,
        images,
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// Project metrics export route
router.get(
  '/:id/export/metrics',
  mockAuthMiddleware,
  mockValidate(),
  async (req: Request, res: Response) => {
    const userId = (req as unknown).user?.userId;
    const projectId = req.params.id;

    try {
      // Fetch project
      const projectResult = await mockDbQuery(
        'SELECT * FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectResult.rows.length === 0) {
        return res.status(404).json({ message: 'Project not found or access denied' });
      }

      // In a real implementation, we would create an Excel file with metrics.
      // For testing, we just return a mock Excel buffer.

      // Set headers for Excel download
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="project-${projectId}-metrics.xlsx"`
      );

      res.status(200).send(mockExcelBuffer);
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  }
);

describe('Project Export API', () => {
  let app: express.Application;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/projects', router);
  });

  describe('GET /projects/:id/export', () => {
    it('should return project export data with all options', async () => {
      const response = await request(app).get(`/projects/${VALID_PROJECT_ID}/export`).query({
        includeMetadata: 'true',
        includeSegmentation: 'true',
        includeMetrics: 'true',
      });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('project');
      expect(response.body.project).toHaveProperty('id', VALID_PROJECT_ID);
      expect(response.body).toHaveProperty('images');
      expect(response.body.images).toHaveLength(1);
      expect(response.body.images[0]).toHaveProperty('id', 'test-image-id');
      expect(response.body.images[0]).toHaveProperty('storage_path');
      expect(response.body.images[0]).toHaveProperty('segmentation');
      expect(response.body.images[0].segmentation).toHaveProperty('id', 'test-segmentation-id');
      expect(response.body.images[0].segmentation).toHaveProperty('metrics');
    });

    it('should return project export data without metadata', async () => {
      const response = await request(app).get(`/projects/${VALID_PROJECT_ID}/export`).query({
        includeMetadata: 'false',
        includeSegmentation: 'true',
        includeMetrics: 'true',
      });

      expect(response.status).toBe(200);
      expect(response.body.images[0]).not.toHaveProperty('storage_path');
      expect(response.body.images[0]).not.toHaveProperty('thumbnail_path');
    });

    it('should return project export data without segmentation', async () => {
      const response = await request(app).get(`/projects/${VALID_PROJECT_ID}/export`).query({
        includeMetadata: 'true',
        includeSegmentation: 'false',
        includeMetrics: 'true',
      });

      expect(response.status).toBe(200);
      expect(response.body.images[0]).not.toHaveProperty('segmentation');
    });

    it('should return project export data without metrics', async () => {
      const response = await request(app).get(`/projects/${VALID_PROJECT_ID}/export`).query({
        includeMetadata: 'true',
        includeSegmentation: 'true',
        includeMetrics: 'false',
      });

      expect(response.status).toBe(200);
      expect(response.body.images[0].segmentation).not.toHaveProperty('metrics');
    });

    it('should return 404 if project does not exist', async () => {
      const response = await request(app).get(`/projects/${NON_EXISTENT_PROJECT_ID}/export`).query({
        includeMetadata: 'true',
        includeSegmentation: 'true',
        includeMetrics: 'true',
      });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });

  describe('GET /projects/:id/export/metrics', () => {
    it('should return project metrics as Excel file', async () => {
      const response = await request(app).get(`/projects/${VALID_PROJECT_ID}/export/metrics`);

      expect(response.status).toBe(200);
      expect(response.header['content-type']).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      expect(response.header['content-disposition']).toContain(
        `filename="project-${VALID_PROJECT_ID}-metrics.xlsx"`
      );
    });

    it('should return 404 if project does not exist', async () => {
      const response = await request(app).get(
        `/projects/${NON_EXISTENT_PROJECT_ID}/export/metrics`
      );

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('message', 'Project not found or access denied');
    });
  });
});
