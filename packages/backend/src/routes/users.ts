import express, { Response, Router, Request } from 'express';
import pool from '@/db';
import { validate } from '../middleware/validationMiddleware';
import { updateUserProfileSchema, changeRoleSchema } from '../validators/userValidators';
import { changePasswordSchema, registerSchema, loginSchema } from '../validators/authValidators';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorizeRole } from '../middleware/authorizationMiddleware';
import multer from 'multer';
import path from 'path';
import fsPromises from 'fs/promises';
import logger from '../utils/logger'; // Corrected path
import { ApiError } from '../middleware/errorMiddleware'; // Corrected path
import config from '../config'; // Assuming you have a config file
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router: Router = express.Router();

// Configure upload directory and storage for avatars
// Base upload directory (relative to this file in src/routes/)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
// Specific directory for avatars within the main upload dir
const AVATAR_DIR = process.env.AVATAR_DIR || path.join(UPLOAD_DIR, 'avatars');

// Ensure avatar directory exists and set permissions using fsPromises
console.log(`Ensuring avatar directory exists: ${AVATAR_DIR}`);
fsPromises.mkdir(AVATAR_DIR, { recursive: true })
  .then(() => {
    console.log(`Avatar directory created/verified: ${AVATAR_DIR}`);
    // Set permissions on avatars directory
    return fsPromises.chmod(AVATAR_DIR, 0o777);
  })
  .then(() => {
    console.log(`Avatar directory permissions set: ${AVATAR_DIR}`);
  })
  .catch(err => console.error('Failed to create avatar directory or set permissions:', err));


// Configure multer storage for avatar uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    console.log(`Saving avatar to directory: ${AVATAR_DIR}`);
    cb(null, AVATAR_DIR);
  },
  filename: function (req, file, cb) {
    // Create a unique filename: userId-timestamp.ext
    const userId = (req as AuthenticatedRequest).user?.userId;
    console.log(`Creating avatar filename for user: ${userId}`);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const filename = `avatar-${userId}-${uniqueSuffix}${path.extname(file.originalname)}`;
    console.log(`Generated avatar filename: ${filename}`);
    cb(null, filename);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    // Accept only image files
    if (!file.mimetype.startsWith('image/')) {
      // @ts-expect-error // Adding back to suppress TS error
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});


// GET /api/users/me - Get current user's profile
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        // This should technically be caught by authenticateToken, but belt-and-suspenders
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        // Get basic user data
        const userRecord = await pool.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);

        if (userRecord.rows.length === 0) {
            return res.status(404).json({ message: 'User not found in database' });
        }

        // Get user profile data if exists
        const profileQuery = `
            SELECT 
                username, 
                full_name, 
                title, 
                organization, 
                bio, 
                location, 
                preferred_language, 
                avatar_url
            FROM user_profiles
            WHERE user_id = $1
        `;
        
        const profileRecord = await pool.query(profileQuery, [userId]);
        const profileData = profileRecord.rows.length > 0 ? profileRecord.rows[0] : {};
        
        // Combine user data with profile data
        const userData = {
            ...userRecord.rows[0],
            ...profileData,
            profile: {
                username: profileData.username,
                full_name: profileData.full_name,
                title: profileData.title,
                organization: profileData.organization,
                bio: profileData.bio,
                location: profileData.location,
                avatar_url: profileData.avatar_url
            }
        };
        
        logger.info('User profile fetched successfully', { userId });
        return res.json(userData);
    } catch (error) {
        logger.error('Error fetching user profile:', error);
        return res.status(500).json({ message: 'Failed to fetch user profile' });
    }
});

// PUT /api/users/me/password - Change current user's password
router.put('/me/password', authMiddleware, validate(changePasswordSchema), async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const { currentPassword, newPassword } = req.body;

    try {
        // Get user's current password hash
        const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
        
        if (userResult.rows.length === 0) {
            logger.warn('Password change failed: User not found', { userId });
            return res.status(404).json({ message: 'User not found' });
        }

        const user = userResult.rows[0];
        
        // Verify current password
        const isMatch = await bcryptjs.compare(currentPassword, user.password_hash);
        if (!isMatch) {
            logger.warn('Password change failed: Current password incorrect', { userId });
            return res.status(401).json({ message: 'Current password is incorrect' });
        }

        // Hash new password
        const SALT_ROUNDS = config.auth.saltRounds || 10;
        const newPasswordHash = await bcryptjs.hash(newPassword, SALT_ROUNDS);

        // Update password
        await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
            [newPasswordHash, userId]);

        logger.info('Password changed successfully', { userId });
        return res.status(200).json({ message: 'Password changed successfully' });
        
    } catch (error) {
        logger.error('Password change error', { error, userId });
        return res.status(500).json({ message: 'Failed to change password' });
    }
});

// PUT /api/users/me/profile - Update current user's profile
router.put('/me/profile', authMiddleware, validate(updateUserProfileSchema), async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
        email,
        name,
        // Profile fields
        username,
        full_name,
        title,
        organization,
        bio,
        location,
        preferred_language,
        institution,
        website,
        twitter,
        github
    } = req.body;
    
    try {
        await pool.query('BEGIN'); // Start transaction

        // Define fields to update in users table
        const userFieldsToUpdate: { [key: string]: string } = {};
        if (email !== undefined) userFieldsToUpdate.email = email;
        if (name !== undefined) userFieldsToUpdate.name = name;

        const userValues: string[] = [];

        // Helper to add field if defined
        const addField = (obj: { [key: string]: string }, values: string[], dbFieldName: string, value: string | undefined) => {
            if (value !== undefined) {
                obj[dbFieldName] = value;
                values.push(value);
            }
        };

        // Add user fields to update object
        Object.keys(userFieldsToUpdate).forEach(key => {
            addField(userFieldsToUpdate, userValues, key, userFieldsToUpdate[key]);
        });

        // Update users table if there are fields to update
        if (Object.keys(userFieldsToUpdate).length > 0) {
            // Check if email is already taken by another user if email is being updated
            if (userFieldsToUpdate.email) {
                const emailCheckQuery = 'SELECT id FROM users WHERE email = $1 AND id != $2';
                const emailCheckResult = await pool.query(emailCheckQuery, [userFieldsToUpdate.email, userId]);
                if (emailCheckResult.rows.length > 0) {
                    await pool.query('ROLLBACK'); // Rollback transaction
                    return res.status(409).json({ message: 'Email already in use by another account' });
                }
            }

            const userSetClauses = Object.keys(userFieldsToUpdate).map((key, index) => `${key} = $${index + 2}`);
            const userUpdateQuery = `UPDATE users SET ${userSetClauses.join(', ')} WHERE id = $1 RETURNING id, email, name, created_at`;
            userValues.unshift(userId); // Add userId as $1
            await pool.query(userUpdateQuery, userValues);
        }

        // Define fields to update/insert in user_profiles table
        const profileFieldsToUpdate: { [key: string]: string } = {};
        const profileValues: string[] = [];

        // Helper to add profile field if defined
        const addProfileField = (dbFieldName: string, value: string | undefined) => {
            if (value !== undefined) {
                profileFieldsToUpdate[dbFieldName] = value;
                profileValues.push(value);
            }
        };

        addProfileField('username', username);
        addProfileField('full_name', full_name);
        addProfileField('title', title);
        addProfileField('organization', organization);
        addProfileField('bio', bio);
        addProfileField('location', location);
        addProfileField('preferred_language', preferred_language);
        addProfileField('institution', institution);
        addProfileField('website', website);
        addProfileField('twitter', twitter);
        addProfileField('github', github);

        if (Object.keys(profileFieldsToUpdate).length > 0) {
            profileValues.unshift(userId); // Add userId as the first value ($1)

            // Build profile UPSERT query dynamically
            const profileSetClauses = Object.keys(profileFieldsToUpdate).map((key, index) => `${key} = $${index + 2}`);
            const profileInsertFields = ['user_id', ...Object.keys(profileFieldsToUpdate)];
            const profileInsertPlaceholders = profileInsertFields.map((_, index) => `$${index + 1}`);

            // Use INSERT ... ON CONFLICT to handle both insert and update
            const profileUpsertQuery = `
                INSERT INTO user_profiles (${profileInsertFields.join(', ')})
                VALUES (${profileInsertPlaceholders.join(', ')})
                ON CONFLICT (user_id)
                DO UPDATE SET ${profileSetClauses.join(', ')}
                RETURNING *;
            `;

            await pool.query(profileUpsertQuery, profileValues);
        }

        // Final checks and commit
        if (Object.keys(userFieldsToUpdate).length === 0 && Object.keys(profileFieldsToUpdate).length === 0) {
            await pool.query('ROLLBACK'); // Rollback transaction
            return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        await pool.query('COMMIT'); // Commit transaction

        // Fetch the latest full user data (including profile) after updates
        const finalUserQuery = `
            SELECT
                u.id, u.email, u.name, u.created_at,
                up.username, up.full_name, up.title, up.organization, up.bio, up.location, 
                up.preferred_language, up.institution, up.website, up.twitter, up.github
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = $1;
        `;
        const finalResult = await pool.query(finalUserQuery, [userId]);

        if (finalResult.rowCount === 0) {
            return res.status(404).json({ message: 'User not found after update operation' });
        }

        return res.status(200).json(finalResult.rows[0]);

    } catch (error) {
        logger.error('Update profile error:', error);
        // Rollback transaction on any error
        await pool.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update user profile', error: (error as Error).message });
    }
});

// PUT /api/users/me/password - Change password for current user
router.put('/me/password', authMiddleware, validate(changePasswordSchema), async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  const { current_password, new_password } = req.body;
  
  try {
    logger.info('Processing password change request', { userId });
    
    // Get current password hash
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      logger.warn('User not found during password change', { userId });
      return res.status(404).json({ message: 'User not found' });
    }
    
    const currentPasswordHash = userResult.rows[0].password_hash;
    
    // Verify current password
    const passwordMatch = await bcryptjs.compare(current_password, currentPasswordHash);
    if (!passwordMatch) {
      logger.warn('Incorrect current password provided', { userId });
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const saltRounds = 10;
    const newPasswordHash = await bcryptjs.hash(new_password, saltRounds);
    
    // Update the password
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPasswordHash, userId]
    );
    
    logger.info('Password changed successfully', { userId });
    return res.json({ message: 'Password updated successfully' });
  } catch (error) {
    logger.error('Password change error', { error, userId });
    return res.status(500).json({ message: 'Failed to change password' });
  }
});

// PUT /api/users/me - Update current user's profile (keeping for backward compatibility)
router.put('/me', authMiddleware, validate(updateUserProfileSchema), async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }

    const {
        email,
        name,
        // Profile fields
        username,
        full_name,
        title,
        organization,
        bio,
        location,
        preferred_language
    } = req.body;

    try {
        await pool.query('BEGIN'); // Start transaction

        // Define fields to update in users table
        const userFieldsToUpdate: { [key: string]: string } = {};
        if (email !== undefined) userFieldsToUpdate.email = email;
        if (name !== undefined) userFieldsToUpdate.name = name;
        // DO NOT update 'role' here as it's handled separately or doesn't exist as intended here

        const userValues: string[] = []; // Specific type

        // Helper to add field if defined, mapping schema name to DB column name if needed
        const addField = (obj: { [key: string]: string }, values: string[], dbFieldName: string, value: string | undefined) => {
            if (value !== undefined) {
                obj[dbFieldName] = value;
                values.push(value);
            }
        };

        // Add user fields to update object
        Object.keys(userFieldsToUpdate).forEach(key => {
            addField(userFieldsToUpdate, userValues, key, userFieldsToUpdate[key]);
        });

        // Update users table if there are fields to update
        if (Object.keys(userFieldsToUpdate).length > 0) {
            // Check if the email is already taken by another user if email is being updated
            if (userFieldsToUpdate.email) {
                const emailCheckQuery = 'SELECT id FROM users WHERE email = $1 AND id != $2';
                const emailCheckResult = await pool.query(emailCheckQuery, [userFieldsToUpdate.email, userId]);
                if (emailCheckResult.rows.length > 0) {
                    await pool.query('ROLLBACK'); // Rollback transaction
                    return res.status(409).json({ message: 'Email already in use by another account' });
                }
            }

            const userSetClauses = Object.keys(userFieldsToUpdate).map((key, index) => `${key} = $${index + 2}`);
            // Ensure RETURNING clause only includes existing columns
            const userUpdateQuery = `UPDATE users SET ${userSetClauses.join(', ')} WHERE id = $1 RETURNING id, email, name, created_at`;
            userValues.unshift(userId); // Add userId as $1
            await pool.query(userUpdateQuery, userValues);
        }

        // Define fields to update/insert in user_profiles table
        const profileFieldsToUpdate: { [key: string]: string } = {}; // Specific type
        const profileValues: string[] = []; // Specific type

        // Helper to add profile field if defined
        const addProfileField = (dbFieldName: string, value: string | undefined) => { // Specific type
            if (value !== undefined) {
                profileFieldsToUpdate[dbFieldName] = value;
                profileValues.push(value);
            }
        };

        addProfileField('username', username);
        addProfileField('full_name', full_name);
        addProfileField('title', title);
        addProfileField('organization', organization);
        addProfileField('bio', bio);
        addProfileField('location', location);
        addProfileField('preferred_language', preferred_language);

        if (Object.keys(profileFieldsToUpdate).length > 0) {
            profileValues.unshift(userId); // Add userId as the first value ($1)

            // Build profile UPSERT query dynamically
            const profileSetClauses = Object.keys(profileFieldsToUpdate).map((key, index) => `${key} = $${index + 2}`); // Removed unused index
            const profileInsertFields = ['user_id', ...Object.keys(profileFieldsToUpdate)];
            const profileInsertPlaceholders = profileInsertFields.map((_, index) => `$${index + 1}`);

            // Use INSERT ... ON CONFLICT to handle both insert and update
            const profileUpsertQuery = `
                INSERT INTO user_profiles (${profileInsertFields.join(', ')})
                VALUES (${profileInsertPlaceholders.join(', ')})
                ON CONFLICT (user_id)
                DO UPDATE SET ${profileSetClauses.join(', ')}
                RETURNING *;
            `;

            // Add detailed logging for debugging profile updates
            console.log('[PUT /me] Profile fields to update:', profileFieldsToUpdate);
            console.log('[PUT /me] Profile values for query:', profileValues);
            console.log('[PUT /me] Profile UPSERT query:', profileUpsertQuery.replace(/\s+/g, ' ').trim()); // Log query concisely

            const upsertResult = await pool.query(profileUpsertQuery, profileValues);
            console.log('[PUT /me] Profile UPSERT result:', upsertResult.rows[0]); // Log the returned row
        }

        // --- Final checks and commit ---
        if (Object.keys(userFieldsToUpdate).length === 0 && Object.keys(profileFieldsToUpdate).length === 0) {
            await pool.query('ROLLBACK'); // Rollback transaction
             return res.status(400).json({ message: 'No valid fields provided for update' });
        }

        await pool.query('COMMIT'); // Commit transaction

        // --- Construct and return response ---
        // Fetch the latest full user data (including profile) after updates
        const finalUserQuery = `
            SELECT
                u.id, u.email, u.name, u.created_at,
                up.username, up.full_name, up.title, up.organization, up.bio, up.location, up.preferred_language
            FROM users u
            LEFT JOIN user_profiles up ON u.id = up.user_id
            WHERE u.id = $1;
        `;
        const finalResult = await pool.query(finalUserQuery, [userId]);

        if (finalResult.rowCount === 0) {
            // This case should ideally not be reached if the user exists and transaction succeeded
            return res.status(404).json({ message: 'User not found after update operation' });
        }

        return res.status(200).json(finalResult.rows[0]); // Return combined user and profile data

    } catch (error) {
        console.error('Update profile error:', error);
        // Rollback transaction on any error
        await pool.query('ROLLBACK');
        res.status(500).json({ message: 'Failed to update user profile', error: (error as Error).message }); // Cast error to Error type
    }
});

// GET /api/users - Get all users (Admin only)
router.get('/', authMiddleware, authorizeRole(['admin']), async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC');
        return res.json(result.rows); // Use return for consistency
    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({ message: 'Failed to fetch users' }); // Use return
    }
});

// PUT /api/users/:userId/approve - Approve a user (Admin only)
router.put('/:userId/approve', authMiddleware, authorizeRole(['admin']), async (req: Request, res: Response) => {
    const { userId } = req.params;
    try {
        // Ensure userId is a valid format if needed (e.g., UUID or number depending on your schema)
        await pool.query('UPDATE users SET is_approved = true WHERE id = $1', [userId]);
        return res.json({ message: 'User approved successfully' }); // Use return
    } catch (error) {
        console.error('Approve user error:', error);
        return res.status(500).json({ message: 'Failed to approve user' }); // Use return
    }
});

// PUT /api/users/:userId/role - Change user role (Admin only)
router.put('/:userId/role', authMiddleware, authorizeRole(['admin']), validate(changeRoleSchema), async (req: Request, res: Response) => {
    const { userId } = req.params;
    const { role } = req.body;

    try {
        // Ensure userId is valid format if needed
        await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role.toUpperCase(), userId]); // Store role in uppercase for consistency?
        return res.json({ message: 'User role updated successfully' }); // Use return
    } catch (error) {
        console.error('Update role error:', error);
        return res.status(500).json({ message: 'Failed to update user role' }); // Use return
    }
});

// GET /api/users/me/stats - Get overview statistics for the logged-in user (enhanced version)
router.get('/me/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        logger.info(`Fetching stats for user: ${userId}`);

        // Check if projects table exists
        const projectsTableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name = 'projects'
            )
        `);

        const projectsTableExists = projectsTableCheck.rows[0].exists;

        let totalProjects = 0;
        let totalImages = 0;
        let completedSegmentations = 0;
        let recentActivity = [];
        let recentProjects = [];
        let recentImages = [];

        // Only run project queries if projects table exists
        if (projectsTableExists) {
            logger.debug('Projects table exists, fetching project stats');

            // Fetch total projects
            const projectsCountRes = await pool.query('SELECT COUNT(*) FROM projects WHERE user_id = $1', [userId]);
            totalProjects = parseInt(projectsCountRes.rows[0].count, 10);

            // Check if images table exists
            const imagesTableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'images'
                )
            `);

            const imagesTableExists = imagesTableCheck.rows[0].exists;

            if (imagesTableExists) {
                logger.debug('Images table exists, fetching image stats');

                // Fetch total images (across user's projects)
                const imagesCountRes = await pool.query(
                    'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
                    [userId]
                );
                totalImages = parseInt(imagesCountRes.rows[0].count, 10);

                // Check if status column exists in images table
                const statusColumnCheck = await pool.query(`
                    SELECT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'images'
                        AND column_name = 'status'
                    )
                `);

                if (statusColumnCheck.rows[0].exists) {
                    // Fetch completed segmentations
                    const completedSegmentationsRes = await pool.query(
                        'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2',
                        [userId, 'completed']
                    );
                    completedSegmentations = parseInt(completedSegmentationsRes.rows[0].count, 10);
                } else {
                    // Try to check if we have segmentation_results table
                    const segmentationTableCheck = await pool.query(`
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public'
                            AND table_name = 'segmentation_results'
                        )
                    `);

                    if (segmentationTableCheck.rows[0].exists) {
                        // Fetch completed segmentations from segmentation_results
                        const completedSegmentationsRes = await pool.query(`
                            SELECT COUNT(*)
                            FROM segmentation_results sr
                            JOIN images i ON sr.image_id = i.id
                            JOIN projects p ON i.project_id = p.id
                            WHERE p.user_id = $1 AND sr.status = $2
                        `, [userId, 'completed']);
                        completedSegmentations = parseInt(completedSegmentationsRes.rows[0].count, 10);
                    }
                }

                // Fetch recent images if available
                const recentImagesQuery = `
                    SELECT
                        i.id,
                        i.name,
                        i.storage_path,
                        i.status,
                        i.created_at,
                        i.updated_at,
                        i.project_id,
                        p.title as project_name
                    FROM images i
                    JOIN projects p ON i.project_id = p.id
                    WHERE p.user_id = $1
                    ORDER BY i.updated_at DESC
                    LIMIT 5
                `;
                const recentImagesRes = await pool.query(recentImagesQuery, [userId]);
                recentImages = recentImagesRes.rows;
            }

            // Fetch recent projects
            const projectsColumnsCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'projects'
                AND column_name IN ('title', 'description')
            `);

            const projectColumns = projectsColumnsCheck.rows.map(row => row.column_name);
            const hasTitleColumn = projectColumns.includes('title');

            if (hasTitleColumn) {
                const recentProjectsQuery = `
                    SELECT
                        p.id,
                        p.title,
                        p.description,
                        p.created_at,
                        p.updated_at,
                        (SELECT COUNT(*) FROM images WHERE project_id = p.id) as image_count,
                        (SELECT COUNT(*) FROM images WHERE project_id = p.id AND status = 'completed') as completed_count
                    FROM projects p
                    WHERE p.user_id = $1
                    ORDER BY p.updated_at DESC
                    LIMIT 5
                `;
                const recentProjectsRes = await pool.query(recentProjectsQuery, [userId]);
                recentProjects = recentProjectsRes.rows;

                // Fetch recent activity
                const activityQuery = `
                    SELECT
                        'project_created' as type,
                        p.id as project_id,
                        p.title as project_name,
                        p.created_at as timestamp,
                        'Created project ' || p.title as description,
                        NULL as image_id,
                        NULL as image_name
                    FROM projects p
                    WHERE p.user_id = $1

                    UNION ALL

                    SELECT
                        'image_uploaded' as type,
                        i.project_id,
                        p.title as project_name,
                        i.created_at as timestamp,
                        'Uploaded image ' || i.name || ' to project ' || p.title as description,
                        i.id as image_id,
                        i.name as image_name
                    FROM images i
                    JOIN projects p ON i.project_id = p.id
                    WHERE p.user_id = $1

                    UNION ALL

                    SELECT
                        'segmentation_completed' as type,
                        i.project_id,
                        p.title as project_name,
                        i.updated_at as timestamp,
                        'Completed segmentation for ' || i.name || ' in project ' || p.title as description,
                        i.id as image_id,
                        i.name as image_name
                    FROM images i
                    JOIN projects p ON i.project_id = p.id
                    WHERE p.user_id = $1 AND i.status = 'completed'

                    ORDER BY timestamp DESC
                    LIMIT 10
                `;
                const activityRes = await pool.query(activityQuery, [userId]);
                recentActivity = activityRes.rows;
            }
        } else {
            logger.info('Projects table does not exist, returning default stats');
        }

        // Calculate storage used (check if storage columns exist)
        const storageColumnsCheck = await pool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN ('storage_limit_bytes', 'storage_used_bytes')
        `);

        const storageColumns = storageColumnsCheck.rows.map(row => row.column_name);
        const hasStorageColumns = storageColumns.length === 2;

        let storageUsedBytes = 0;
        let storageUsedMB = 0;
        let storageLimitBytes = 10 * 1024 * 1024 * 1024; // 10GB default

        if (hasStorageColumns) {
            // Get storage used from users table
            const storageQuery = `
                SELECT storage_used_bytes, storage_limit_bytes
                FROM users
                WHERE id = $1
            `;
            const storageRes = await pool.query(storageQuery, [userId]);
            if (storageRes.rows.length > 0) {
                if (storageRes.rows[0].storage_used_bytes !== null) {
                    storageUsedBytes = parseInt(storageRes.rows[0].storage_used_bytes, 10);
                    storageUsedMB = Math.round(storageUsedBytes / (1024 * 1024) * 100) / 100; // Convert to MB with 2 decimal places
                }
                if (storageRes.rows[0].storage_limit_bytes !== null) {
                    storageLimitBytes = parseInt(storageRes.rows[0].storage_limit_bytes, 10);
                }
            }
        }

        // Get current month vs previous month stats
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const firstDayOfPrevMonth = new Date();
        firstDayOfPrevMonth.setMonth(firstDayOfPrevMonth.getMonth() - 1);
        firstDayOfPrevMonth.setDate(1);
        firstDayOfPrevMonth.setHours(0, 0, 0, 0);

        const lastDayOfPrevMonth = new Date(firstDayOfMonth);
        lastDayOfPrevMonth.setDate(0);
        lastDayOfPrevMonth.setHours(23, 59, 59, 999);

        let projectsThisMonth = 0;
        let projectsLastMonth = 0;
        let imagesThisMonth = 0;
        let imagesLastMonth = 0;

        if (projectsTableExists) {
            // Projects created this month
            const projectsThisMonthRes = await pool.query(
                'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND created_at >= $2',
                [userId, firstDayOfMonth]
            );
            projectsThisMonth = parseInt(projectsThisMonthRes.rows[0].count, 10);

            // Projects created last month
            const projectsLastMonthRes = await pool.query(
                'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3',
                [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
            );
            projectsLastMonth = parseInt(projectsLastMonthRes.rows[0].count, 10);

            // Images uploaded this month and last month if images table exists
            const imagesTableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'images'
                )
            `);

            if (imagesTableCheck.rows[0].exists) {
                // Images uploaded this month
                const imagesThisMonthRes = await pool.query(
                    'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2',
                    [userId, firstDayOfMonth]
                );
                imagesThisMonth = parseInt(imagesThisMonthRes.rows[0].count, 10);

                // Images uploaded last month
                const imagesLastMonthRes = await pool.query(
                    'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2 AND i.created_at <= $3',
                    [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
                );
                imagesLastMonth = parseInt(imagesLastMonthRes.rows[0].count, 10);
            }
        }

        // Return all statistics with both new format keys and old format keys for compatibility
        logger.info('User stats fetched successfully', { userId });
        res.status(200).json({
            // New format property names
            totalProjects,
            totalImages,
            completedSegmentations,
            storageUsedMB,
            storageUsedBytes: storageUsedBytes.toString(),
            storageLimitBytes: storageLimitBytes.toString(),
            recentActivity,
            recentProjects,
            recentImages,
            comparisons: {
                projectsThisMonth,
                projectsLastMonth,
                projectsChange: projectsThisMonth - projectsLastMonth,
                imagesThisMonth,
                imagesLastMonth,
                imagesChange: imagesThisMonth - imagesLastMonth
            },
            // Old format property names for compatibility
            projects_count: totalProjects,
            images_count: totalImages,
            segmentations_count: completedSegmentations,
            storage_used_mb: storageUsedMB,
            storage_used_bytes: storageUsedBytes.toString(),
            storage_limit_bytes: storageLimitBytes.toString(),
            last_login: new Date().toISOString(),
            recent_activity: recentActivity,
            recent_projects: recentProjects,
            recent_images: recentImages,
            projects_this_month: projectsThisMonth,
            projects_last_month: projectsLastMonth,
            projects_change: projectsThisMonth - projectsLastMonth,
            images_this_month: imagesThisMonth,
            images_last_month: imagesLastMonth,
            images_change: imagesThisMonth - imagesLastMonth
        });

    } catch (err: unknown) {
      let errorMessage = 'Failed to fetch user statistics';
      if (err instanceof Error) {
        errorMessage = err.message;
        logger.error('Error fetching user statistics:', err);
      } else {
        logger.error('An unknown error occurred while fetching user statistics:', err);
      }
      res.status(500).json({ message: errorMessage });
    }
});

// POST /api/users/me/avatar - Upload user avatar
router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req: AuthenticatedRequest, res: Response) => {
  console.log('POST /api/users/me/avatar - Received request');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  console.log('Request user:', req.user);
  console.log('AVATAR_DIR:', AVATAR_DIR);

  const userId = req.user?.userId;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ message: 'No avatar file uploaded' });
  }

  try {
    // Get the relative path to store in the database
    const relativePath = `/uploads/avatars/${path.basename(req.file.path)}`;

    // Check if user already has an avatar and delete it if exists
    const userResult = await pool.query(
      'SELECT avatar_url FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    const oldAvatarUrl = userResult.rows.length > 0 ? userResult.rows[0].avatar_url : null;

    if (oldAvatarUrl) {
      // Extract the filename from the URL
      const oldAvatarPath = path.join(AVATAR_DIR, path.basename(oldAvatarUrl));
      try {
        await fsPromises.unlink(oldAvatarPath);
        console.log(`Deleted old avatar: ${oldAvatarPath}`);
      } catch (err) {
        console.warn(`Failed to delete old avatar: ${oldAvatarPath}`, err);
        // Continue even if deletion fails
      }
    }

    // Update the user profile with the new avatar URL
    await pool.query(
      `INSERT INTO user_profiles (user_id, avatar_url, updated_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id)
       DO UPDATE SET avatar_url = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, relativePath]
    );

    res.status(200).json({
      avatar_url: relativePath,
      message: 'Avatar uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading avatar:', error);
    // Clean up the uploaded file on error
    if (req.file?.path) {
      try {
        await fsPromises.unlink(req.file.path);
      } catch (unlinkErr) {
        console.error('Failed to delete avatar file after error:', unlinkErr);
      }
    }
    res.status(500).json({ message: 'Failed to upload avatar' });
  }
});

// GET /api/users/me/statistics - Get comprehensive statistics for the logged-in user
router.get('/me/statistics', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    logger.info('Fetching statistics for user', { userId });
    try {
        logger.debug('Fetching projects count...');
        // Fetch total projects
        const projectsCountRes = await pool.query('SELECT COUNT(*) FROM projects WHERE user_id = $1', [userId]);
        const totalProjects = parseInt(projectsCountRes.rows[0]?.count || '0', 10);
        logger.debug(`Projects count: ${totalProjects}`);

        logger.debug('Fetching images count...');
        // Fetch total images (across user's projects)
        const imagesCountRes = await pool.query(
            'SELECT COUNT(i.id) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
            [userId]
        );
        const totalImages = parseInt(imagesCountRes.rows[0]?.count || '0', 10);
        logger.debug(`Images count: ${totalImages}`);

        logger.debug('Fetching completed segmentations count...');
        // Fetch completed segmentations
        const completedSegmentationsRes = await pool.query(
            'SELECT COUNT(sr.id) FROM segmentation_results sr JOIN images i ON sr.image_id = i.id JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND sr.status = $2',
            [userId, 'completed']
        );
        const completedSegmentations = parseInt(completedSegmentationsRes.rows[0]?.count || '0', 10);
        logger.debug(`Completed segmentations: ${completedSegmentations}`);

        let storageLimitBytes: bigint;
        let storageUsedBytes: bigint;

        try {
            logger.debug('Fetching user storage info...');
            
            // Set defaults
            const defaultLimit = config.storage.defaultUserLimitBytes || 10737418240; // 10GB
            storageLimitBytes = BigInt(defaultLimit);
            storageUsedBytes = 0n;
            
            try {
                // First check if the storage columns exist in the users table
                const checkColumnsQuery = `
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_name = 'users' AND column_name IN ('storage_limit_bytes', 'storage_used_bytes')
                `;
                const columnsCheck = await pool.query(checkColumnsQuery);
                const existingColumns = columnsCheck.rows.map(row => row.column_name);
                
                if (existingColumns.length === 2) {
                    // Both columns exist, fetch data
                    const userStorageRes = await pool.query(
                        'SELECT storage_limit_bytes, storage_used_bytes FROM users WHERE id = $1',
                        [userId]
                    );
    
                    if (userStorageRes.rows.length === 0) {
                        logger.warn('User not found in users table during storage fetch, using defaults', { userId });
                    } else {
                        const userData = userStorageRes.rows[0];
                        logger.debug('Raw user storage data from DB:', userData);
    
                        // Safely convert to BigInt, providing defaults if null/undefined
                        const rawLimit = userData.storage_limit_bytes;
                        const rawUsed = userData.storage_used_bytes;
    
                        storageLimitBytes = rawLimit !== null && rawLimit !== undefined
                            ? BigInt(rawLimit)
                            : BigInt(defaultLimit);
    
                        storageUsedBytes = rawUsed !== null && rawUsed !== undefined
                            ? BigInt(rawUsed)
                            : 0n;
                    }
                } else {
                    logger.info('Storage columns not found in users table, using defaults', { existingColumns });
                }
            } catch (storageColError) {
                logger.warn('Error checking storage columns, using defaults', { error: storageColError });
            }

            logger.debug(`Storage info - Limit: ${storageLimitBytes}, Used: ${storageUsedBytes}`);
        } catch (storageError: unknown) {
            logger.error('Error fetching or processing user storage info', { userId, error: storageError instanceof Error ? storageError.message : 'Unknown error', stack: storageError instanceof Error ? storageError.stack : 'Unknown error' });
            // Re-throw or handle as a 500 error appropriately
            if (storageError instanceof Error) {
                logger.error('Original storage error:', storageError);
                throw new ApiError('Failed to retrieve user storage details', 500);
            } else {
                throw new ApiError('Failed to retrieve user storage details', 500);
            }
        }

        logger.debug('Fetching recent activity...');
        // Fetch recent activity (last 10 events)
        const activityQuery = `
            SELECT
                'project_created' as type,
                p.id as project_id,
                p.title as project_name,
                p.created_at as timestamp,
                'Created project ' || p.title as description,
                NULL as image_id,
                NULL as image_name
            FROM projects p
            WHERE p.user_id = $1

            UNION ALL

            SELECT
                'image_uploaded' as type,
                i.project_id,
                p.title as project_name,
                i.created_at as timestamp,
                'Uploaded image ' || i.name || ' to project ' || p.title as description,
                i.id as image_id,
                i.name as image_name
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE p.user_id = $1

            UNION ALL

            SELECT
                'segmentation_completed' as type,
                i.project_id,
                p.title as project_name,
                i.updated_at as timestamp,
                'Completed segmentation for ' || i.name || ' in project ' || p.title as description,
                i.id as image_id,
                i.name as image_name
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE p.user_id = $1 AND i.status = 'completed'

            ORDER BY timestamp DESC
            LIMIT 10
        `;
        const activityRes = await pool.query(activityQuery, [userId]);
        const recentActivity = activityRes.rows;

        // Fetch recent projects (last 5)
        const recentProjectsQuery = `
            SELECT
                p.id,
                p.title,
                p.description,
                p.created_at,
                p.updated_at,
                (SELECT COUNT(*) FROM images WHERE project_id = p.id) as image_count,
                (SELECT COUNT(*) FROM images WHERE project_id = p.id AND status = 'completed') as completed_count
            FROM projects p
            WHERE p.user_id = $1
            ORDER BY p.updated_at DESC
            LIMIT 5
        `;
        const recentProjectsRes = await pool.query(recentProjectsQuery, [userId]);
        const recentProjects = recentProjectsRes.rows;

        // Fetch recent images (last 5)
        const recentImagesQuery = `
            SELECT
                i.id,
                i.name,
                i.storage_path,
                i.status,
                i.created_at,
                i.updated_at,
                i.project_id,
                p.title as project_name
            FROM images i
            JOIN projects p ON i.project_id = p.id
            WHERE p.user_id = $1
            ORDER BY i.updated_at DESC
            LIMIT 5
        `;
        const recentImagesRes = await pool.query(recentImagesQuery, [userId]);
        const recentImages = recentImagesRes.rows;

        // Get comparison data (previous month vs current month)
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);

        const firstDayOfPrevMonth = new Date();
        firstDayOfPrevMonth.setMonth(firstDayOfPrevMonth.getMonth() - 1);
        firstDayOfPrevMonth.setDate(1);
        firstDayOfPrevMonth.setHours(0, 0, 0, 0);

        const lastDayOfPrevMonth = new Date(firstDayOfMonth);
        lastDayOfPrevMonth.setDate(0);
        lastDayOfPrevMonth.setHours(23, 59, 59, 999);

        // Projects created this month
        const projectsThisMonthRes = await pool.query(
            'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND created_at >= $2',
            [userId, firstDayOfMonth]
        );
        const projectsThisMonth = parseInt(projectsThisMonthRes.rows[0]?.count || '0', 10);

        // Projects created last month
        const projectsLastMonthRes = await pool.query(
            'SELECT COUNT(*) FROM projects WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3',
            [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
        );
        const projectsLastMonth = parseInt(projectsLastMonthRes.rows[0]?.count || '0', 10);

        // Images uploaded this month
        const imagesThisMonthRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2',
            [userId, firstDayOfMonth]
        );
        const imagesThisMonth = parseInt(imagesThisMonthRes.rows[0]?.count || '0', 10);

        // Images uploaded last month
        const imagesLastMonthRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2 AND i.created_at <= $3',
            [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
        );
        const imagesLastMonth = parseInt(imagesLastMonthRes.rows[0]?.count || '0', 10);
        logger.debug(`Stats calculation complete`);

        // Return all statistics
        res.status(200).json({
            totalProjects,
            totalImages,
            completedSegmentations,
            storageLimitBytes: storageLimitBytes.toString(),
            storageUsedBytes: storageUsedBytes.toString(),
            recentActivity,
            recentProjects,
            recentImages,
            comparisons: {
                projectsThisMonth,
                projectsLastMonth,
                projectsChange: projectsThisMonth - projectsLastMonth,
                imagesThisMonth,
                imagesLastMonth,
                imagesChange: imagesThisMonth - imagesLastMonth
            }
        });

    } catch (error: unknown) {
        logger.error(`Error in /me/statistics for user ${userId}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'Unknown error',
            ...(error instanceof ApiError ? { status: error.statusCode } : {})
        });
        next(error); // Pass error to the centralized error handler
    }
});

// POST /api/users/register - Register a new user
router.post('/register', validate(registerSchema), async (req: Request, res: Response) => {
    const { email, password, name } = req.body;
    // TODO: Adjust later if firstName, lastName are passed separately
    const [firstName, lastName] = name ? name.split(' ') : [null, null]; // Simple split for now

    try {
        logger.info('User registration attempt', { email });

        // Check if user already exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            logger.warn('Registration failed: Email already registered', { email });
            return res.status(409).json({ message: 'Email already registered' });
        }

        // Hash password
        const SALT_ROUNDS = config.auth.saltRounds || 10;
        let hashedPassword;
        try {
            hashedPassword = await bcryptjs.hash(password, SALT_ROUNDS);
        } catch (bcryptjsError) {
            logger.error('Bcrypt hash error during registration', { error: bcryptjsError });
            return res.status(500).json({ message: 'Error creating account. Please try again later.' });
        }

        // Insert new user
        const fullName = `${firstName} ${lastName}`.trim();

        try {
            // Check if the users table has a name column
            const tableInfo = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = 'name'
            `);

            let newUserResult;
            if (tableInfo.rows.length > 0) {
                // If name column exists, use it
                newUserResult = await pool.query(
                    'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, name, created_at',
                    [email, hashedPassword, fullName]
                );
            } else {
                // If name column doesn't exist, don't include it
                newUserResult = await pool.query(
                    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
                    [email, hashedPassword]
                );
                logger.warn('Name column missing in users table', { email });
            }

            const newUser = newUserResult.rows[0];
            logger.info('User registered successfully', { userId: newUser.id, email: newUser.email });

            // Respond successfully
            res.status(201).json({
                message: 'User registered successfully',
                user: {
                    id: newUser.id,
                    email: newUser.email,
                    name: newUser.name || fullName
                }
            });
        } catch (dbError) {
            logger.error('Database error during user registration', { error: dbError, email });
            return res.status(500).json({ message: 'Error creating account. Please try again later.' });
        }

    } catch (error) {
        logger.error('Registration error', { error });
        res.status(500).json({ message: 'Internal server error during registration' });
    }
});

// POST /api/users/login - Login with email/password
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body;

    try {
        logger.info('Login attempt', { email });

        // Find user by email
        const userResult = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userResult.rows.length === 0) {
            logger.warn('Login failed: User not found', { email });
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = userResult.rows[0];
        logger.debug('User found', { userId: user.id, email: user.email });

        // Check if password_hash exists
        if (!user.password_hash) {
            logger.error('Login error: User has no password_hash', { userId: user.id, email: user.email });
            return res.status(500).json({ message: 'Account configuration error. Please contact support.' });
        }

        // Compare password
        try {
            const isMatch = await bcryptjs.compare(password, user.password_hash);
            if (!isMatch) {
                logger.warn('Login failed: Invalid password', { userId: user.id, email: user.email });
                return res.status(401).json({ message: 'Invalid credentials' });
            }
        } catch (bcryptjsError) {
            logger.error('Bcrypt compare error', { error: bcryptjsError, userId: user.id, email: user.email });
            return res.status(500).json({ message: 'Authentication error. Please try again later.' });
        }

        // Check if user is approved (if the column exists)
        if (user.hasOwnProperty('is_approved') && !user.is_approved) {
            logger.warn('Login failed: Account not approved', { userId: user.id, email: user.email });
            return res.status(403).json({ message: 'Account not approved' });
        }

        // Generate JWT
        const JWT_SECRET = config.auth.jwtSecret;
        if (!JWT_SECRET) {
            return res.status(500).json({ message: 'Server configuration error' });
        }

        try {
            const token = jwt.sign(
                { userId: user.id, email: user.email },
                String(JWT_SECRET),
                { expiresIn: config.auth.jwtExpiry }
            );

            logger.info('Login successful', { userId: user.id, email: user.email });

            // Include name in response if available
            const userResponse = {
                id: user.id,
                email: user.email
            };

            // Add name to response if it exists
            if (user.name) {
                userResponse['name'] = user.name;
            }

            res.status(200).json({
                message: 'Login successful',
                token,
                user: userResponse
            });
        } catch (jwtError) {
            logger.error('JWT sign error', { error: jwtError, userId: user.id, email: user.email });
            return res.status(500).json({ message: 'Authentication error. Please try again later.' });
        }

    } catch (error) {
        logger.error('Login error', { error });
        res.status(500).json({ message: 'Internal server error during login' });
    }
});

export default router;
