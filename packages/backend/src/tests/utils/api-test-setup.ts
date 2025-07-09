/**
 * API Test Setup Utilities
 * This module provides helper functions for setting up API integration tests
 */
import { Server } from 'http';
import request from 'supertest';
import app from '../../server';
import jwt from 'jsonwebtoken';
import db from '../../db';
import { v4 as uuidv4 } from 'uuid';

// Interfaces
interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  token?: string;
}

interface TestProject {
  id: string;
  name: string;
  description: string;
  user_id: string;
}

interface TestImage {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string;
  width: number;
  height: number;
  project_id: string;
}

/**
 * Create a test user and insert it into the database
 */
export const createTestUser = async (): Promise<TestUser> => {
  const userId = uuidv4();
  const email = `test-${userId}@example.com`;
  const password = 'Password123!';
  const name = `Test User ${userId}`;

  // Insert user into database
  await db.query(
    `
    INSERT INTO users (id, email, password_hash, name)
    VALUES ($1, $2, crypt($3, gen_salt('bf')), $4)
  `,
    [userId, email, password, name]
  );

  // Create profile
  await db.query(
    `
    INSERT INTO profiles (user_id, preferred_language)
    VALUES ($1, 'en')
  `,
    [userId]
  );

  // Create token
  const token = jwt.sign({ userId }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h',
  });

  return {
    id: userId,
    email,
    password,
    name,
    token,
  };
};

/**
 * Create a test project and insert it into the database
 */
export const createTestProject = async (userId: string): Promise<TestProject> => {
  const projectId = uuidv4();
  const name = `Test Project ${projectId}`;
  const description = `Description for test project ${projectId}`;

  // Insert project into database
  await db.query(
    `
    INSERT INTO projects (id, name, description, user_id)
    VALUES ($1, $2, $3, $4)
  `,
    [projectId, name, description, userId]
  );

  return {
    id: projectId,
    name,
    description,
    user_id: userId,
  };
};

/**
 * Create a test image and insert it into the database
 */
export const createTestImage = async (projectId: string): Promise<TestImage> => {
  const imageId = uuidv4();
  const name = `test-image-${imageId}.jpg`;
  const url = `/uploads/images/${name}`;
  const thumbnail_url = `/uploads/thumbnails/${name}`;
  const width = 800;
  const height = 600;

  // Insert image into database
  await db.query(
    `
    INSERT INTO images (id, name, url, thumbnail_url, width, height, project_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,
    [imageId, name, url, thumbnail_url, width, height, projectId]
  );

  return {
    id: imageId,
    name,
    url,
    thumbnail_url,
    width,
    height,
    project_id: projectId,
  };
};

/**
 * Create segmentation data for a test image
 */
export const createTestSegmentation = async (imageId: string): Promise<void> => {
  const segmentationData = {
    polygons: [
      {
        id: uuidv4(),
        type: 'external',
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
          { x: 200, y: 200 },
          { x: 100, y: 200 },
        ],
      },
    ],
  };

  // Insert segmentation into database
  await db.query(
    `
    UPDATE images
    SET segmentation_result = $1, segmentation_status = 'completed'
    WHERE id = $2
  `,
    [JSON.stringify(segmentationData), imageId]
  );
};

/**
 * Clean up test data from the database
 */
export const cleanupTestData = async (userId: string): Promise<void> => {
  // Get all projects for this user
  const projectResult = await db.query('SELECT id FROM projects WHERE user_id = $1', [userId]);
  const projectIds = projectResult.rows.map((row) => row.id);

  // Delete image data for these projects
  if (projectIds.length > 0) {
    await db.query(
      `
      DELETE FROM images
      WHERE project_id IN (${projectIds.map((_, i) => `$${i + 1}`).join(',')})
    `,
      projectIds
    );
  }

  // Delete projects
  await db.query('DELETE FROM projects WHERE user_id = $1', [userId]);

  // Delete profile
  await db.query('DELETE FROM profiles WHERE user_id = $1', [userId]);

  // Delete user
  await db.query('DELETE FROM users WHERE id = $1', [userId]);
};

/**
 * Create complete test setup with user, project, and image
 */
export const setupCompleteTestEnv = async () => {
  const user = await createTestUser();
  const project = await createTestProject(user.id);
  const image = await createTestImage(project.id);
  await createTestSegmentation(image.id);

  return {
    user,
    project,
    image,
    cleanup: async () => {
      await cleanupTestData(user.id);
    },
  };
};

/**
 * Helper for making authenticated requests
 */
export const authRequest = (token: string) => {
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
  };
};

/**
 * Start server for testing
 */
export const startServer = (): Promise<Server> => {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      resolve(server);
    });
  });
};

/**
 * Stop server after testing
 */
export const stopServer = (server: Server): Promise<void> => {
  return new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
};
