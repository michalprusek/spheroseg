/**
 * Integration tests for ImageDeleteService with proper database transactions
 * 
 * This file demonstrates the correct way to test database operations using
 * the new transaction utilities from testDatabase.ts
 */

import { 
  withTransaction, 
  createTestTransaction, 
  TestDataFactory,
  testDatabaseConnection,
  type TestTransaction
} from '../../__tests__/helpers/testDatabase';
import pool from '../../config/database';
import type { PoolClient } from 'pg';

// The service under test
const imageDeleteService = require('../imageDeleteService').default;

// Mock dependencies
jest.mock('../../utils/logger', () => ({
  default: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('../cacheService', () => ({
  default: {
    invalidateImageList: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('../../utils/imageUtils.unified', () => ({
  default: {
    dbPathToFilesystemPath: jest.fn((dbPath: string, uploadDir: string) => {
      return `${uploadDir}/${dbPath}`;
    }),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getFilesInDirectory: jest.fn().mockResolvedValue([])
  }
}));

jest.mock('fs', () => ({
  rmdirSync: jest.fn()
}));

// Mock projectService to control access permissions
jest.mock('../projectService', () => ({
  getProjectById: jest.fn()
}));

describe('ImageDeleteService Integration Tests', () => {
  let mockProjectService: any;
  
  beforeAll(async () => {
    // Verify database connection
    const isConnected = await testDatabaseConnection();
    if (!isConnected) {
      throw new Error('Database connection failed - ensure test database is running');
    }
    
    // Get mocked projectService
    mockProjectService = require('../projectService');
  });

  afterAll(async () => {
    // Ensure pool is closed after all tests
    await pool.end();
  });

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Reset mock implementations
    const imageUtils = require('../../utils/imageUtils.unified').default;
    imageUtils.deleteFile.mockResolvedValue(undefined);
    imageUtils.getFilesInDirectory.mockResolvedValue([]);
  });

  describe('deleteImage with transactions', () => {
    it('should delete image and all related data within transaction, then rollback', async () => {
      // Use withTransaction to ensure automatic rollback
      await withTransaction(async (client: PoolClient) => {
        // Step 1: Create test data within the transaction
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        const projectData = TestDataFactory.createProject(userId);
        const projectResult = await client.query(
          'INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING id',
          [projectData.name, projectData.description, userId]
        );
        const projectId = projectResult.rows[0].id;

        const imageData = TestDataFactory.createImage(projectId);
        const imageResult = await client.query(
          `INSERT INTO images (project_id, name, storage_path, thumbnail_path, file_size, width, height, segmentation_status) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
          [projectId, imageData.name, imageData.file_path, '/thumbnails/thumb.jpg', 
           imageData.file_size, imageData.width, imageData.height, imageData.segmentation_status]
        );
        const imageId = imageResult.rows[0].id;

        // Create related segmentation data
        await client.query(
          'INSERT INTO segmentation_results (image_id, result_data) VALUES ($1, $2)',
          [imageId, JSON.stringify({ cells: [], polygons: [] })]
        );

        // Step 2: Mock project service to grant access
        mockProjectService.getProjectById.mockResolvedValue({
          id: projectId,
          name: projectData.name,
          user_id: userId,
          is_owner: true,
          permission: 'owner'
        });

        // Step 3: Test the delete operation
        const result = await imageDeleteService.deleteImage(imageId, projectId, userId);
        
        // Step 4: Verify the result
        expect(result.success).toBe(true);
        expect(result.imageId).toBe(imageId);
        expect(result.error).toBeUndefined();

        // Step 5: Verify data was actually deleted (within same transaction)
        const segmentationCheck = await client.query(
          'SELECT * FROM segmentation_results WHERE image_id = $1',
          [imageId]
        );
        expect(segmentationCheck.rows).toHaveLength(0);

        const imageCheck = await client.query(
          'SELECT * FROM images WHERE id = $1',
          [imageId]
        );
        expect(imageCheck.rows).toHaveLength(0);

        // Step 6: Verify external operations were called
        const imageUtils = require('../../utils/imageUtils.unified').default;
        expect(imageUtils.deleteFile).toHaveBeenCalledWith(
          expect.stringContaining(imageData.file_path)
        );
        expect(imageUtils.deleteFile).toHaveBeenCalledWith(
          expect.stringContaining('thumb.jpg')
        );

        const cacheService = require('../cacheService').default;
        expect(cacheService.invalidateImageList).toHaveBeenCalledWith(projectId);

        // Transaction will be automatically rolled back after this block
      });

      // After rollback, verify nothing was persisted to the database
      const checkResult = await pool.query(
        "SELECT COUNT(*) FROM users WHERE email LIKE '%@test.%'"
      );
      expect(parseInt(checkResult.rows[0].count)).toBe(0);
    });

    it('should handle permission denial correctly', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create two users - owner and non-owner
        const ownerData = TestDataFactory.createUser({ email: 'owner@test.com' });
        const ownerResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [ownerData.email, 'hashed_password', ownerData.name]
        );
        const ownerId = ownerResult.rows[0].id;

        const otherUserData = TestDataFactory.createUser({ email: 'other@test.com' });
        const otherUserResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [otherUserData.email, 'hashed_password', otherUserData.name]
        );
        const otherUserId = otherUserResult.rows[0].id;

        // Create project owned by first user
        const projectData = TestDataFactory.createProject(ownerId);
        const projectResult = await client.query(
          'INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING id',
          [projectData.name, projectData.description, ownerId]
        );
        const projectId = projectResult.rows[0].id;

        // Create image in the project
        const imageData = TestDataFactory.createImage(projectId);
        const imageResult = await client.query(
          'INSERT INTO images (project_id, name, storage_path, file_size) VALUES ($1, $2, $3, $4) RETURNING id',
          [projectId, imageData.name, imageData.file_path, imageData.file_size]
        );
        const imageId = imageResult.rows[0].id;

        // Mock project service to deny access (view-only permission)
        mockProjectService.getProjectById.mockResolvedValue({
          id: projectId,
          name: projectData.name,
          user_id: ownerId,
          is_owner: false,
          permission: 'view'
        });

        // Try to delete as non-owner with view-only permission
        const result = await imageDeleteService.deleteImage(imageId, projectId, otherUserId);
        
        expect(result.success).toBe(false);
        expect(result.error).toContain("You need 'edit' or 'owner' permission");

        // Verify image still exists
        const imageCheck = await client.query(
          'SELECT * FROM images WHERE id = $1',
          [imageId]
        );
        expect(imageCheck.rows).toHaveLength(1);

        // Verify no file operations were attempted
        const imageUtils = require('../../utils/imageUtils.unified').default;
        expect(imageUtils.deleteFile).not.toHaveBeenCalled();
      });
    });

    it('should handle database errors with proper rollback', async () => {
      // Use manual transaction control to simulate errors
      const transaction = await createTestTransaction();
      
      try {
        // Create initial data
        const userData = TestDataFactory.createUser();
        const userResult = await transaction.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        const projectData = TestDataFactory.createProject(userId);
        const projectResult = await transaction.query(
          'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id',
          [projectData.name, userId]
        );
        const projectId = projectResult.rows[0].id;

        // Create image without required fields to simulate constraint violation
        try {
          await transaction.query(
            'INSERT INTO images (project_id) VALUES ($1) RETURNING id',
            [projectId]
          );
          fail('Should have thrown an error');
        } catch (error) {
          // Expected error - rollback to savepoint
          await transaction.rollback();
          
          // Verify no data was persisted
          const projectCheck = await pool.query(
            'SELECT * FROM projects WHERE id = $1',
            [projectId]
          );
          expect(projectCheck.rows).toHaveLength(0);
        }
      } finally {
        transaction.release();
      }
    });
  });

  describe('deleteMultipleImages with transactions', () => {
    it('should handle batch deletion with proper transaction management', async () => {
      // Create test data outside transaction first
      const setupTransaction = await createTestTransaction();
      let userId: string;
      let projectId: string;
      const imageIds: string[] = [];
      
      try {
        // Setup test data
        const userData = TestDataFactory.createUser({ email: 'batch-test@example.com' });
        const userResult = await setupTransaction.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed', userData.name]
        );
        userId = userResult.rows[0].id;

        const projectData = TestDataFactory.createProject(userId, { name: 'Batch Test Project' });
        const projectResult = await setupTransaction.query(
          'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id',
          [projectData.name, userId]
        );
        projectId = projectResult.rows[0].id;

        // Create multiple images
        for (let i = 0; i < 3; i++) {
          const imageData = TestDataFactory.createImage(projectId, {
            name: `test-${i}.jpg`,
            file_path: `/test/path/test-${i}.jpg`
          });
          const imageResult = await setupTransaction.query(
            'INSERT INTO images (project_id, name, storage_path, file_size) VALUES ($1, $2, $3, $4) RETURNING id',
            [projectId, imageData.name, imageData.file_path, imageData.file_size]
          );
          imageIds.push(imageResult.rows[0].id);
        }

        // Mock project service
        mockProjectService.getProjectById.mockResolvedValue({
          id: projectId,
          name: projectData.name,
          user_id: userId,
          is_owner: true,
          permission: 'owner'
        });

        // Commit setup data
        await setupTransaction.commit();

        // Test batch delete
        const results = await imageDeleteService.deleteMultipleImages(imageIds, projectId, userId);
        
        // Verify results
        expect(results).toHaveLength(3);
        expect(results.every((r: any) => r.success)).toBe(true);
        expect(results.every((r: any) => !r.error)).toBe(true);

        // Verify all images are deleted
        const checkResult = await pool.query(
          'SELECT COUNT(*) FROM images WHERE id = ANY($1)',
          [imageIds]
        );
        expect(parseInt(checkResult.rows[0].count)).toBe(0);

        // Clean up test data
        await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      } catch (error) {
        // Ensure cleanup even on test failure
        await setupTransaction.rollback();
        throw error;
      } finally {
        setupTransaction.release();
      }
    });
  });

  describe('canDeleteImage', () => {
    it('should correctly check delete permissions', async () => {
      await withTransaction(async (client: PoolClient) => {
        // Create test data
        const userData = TestDataFactory.createUser();
        const userResult = await client.query(
          'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id',
          [userData.email, 'hashed_password', userData.name]
        );
        const userId = userResult.rows[0].id;

        const projectData = TestDataFactory.createProject(userId);
        const projectResult = await client.query(
          'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id',
          [projectData.name, userId]
        );
        const projectId = projectResult.rows[0].id;

        const imageData = TestDataFactory.createImage(projectId);
        const imageResult = await client.query(
          'INSERT INTO images (project_id, name, storage_path) VALUES ($1, $2, $3) RETURNING id',
          [projectId, imageData.name, imageData.file_path]
        );
        const imageId = imageResult.rows[0].id;

        // Test canDeleteImage
        const canDelete = await imageDeleteService.canDeleteImage(imageId, projectId, userId);
        
        expect(canDelete).toBe(true);
      });
    });
  });

  describe('storage quota updates', () => {
    it('should properly update user storage quota within transaction', async () => {
      await withTransaction(async (client: PoolClient) => {
        // First check if storage_used_bytes column exists
        const columnCheck = await client.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'storage_used_bytes'"
        );
        
        if (columnCheck.rows.length === 0) {
          // Add the column for testing
          await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_used_bytes BIGINT DEFAULT 0');
        }

        // Create test data with initial storage usage
        const userData = TestDataFactory.createUser();
        const initialStorage = 1000000; // 1MB
        const userResult = await client.query(
          'INSERT INTO users (email, password, name, storage_used_bytes) VALUES ($1, $2, $3, $4) RETURNING id',
          [userData.email, 'hashed_password', userData.name, initialStorage]
        );
        const userId = userResult.rows[0].id;

        const projectData = TestDataFactory.createProject(userId);
        const projectResult = await client.query(
          'INSERT INTO projects (name, user_id) VALUES ($1, $2) RETURNING id',
          [projectData.name, userId]
        );
        const projectId = projectResult.rows[0].id;

        const fileSize = 500000; // 500KB
        const imageData = TestDataFactory.createImage(projectId);
        const imageResult = await client.query(
          'INSERT INTO images (project_id, name, storage_path, file_size) VALUES ($1, $2, $3, $4) RETURNING id',
          [projectId, imageData.name, imageData.file_path, fileSize]
        );
        const imageId = imageResult.rows[0].id;

        // Mock project service
        mockProjectService.getProjectById.mockResolvedValue({
          id: projectId,
          name: projectData.name,
          user_id: userId,
          is_owner: true,
          permission: 'owner'
        });

        // Delete the image
        const result = await imageDeleteService.deleteImage(imageId, projectId, userId);
        
        expect(result.success).toBe(true);

        // Check storage was updated correctly
        const userCheck = await client.query(
          'SELECT storage_used_bytes FROM users WHERE id = $1',
          [userId]
        );
        const newStorage = parseInt(userCheck.rows[0].storage_used_bytes);
        expect(newStorage).toBe(initialStorage - fileSize); // 1MB - 500KB = 500KB
      });
    });
  });
});