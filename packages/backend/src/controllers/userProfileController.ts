/**
 * User Profile Controller
 * Handles HTTP requests for user profile and settings management
 */
import { Response } from 'express';
import { Pool } from 'pg';
import multer from 'multer';
import path from 'path';
import userProfileService from '../services/userProfileService';
import logger from '../utils/logger';
import dbPool from '../db';
import { AuthenticatedRequest } from '../security/middleware/auth';;

// Multer configuration for avatar uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  },
});

export const uploadAvatar = upload.single('avatar');

/**
 * Get user profile
 */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await userProfileService.getUserProfile(dbPool, userId);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(profile);
  } catch (error) {
    logger.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user profile with settings
 */
export const getUserProfileWithSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { profile, settings } = await userProfileService.getUserProfileWithSettings(dbPool, userId);
    
    // Convert settings to object for easier frontend usage
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.setting_key] = setting.setting_value;
      return acc;
    }, {} as Record<string, any>);

    res.json({ profile, settings: settingsObj });
  } catch (error) {
    logger.error('Error fetching user profile with settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create user profile
 */
export const createUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await userProfileService.createUserProfile(dbPool, userId, req.body);
    
    res.status(201).json(profile);
  } catch (error) {
    logger.error('Error creating user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const profile = await userProfileService.updateUserProfile(dbPool, userId, req.body);
    
    res.json(profile);
  } catch (error) {
    logger.error('Error updating user profile:', error);
    if (error instanceof Error && error.message === 'Profile not found') {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Upload avatar
 */
export const uploadAvatarHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const uploadsDir = process.env.UPLOADS_DIR || '/app/uploads';
    const avatarFile = await userProfileService.saveAvatarFile(dbPool, userId, req.file, uploadsDir);
    
    res.json({ 
      message: 'Avatar uploaded successfully',
      avatar: {
        filename: avatarFile.filename,
        url: `/uploads/avatars/${avatarFile.filename}`
      }
    });
  } catch (error) {
    logger.error('Error uploading avatar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete avatar
 */
export const deleteAvatar = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await userProfileService.deleteAvatarFile(dbPool, userId);
    
    res.json({ message: 'Avatar deleted successfully' });
  } catch (error) {
    logger.error('Error deleting avatar:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get user setting
 */
export const getUserSetting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { key } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const setting = await userProfileService.getUserSetting(dbPool, userId, key);
    
    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({
      key: setting.setting_key,
      value: setting.setting_value,
      category: setting.category
    });
  } catch (error) {
    logger.error('Error fetching user setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get all user settings
 */
export const getUserSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const settings = await userProfileService.getUserSettings(dbPool, userId);
    
    // Convert to object format
    const settingsObj = settings.reduce((acc, setting) => {
      acc[setting.setting_key] = {
        value: setting.setting_value,
        category: setting.category,
        updated_at: setting.updated_at
      };
      return acc;
    }, {} as Record<string, any>);

    res.json(settingsObj);
  } catch (error) {
    logger.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Set user setting
 */
export const setUserSetting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { key } = req.params;
    const { value, category = 'general' } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }

    const setting = await userProfileService.setUserSetting(dbPool, userId, key, value, category);
    
    res.json({
      key: setting.setting_key,
      value: setting.setting_value,
      category: setting.category,
      updated_at: setting.updated_at
    });
  } catch (error) {
    logger.error('Error setting user setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete user setting
 */
export const deleteUserSetting = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { key } = req.params;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await userProfileService.deleteUserSetting(dbPool, userId, key);
    
    res.json({ message: 'Setting deleted successfully' });
  } catch (error) {
    logger.error('Error deleting user setting:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Batch update user settings
 */
export const batchUpdateUserSettings = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { settings } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    const updatedSettings = await Promise.all(
      Object.entries(settings).map(async ([key, data]: [string, any]) => {
        const { value, category = 'general' } = data;
        return userProfileService.setUserSetting(dbPool, userId, key, value, category);
      })
    );

    const settingsObj = updatedSettings.reduce((acc, setting) => {
      acc[setting.setting_key] = {
        value: setting.setting_value,
        category: setting.category,
        updated_at: setting.updated_at
      };
      return acc;
    }, {} as Record<string, any>);

    res.json(settingsObj);
  } catch (error) {
    logger.error('Error batch updating user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default {
  getUserProfile,
  getUserProfileWithSettings,
  createUserProfile,
  updateUserProfile,
  uploadAvatarHandler,
  deleteAvatar,
  getUserSetting,
  getUserSettings,
  setUserSetting,
  deleteUserSetting,
  batchUpdateUserSettings,
  uploadAvatar
};