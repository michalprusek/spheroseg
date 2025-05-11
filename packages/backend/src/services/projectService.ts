/**
 * Project Service
 *
 * Handles business logic for project operations including creation, retrieval,
 * updating, and deletion.
 */
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import config from '../config';
import logger from '../utils/logger';
import { ApiError } from '../utils/errors';

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
export async function createProject(pool: Pool, params: CreateProjectParams): Promise<ProjectResponse> {
  const { title: rawTitle, description, userId, tags = [], public: isPublic = false } = params;

  // Ensure title is not empty or undefined and properly trimmed
  if (!rawTitle) {
    throw new ApiError(400, 'Project title cannot be empty');
  }

  // Trim the title to ensure no leading/trailing whitespace
  const title = rawTitle.trim();

  if (title === '') {
    throw new ApiError(400, 'Project title cannot be empty after trimming');
  }

  // Log the project creation attempt with the title
  logger.info('Creating project with title', { title, userId });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if a project with the same title already exists for this user
    const existingProject = await client.query('SELECT id FROM projects WHERE user_id = $1 AND title = $2', [
      userId,
      title,
    ]);

    if (existingProject.rows.length > 0) {
      throw new ApiError(409, `A project with the title "${title}" already exists`);
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

      // Create directories
      fs.mkdirSync(projectDir, { recursive: true });
      fs.mkdirSync(imagesDir, { recursive: true });
      fs.mkdirSync(segmentationsDir, { recursive: true });
      fs.mkdirSync(thumbnailsDir, { recursive: true });
      fs.mkdirSync(exportsDir, { recursive: true });

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
      throw new ApiError(500, 'Failed to create project directories');
    }

    await client.query('COMMIT');

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

    logger.error('Error creating project', { error, title, userId });
    throw new ApiError(500, 'Failed to create project');
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
export async function getProjectById(pool: Pool, projectId: string, userId: string): Promise<ProjectResponse | null> {
  // First try to fetch the project owned by the user
  const ownedProject = await pool.query('SELECT * FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);

  if (ownedProject.rows.length > 0) {
    return {
      ...ownedProject.rows[0],
      is_owner: true,
    };
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
      [projectId, userId],
    );

    if (sharedProject.rows.length > 0) {
      return sharedProject.rows[0];
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
  includeShared: boolean = true,
): Promise<{ projects: ProjectResponse[]; total: number }> {
  // Build the query based on available tables and columns
  let baseSelect = `
    SELECT p.id, p.title, p.description, p.user_id, p.created_at, p.updated_at
  `;

  // Check if images table exists for image_count and thumbnail_url
  try {
    const imagesResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'images'
      )
    `);

    const imagesTableExists = imagesResult.rows[0].exists;

    if (imagesTableExists) {
      // Add image count and thumbnail if columns exist
      baseSelect += `,
        (SELECT COUNT(*) FROM images i WHERE i.project_id = p.id) as image_count,
        (SELECT thumbnail_path FROM images i WHERE i.project_id = p.id ORDER BY i.created_at DESC LIMIT 1) as thumbnail_url
      `;
    }
  } catch (error) {
    logger.debug('Error checking for images table', { error });
  }

  // Query to fetch owned projects
  const ownedProjectsQuery = `
    ${baseSelect},
    true as is_owner,
    null as permission
    FROM projects p
    WHERE p.user_id = $1
  `;

  // Query to fetch shared projects if applicable
  let sharedProjectsQuery = '';
  let finalQuery;

  if (includeShared) {
    try {
      const sharesResult = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'project_shares'
        )
      `);

      const sharesTableExists = sharesResult.rows[0].exists;

      if (sharesTableExists) {
        sharedProjectsQuery = `
          ${baseSelect},
          false as is_owner,
          ps.permission
          FROM projects p
          JOIN project_shares ps ON p.id = ps.project_id
          WHERE ps.user_id = $1
            AND ps.invitation_token IS NULL
        `;

        finalQuery = `
          (${ownedProjectsQuery})
          UNION ALL
          (${sharedProjectsQuery})
          ORDER BY updated_at DESC
          LIMIT $2 OFFSET $3;
        `;
      }
    } catch (error) {
      logger.debug('Error checking for project_shares table', { error });
    }
  }

  if (!finalQuery) {
    finalQuery = `
      ${ownedProjectsQuery}
      ORDER BY updated_at DESC
      LIMIT $2 OFFSET $3;
    `;
  }

  // Execute the query
  const projectsResult = await pool.query(finalQuery, [userId, limit, offset]);

  // Get total count for pagination
  const ownedCountQuery = 'SELECT COUNT(*) FROM projects WHERE user_id = $1';
  const ownedCountResult = await pool.query(ownedCountQuery, [userId]);
  let totalProjects = parseInt(ownedCountResult.rows[0].count, 10);

  // Add shared projects count if applicable
  if (includeShared) {
    try {
      const sharesResult = await pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'project_shares'
        )
      `);

      const sharesTableExists = sharesResult.rows[0].exists;

      if (sharesTableExists) {
        const sharedCountQuery = `
          SELECT COUNT(*)
          FROM project_shares
          WHERE user_id = $1 AND invitation_token IS NULL
        `;
        const sharedCountResult = await pool.query(sharedCountQuery, [userId]);
        totalProjects += parseInt(sharedCountResult.rows[0].count, 10);
      }
    } catch (error) {
      logger.debug('Error checking for project_shares table for counting', {
        error,
      });
    }
  }

  return {
    projects: projectsResult.rows,
    total: totalProjects,
  };
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
  updates: { title?: string; description?: string },
): Promise<ProjectResponse> {
  // Check if user owns the project
  const projectCheck = await pool.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [projectId, userId]);

  if (projectCheck.rows.length === 0) {
    throw new ApiError(404, 'Project not found or you do not have permission to update it');
  }

  // Build update query
  const updateFields = [];
  const queryParams = [projectId];
  let paramIndex = 2;

  if (updates.title !== undefined) {
    // Check if title already exists for another project owned by this user
    const titleCheck = await pool.query('SELECT id FROM projects WHERE user_id = $1 AND title = $2 AND id != $3', [
      userId,
      updates.title,
      projectId,
    ]);

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
    throw new ApiError(400, 'No valid update fields provided');
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
export async function deleteProject(pool: Pool, projectId: string, userId: string): Promise<boolean> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if project exists and user owns it
    try {
      // First check if the project exists at all
      const projectExists = await client.query('SELECT id, user_id FROM projects WHERE id = $1', [projectId]);

      if (projectExists.rows.length === 0) {
        // Project doesn't exist
        logger.info('Project not found during deletion attempt', {
          projectId,
          userId,
        });
        throw new ApiError(404, 'Project not found');
      }

      // Now check if user owns the project
      const projectCheck = await client.query('SELECT id FROM projects WHERE id = $1 AND user_id = $2', [
        projectId,
        userId,
      ]);

      if (projectCheck.rows.length === 0) {
        // Project exists but user doesn't own it
        logger.warn('Unauthorized project deletion attempt', {
          projectId,
          userId,
          actualOwnerId: projectExists.rows[0].user_id,
        });
        throw new ApiError(403, 'You do not have permission to delete this project');
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
      throw new ApiError(500, 'Error verifying project ownership');
    }

    // Step 1: First delete records from database (cascades to related tables)
    const deleteResult = await client.query('DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id', [
      projectId,
      userId,
    ]);

    if (deleteResult.rowCount === 0) {
      throw new ApiError(404, 'Project not found for deletion');
    }

    // Only attempt to delete files after database records are successfully deleted
    // and transaction is committed
    await client.query('COMMIT');

    // Step 2: Then delete associated files (outside of transaction) to avoid orphaned records
    try {
      const projectDir = path.join(config.storage.uploadDir, 'projects', projectId);

      if (fs.existsSync(projectDir)) {
        // Recursively delete project directory
        fs.rmSync(projectDir, { recursive: true, force: true });
        logger.info('Project directory deleted', { projectId, projectDir });
      } else {
        logger.info('Project directory not found during deletion', {
          projectId,
          projectDir,
        });
      }
    } catch (error) {
      // Log file deletion error but consider the operation successful
      // since database records are already removed
      logger.error('Failed to delete project directory, but database records were removed', {
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
    throw new ApiError(500, 'Failed to delete project');
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
