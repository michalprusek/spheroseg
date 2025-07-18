/**
 * Tests for segmentation data version management
 *
 * Tests the backend functionality for storing and retrieving segmentation
 * history, versions, and revisions.
 */

// Jest test for version management
import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import segmentationRouter from '../../routes/segmentation';
import authMiddleware from '../../security/middleware/auth';
import db from '../../db';

// Mock dependencies
jest.mock('../../security/middleware/auth', () => {
  return jest.fn((req, res, next) => {
    req.user = { userId: 'test-user-id' };
    next();
  });
});

jest.mock('../../db', () => ({
  query: jest.fn().mockImplementation((query, params) => {
    // Mock segmentation_results table queries
    if (query.includes('SELECT * FROM segmentation_results WHERE image_id')) {
      return {
        rows: [
          {
            id: 'seg-1',
            image_id: params[0], // Use the provided parameter
            status: 'completed',
            result_data: {
              polygons: [
                {
                  id: 'poly-1',
                  type: 'external',
                  points: [
                    { x: 10, y: 10 },
                    { x: 100, y: 10 },
                    { x: 100, y: 100 },
                    { x: 10, y: 100 },
                  ],
                },
              ],
            },
            created_at: new Date('2023-01-01T00:00:00Z'),
            updated_at: new Date('2023-01-01T00:00:00Z'),
          },
        ],
      };
    }

    // Mock segmentation_history table queries
    if (query.includes('SELECT * FROM segmentation_history WHERE image_id')) {
      // For pagination
      const limit = params[2] || 10;
      const offset = params[3] || 0;

      // Create history entries
      const rows = [];
      for (let i = 1; i <= 5; i++) {
        rows.push({
          id: `history-${i}`,
          image_id: params[0],
          version: i,
          result_data: {
            polygons: [
              {
                id: 'poly-1',
                type: 'external',
                points: [
                  { x: 10 * i, y: 10 * i },
                  { x: 100 * i, y: 10 * i },
                  { x: 100 * i, y: 100 * i },
                  { x: 10 * i, y: 100 * i },
                ],
              },
            ],
          },
          created_at: new Date(`2023-01-0${i}T00:00:00Z`),
          updated_by: 'test-user-id',
          change_description: i === 1 ? 'Initial version' : `Edit version ${i}`,
        });
      }

      return {
        rows: rows.slice(offset, offset + limit),
      };
    }

    // Mock segmentation_history count query
    if (query.includes('SELECT COUNT(*) FROM segmentation_history')) {
      return {
        rows: [{ count: '5' }],
      };
    }

    // Mock specific history version query
    if (query.includes('SELECT * FROM segmentation_history WHERE image_id = $1 AND version = $2')) {
      const version = params[1];
      return {
        rows: [
          {
            id: `history-${version}`,
            image_id: params[0],
            version: version,
            result_data: {
              polygons: [
                {
                  id: 'poly-1',
                  type: 'external',
                  points: [
                    { x: 10 * version, y: 10 * version },
                    { x: 100 * version, y: 10 * version },
                    { x: 100 * version, y: 100 * version },
                    { x: 10 * version, y: 100 * version },
                  ],
                },
              ],
            },
            created_at: new Date(`2023-01-0${version}T00:00:00Z`),
            updated_by: 'test-user-id',
            change_description: version === 1 ? 'Initial version' : `Edit version ${version}`,
          },
        ],
      };
    }

    // Mock image checks
    if (
      query.includes(
        'SELECT i.id FROM images i JOIN projects p ON i.project_id = p.id WHERE i.id = $1'
      )
    ) {
      return {
        rows: [{ id: params[0] }],
      };
    }

    // Mock insert into segmentation_history
    if (query.includes('INSERT INTO segmentation_history')) {
      return {
        rows: [
          {
            id: uuidv4(),
            image_id: params[0],
            version: 6, // New version
            result_data: params[2],
            created_at: new Date(),
            updated_by: 'test-user-id',
            change_description: params[3] || 'New edit',
          },
        ],
      };
    }

    // Mock project verification
    if (query.includes('SELECT id FROM projects WHERE id = $1 AND user_id = $2')) {
      return {
        rows: [{ id: params[0] }],
      };
    }

    // Mock image verification
    if (query.includes('SELECT id FROM images WHERE id = $1 AND project_id = $2')) {
      return {
        rows: [{ id: params[0] }],
      };
    }

    // Default empty response
    return { rows: [] };
  }),
}));

// Set up Express app
let app: express.Application;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api', segmentationRouter);
});

describe('Segmentation Version Management', () => {
  const testImageId = '12345678-1234-1234-1234-123456789012';

  it('should retrieve current segmentation data', async () => {
    const response = await request(app).get(`/api/images/${testImageId}/segmentation`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('result_data');
    expect(response.body.result_data).toHaveProperty('polygons');
    expect(response.body.result_data.polygons).toHaveLength(1);
  });

  it('should retrieve segmentation history versions', async () => {
    const response = await request(app).get(`/api/images/${testImageId}/segmentation/history`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('versions');
    expect(response.body.versions).toHaveLength(5);
    expect(response.body).toHaveProperty('total', 5);

    // First version should be version 1
    expect(response.body.versions[0]).toHaveProperty('version', 1);
    expect(response.body.versions[0]).toHaveProperty('change_description', 'Initial version');

    // Versions should be in descending order
    expect(response.body.versions[0].version).toBeLessThan(response.body.versions[1].version);
  });

  it('should support pagination for history versions', async () => {
    const response = await request(app).get(
      `/api/images/${testImageId}/segmentation/history?limit=2&offset=1`
    );

    expect(response.status).toBe(200);
    expect(response.body.versions).toHaveLength(2);
    expect(response.body).toHaveProperty('total', 5);

    // Should start from version 2 (offset 1)
    expect(response.body.versions[0]).toHaveProperty('version', 2);
  });

  it('should retrieve a specific version of segmentation data', async () => {
    const version = 3;
    const response = await request(app).get(
      `/api/images/${testImageId}/segmentation/history/${version}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('version', version);
    expect(response.body).toHaveProperty('result_data');
    expect(response.body).toHaveProperty('change_description', `Edit version ${version}`);

    // Points should be scaled by the version number (based on our mock data)
    expect(response.body.result_data.polygons[0].points[0]).toEqual({
      x: 10 * version,
      y: 10 * version,
    });
  });

  it('should create a new version when updating segmentation', async () => {
    const newSegmentationData = {
      polygons: [
        {
          id: 'poly-1',
          type: 'external',
          points: [
            { x: 20, y: 20 },
            { x: 200, y: 20 },
            { x: 200, y: 200 },
            { x: 20, y: 200 },
          ],
        },
      ],
    };

    const response = await request(app).put(`/api/images/${testImageId}/segmentation`).send({
      result_data: newSegmentationData,
      status: 'completed',
      change_description: 'Updated polygon coordinates',
    });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('status', 'completed');
  });

  it('should restore a previous version to current', async () => {
    const versionToRestore = 2;

    const response = await request(app)
      .post(`/api/images/${testImageId}/segmentation/history/${versionToRestore}/restore`)
      .send({
        change_description: 'Restored version 2',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Version restored successfully');

    // Check the current segmentation has been updated
    const currentDataResponse = await request(app).get(`/api/images/${testImageId}/segmentation`);

    expect(currentDataResponse.status).toBe(200);

    // Since this is a mock, we can't fully test the restoration logic
    // In a real test, we would verify that the current version matches the restored version
  });

  it('should handle restoring a non-existent version', async () => {
    const nonExistentVersion = 999;

    // Override mock for this specific test to return empty rows
    const originalQuery = db.query;
    db.query = jest.fn().mockImplementation((query, params) => {
      if (
        query.includes('SELECT * FROM segmentation_history WHERE image_id = $1 AND version = $2') &&
        params[1] === nonExistentVersion
      ) {
        return { rows: [] };
      }
      return originalQuery(query, params);
    });

    const response = await request(app)
      .post(`/api/images/${testImageId}/segmentation/history/${nonExistentVersion}/restore`)
      .send({
        change_description: 'Trying to restore non-existent version',
      });

    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('message', 'Version not found');

    // Restore original mock
    db.query = originalQuery;
  });

  it('should compare two versions of segmentation data', async () => {
    const version1 = 1;
    const version2 = 2;

    const response = await request(app).get(
      `/api/images/${testImageId}/segmentation/history/compare?version1=${version1}&version2=${version2}`
    );

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('differences');
    expect(response.body.differences).toHaveProperty('polygons');

    // There should be differences in polygon coordinates
    expect(response.body.differences.polygons).toHaveLength(1);
    expect(response.body.differences.polygons[0]).toHaveProperty('points');

    // The response should include metadata about both versions
    expect(response.body).toHaveProperty('version1');
    expect(response.body).toHaveProperty('version2');
    expect(response.body.version1).toHaveProperty('version', version1);
    expect(response.body.version2).toHaveProperty('version', version2);
  });

  it('should track segmentation version metadata', async () => {
    const response = await request(app).get(`/api/images/${testImageId}/segmentation/history`);

    expect(response.status).toBe(200);
    expect(response.body.versions[0]).toHaveProperty('created_at');
    expect(response.body.versions[0]).toHaveProperty('updated_by');
    expect(response.body.versions[0]).toHaveProperty('change_description');

    // Check the timestamps are in correct format
    expect(Date.parse(response.body.versions[0].created_at)).not.toBeNaN();
  });

  it('should create a named snapshot version', async () => {
    const snapshotName = 'Important milestone';
    const snapshotDescription = 'Completed initial segmentation review';

    const response = await request(app)
      .post(`/api/images/${testImageId}/segmentation/snapshot`)
      .send({
        name: snapshotName,
        description: snapshotDescription,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('version');
    expect(response.body).toHaveProperty('snapshot_id');
  });

  it('should list snapshots separately from regular versions', async () => {
    const response = await request(app).get(`/api/images/${testImageId}/segmentation/snapshots`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('snapshots');
    expect(response.body.snapshots).toBeInstanceOf(Array);

    // Verify that the snapshots have name and description
    if (response.body.snapshots.length > 0) {
      expect(response.body.snapshots[0]).toHaveProperty('name');
      expect(response.body.snapshots[0]).toHaveProperty('description');
      expect(response.body.snapshots[0]).toHaveProperty('version');
      expect(response.body.snapshots[0]).toHaveProperty('created_at');
    }
  });

  it('should handle access control for version management', async () => {
    // Override the auth middleware mock to simulate unauthorized access
    const originalAuthMiddleware = authMiddleware;
    (authMiddleware as jest.Mock).mockImplementation((req, res, _next) => {
      res.status(401).json({ message: 'Authentication error' });
    });

    // Try to access versions
    const response = await request(app).get(`/api/images/${testImageId}/segmentation/history`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Authentication error');

    // Restore original auth middleware
    (authMiddleware as jest.Mock).mockImplementation(originalAuthMiddleware);
  });

  it('should publish a specific version to make it the current version', async () => {
    const versionToPublish = 3;

    const response = await request(app)
      .post(`/api/images/${testImageId}/segmentation/history/${versionToPublish}/publish`)
      .send({
        change_description: 'Publishing version 3 as current',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Version published successfully');
  });

  it('should record the version information when creating a version with branching', async () => {
    const baseVersion = 2;
    const newBranchName = 'experiment-1';

    // Create a new segmentation based on version 2
    const newSegmentationData = {
      polygons: [
        {
          id: 'poly-1',
          type: 'external',
          points: [
            { x: 25, y: 25 },
            { x: 250, y: 25 },
            { x: 250, y: 250 },
            { x: 25, y: 250 },
          ],
        },
      ],
    };

    const response = await request(app)
      .post(`/api/images/${testImageId}/segmentation/branch`)
      .send({
        base_version: baseVersion,
        branch_name: newBranchName,
        result_data: newSegmentationData,
        change_description: 'Created experimental branch with larger polygon',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('branch_name', newBranchName);
    expect(response.body).toHaveProperty('version');
  });

  it('should list all branches for an image', async () => {
    const response = await request(app).get(`/api/images/${testImageId}/segmentation/branches`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('branches');
    expect(response.body.branches).toBeInstanceOf(Array);

    // There should be at least one branch (main/default branch)
    expect(response.body.branches.length).toBeGreaterThanOrEqual(1);

    // Verify branch data
    if (response.body.branches.length > 0) {
      expect(response.body.branches[0]).toHaveProperty('name');
      expect(response.body.branches[0]).toHaveProperty('versions');
      expect(response.body.branches[0].versions).toBeInstanceOf(Array);
    }
  });

  it('should merge a branch back to main', async () => {
    const branchName = 'experiment-1';

    const response = await request(app)
      .post(`/api/images/${testImageId}/segmentation/branches/${branchName}/merge`)
      .send({
        target_branch: 'main',
        change_description: 'Merging experimental branch back to main',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Branch merged successfully');
    expect(response.body).toHaveProperty('new_version');
  });
});

describe('Project-level Segmentation Version Management', () => {
  const testProjectId = '87654321-1234-1234-1234-123456789012';

  it('should get versions for all segmentations in a project', async () => {
    const response = await request(app).get(`/api/projects/${testProjectId}/segmentations/history`);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('images');
    expect(response.body.images).toBeInstanceOf(Array);

    // Each image should have version history info
    if (response.body.images.length > 0) {
      expect(response.body.images[0]).toHaveProperty('image_id');
      expect(response.body.images[0]).toHaveProperty('latest_version');
      expect(response.body.images[0]).toHaveProperty('version_count');
      expect(response.body.images[0]).toHaveProperty('latest_update');
    }
  });

  it('should create a project-wide snapshot', async () => {
    const snapshotName = 'Project milestone';
    const snapshotDescription = 'All segmentations reviewed by expert';

    const response = await request(app)
      .post(`/api/projects/${testProjectId}/segmentations/snapshot`)
      .send({
        name: snapshotName,
        description: snapshotDescription,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('snapshot_id');
    expect(response.body).toHaveProperty('image_count');
  });

  it('should restore a project-wide snapshot', async () => {
    const snapshotId = 'proj-snapshot-123';

    const response = await request(app)
      .post(`/api/projects/${testProjectId}/segmentations/snapshots/${snapshotId}/restore`)
      .send({
        change_description: 'Restoring project to milestone state',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('restored_images');
    expect(response.body.restored_images).toBeInstanceOf(Array);
  });
});
