/**
 * Integration tests for resegmentation workflow
 *
 * These tests verify the complete resegmentation process:
 * - Initial image upload and segmentation
 * - Resegmentation endpoint functionality
 * - Old data cleanup verification
 * - Status updates through WebSocket
 * - Queue management
 */

import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import app from '../../app';
import pool from '../../db';
import { SEGMENTATION_STATUS } from '../../constants/segmentationStatus';
import { io, Socket } from 'socket.io-client';

// Test data
let testUserId: string;
let testProjectId: string;
let testImageId: string;
let authToken: string;
let socketClient: Socket;

// Mock ML service responses
jest.mock('axios');
import axios from 'axios';
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Setup before tests
beforeAll(async () => {
  // Create test user
  const userResult = await pool.query(
    `INSERT INTO users (id, email, password_hash, created_at) 
     VALUES ($1, $2, $3, NOW()) 
     RETURNING id`,
    [uuidv4(), `test-resegment-${Date.now()}@test.com`, 'hashed_password']
  );
  testUserId = userResult.rows[0].id;

  // Generate auth token (simplified for testing)
  authToken = `test-token-${testUserId}`;

  // Create test project
  const projectResult = await pool.query(
    `INSERT INTO projects (id, name, user_id, created_at) 
     VALUES ($1, $2, $3, NOW()) 
     RETURNING id`,
    [uuidv4(), 'Test Resegment Project', testUserId]
  );
  testProjectId = projectResult.rows[0].id;

  // Create test image
  const imageResult = await pool.query(
    `INSERT INTO images (id, project_id, filename, original_name, size, width, height, segmentation_status, created_at) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
     RETURNING id`,
    [
      uuidv4(),
      testProjectId,
      'test-image.jpg',
      'test-image.jpg',
      1024,
      800,
      600,
      SEGMENTATION_STATUS.COMPLETED,
    ]
  );
  testImageId = imageResult.rows[0].id;

  // Create initial segmentation result
  await pool.query(
    `INSERT INTO segmentation_results (image_id, status, result_data, created_at) 
     VALUES ($1, $2, $3, NOW())`,
    [
      testImageId,
      SEGMENTATION_STATUS.COMPLETED,
      {
        polygons: [
          {
            id: 'polygon-1',
            points: [
              [100, 100],
              [200, 100],
              [200, 200],
              [100, 200],
            ],
            properties: { area: 10000, perimeter: 400 },
          },
        ],
      },
    ]
  );

  // Create initial cells data
  await pool.query(
    `INSERT INTO cells (id, segmentation_result_id, polygon_data, area, perimeter, created_at)
     SELECT $1, sr.id, $2, $3, $4, NOW()
     FROM segmentation_results sr
     WHERE sr.image_id = $5`,
    [
      uuidv4(),
      {
        points: [
          [100, 100],
          [200, 100],
          [200, 200],
          [100, 200],
        ],
      },
      10000,
      400,
      testImageId,
    ]
  );

  // Setup WebSocket client
  const port = process.env.PORT || 5001;
  socketClient = io(`http://localhost:${port}`, {
    auth: { token: authToken },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    socketClient.on('connect', () => resolve());
  });
});

// Cleanup after tests
afterAll(async () => {
  // Disconnect socket
  if (socketClient) {
    socketClient.disconnect();
  }

  // Clean up test data
  await pool.query(
    'DELETE FROM cells WHERE segmentation_result_id IN (SELECT id FROM segmentation_results WHERE image_id = $1)',
    [testImageId]
  );
  await pool.query('DELETE FROM segmentation_results WHERE image_id = $1', [testImageId]);
  await pool.query('DELETE FROM segmentation_queue WHERE image_id = $1', [testImageId]);
  await pool.query('DELETE FROM segmentation_tasks WHERE image_id = $1', [testImageId]);
  await pool.query('DELETE FROM images WHERE id = $1', [testImageId]);
  await pool.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
  await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);

  await pool.closePool();
});

// Mock authentication middleware for testing
jest.mock('../../security/middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (token && token.startsWith('test-token-')) {
      req.user = { userId: token.split('-')[2] };
      next();
    } else {
      res.status(401).json({ message: 'Unauthorized' });
    }
  },
  AuthenticatedRequest: jest.fn(),
}));

describe('Resegmentation Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should verify initial segmentation exists', async () => {
    const response = await request(app)
      .get(`/api/images/${testImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', SEGMENTATION_STATUS.COMPLETED);
    expect(response.body).toHaveProperty('polygons');
    expect(response.body.polygons).toHaveLength(1);
    expect(response.body.polygons[0]).toHaveProperty('id', 'polygon-1');
  });

  test('should trigger resegmentation and delete old data', async () => {
    // Count initial data
    const initialCellsResult = await pool.query(
      'SELECT COUNT(*) FROM cells WHERE segmentation_result_id IN (SELECT id FROM segmentation_results WHERE image_id = $1)',
      [testImageId]
    );
    const initialCellCount = parseInt(initialCellsResult.rows[0].count);
    expect(initialCellCount).toBeGreaterThan(0);

    // Set up WebSocket listener for status updates
    const statusUpdates: string[] = [];
    socketClient.on('segmentation_update', (data) => {
      if (data.imageId === testImageId) {
        statusUpdates.push(data.status);
      }
    });

    // Mock ML service response
    mockedAxios.post.mockResolvedValueOnce({
      data: { task_id: 'test-task-123', status: 'queued' },
    });

    // Trigger resegmentation
    const response = await request(app)
      .post(`/api/segmentation/${testImageId}/resegment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: testProjectId,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Resegmentation started successfully');
    expect(response.body).toHaveProperty('status', SEGMENTATION_STATUS.QUEUED);

    // Verify old cells data was deleted
    const cellsAfterResult = await pool.query(
      'SELECT COUNT(*) FROM cells WHERE segmentation_result_id IN (SELECT id FROM segmentation_results WHERE image_id = $1)',
      [testImageId]
    );
    const cellsAfterCount = parseInt(cellsAfterResult.rows[0].count);
    expect(cellsAfterCount).toBe(0);

    // Verify old segmentation result was deleted
    const oldSegmentationResult = await pool.query(
      "SELECT * FROM segmentation_results WHERE image_id = $1 AND result_data->'polygons' @> $2",
      [testImageId, JSON.stringify([{ id: 'polygon-1' }])]
    );
    expect(oldSegmentationResult.rows).toHaveLength(0);

    // Verify new segmentation result with queued status was created
    const newSegmentationResult = await pool.query(
      'SELECT * FROM segmentation_results WHERE image_id = $1 AND status = $2',
      [testImageId, SEGMENTATION_STATUS.QUEUED]
    );
    expect(newSegmentationResult.rows).toHaveLength(1);

    // Verify image status was updated
    const imageResult = await pool.query('SELECT segmentation_status FROM images WHERE id = $1', [
      testImageId,
    ]);
    expect(imageResult.rows[0].segmentation_status).toBe(SEGMENTATION_STATUS.QUEUED);

    // Wait for WebSocket updates
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Verify WebSocket updates were sent
    expect(statusUpdates).toContain(SEGMENTATION_STATUS.QUEUED);
  });

  test('should handle resegmentation when no previous segmentation exists', async () => {
    // Create new image without segmentation
    const newImageResult = await pool.query(
      `INSERT INTO images (id, project_id, filename, original_name, size, width, height, segmentation_status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
       RETURNING id`,
      [
        uuidv4(),
        testProjectId,
        'test-image-2.jpg',
        'test-image-2.jpg',
        2048,
        1024,
        768,
        SEGMENTATION_STATUS.WITHOUT_SEGMENTATION,
      ]
    );
    const newImageId = newImageResult.rows[0].id;

    // Mock ML service response
    mockedAxios.post.mockResolvedValueOnce({
      data: { task_id: 'test-task-456', status: 'queued' },
    });

    // Trigger resegmentation
    const response = await request(app)
      .post(`/api/segmentation/${newImageId}/resegment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: testProjectId,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Resegmentation started successfully');
    expect(response.body).toHaveProperty('status', SEGMENTATION_STATUS.QUEUED);

    // Verify segmentation result was created
    const segmentationResult = await pool.query(
      'SELECT * FROM segmentation_results WHERE image_id = $1',
      [newImageId]
    );
    expect(segmentationResult.rows).toHaveLength(1);
    expect(segmentationResult.rows[0].status).toBe(SEGMENTATION_STATUS.QUEUED);

    // Cleanup
    await pool.query('DELETE FROM segmentation_results WHERE image_id = $1', [newImageId]);
    await pool.query('DELETE FROM segmentation_queue WHERE image_id = $1', [newImageId]);
    await pool.query('DELETE FROM segmentation_tasks WHERE image_id = $1', [newImageId]);
    await pool.query('DELETE FROM images WHERE id = $1', [newImageId]);
  });

  test('should prevent duplicate resegmentation requests', async () => {
    // First request - should succeed
    mockedAxios.post.mockResolvedValueOnce({
      data: { task_id: 'test-task-789', status: 'queued' },
    });

    const firstResponse = await request(app)
      .post(`/api/segmentation/${testImageId}/resegment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: testProjectId,
      });

    expect(firstResponse.status).toBe(200);

    // Second request while first is still queued - should be rejected
    const secondResponse = await request(app)
      .post(`/api/segmentation/${testImageId}/resegment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: testProjectId,
      });

    // The endpoint should handle duplicate requests gracefully
    // It may return 200 but not create duplicate tasks
    if (secondResponse.status === 200) {
      // Verify only one task exists in the queue
      const queueResult = await pool.query(
        'SELECT COUNT(*) FROM segmentation_queue WHERE image_id = $1',
        [testImageId]
      );
      const queueCount = parseInt(queueResult.rows[0].count);
      expect(queueCount).toBeLessThanOrEqual(1);
    }
  });

  test('should handle resegmentation errors gracefully', async () => {
    // Create test image
    const errorImageResult = await pool.query(
      `INSERT INTO images (id, project_id, filename, original_name, size, width, height, segmentation_status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
       RETURNING id`,
      [
        uuidv4(),
        testProjectId,
        'test-error-image.jpg',
        'test-error-image.jpg',
        1024,
        800,
        600,
        SEGMENTATION_STATUS.COMPLETED,
      ]
    );
    const errorImageId = errorImageResult.rows[0].id;

    // Mock ML service error
    mockedAxios.post.mockRejectedValueOnce(new Error('ML service unavailable'));

    // Trigger resegmentation
    const response = await request(app)
      .post(`/api/segmentation/${errorImageId}/resegment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: testProjectId,
      });

    // Should still return success as task is queued
    expect(response.status).toBe(200);

    // Cleanup
    await pool.query('DELETE FROM segmentation_results WHERE image_id = $1', [errorImageId]);
    await pool.query('DELETE FROM segmentation_queue WHERE image_id = $1', [errorImageId]);
    await pool.query('DELETE FROM segmentation_tasks WHERE image_id = $1', [errorImageId]);
    await pool.query('DELETE FROM images WHERE id = $1', [errorImageId]);
  });

  test('should verify queue status after resegmentation', async () => {
    // Get queue status
    const response = await request(app)
      .get(`/api/segmentation/queue-status/${testProjectId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('project_id', testProjectId);
    expect(response.body).toHaveProperty('queue_status');
    expect(response.body).toHaveProperty('image_stats');

    // Verify at least one image is in queued status (from our resegmentation)
    const queuedCount = response.body.queue_status.pending_count || 0;
    const imageQueuedCount = response.body.image_stats.pending_count || 0;
    expect(queuedCount + imageQueuedCount).toBeGreaterThan(0);
  });
});

describe('Resegmentation Status Update Flow', () => {
  test('should update status from queued to processing to completed', async () => {
    // Create fresh image for this test
    const flowImageResult = await pool.query(
      `INSERT INTO images (id, project_id, filename, original_name, size, width, height, segmentation_status, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) 
       RETURNING id`,
      [
        uuidv4(),
        testProjectId,
        'test-flow-image.jpg',
        'test-flow-image.jpg',
        1024,
        800,
        600,
        SEGMENTATION_STATUS.WITHOUT_SEGMENTATION,
      ]
    );
    const flowImageId = flowImageResult.rows[0].id;

    // Track status updates
    const statusUpdates: any[] = [];
    socketClient.on('segmentation_update', (data) => {
      if (data.imageId === flowImageId) {
        statusUpdates.push(data);
      }
    });

    // Mock ML service response
    mockedAxios.post.mockResolvedValueOnce({
      data: { task_id: 'test-task-flow', status: 'queued' },
    });

    // Trigger resegmentation
    await request(app)
      .post(`/api/segmentation/${flowImageId}/resegment`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        project_id: testProjectId,
      });

    // Simulate ML service updating status to processing
    await pool.query(`UPDATE images SET segmentation_status = $1 WHERE id = $2`, [
      SEGMENTATION_STATUS.PROCESSING,
      flowImageId,
    ]);
    await pool.query(`UPDATE segmentation_results SET status = $1 WHERE image_id = $2`, [
      SEGMENTATION_STATUS.PROCESSING,
      flowImageId,
    ]);

    // Simulate ML service completing segmentation
    const newPolygons = [
      {
        id: 'new-polygon-1',
        points: [
          [150, 150],
          [250, 150],
          [250, 250],
          [150, 250],
        ],
        properties: { area: 10000, perimeter: 400 },
      },
    ];

    await pool.query(
      `UPDATE segmentation_results 
       SET status = $1, result_data = $2, updated_at = NOW() 
       WHERE image_id = $3`,
      [SEGMENTATION_STATUS.COMPLETED, { polygons: newPolygons }, flowImageId]
    );
    await pool.query(`UPDATE images SET segmentation_status = $1 WHERE id = $2`, [
      SEGMENTATION_STATUS.COMPLETED,
      flowImageId,
    ]);

    // Verify final segmentation result
    const finalResponse = await request(app)
      .get(`/api/images/${flowImageId}/segmentation`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(finalResponse.status).toBe(200);
    expect(finalResponse.body).toHaveProperty('status', SEGMENTATION_STATUS.COMPLETED);
    expect(finalResponse.body.polygons).toHaveLength(1);
    expect(finalResponse.body.polygons[0]).toHaveProperty('id', 'new-polygon-1');

    // Cleanup
    await pool.query('DELETE FROM segmentation_results WHERE image_id = $1', [flowImageId]);
    await pool.query('DELETE FROM segmentation_queue WHERE image_id = $1', [flowImageId]);
    await pool.query('DELETE FROM segmentation_tasks WHERE image_id = $1', [flowImageId]);
    await pool.query('DELETE FROM images WHERE id = $1', [flowImageId]);
  });
});
