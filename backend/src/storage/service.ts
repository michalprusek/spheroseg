import { query } from '../db/connection';
import path from 'path';
import { config } from '../config/app';

/**
 * Get a file by ID and user ID
 */
export async function getFile(fileId: string, userId: string) {
  const result = await query('SELECT * FROM files WHERE id = $1 AND user_id = $2', [fileId, userId]);
  return result[0];
}

/**
 * Generate a signed URL for a file
 */
export async function getSignedUrl(fileId: string, userId: string, expiresIn = 3600) {
  const file = await getFile(fileId, userId);
  if (!file) {
    throw new Error('File not found');
  }

  // In a real implementation, this would generate a signed URL with an expiration
  // For this example, we'll just return a fake URL
  const filePath = path.join(config.storage.uploadDir, file.path);
  return `${process.env.BACKEND_URL || 'http://localhost:3000'}/storage/download/${fileId}?token=signed&expires=${Date.now() + expiresIn * 1000}`;
}
