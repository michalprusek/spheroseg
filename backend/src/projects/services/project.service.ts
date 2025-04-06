import { query } from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';

interface ProjectInput {
  name: string;
  description?: string;
  userId: string;
}

interface PaginationOptions {
  page: number;
  pageSize: number;
}

export async function createProject({ name, description, userId }: ProjectInput) {
  const id = uuidv4();
  const result = await query(
    `INSERT INTO projects (id, name, description, user_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, description, created_at, updated_at`,
    [id, name, description ?? null, userId]
  );
  return result[0];
}

export async function getProjectById(projectId: string, userId: string) {
  const result = await query(
    `SELECT * FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return result[0] || null;
}

export async function updateProject(projectId: string, userId: string, data: { name?: string; description?: string }) {
  const updates: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    updates.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }

  if (updates.length === 0) {
    throw new Error('No fields to update');
  }

  updates.push(`updated_at = NOW()`);

  values.push(projectId);
  values.push(userId);

  const result = await query(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramIndex++} AND user_id = $${paramIndex}
     RETURNING id, name, description, created_at, updated_at`,
    values
  );
  return result[0];
}

export async function deleteProject(projectId: string, userId: string) {
  const result = await query(
    `DELETE FROM projects WHERE id = $1 AND user_id = $2`,
    [projectId, userId]
  );
  return result.length > 0;
}

export async function listProjects(userId: string, { page, pageSize }: PaginationOptions) {
  const offset = (page - 1) * pageSize;
  const result = await query(
    `SELECT * FROM projects WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [userId, pageSize, offset]
  );
  return result;
}

export async function associateFile(projectId: string, fileId: string, userId: string) {
  // Check ownership
  const project = await getProjectById(projectId, userId);
  if (!project) return false;

  const updateResult = await query(
    `UPDATE files SET project_id = $1 WHERE id = $2`,
    [projectId, fileId]
  );
  return updateResult.length > 0;
}

export async function disassociateFile(projectId: string, fileId: string, userId: string) {
  // Check ownership
  const project = await getProjectById(projectId, userId);
  if (!project) return false;

  const updateResult = await query(
    `UPDATE files SET project_id = NULL WHERE id = $1 AND project_id = $2`,
    [fileId, projectId]
  );
  return updateResult.length > 0;
}