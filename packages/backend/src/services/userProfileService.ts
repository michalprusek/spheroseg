/**
 * User Profile Service
 * Handles all user profile operations including avatar management
 */
import { Pool, PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

export interface UserProfile {
  id: string;
  user_id: string;
  username?: string;
  full_name?: string;
  title?: string;
  organization?: string;
  bio?: string;
  location?: string;
  avatar_url?: string;
  preferred_language?: string;
  theme_preference?: string;
  created_at: Date;
  updated_at: Date;
}

export interface AvatarFile {
  id: string;
  user_id: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  file_path: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserSetting {
  id: string;
  user_id: string;
  setting_key: string;
  setting_value: any;
  category: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateProfileData {
  username?: string;
  full_name?: string;
  title?: string;
  organization?: string;
  bio?: string;
  location?: string;
  preferred_language?: string;
  theme_preference?: string;
}

export interface UpdateProfileData extends Partial<CreateProfileData> {
  avatar_url?: string;
}

/**
 * Get user profile by user ID
 */
export const getUserProfile = async (pool: Pool, userId: string): Promise<UserProfile | null> => {
  try {
    const result = await pool.query(
      `SELECT up.*, af.file_path as avatar_file_path, af.filename as avatar_filename
       FROM user_profiles up
       LEFT JOIN avatar_files af ON up.user_id = af.user_id
       WHERE up.user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const profile = result.rows[0];
    
    // Construct avatar URL if avatar file exists
    if (profile.avatar_filename) {
      profile.avatar_url = `/uploads/avatars/${profile.avatar_filename}`;
    }

    return profile;
  } catch (error) {
    logger.error('Error fetching user profile:', { error, userId });
    throw error;
  }
};

/**
 * Create user profile
 */
export const createUserProfile = async (
  pool: Pool, 
  userId: string, 
  profileData: CreateProfileData
): Promise<UserProfile> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Check if a profile already exists for this user
    const existingProfile = await client.query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );

    if (existingProfile.rows.length > 0) {
      await client.query('COMMIT');
      logger.info('User profile already exists', { userId, profileId: existingProfile.rows[0].id });
      return existingProfile.rows[0];
    }

    const profileId = uuidv4();
    let username = profileData.username;

    // If username is provided, ensure it's unique
    if (username) {
      const usernameCheck = await client.query(
        'SELECT COUNT(*) FROM user_profiles WHERE username = $1',
        [username]
      );

      if (parseInt(usernameCheck.rows[0].count) > 0) {
        // Generate a unique username by appending a number
        let counter = 1;
        let uniqueUsername = `${username}${counter}`;
        
        while (true) {
          const check = await client.query(
            'SELECT COUNT(*) FROM user_profiles WHERE username = $1',
            [uniqueUsername]
          );
          
          if (parseInt(check.rows[0].count) === 0) {
            username = uniqueUsername;
            break;
          }
          
          counter++;
          uniqueUsername = `${username}${counter}`;
          
          // Safety check to prevent infinite loop
          if (counter > 1000) {
            username = `${username}_${profileId.substring(0, 8)}`;
            break;
          }
        }
        
        logger.info('Username conflict resolved', { 
          originalUsername: profileData.username, 
          newUsername: username,
          userId 
        });
      }
    }
    
    const result = await client.query(
      `INSERT INTO user_profiles (
        id, user_id, username, full_name, title, organization, 
        bio, location, preferred_language, theme_preference
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        profileId,
        userId,
        username,
        profileData.full_name,
        profileData.title,
        profileData.organization,
        profileData.bio,
        profileData.location,
        profileData.preferred_language,
        profileData.theme_preference
      ]
    );

    await client.query('COMMIT');
    
    logger.info('User profile created successfully', { userId, profileId, username });
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating user profile:', { error, userId });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  pool: Pool,
  userId: string,
  profileData: UpdateProfileData
): Promise<UserProfile> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Build dynamic update query
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramCount = 1;

    Object.entries(profileData).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(value);
        paramCount++;
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No fields to update');
    }

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(userId);

    const updateQuery = `
      UPDATE user_profiles 
      SET ${updateFields.join(', ')}
      WHERE user_id = $${paramCount}
      RETURNING *
    `;

    const result = await client.query(updateQuery, updateValues);

    if (result.rows.length === 0) {
      throw new Error('Profile not found');
    }

    await client.query('COMMIT');
    
    logger.info('User profile updated successfully', { userId });
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error updating user profile:', { error, userId });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Upload and save avatar file
 */
export const saveAvatarFile = async (
  pool: Pool,
  userId: string,
  file: Express.Multer.File,
  uploadsDir: string
): Promise<AvatarFile> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create avatars directory if it doesn't exist
    const avatarsDir = path.join(uploadsDir, 'avatars');
    await fs.mkdir(avatarsDir, { recursive: true });

    // Generate unique filename
    const fileExtension = path.extname(file.originalname);
    const filename = `${userId}_${Date.now()}${fileExtension}`;
    const filePath = path.join(avatarsDir, filename);

    // Save file to disk
    await fs.writeFile(filePath, file.buffer);

    // Remove old avatar file if exists
    const oldAvatarResult = await client.query(
      'SELECT * FROM avatar_files WHERE user_id = $1',
      [userId]
    );

    if (oldAvatarResult.rows.length > 0) {
      const oldAvatar = oldAvatarResult.rows[0];
      try {
        await fs.unlink(oldAvatar.file_path);
      } catch (error) {
        logger.warn('Failed to delete old avatar file:', { error, filePath: oldAvatar.file_path });
      }
      
      // Delete old avatar record
      await client.query('DELETE FROM avatar_files WHERE user_id = $1', [userId]);
    }

    // Save avatar metadata to database
    const avatarId = uuidv4();
    const avatarResult = await client.query(
      `INSERT INTO avatar_files (
        id, user_id, filename, original_name, mime_type, 
        file_size, file_path
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        avatarId,
        userId,
        filename,
        file.originalname,
        file.mimetype,
        file.size,
        filePath
      ]
    );

    // Update user profile with avatar URL
    await client.query(
      `UPDATE user_profiles 
       SET avatar_url = $1, updated_at = NOW()
       WHERE user_id = $2`,
      [`/uploads/avatars/${filename}`, userId]
    );

    await client.query('COMMIT');
    
    logger.info('Avatar file saved successfully', { userId, filename });
    return avatarResult.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error saving avatar file:', { error, userId });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Delete avatar file
 */
export const deleteAvatarFile = async (pool: Pool, userId: string): Promise<void> => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Get avatar file info
    const avatarResult = await client.query(
      'SELECT * FROM avatar_files WHERE user_id = $1',
      [userId]
    );

    if (avatarResult.rows.length > 0) {
      const avatar = avatarResult.rows[0];
      
      // Delete file from disk
      try {
        await fs.unlink(avatar.file_path);
      } catch (error) {
        logger.warn('Failed to delete avatar file from disk:', { error, filePath: avatar.file_path });
      }

      // Remove avatar record from database
      await client.query('DELETE FROM avatar_files WHERE user_id = $1', [userId]);
    }

    // Update user profile to remove avatar reference
    await client.query(
      `UPDATE user_profiles 
       SET avatar_url = NULL, updated_at = NOW()
       WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');
    
    logger.info('Avatar file deleted successfully', { userId });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error deleting avatar file:', { error, userId });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Get user profile with fallback creation
 */
export const getOrCreateUserProfile = async (
  pool: Pool, 
  userId: string, 
  userEmail: string,
  userName?: string
): Promise<UserProfile> => {
  try {
    // Try to get existing profile
    let profile = await getUserProfile(pool, userId);
    
    if (!profile) {
      // Create profile with basic data
      const defaultUsername = userName || userEmail.split('@')[0];
      
      profile = await createUserProfile(pool, userId, {
        username: defaultUsername,
        full_name: userName || 'User',
        preferred_language: 'en'
      });
    }
    
    return profile;
  } catch (error) {
    logger.error('Error getting or creating user profile:', { error, userId });
    throw error;
  }
};

/**
 * Get user setting by key
 */
export const getUserSetting = async (pool: Pool, userId: string, settingKey: string): Promise<UserSetting | null> => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1 AND setting_key = $2',
      [userId, settingKey]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error fetching user setting:', { error, userId, settingKey });
    throw error;
  }
};

/**
 * Get all user settings
 */
export const getUserSettings = async (pool: Pool, userId: string): Promise<UserSetting[]> => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1 ORDER BY setting_key',
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    logger.error('Error fetching user settings:', { error, userId });
    throw error;
  }
};

/**
 * Set user setting
 */
export const setUserSetting = async (
  pool: Pool,
  userId: string,
  settingKey: string,
  settingValue: any,
  category: string = 'general'
): Promise<UserSetting> => {
  try {
    const settingId = uuidv4();
    const result = await pool.query(
      `INSERT INTO user_settings (id, user_id, setting_key, setting_value, category, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       ON CONFLICT (user_id, setting_key) DO UPDATE SET
         setting_value = $4,
         category = $5,
         updated_at = NOW()
       RETURNING *`,
      [settingId, userId, settingKey, JSON.stringify(settingValue), category]
    );
    
    logger.info('User setting updated successfully', { userId, settingKey, category });
    return result.rows[0];
  } catch (error) {
    logger.error('Error setting user setting:', { error, userId, settingKey });
    throw error;
  }
};

/**
 * Delete user setting
 */
export const deleteUserSetting = async (pool: Pool, userId: string, settingKey: string): Promise<void> => {
  try {
    await pool.query(
      'DELETE FROM user_settings WHERE user_id = $1 AND setting_key = $2',
      [userId, settingKey]
    );
    
    logger.info('User setting deleted successfully', { userId, settingKey });
  } catch (error) {
    logger.error('Error deleting user setting:', { error, userId, settingKey });
    throw error;
  }
};

/**
 * Get user profile with settings
 */
export const getUserProfileWithSettings = async (pool: Pool, userId: string): Promise<{
  profile: UserProfile | null;
  settings: UserSetting[];
}> => {
  try {
    const [profile, settings] = await Promise.all([
      getUserProfile(pool, userId),
      getUserSettings(pool, userId)
    ]);

    return { profile, settings };
  } catch (error) {
    logger.error('Error fetching user profile with settings:', { error, userId });
    throw error;
  }
};

export default {
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  saveAvatarFile,
  deleteAvatarFile,
  getOrCreateUserProfile,
  getUserSetting,
  getUserSettings,
  setUserSetting,
  deleteUserSetting,
  getUserProfileWithSettings
};