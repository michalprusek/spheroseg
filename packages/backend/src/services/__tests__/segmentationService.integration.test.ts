/**
 * Integration tests for SegmentationService
 *
 * Tests segmentation workflow with real database and ML service mocking
 */

import { SegmentationService } from '../segmentationService';
import { SegmentationQueueService } from '../segmentationQueueService';
import pool from '../../config/database';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

// Mock axios for ML service calls
jest.mock('axios');
const mockedAxios = axios as any;

describe('SegmentationService Integration Tests', () => {
  let segmentationService: SegmentationService;
  let queueService: SegmentationQueueService;
  let testUserId: string;
  let testProjectId: string;
  let testImageId: string;

  beforeAll(async () => {
    // Initialize services
    queueService = new SegmentationQueueService();
    segmentationService = new SegmentationService(queueService);

    // Create test user
    testUserId = uuidv4();
    await pool.query('INSERT INTO users (id, email, password, name) VALUES ($1, $2, $3, $4)', [
      testUserId,
      'segtest@test.integration.com',
      'hashed',
      'Test User',
    ]);

    // Create test project
    testProjectId = uuidv4();
    await pool.query('INSERT INTO projects (id, user_id, name) VALUES ($1, $2, $3)', [
      testProjectId,
      testUserId,
      'Test Project',
    ]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query(
      'DELETE FROM cells WHERE image_id IN (SELECT id FROM images WHERE project_id = $1)',
      [testProjectId]
    );
    await pool.query(
      'DELETE FROM segmentation_results WHERE image_id IN (SELECT id FROM images WHERE project_id = $1)',
      [testProjectId]
    );
    await pool.query(
      'DELETE FROM segmentation_queue WHERE image_id IN (SELECT id FROM images WHERE project_id = $1)',
      [testProjectId]
    );
    await pool.query('DELETE FROM images WHERE project_id = $1', [testProjectId]);
    await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  beforeEach(async () => {
    // Clean up any existing test images
    await pool.query(
      'DELETE FROM cells WHERE image_id IN (SELECT id FROM images WHERE project_id = $1)',
      [testProjectId]
    );
    await pool.query(
      'DELETE FROM segmentation_results WHERE image_id IN (SELECT id FROM images WHERE project_id = $1)',
      [testProjectId]
    );
    await pool.query(
      'DELETE FROM segmentation_queue WHERE image_id IN (SELECT id FROM images WHERE project_id = $1)',
      [testProjectId]
    );
    await pool.query('DELETE FROM images WHERE project_id = $1', [testProjectId]);

    // Create test image
    testImageId = uuidv4();
    await pool.query(
      `INSERT INTO images (id, project_id, name, url, thumbnail_url, size, width, height, segmentation_status) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        testImageId,
        testProjectId,
        'test.jpg',
        'http://test.com/test.jpg',
        'http://test.com/thumb.jpg',
        1024000,
        1920,
        1080,
        'without_segmentation',
      ]
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('queueSegmentation', () => {
    it('should queue single image for segmentation', async () => {
      const result = await segmentationService.queueSegmentation(testImageId, testUserId);

      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('status', 'queued');

      // Verify in database
      const queueResult = await pool.query('SELECT * FROM segmentation_queue WHERE image_id = $1', [
        testImageId,
      ]);
      expect(queueResult.rows).toHaveLength(1);
      expect(queueResult.rows[0].status).toBe('queued');

      const imageResult = await pool.query('SELECT segmentation_status FROM images WHERE id = $1', [
        testImageId,
      ]);
      expect(imageResult.rows[0].segmentation_status).toBe('queued');
    });

    it('should not queue already segmented image', async () => {
      // Update image status to completed
      await pool.query('UPDATE images SET segmentation_status = $1 WHERE id = $2', [
        'completed',
        testImageId,
      ]);

      await expect(segmentationService.queueSegmentation(testImageId, testUserId)).rejects.toThrow(
        'already been segmented'
      );
    });

    it('should not queue image already in queue', async () => {
      // Queue once
      await segmentationService.queueSegmentation(testImageId, testUserId);

      // Try to queue again
      await expect(segmentationService.queueSegmentation(testImageId, testUserId)).rejects.toThrow(
        'already in queue'
      );
    });
  });

  describe('queueBatchSegmentation', () => {
    let testImageIds: string[];

    beforeEach(async () => {
      // Create multiple test images
      testImageIds = [];
      for (let i = 0; i < 3; i++) {
        const imageId = uuidv4();
        await pool.query(
          `INSERT INTO images (id, project_id, name, url, thumbnail_url, size, width, height, segmentation_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            imageId,
            testProjectId,
            `test${i}.jpg`,
            `http://test.com/test${i}.jpg`,
            `http://test.com/thumb${i}.jpg`,
            1024000,
            1920,
            1080,
            'without_segmentation',
          ]
        );
        testImageIds.push(imageId);
      }
    });

    it('should queue multiple images for segmentation', async () => {
      const result = await segmentationService.queueBatchSegmentation(
        testImageIds,
        testProjectId,
        testUserId
      );

      expect(result.queued).toHaveLength(3);
      expect(result.skipped).toHaveLength(0);
      expect(result.errors).toHaveLength(0);

      // Verify all images are queued
      const queueResult = await pool.query(
        'SELECT COUNT(*) FROM segmentation_queue WHERE image_id = ANY($1)',
        [testImageIds]
      );
      expect(parseInt(queueResult.rows[0].count)).toBe(3);
    });

    it('should skip already segmented images', async () => {
      // Mark one image as completed
      await pool.query('UPDATE images SET segmentation_status = $1 WHERE id = $2', [
        'completed',
        testImageIds[0],
      ]);

      const result = await segmentationService.queueBatchSegmentation(
        testImageIds,
        testProjectId,
        testUserId
      );

      expect(result.queued).toHaveLength(2);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]).toHaveProperty('imageId', testImageIds[0]);
    });
  });

  describe('processSegmentation', () => {
    beforeEach(async () => {
      // Queue the image first
      await segmentationService.queueSegmentation(testImageId, testUserId);

      // Mock ML service response
      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          result: {
            mask_url: 'http://test.com/mask.png',
            cells: [
              {
                id: 'cell_1',
                polygon: [
                  [10, 10],
                  [20, 10],
                  [20, 20],
                  [10, 20],
                ],
                centroid: [15, 15],
                area: 100,
                perimeter: 40,
                circularity: 0.78,
                eccentricity: 0.1,
                solidity: 0.95,
                mean_intensity: 128,
                features: {
                  texture_contrast: 0.5,
                  texture_homogeneity: 0.8,
                },
              },
            ],
            metadata: {
              processing_time: 2.5,
              model_version: '1.0',
              confidence: 0.95,
            },
          },
        },
      });
    });

    it('should process segmentation successfully', async () => {
      const result = await segmentationService.processSegmentation(testImageId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('segmentationId');
      expect(result).toHaveProperty('cellCount', 1);

      // Verify segmentation result in database
      const segResult = await pool.query('SELECT * FROM segmentation_results WHERE image_id = $1', [
        testImageId,
      ]);
      expect(segResult.rows).toHaveLength(1);
      expect(segResult.rows[0].status).toBe('completed');

      // Verify cells in database
      const cellResult = await pool.query('SELECT * FROM cells WHERE image_id = $1', [testImageId]);
      expect(cellResult.rows).toHaveLength(1);
      expect(cellResult.rows[0].area).toBe(100);

      // Verify image status updated
      const imageResult = await pool.query('SELECT segmentation_status FROM images WHERE id = $1', [
        testImageId,
      ]);
      expect(imageResult.rows[0].segmentation_status).toBe('completed');

      // Verify queue entry updated
      const queueResult = await pool.query(
        'SELECT status FROM segmentation_queue WHERE image_id = $1',
        [testImageId]
      );
      expect(queueResult.rows[0].status).toBe('completed');
    });

    it('should handle ML service errors', async () => {
      // Mock ML service error
      mockedAxios.post.mockRejectedValue(new Error('ML service unavailable'));

      await expect(segmentationService.processSegmentation(testImageId)).rejects.toThrow(
        'ML service unavailable'
      );

      // Verify status is failed
      const queueResult = await pool.query(
        'SELECT status FROM segmentation_queue WHERE image_id = $1',
        [testImageId]
      );
      expect(queueResult.rows[0].status).toBe('failed');

      const imageResult = await pool.query('SELECT segmentation_status FROM images WHERE id = $1', [
        testImageId,
      ]);
      expect(imageResult.rows[0].segmentation_status).toBe('failed');
    });

    it('should handle empty segmentation results', async () => {
      // Mock ML service response with no cells
      mockedAxios.post.mockResolvedValue({
        data: {
          success: true,
          result: {
            mask_url: 'http://test.com/mask.png',
            cells: [],
            metadata: {
              processing_time: 1.5,
              model_version: '1.0',
              confidence: 0.95,
            },
          },
        },
      });

      const result = await segmentationService.processSegmentation(testImageId);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('cellCount', 0);

      // Verify no cells in database
      const cellResult = await pool.query('SELECT * FROM cells WHERE image_id = $1', [testImageId]);
      expect(cellResult.rows).toHaveLength(0);
    });
  });

  describe('getSegmentationStatus', () => {
    it('should get status of queued segmentation', async () => {
      await segmentationService.queueSegmentation(testImageId, testUserId);

      const status = await segmentationService.getSegmentationStatus(testImageId);

      expect(status).toHaveProperty('imageId', testImageId);
      expect(status).toHaveProperty('status', 'queued');
      expect(status).toHaveProperty('progress', 0);
    });

    it('should get status of completed segmentation', async () => {
      // Create completed segmentation
      await pool.query('UPDATE images SET segmentation_status = $1 WHERE id = $2', [
        'completed',
        testImageId,
      ]);

      const segmentationId = uuidv4();
      await pool.query(
        `INSERT INTO segmentation_results (id, image_id, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [segmentationId, testImageId, 'completed', JSON.stringify({ cellCount: 5 })]
      );

      const status = await segmentationService.getSegmentationStatus(testImageId);

      expect(status).toHaveProperty('status', 'completed');
      expect(status).toHaveProperty('segmentationId', segmentationId);
      expect(status).toHaveProperty('completedAt');
    });
  });

  describe('retryFailedSegmentation', () => {
    beforeEach(async () => {
      // Create failed segmentation
      await pool.query('UPDATE images SET segmentation_status = $1 WHERE id = $2', [
        'failed',
        testImageId,
      ]);

      await pool.query(
        `INSERT INTO segmentation_queue (id, image_id, status, error_message) 
         VALUES ($1, $2, $3, $4)`,
        [uuidv4(), testImageId, 'failed', 'Previous error']
      );
    });

    it('should retry failed segmentation', async () => {
      const result = await segmentationService.retryFailedSegmentation(testImageId, testUserId);

      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('status', 'queued');

      // Verify queue updated
      const queueResult = await pool.query(
        'SELECT status, retry_count FROM segmentation_queue WHERE image_id = $1',
        [testImageId]
      );
      expect(queueResult.rows[0].status).toBe('queued');
      expect(queueResult.rows[0].retry_count).toBe(1);
    });

    it('should not retry if max retries exceeded', async () => {
      // Update retry count to max
      await pool.query('UPDATE segmentation_queue SET retry_count = $1 WHERE image_id = $2', [
        3,
        testImageId,
      ]);

      await expect(
        segmentationService.retryFailedSegmentation(testImageId, testUserId)
      ).rejects.toThrow('Maximum retry attempts');
    });
  });

  describe('deleteSegmentationResults', () => {
    beforeEach(async () => {
      // Create segmentation results
      const segmentationId = uuidv4();
      await pool.query(
        `INSERT INTO segmentation_results (id, image_id, status, metadata) 
         VALUES ($1, $2, $3, $4)`,
        [segmentationId, testImageId, 'completed', '{}']
      );

      // Create cells
      for (let i = 0; i < 3; i++) {
        await pool.query(
          `INSERT INTO cells (id, image_id, segmentation_result_id, cell_index, polygon, area) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [uuidv4(), testImageId, segmentationId, i, '[[0,0],[10,0],[10,10],[0,10]]', 100]
        );
      }

      await pool.query('UPDATE images SET segmentation_status = $1 WHERE id = $2', [
        'completed',
        testImageId,
      ]);
    });

    it('should delete segmentation results and cells', async () => {
      await segmentationService.deleteSegmentationResults(testImageId);

      // Verify results deleted
      const segResult = await pool.query('SELECT * FROM segmentation_results WHERE image_id = $1', [
        testImageId,
      ]);
      expect(segResult.rows).toHaveLength(0);

      // Verify cells deleted
      const cellResult = await pool.query('SELECT * FROM cells WHERE image_id = $1', [testImageId]);
      expect(cellResult.rows).toHaveLength(0);

      // Verify image status reset
      const imageResult = await pool.query('SELECT segmentation_status FROM images WHERE id = $1', [
        testImageId,
      ]);
      expect(imageResult.rows[0].segmentation_status).toBe('without_segmentation');
    });
  });
});
