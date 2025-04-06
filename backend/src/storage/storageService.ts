import { query } from '../db/connection';
import type { FileData } from './types';
import type { QueryResultRow } from 'pg';

export async function getSignedUrl(fileId: string): Promise<string> {
  const baseUrl = process.env.STORAGE_BASE_URL || 'https://storage.local';
  const token = process.env.STORAGE_ACCESS_TOKEN || '';
  const url = `${baseUrl}/files/${fileId}${token ? `?token=${token}` : ''}`;
  return url;
}

interface FileRecord extends QueryResultRow, FileData {
  id: string;
  user_id: string;
  category_id?: string;
  is_public: boolean;
  storage_path: string;
}

export const createFileRecord = async (fileData: FileData, userId: string): Promise<FileRecord> => {
  const [result] = await query<FileRecord>(
    `INSERT INTO files (
      filename,
      original_name,
      storage_path,
      size,
      mimetype,
      user_id,
      is_public,
      description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
    [
      fileData.filename,
      fileData.filename,
      fileData.path,
      fileData.size,
      fileData.mimetype,
      userId,
      false,
      ''
    ]
  );
  return result;
};

export const getFileRecord = async (fileId: string, userId?: string): Promise<FileRecord | null> => {
  let queryStr = 'SELECT * FROM files WHERE id = $1';
  const params = [fileId];

  if (userId) {
    queryStr += ' AND user_id = $2';
    params.push(userId);
  }

  const [result] = await query<FileRecord>(queryStr, params);
  return result || null;
};

export const getFilesByUser = async (
  userId: string,
  limit: number = 10,
  offset: number = 0,
  categoryId?: string
): Promise<{ files: FileRecord[]; total: number }> => {
  let queryStr = 'SELECT * FROM files WHERE user_id = $1';
  let params: any[] = [userId];
  let countStr = 'SELECT COUNT(*) FROM files WHERE user_id = $1';

  if (categoryId) {
    queryStr += ' AND category_id = $2';
    countStr += ' AND category_id = $2';
    params.push(categoryId);
  }

  queryStr += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const [filesResult, [countResult]] = await Promise.all([
    query<FileRecord>(queryStr, params),
    query<{ count: string }>(countStr, params.slice(0, -2))
  ]);

  return {
    files: filesResult,
    total: parseInt(countResult.count, 10)
  };
};

export const deleteFileRecord = async (fileId: string): Promise<void> => {
  await query('DELETE FROM files WHERE id = $1', [fileId]);
};

export const addFileTag = async (fileId: string, tagId: string): Promise<void> => {
  await query(
    'INSERT INTO file_tags (file_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [fileId, tagId]
  );
};

export const removeFileTag = async (fileId: string, tagId: string): Promise<void> => {
  await query('DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2', [fileId, tagId]);
};

export const updateFileMetadata = async (
  fileId: string,
  updates: Partial<FileData>
): Promise<FileRecord> => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  const queryStr = `UPDATE files SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
  const [result] = await query<FileRecord>(queryStr, [...values, fileId]);
  return result;
};

export const getFileRecordByFilename = async (
  filename: string,
  userId: string,
  projectId?: string
): Promise<FileRecord | null> => {
  let queryStr = 'SELECT * FROM files WHERE filename = $1 AND user_id = $2';
  const params: any[] = [filename, userId];

  if (projectId) {
    queryStr += ' AND project_id = $3';
    params.push(projectId);
  }

  const [result] = await query<FileRecord>(queryStr, params);
  return result || null;
};

export const deleteFileRecordByFilename = async (
  filename: string,
  userId: string,
  projectId?: string
): Promise<void> => {
  let queryStr = 'DELETE FROM files WHERE filename = $1 AND user_id = $2';
  const params: any[] = [filename, userId];

  if (projectId) {
    queryStr += ' AND project_id = $3';
    params.push(projectId);
  }

  await query(queryStr, params);
};