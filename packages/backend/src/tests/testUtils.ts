import pool from '../db';
import bcrypt from 'bcryptjs';

export async function createTestUser() {
  const email = `test${Date.now()}@example.com`;
  const password = 'testpassword';
  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING *',
    [email, hashedPassword, 'Test User', 'user'],
  );

  return result.rows[0];
}

export async function deleteTestUser(userId: string) {
  await pool.query('DELETE FROM users WHERE id = $1', [userId]);
}

export async function createTestProject(userId: string) {
  const result = await pool.query('INSERT INTO projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING *', [
    'Test Project',
    'Test Description',
    userId,
  ]);

  return result.rows[0];
}

export async function deleteTestProject(projectId: string) {
  await pool.query('DELETE FROM projects WHERE id = $1', [projectId]);
}

export async function createTestImage(projectId: string) {
  const result = await pool.query('INSERT INTO images (project_id, filename, url) VALUES ($1, $2, $3) RETURNING *', [
    projectId,
    'test_image.png',
    '/uploads/test_image.png',
  ]);

  return result.rows[0];
}

export async function deleteTestImage(imageId: string) {
  await pool.query('DELETE FROM images WHERE id = $1', [imageId]);
}

export async function createTestSegmentation(imageId: string) {
  const result = await pool.query('INSERT INTO segmentations (image_id, polygons) VALUES ($1, $2) RETURNING *', [
    imageId,
    JSON.stringify([{ type: 'external', points: [{ x: 0, y: 0 }] }]),
  ]);

  return result.rows[0];
}

export async function deleteTestSegmentation(segmentationId: string) {
  await pool.query('DELETE FROM segmentations WHERE id = $1', [segmentationId]);
}
