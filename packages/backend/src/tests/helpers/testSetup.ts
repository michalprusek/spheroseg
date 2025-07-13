/**
 * Test Setup Helpers
 * Common utilities for setting up test data
 */

import { v4 as uuidv4 } from 'uuid';
import bcryptjs from 'bcryptjs';
import pool from '../../db';
import config from '../../config';

/**
 * Create a test user
 */
export async function createTestUser(
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    role: string;
    is_approved: boolean;
  }> = {}
) {
  const userId = uuidv4();
  const email = overrides.email || `test-${userId}@example.com`;
  const password = overrides.password || 'testpassword123';
  const passwordHash = await bcryptjs.hash(password, config.auth.saltRounds);

  const userResult = await pool.query(
    `INSERT INTO users (id, email, password_hash, name, role, is_approved, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     RETURNING *`,
    [
      userId,
      email,
      passwordHash,
      overrides.name || 'Test User',
      overrides.role || 'user',
      overrides.is_approved !== false,
    ]
  );

  // Create user profile
  await pool.query(
    `INSERT INTO user_profiles (user_id, full_name)
     VALUES ($1, $2)`,
    [userId, overrides.name || 'Test User']
  );

  return {
    ...userResult.rows[0],
    password, // Return plain password for testing
  };
}

/**
 * Create a test project
 */
export async function createTestProject(
  userId: string,
  overrides: Partial<{
    title: string;
    description: string;
    public: boolean;
  }> = {}
) {
  const projectId = uuidv4();

  const result = await pool.query(
    `INSERT INTO projects (id, user_id, title, description, public, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     RETURNING *`,
    [
      projectId,
      userId,
      overrides.title || 'Test Project',
      overrides.description || 'Test project description',
      overrides.public || false,
    ]
  );

  return result.rows[0];
}

/**
 * Create a test image
 */
export async function createTestImage(
  projectId: string,
  overrides: Partial<{
    name: string;
    filename: string;
    original_filename: string;
    file_size: number;
    width: number;
    height: number;
    segmentation_status: string;
  }> = {}
) {
  const imageId = uuidv4();

  const result = await pool.query(
    `INSERT INTO images (
      id, project_id, name, filename, original_filename, 
      file_size, width, height, segmentation_status, uploaded_at
    )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     RETURNING *`,
    [
      imageId,
      projectId,
      overrides.name || 'test-image.jpg',
      overrides.filename || `${imageId}.jpg`,
      overrides.original_filename || 'test-image.jpg',
      overrides.file_size || 1024000,
      overrides.width || 1920,
      overrides.height || 1080,
      overrides.segmentation_status || 'without_segmentation',
    ]
  );

  return result.rows[0];
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  userIds: string[] = [],
  projectIds: string[] = [],
  imageIds: string[] = []
) {
  const client = await pool.getPool().connect();

  try {
    await client.query('BEGIN');

    // Delete in reverse order of dependencies
    if (imageIds.length > 0) {
      await client.query('DELETE FROM cells WHERE image_id = ANY($1)', [imageIds]);
      await client.query('DELETE FROM segmentation_results WHERE image_id = ANY($1)', [imageIds]);
      await client.query('DELETE FROM images WHERE id = ANY($1)', [imageIds]);
    }

    if (projectIds.length > 0) {
      await client.query('DELETE FROM project_shares WHERE project_id = ANY($1)', [projectIds]);
      await client.query('DELETE FROM projects WHERE id = ANY($1)', [projectIds]);
    }

    if (userIds.length > 0) {
      await client.query('DELETE FROM refresh_tokens WHERE user_id = ANY($1)', [userIds]);
      await client.query('DELETE FROM user_profiles WHERE user_id = ANY($1)', [userIds]);
      await client.query('DELETE FROM users WHERE id = ANY($1)', [userIds]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Generate a valid JWT token for testing
 */
export function generateTestToken(user: { id: string; email: string; role?: string }) {
  // This is a mock implementation - in real tests you might want to use the actual tokenService
  return 'test-jwt-token';
}
