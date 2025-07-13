/**
 * Project Service
 *
 * Handles business logic for project operations including creation, retrieval,
 * updating, and deletion.
 */
import { Pool } from 'pg';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';
import fileCleanupService from './fileCleanupService';
import cacheService from './cacheService';

interface CreateProjectParams {
  title: string;
  description?: string | null;
  userId: string;
  tags?: string[];
  public?: boolean;
}

interface ProjectResponse {
  id: string;
  title: string;
  description: string | null;
  user_id: string;
  created_at: Date;
  updated_at: Date;
  is_owner: boolean;
  image_count?: number;
  thumbnail_url?: string | null;
}

/**
 * Creates a new project and associated project directory
 *
 * @param pool Database connection pool
 * @param params Project creation parameters (title, description, userId)
 * @returns The newly created project
 * @throws ApiError if project creation fails
 */
export async function createProject(
  pool: Pool,
  params: CreateProjectParams
): Promise<ProjectResponse> {
  const { title: rawTitle, description, userId, tags = [], public: isPublic = false } = params;

  // Ensure title is not empty or undefined and properly trimmed
  if (!rawTitle) {
    throw new ApiError('Project title cannot be empty', 400);
  }

  // Trim the title to ensure no leading/trailing whitespace
  const title = rawTitle.trim();

  if (title === '') {
    throw new ApiError('Project title cannot be empty after trimming', 400);
  }

  // Log the project creation attempt with the title
  logger.info('Creating project with title', { title, userId });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if a project with the same title already exists for this user
    const existingProject = await client.query(
      'SELECT id FROM projects WHERE user_id = $1 AND title = $2',
      [userId, title]
    );

    if (existingProject.rows.length > 0) {
      throw new ApiError(`A project with the title "${title}" already exists`, 409);
    }

    // Check if the projects table has the needed columns
    let hasTagsColumn = false;
    let hasPublicColumn = false;

    try {
      // Check for tags column
      const tagsColumnCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'tags'
        )
      `);
      hasTagsColumn = tagsColumnCheck.rows[0].exists;

      // Check for public column
      const publicColumnCheck = await client.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
          AND table_name = 'projects'
          AND column_name = 'public'
        )
      `);
      hasPublicColumn = publicColumnCheck.rows[0].exists;
    } catch (error) {
      logger.debug('Error checking for optional columns', { error });
      // Continue even if column check fails - we'll use default insert
    }

    // Prepare the insert query based on available columns
    let insertQuery = 'INSERT INTO projects (user_id, title, description';
    let valuesClause = 'VALUES ($1, $2, $3';
    const queryParams = [userId, title, description || null];
    let paramIndex = 4;

    if (hasTagsColumn && tags.length > 0) {
      insertQuery += ', tags';
      valuesClause += `, $${paramIndex++}`;
      queryParams.push(JSON.stringify(tags)); // Convert array to JSON string
    }

    if (hasPublicColumn) {
      insertQuery += ', public';
      valuesClause += `, $${paramIndex++}`;
      queryParams.push(isPublic.toString()); // Convert boolean to string
    }

    insertQuery += ') ' + valuesClause + ') RETURNING *';

    // Insert the new project
    const result = await client.query(insertQuery, queryParams);
    const newProject = result.rows[0];

    // Create project directory structure
    try {
      const projectDir = path.join(config.storage.uploadDir, 'projects', newProject.id);
      const imagesDir = path.join(projectDir, 'images');
      const segmentationsDir = path.join(projectDir, 'segmentations');
      const thumbnailsDir = path.join(projectDir, 'thumbnails');
      const exportsDir = path.join(projectDir, 'exports');

      // Create directories in parallel
      await Promise.all([
        fs.mkdir(projectDir, { recursive: true }),
        fs.mkdir(imagesDir, { recursive: true }),
        fs.mkdir(segmentationsDir, { recursive: true }),
        fs.mkdir(thumbnailsDir, { recursive: true }),
        fs.mkdir(exportsDir, { recursive: true }),
      ]);

      logger.info('Project directories created', {
        projectId: newProject.id,
        projectDir,
      });
    } catch (error) {
      // Rollback if directory creation fails
      await client.query('ROLLBACK');
      logger.error('Failed to create project directories', {
        error,
        projectId: newProject.id,
      });
      throw new ApiError('Failed to create project directories', 500);
    }

    await client.query('COMMIT');

    // Invalidate user's project list cache
    await cacheService.delPattern(`project_list:${userId}:*`);

    // Return the project with is_owner flag
    return {
      ...newProject,
      is_owner: true,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof ApiError) {
      throw error;
    }

    logger.error('Error creating project', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              stack: error.stack,
              name: error.name,
            }
          : error,
      title,
      userId,
    });
    throw new ApiError('Failed to create project', 500);
  } finally {
    client.release();
  }
}

/**
 * Retrieves a project by ID, with permission checks
 *
 * @param pool Database connection pool
 * @param projectId The project ID to retrieve
 * @param userId The user ID requesting the project
 * @returns The project if found and user has access, null otherwise
 */
export async function getProjectById(
  pool: Pool,
  projectId: string,
  userId: string
): Promise<ProjectResponse | null> {
  // Try to get from cache first
  const cacheKey = `project:${projectId}:${userId}`;
  const cached = await cacheService.getCachedProject(cacheKey);

  if (cached) {
    logger.debug('Returning cached project', { projectId, userId });
    return cached;
  }
  // First try to fetch the project owned by the user
  const ownedProject = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [
    projectId,
    userId,
  ]);

  if (ownedProject.rows.length > 0) {
    const project = {
      ...ownedProject.rows[0],
      is_owner: true,
    };

    // Cache the project
    await cacheService.cacheProject(cacheKey, project);

    return project;
  }

  // Check if project is shared with the user
  try {
    const sharedProject = await pool.query(
      `
      SELECT p.*, ps.permission, false as is_owner
      FROM projects p
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE p.id = $1
        AND ps.user_id = $2
        AND ps.invitation_token IS NULL
    `,
      [projectId, userId]
    );

    if (sharedProject.rows.length > 0) {
      const project = sharedProject.rows[0];

      // Cache the project
      await cacheService.cacheProject(cacheKey, project);

      return project;
    }
  } catch (error) {
    // Project shares table might not exist, just return null
    logger.debug('Error checking for shared project', {
      error,
      projectId,
      userId,
    });
  }

  return null;
}

/**
 * Gets the list of projects for a user, including both owned and shared projects
 *
 * @param pool Database connection pool
 * @param userId The user ID
 * @param limit Maximum number of projects to return
 * @param offset Pagination offset
 * @param includeShared Whether to include projects shared with the user
 * @returns Object containing projects array and total count
 */
export async function getUserProjects(
  pool: Pool,
  userId: string,
  limit: number = 10,
  offset: number = 0,
  includeShared: boolean = true
): Promise<{ projects: ProjectResponse[]; total: number }> {
  // Try to get from cache first
  const cacheKey = `project_list:${userId}:${limit}:${offset}:${includeShared}`;
  const cached = await cacheService.get<{ projects: ProjectResponse[]; total: number }>(cacheKey);

  if (cached) {
    logger.debug('Returning cached project list', { userId, limit, offset });
    return cached;
  }
  // Check if tables exist
  let imagesTableExists = false;
  let sharesTableExists = false;

  try {
    const tableCheckResult = await pool.query(`
      SELECT 
        EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'images'
        ) as images_exists,
        EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'project_shares'
        ) as shares_exists
    `);

    imagesTableExists = tableCheckResult.rows[0].images_exists;
    sharesTableExists = tableCheckResult.rows[0].shares_exists;
  } catch (error) {
    logger.debug('Error checking for tables', { error });
  }

  // Build optimized query using CTEs to eliminate N+1 pattern
  let finalQuery = `
    WITH user_projects AS (
      -- Get all user's projects (owned and shared)
      SELECT 
        p.id,
        p.title,
        p.description,
        p.user_id,
        p.created_at,
        p.updated_at,
        true as is_owner,
        null::text as permission
      FROM projects p
      WHERE p.user_id = $1
  `;

  if (includeShared && sharesTableExists) {
    finalQuery += `
      UNION ALL
      SELECT 
        p.id,
        p.title,
        p.description,
        p.user_id,
        p.created_at,
        p.updated_at,
        false as is_owner,
        ps.permission
      FROM projects p
      JOIN project_shares ps ON p.id = ps.project_id
      WHERE ps.user_id = $1 AND ps.invitation_token IS NULL
    `;
  }

  finalQuery += `
    )`;

  if (imagesTableExists) {
    // Add image statistics CTE for efficient aggregation
    finalQuery += `,
    image_stats AS (
      -- Aggregate image data per project
      SELECT 
        i.project_id,
        COUNT(*) as image_count,
        MAX(i.created_at) as latest_image_created_at
      FROM images i
      WHERE i.project_id IN (SELECT id FROM user_projects)
      GROUP BY i.project_id
    ),
    latest_thumbnails AS (
      -- Get latest thumbnail for each project efficiently
      SELECT DISTINCT ON (i.project_id)
        i.project_id,
        i.thumbnail_path
      FROM images i
      WHERE i.project_id IN (SELECT id FROM user_projects)
      ORDER BY i.project_id, i.created_at DESC
    )`;
  }

  // Final SELECT with LEFT JOINs
  finalQuery += `
    SELECT 
      up.*`;

  if (imagesTableExists) {
    finalQuery += `,
      COALESCE(img_stats.image_count, 0) as image_count,
      lt.thumbnail_path as thumbnail_url`;
  }

  finalQuery += `
    FROM user_projects up`;

  if (imagesTableExists) {
    finalQuery += `
    LEFT JOIN image_stats img_stats ON up.id = img_stats.project_id
    LEFT JOIN latest_thumbnails lt ON up.id = lt.project_id`;
  }

  finalQuery += `
    ORDER BY up.updated_at DESC
    LIMIT $2 OFFSET $3
  `;

  // Execute the optimized query - now runs in O(1) instead of O(n)
  const projectsResult = await pool.query(finalQuery, [userId, limit, offset]);

  // Get total count for pagination using efficient CTE
  let countQuery = `
    WITH project_counts AS (
      SELECT COUNT(*) as count FROM projects WHERE user_id = $1
  `;

  if (includeShared && sharesTableExists) {
    countQuery += `
      UNION ALL
      SELECT COUNT(*) as count 
      FROM project_shares ps 
      WHERE ps.user_id = $1 AND ps.invitation_token IS NULL
    `;
  }

  countQuery += `
    )
    SELECT SUM(count)::int as total FROM project_counts
  `;

  const countResult = await pool.query(countQuery, [userId]);
  const totalProjects = countResult.rows[0].total || 0;

  const result = {
    projects: projectsResult.rows,
    total: totalProjects,
  };

  // Cache the result
  await cacheService.set(cacheKey, result, 60); // Cache for 1 minute

  return result;
}

/**
 * Updates a project with new title and/or description
 *
 * @param pool Database connection pool
 * @param projectId The project ID to update
 * @param userId The user ID (must be project owner)
 * @param updates The fields to update (title, description)
 * @returns The updated project
 * @throws ApiError if project update fails or user doesn't own the project
 */
export async function updateProject(
  pool: Pool,
  projectId: string,
  userId: string,
  updates: { title?: string; description?: string }
): Promise<ProjectResponse> {
  // Check if user owns the project
  const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
    projectId,
    userId,
  ]);

  if (projectCheck.rows.length === 0) {
    throw new ApiError('Project not found or you do not have permission to update it', 404);
  }

  // Build update query
  const updateFields = [];
  const queryParams = [projectId];
  let paramIndex = 2;

  if (updates.title !== undefined) {
    // Check if title already exists for another project owned by this user
    const titleCheck = await pool.query(
      'SELECT id FROM projects WHERE user_id = $1 AND title = $2 AND id != $3',
      [userId, updates.title, projectId]
    );

    if (titleCheck.rows.length > 0) {
      throw new ApiError(409, `A project with the title "${updates.title}" already exists`);
    }

    updateFields.push(`title = $${paramIndex++}`);
    queryParams.push(updates.title);
  }

  if (updates.description !== undefined) {
    updateFields.push(`description = $${paramIndex++}`);
    queryParams.push(updates.description);
  }

  if (updateFields.length === 0) {
    throw new ApiError('No valid update fields provided', 400);
  }

  // Add updated_at field
  updateFields.push(`updated_at = NOW()`);

  // Execute update
  const updateQuery = `
    UPDATE projects
    SET ${updateFields.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(updateQuery, queryParams);

  return {
    ...result.rows[0],
    is_owner: true,
  };
}

/**
 * Deletes a project and its associated resources
 *
 * @param pool Database connection pool
 * @param projectId The project ID to delete
 * @param userId The user ID (must be project owner)
 * @returns True if successfully deleted
 * @throws ApiError if project deletion fails or user doesn't own the project
 */
export async function deleteProject(
  pool: Pool,
  projectId: string,
  userId: string
): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if project exists and user owns it
    try {
      // First check if the project exists at all
      const projectExists = await client.query('SELECT id, user_id FROM projects WHERE id = $1', [
        projectId,
      ]);

      if (projectExists.rows.length === 0) {
        // Project doesn't exist
        logger.info('Project not found during deletion attempt', {
          projectId,
          userId,
        });
        throw new ApiError('Project not found', 404);
      }

      // Now check if user owns the project
      const projectCheck = await client.query(
        'SELECT id FROM projects WHERE id = $1 AND user_id = $2',
        [projectId, userId]
      );

      if (projectCheck.rows.length === 0) {
        // Project exists but user doesn't own it
        logger.warn('Unauthorized project deletion attempt', {
          projectId,
          userId,
          actualOwnerId: projectExists.rows[0].user_id,
        });
        throw new ApiError('You do not have permission to delete this project', 403);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      // For database errors, rethrow with a clear message
      logger.error('Database error checking project ownership', {
        error: err,
        projectId,
        userId,
      });
      throw new ApiError('Error verifying project ownership', 500);
    }

    // Get all images in the project before deletion for cleanup
    logger.info('Fetching all images in project before deletion', { projectId });
    const imagesQuery = await client.query('SELECT id FROM images WHERE project_id = $1', [
      projectId,
    ]);
    const imageIds = imagesQuery.rows.map((row) => row.id);
    logger.info(`Found ${imageIds.length} images to delete with project`, { projectId });

    // Step 1: First delete records from database (cascades to related tables)
    const deleteResult = await client.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [projectId, userId]
    );

    if (deleteResult.rowCount === 0) {
      throw new ApiError('Project not found for deletion', 404);
    }

    // Only attempt to delete files after database records are successfully deleted
    // and transaction is committed
    await client.query('COMMIT');

    // Invalidate all caches related to this project and user
    await cacheService.invalidateProject(projectId);
    await cacheService.delPattern(`project_list:${userId}:*`);

    // Step 2: Properly clean up all project files using fileCleanupService
    try {
      logger.info('Starting thorough file cleanup for project', {
        projectId,
        imageCount: imageIds.length,
      });

      // Use the dedicated file cleanup service to properly clean all files
      const cleanupResult = await fileCleanupService.cleanupProjectFiles(pool, projectId);

      if (cleanupResult.success) {
        logger.info('Successfully cleaned up all project files', {
          projectId,
          deletedFiles: cleanupResult.deletedFiles.length,
        });
      } else {
        logger.warn('Partial success cleaning up project files', {
          projectId,
          deletedFiles: cleanupResult.deletedFiles.length,
          failedFiles: cleanupResult.failedFiles.length,
        });
      }
    } catch (error) {
      // Log file deletion error but consider the operation successful
      // since database records are already removed
      logger.error('Failed to clean up project files, but database records were removed', {
        error,
        projectId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return true;
  } catch (error) {
    await client.query('ROLLBACK');

    if (error instanceof ApiError) {
      throw error;
    }

    logger.error('Error deleting project', {
      error,
      projectId,
      userId,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    throw new ApiError('Failed to delete project', 500);
  } finally {
    client.release();
  }
}

export default {
  createProject,
  getProjectById,
  getUserProjects,
  updateProject,
  deleteProject,
};
