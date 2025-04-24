import express, { Response, Router, Request, NextFunction } from 'express';
import pool from '@/db';
import { validate } from '../middleware/validationMiddleware';
import { updateUserProfileSchema, changeRoleSchema } from '../validators/userValidators';
import bcrypt from 'bcryptjs';
import authMiddleware, { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authorizeRole } from '../middleware/authorizationMiddleware';
import { z } from 'zod'; // Import z
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';

// Define the expected shape of the request body based on the schema
type UserProfileUpdateBody = z.infer<typeof updateUserProfileSchema>['body'];

const router: Router = express.Router();

// Configure upload directory and storage for avatars
const AVATAR_DIR = process.env.AVATAR_DIR || '/app/uploads/avatars';

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
      // Pass error as the first argument and false for acceptance
      // @ts-ignore
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});


// GET /api/users/me - Get current user's profile
// @ts-ignore // TS2769: No overload matches this call
router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
        // This should technically be caught by authenticateToken, but belt-and-suspenders
        return res.status(401).json({ message: 'Authentication required' });
    }

    try {
        const userRecord = await pool.query('SELECT id, email, name, created_at FROM users WHERE id = $1', [userId]);

        if (userRecord.rows.length === 0) {
            return res.status(404).json({ message: 'User not found in database' });
        }

        // Exclude password hash from the response (assuming it's selected - adjust query if needed)
        // const { passwordHash, ...userWithoutPassword } = userRecord.rows[0]; // Example if passwordHash was selected
        return res.json(userRecord.rows[0]); // Return the user data
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return res.status(500).json({ message: 'Failed to fetch user profile' });
    }
});

// PUT /api/users/me - Update current user's profile
// @ts-ignore // TS2769: No overload matches this call
router.put('/me', authMiddleware, validate(updateUserProfileSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;

    if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    // Extract fields based on the CORRECTED UserProfileUpdateBody type
    const {
        // User table fields
        email,
        name, // Use the actual 'name' field from the users table
        password,
        // Profile table fields
        username,
        full_name,
        title,
        organization,
        bio,
        location,
        avatar_url,
        preferred_language
    }: UserProfileUpdateBody = req.body;

    try {
        await pool.query('BEGIN'); // Start transaction

        // --- Update users table --- (Handles email, name, password)
        const userFieldsToUpdate: { [key: string]: any } = {};
        const userValues: any[] = [];
        let userPlaceholderIndex = 1; // Start index for user query values

        if (email !== undefined) {
            userFieldsToUpdate.email = email;
            userValues.push(email);
            userPlaceholderIndex++;
        }
        // Add 'name' field handling
        if (name !== undefined) {
            userFieldsToUpdate.name = name;
            userValues.push(name);
            userPlaceholderIndex++;
        }
        if (password !== undefined) {
             if (typeof password === 'string' && password.length > 0) {
                userFieldsToUpdate.password_hash = await bcrypt.hash(password, 10);
                userValues.push(userFieldsToUpdate.password_hash);
                userPlaceholderIndex++;
             } else if (password !== null && password !== '') {
                 await pool.query('ROLLBACK'); // Rollback transaction
                 return res.status(400).json({ message: 'Invalid password provided for update' });
             }
        }

        let updatedUser = null;
        if (Object.keys(userFieldsToUpdate).length > 0) {
            const userSetClauses = Object.keys(userFieldsToUpdate).map((key, index) => `${key} = $${index + 2}`).join(', ');
            const userUpdateQuery = `UPDATE users SET ${userSetClauses} WHERE id = $1 RETURNING id, email, name, role, is_approved, created_at`; // Correct RETURNING clause
            userValues.unshift(userId); // Add userId as $1
            const updatedUserResult = await pool.query(userUpdateQuery, userValues);
             // Check rowCount explicitly for null
             if (updatedUserResult && updatedUserResult.rowCount !== null && updatedUserResult.rowCount > 0) {
                 updatedUser = updatedUserResult.rows[0]; // Store result if needed later
            }
            // Handle case where user wasn't found for update, though auth should prevent this
            // else { await pool.query('ROLLBACK'); return res.status(404).json({ message: 'User not found for update' }); }
        }

        // --- Update/Insert user_profiles table --- (Handles profile fields)
        const profileFieldsToUpdate: { [key: string]: any } = {};
        const profileValues: any[] = [];
        let profilePlaceholderIndex = 1; // Start index for profile query values

        // Helper to add field if defined, mapping schema name to DB column name if needed
        const addProfileField = (dbFieldName: string, value: any) => {
            if (value !== undefined) {
                profileFieldsToUpdate[dbFieldName] = value;
                profileValues.push(value);
                profilePlaceholderIndex++;
            }
        };

        addProfileField('username', username);
        addProfileField('full_name', full_name);
        addProfileField('title', title);
        addProfileField('organization', organization);
        addProfileField('bio', bio);
        addProfileField('location', location);
        addProfileField('avatar_url', avatar_url);
        addProfileField('preferred_language', preferred_language);

        let updatedProfile = null;
        if (Object.keys(profileFieldsToUpdate).length > 0) {
            profileValues.unshift(userId); // Add userId as the first value ($1)

            const profileColumns = ['user_id', ...Object.keys(profileFieldsToUpdate)];
            const profilePlaceholders = profileColumns.map((_, index) => `$${index + 1}`).join(', ');
            // Construct SET clauses for the UPDATE part of ON CONFLICT
            // Ensure keys match DB columns; placeholders start from $2 ($1 is user_id for WHERE)
            const profileSetClauses = Object.keys(profileFieldsToUpdate).map((key, index) => `${key} = EXCLUDED.${key}`).join(', ');

            // Use INSERT ... ON CONFLICT to handle both insert and update
            const profileUpsertQuery = `
                INSERT INTO user_profiles (${profileColumns.join(', ')})
                VALUES (${profilePlaceholders})
                ON CONFLICT (user_id)
                DO UPDATE SET ${profileSetClauses}
                RETURNING *;
            `;

            const updatedProfileResult = await pool.query(profileUpsertQuery, profileValues);
             // Check rowCount explicitly for null
             if (updatedProfileResult && updatedProfileResult.rowCount !== null && updatedProfileResult.rowCount > 0) {
                updatedProfile = updatedProfileResult.rows[0];
            }
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
                u.id, u.email, u.name, u.role, u.is_approved, u.created_at,
                up.username, up.full_name, up.title, up.organization, up.bio, up.location, up.avatar_url, up.preferred_language
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
        await pool.query('ROLLBACK'); // Rollback transaction on any error
        console.error('Update profile error:', error);
        // Handle specific DB errors like unique constraint violation
        if ((error as any).code === '23505') { // Unique constraint violation
             return res.status(409).json({ message: 'Update failed: Conflict with existing data (e.g., email or username already in use).' });
        }
        return res.status(500).json({ message: 'Failed to update user profile' });
    }
});

// GET /api/users - Get all users (Admin only)
// @ts-ignore // TS2769: No overload matches this call
router.get('/', authMiddleware, authorizeRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query('SELECT id, email, name, created_at FROM users ORDER BY created_at DESC');
        return res.json(result.rows); // Use return for consistency
    } catch (error) {
        console.error('Get all users error:', error);
        return res.status(500).json({ message: 'Failed to fetch users' }); // Use return
    }
});

// PUT /api/users/:userId/approve - Approve a user (Admin only)
// @ts-ignore // TS2769: No overload matches this call
router.put('/:userId/approve', authMiddleware, authorizeRole(['admin']), async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    try {
        // Ensure userId is a valid format if needed (e.g., UUID or number depending on your schema)
        const result = await pool.query('UPDATE users SET is_approved = true WHERE id = $1 RETURNING id, email, first_name, last_name, role, is_approved', [userId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json({ message: 'User approved successfully', user: result.rows[0] }); // Use return
    } catch (error) {
        console.error('Approve user error:', error);
        return res.status(500).json({ message: 'Failed to approve user' }); // Use return
    }
});

// PUT /api/users/:userId/role - Change user role (Admin only)
// @ts-ignore // TS2769: No overload matches this call
router.put('/:userId/role', authMiddleware, authorizeRole(['admin']), validate(changeRoleSchema), async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req.params;
    const { role } = req.body;

    try {
        // Ensure userId is valid format if needed
        const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, first_name, last_name, role, is_approved', [role.toUpperCase(), userId]); // Store role in uppercase for consistency?
        if (result.rowCount === 0) {
             return res.status(404).json({ message: 'User not found' });
        }
        return res.json({ message: 'User role updated successfully', user: result.rows[0] }); // Use return
    } catch (error) {
        console.error('Update role error:', error);
        return res.status(500).json({ message: 'Failed to update user role' }); // Use return
    }
});

// GET /api/users/me/stats - Get overview statistics for the logged-in user
// @ts-ignore // TS2769: No overload matches this call
router.get('/me/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    try {
        console.log(`Fetching stats for user: ${userId}`);

        // Fetch total projects
        const projectsCountRes = await pool.query('SELECT COUNT(*) FROM projects WHERE user_id = $1', [userId]);
        const totalProjects = parseInt(projectsCountRes.rows[0].count, 10);
        console.log(`Total projects: ${totalProjects}`);

        // Fetch total images (across user's projects)
        const imagesCountRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1',
            [userId]
        );
        const totalImages = parseInt(imagesCountRes.rows[0].count, 10);
        console.log(`Total images: ${totalImages}`);

        // Fetch completed segmentations (across user's projects/images)
        const completedSegmentationsRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2',
            [userId, 'completed'] // Assuming 'completed' is the status string
        );
        const completedSegmentations = parseInt(completedSegmentationsRes.rows[0].count, 10);
        console.log(`Completed segmentations: ${completedSegmentations}`);

        // Fetch segmentations completed today
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        const segmentationsTodayRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2 AND i.updated_at >= $3',
            [userId, 'completed', today]
        );
        const segmentationsToday = parseInt(segmentationsTodayRes.rows[0].count, 10);
        console.log(`Segmentations today: ${segmentationsToday}`);

        // Get comparison data (previous month vs current month for projects)
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
        const projectsThisMonth = parseInt(projectsThisMonthRes.rows[0].count, 10);
        console.log(`Projects this month: ${projectsThisMonth}`);

        // Images uploaded this month vs last month
        const imagesThisMonthRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2',
            [userId, firstDayOfMonth]
        );
        const imagesThisMonth = parseInt(imagesThisMonthRes.rows[0].count, 10);
        console.log(`Images this month: ${imagesThisMonth}`);

        const imagesLastMonthRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.created_at >= $2 AND i.created_at <= $3',
            [userId, firstDayOfPrevMonth, lastDayOfPrevMonth]
        );
        const imagesLastMonth = parseInt(imagesLastMonthRes.rows[0].count, 10);
        console.log(`Images last month: ${imagesLastMonth}`);

        // Calculate percentage increase in images
        const imagesComparison = imagesLastMonth > 0
            ? Math.round((imagesThisMonth - imagesLastMonth) / imagesLastMonth * 100)
            : (imagesThisMonth > 0 ? 100 : 0);
        console.log(`Images comparison: ${imagesComparison}%`);

        // Segmentations completed this month vs last month
        const segmentsThisMonthRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2 AND i.updated_at >= $3',
            [userId, 'completed', firstDayOfMonth]
        );
        const segmentsThisMonth = parseInt(segmentsThisMonthRes.rows[0].count, 10);
        console.log(`Segments this month: ${segmentsThisMonth}`);

        const segmentsLastMonthRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2 AND i.updated_at >= $3 AND i.updated_at <= $4',
            [userId, 'completed', firstDayOfPrevMonth, lastDayOfPrevMonth]
        );
        const segmentsLastMonth = parseInt(segmentsLastMonthRes.rows[0].count, 10);
        console.log(`Segments last month: ${segmentsLastMonth}`);

        // Segmentations completed yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        const segmentsYesterdayRes = await pool.query(
            'SELECT COUNT(*) FROM images i JOIN projects p ON i.project_id = p.id WHERE p.user_id = $1 AND i.status = $2 AND i.updated_at >= $3 AND i.updated_at <= $4',
            [userId, 'completed', yesterday, yesterdayEnd]
        );
        const segmentsYesterday = parseInt(segmentsYesterdayRes.rows[0].count, 10);
        console.log(`Segments yesterday: ${segmentsYesterday}`);

        const result = {
            totalProjects,
            totalImages,
            completedSegmentations,
            segmentationsToday,
            projectsComparison: projectsThisMonth,
            imagesComparison: imagesComparison,
            completedComparison: segmentsThisMonth - segmentsLastMonth,
            todayComparison: segmentationsToday - segmentsYesterday
        };

        console.log('Stats result:', result);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error fetching user stats:', error);
        return res.status(500).json({ message: 'Failed to fetch user stats' });
    }
});

// POST /api/users/me/avatar - Upload user avatar
// @ts-ignore // TS2769: No overload matches this call
router.post('/me/avatar', authMiddleware, upload.single('avatar'), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    const result = await pool.query(
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
    const result = await pool.query(
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

export default router;
