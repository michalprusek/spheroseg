/**
 * User Profile Service Test Suite
 * 
 * This suite tests the critical user profile functionality including
 * profile CRUD operations, avatar management, user settings, image processing,
 * transaction handling, and data validation.
 */

// Mock dependencies BEFORE imports
jest.mock('../../utils/logger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    http: jest.fn(),
    silly: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockLogger,
    createLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

jest.mock('sharp', () => {
  return jest.fn(() => ({
    resize: jest.fn().mockReturnThis(),
    jpeg: jest.fn().mockReturnThis(),
    toFile: jest.fn(),
  }));
});

jest.mock('uuid', () => ({
  v4: jest.fn(),
}));

import {
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
  getUserProfileWithSettings,
  UserProfile,
  AvatarFile,
  UserSetting,
  CreateProfileData,
  UpdateProfileData,
} from '../userProfileService';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import fs from 'fs/promises';

// Get mocked dependencies
const mockLogger = require('../../utils/logger').default;
const mockFs = fs as jest.Mocked<typeof fs>;
const mockSharp = sharp as jest.MockedFunction<typeof sharp>;
const mockUuidv4 = uuidv4 as jest.MockedFunction<typeof uuidv4>;

// Mock database pool and client
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  query: jest.fn(),
  connect: jest.fn().mockResolvedValue(mockClient),
};

// Mock file upload
const mockFile: Express.Multer.File = {
  fieldname: 'avatar',
  originalname: 'test-avatar.jpg',
  encoding: '7bit',
  mimetype: 'image/jpeg',
  size: 1024 * 50, // 50KB
  buffer: Buffer.from('fake-image-data'),
  destination: '/uploads',
  filename: 'test-avatar.jpg',
  path: '/uploads/test-avatar.jpg',
  stream: {} as any,
};

describe('User Profile Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockUuidv4.mockReturnValue('test-uuid-1234');
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    
    // Default sharp mock
    const sharpInstance = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toFile: jest.fn().mockResolvedValue(undefined),
    };
    mockSharp.mockReturnValue(sharpInstance as any);
  });

  describe('getUserProfile', () => {
    it('should return user profile with avatar URL when profile exists', async () => {
      const mockProfileData = {
        id: 'profile-1',
        user_id: 'user-1',
        username: 'testuser',
        full_name: 'Test User',
        title: 'Developer',
        organization: 'Test Corp',
        bio: 'Test bio',
        location: 'Test City',
        preferred_language: 'en',
        theme_preference: 'dark',
        avatar_filename: 'user-1_123456.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProfileData],
      });

      const result = await getUserProfile(mockPool as any, 'user-1');

      expect(result).toEqual({
        ...mockProfileData,
        avatar_url: '/uploads/avatars/user-1_123456.jpg',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('FROM user_profiles up'),
        ['user-1']
      );
    });

    it('should return user profile without avatar URL when no avatar exists', async () => {
      const mockProfileData = {
        id: 'profile-1',
        user_id: 'user-1',
        username: 'testuser',
        full_name: 'Test User',
        avatar_filename: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockPool.query.mockResolvedValue({
        rows: [mockProfileData],
      });

      const result = await getUserProfile(mockPool as any, 'user-1');

      expect(result).toEqual(mockProfileData);
      expect(result?.avatar_url).toBeUndefined();
    });

    it('should return null when profile does not exist', async () => {
      mockPool.query.mockResolvedValue({
        rows: [],
      });

      const result = await getUserProfile(mockPool as any, 'non-existent-user');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(error);

      await expect(getUserProfile(mockPool as any, 'user-1')).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error fetching user profile:',
        { error, userId: 'user-1' }
      );
    });
  });

  describe('createUserProfile', () => {
    const profileData: CreateProfileData = {
      username: 'testuser',
      full_name: 'Test User',
      title: 'Developer',
      organization: 'Test Corp',
      bio: 'Test bio',
      location: 'Test City',
      preferred_language: 'en',
      theme_preference: 'dark',
    };

    it('should create new user profile successfully', async () => {
      const mockCreatedProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        ...profileData,
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock no existing profile
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Username check
        .mockResolvedValueOnce({ rows: [mockCreatedProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileData);

      expect(result).toEqual(mockCreatedProfile);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
      
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile created successfully',
        { userId: 'user-1', profileId: 'test-uuid-1234', username: 'testuser' }
      );
    });

    it('should return existing profile if one already exists', async () => {
      const existingProfile = {
        id: 'existing-profile',
        user_id: 'user-1',
        username: 'existinguser',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [existingProfile] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileData);

      expect(result).toEqual(existingProfile);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile already exists',
        { userId: 'user-1', profileId: 'existing-profile' }
      );
    });

    it('should handle username conflicts by generating unique username', async () => {
      const profileDataWithConflict = { ...profileData, username: 'conflictuser' };
      const mockCreatedProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        ...profileDataWithConflict,
        username: 'conflictuser1', // Modified username
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Username conflict
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Check conflictuser1
        .mockResolvedValueOnce({ rows: [mockCreatedProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileDataWithConflict);

      expect(result.username).toBe('conflictuser1');
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Username conflict resolved',
        {
          originalUsername: 'conflictuser',
          newUsername: 'conflictuser1',
          userId: 'user-1',
        }
      );
    });

    it('should handle username conflict with safety limit', async () => {
      const profileDataWithConflict = { ...profileData, username: 'popularuser' };

      // Mock many conflicts
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Username conflict

      // Mock 1000 conflicts to trigger safety limit
      for (let i = 1; i <= 1000; i++) {
        mockClient.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
      }

      const mockCreatedProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        ...profileDataWithConflict,
        username: 'popularuser_test-uui', // Fallback with UUID
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [mockCreatedProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileDataWithConflict);

      expect(result.username).toBe('popularuser_test-uui');
    });

    it('should create profile without username when not provided', async () => {
      const profileDataNoUsername = { ...profileData };
      delete profileDataNoUsername.username;

      const mockCreatedProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        ...profileDataNoUsername,
        username: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [mockCreatedProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileDataNoUsername);

      expect(result).toEqual(mockCreatedProfile);
    });

    it('should handle database errors with rollback', async () => {
      const error = new Error('Database insert failed');
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockRejectedValueOnce(error); // Username check fails

      await expect(createUserProfile(mockPool as any, 'user-1', profileData)).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error creating user profile:',
        { error, userId: 'user-1' }
      );
    });
  });

  describe('updateUserProfile', () => {
    const updateData: UpdateProfileData = {
      full_name: 'Updated User',
      title: 'Senior Developer',
      bio: 'Updated bio',
    };

    it('should update user profile successfully', async () => {
      const mockUpdatedProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        username: 'testuser',
        full_name: 'Updated User',
        title: 'Senior Developer',
        bio: 'Updated bio',
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedProfile] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await updateUserProfile(mockPool as any, 'user-1', updateData);

      expect(result).toEqual(mockUpdatedProfile);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();

      expect(mockLogger.info).toHaveBeenCalledWith(
        'User profile updated successfully',
        { userId: 'user-1' }
      );
    });

    it('should build dynamic update query with only provided fields', async () => {
      const partialUpdate = { title: 'Lead Developer' };
      const mockUpdatedProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        title: 'Lead Developer',
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedProfile] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await updateUserProfile(mockPool as any, 'user-1', partialUpdate);

      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE user_profiles')
      );
      
      expect(updateCall[0]).toContain('title = $1');
      expect(updateCall[0]).toContain('updated_at = NOW()');
      expect(updateCall[1]).toEqual(['Lead Developer', 'user-1']);
    });

    it('should filter out disallowed columns for security', async () => {
      const maliciousUpdate = {
        title: 'Developer',
        malicious_field: 'hacker_value',
        id: 'fake-id',
        created_at: new Date(),
      };

      const mockUpdatedProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        title: 'Developer',
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedProfile] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await updateUserProfile(mockPool as any, 'user-1', maliciousUpdate);

      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE user_profiles')
      );
      
      expect(updateCall[0]).toContain('title = $1');
      expect(updateCall[0]).not.toContain('malicious_field');
      expect(updateCall[0]).not.toContain('id = ');
      expect(updateCall[1]).toEqual(['Developer', 'user-1']);
    });

    it('should handle undefined values correctly', async () => {
      const updateWithUndefined = {
        title: 'Developer',
        bio: undefined,
        organization: 'Test Corp',
      };

      const mockUpdatedProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        title: 'Developer',
        organization: 'Test Corp',
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedProfile] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await updateUserProfile(mockPool as any, 'user-1', updateWithUndefined);

      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE user_profiles')
      );
      
      expect(updateCall[0]).toContain('title = $1');
      expect(updateCall[0]).toContain('organization = $2');
      expect(updateCall[0]).not.toContain('bio = ');
      expect(updateCall[1]).toEqual(['Developer', 'Test Corp', 'user-1']);
    });

    it('should throw error when no fields to update', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN

      await expect(updateUserProfile(mockPool as any, 'user-1', {})).rejects.toThrow(
        'No fields to update'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should throw error when profile not found', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // UPDATE returns no rows

      await expect(updateUserProfile(mockPool as any, 'user-1', updateData)).rejects.toThrow(
        'Profile not found'
      );

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle database errors with rollback', async () => {
      const error = new Error('Database update failed');
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(error); // UPDATE fails

      await expect(updateUserProfile(mockPool as any, 'user-1', updateData)).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error updating user profile:',
        { error, userId: 'user-1' }
      );
    });
  });

  describe('saveAvatarFile', () => {
    const uploadsDir = '/tmp/uploads';

    beforeEach(() => {
      mockUuidv4.mockReturnValue('avatar-uuid-1234');
    });

    it('should save avatar file successfully with image processing', async () => {
      const mockAvatarFile = {
        id: 'avatar-uuid-1234',
        user_id: 'user-1',
        filename: 'user-1_123456.jpg',
        original_name: 'test-avatar.jpg',
        mime_type: 'image/jpeg',
        file_size: 51200,
        file_path: '/tmp/uploads/avatars/user-1_123456.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock current timestamp
      const mockTimestamp = 123456;
      jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check old avatar
        .mockResolvedValueOnce({ rows: [mockAvatarFile] }) // INSERT avatar
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await saveAvatarFile(mockPool as any, 'user-1', mockFile, uploadsDir);

      expect(result).toEqual(mockAvatarFile);

      // Verify Sharp image processing
      expect(mockSharp).toHaveBeenCalledWith(mockFile.buffer);
      const sharpInstance = mockSharp.mock.results[0].value;
      expect(sharpInstance.resize).toHaveBeenCalledWith(512, 512, {
        fit: 'cover',
        position: 'center',
      });
      expect(sharpInstance.jpeg).toHaveBeenCalledWith({
        quality: 90,
        progressive: true,
      });
      expect(sharpInstance.toFile).toHaveBeenCalledWith('/tmp/uploads/avatars/user-1_123456.jpg');

      // Verify directory creation
      expect(mockFs.mkdir).toHaveBeenCalledWith('/tmp/uploads/avatars', { recursive: true });

      // Verify profile update
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_profiles'),
        ['/uploads/avatars/user-1_123456.jpg', 'user-1']
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Avatar file saved successfully',
        { userId: 'user-1', filename: 'user-1_123456.jpg' }
      );
    });

    it('should handle Sharp processing errors with fallback', async () => {
      const sharpError = new Error('Sharp processing failed');
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        jpeg: jest.fn().mockReturnThis(),
        toFile: jest.fn().mockRejectedValue(sharpError),
      };
      mockSharp.mockReturnValue(sharpInstance as any);

      const mockAvatarFile = {
        id: 'avatar-uuid-1234',
        user_id: 'user-1',
        filename: 'user-1_123456.jpg',
        original_name: 'test-avatar.jpg',
        mime_type: 'image/jpeg',
        file_size: 51200,
        file_path: '/tmp/uploads/avatars/user-1_123456.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check old avatar
        .mockResolvedValueOnce({ rows: [mockAvatarFile] }) // INSERT avatar
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await saveAvatarFile(mockPool as any, 'user-1', mockFile, uploadsDir);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error processing avatar image with Sharp:',
        { error: sharpError }
      );

      // Verify fallback to direct file write
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        '/tmp/uploads/avatars/user-1_123456.jpg',
        mockFile.buffer
      );
    });

    it('should remove old avatar file when replacing', async () => {
      const oldAvatarFile = {
        id: 'old-avatar-id',
        user_id: 'user-1',
        filename: 'old-avatar.jpg',
        file_path: '/tmp/uploads/avatars/old-avatar.jpg',
      };

      const mockNewAvatarFile = {
        id: 'avatar-uuid-1234',
        user_id: 'user-1',
        filename: 'user-1_123456.jpg',
        original_name: 'test-avatar.jpg',
        mime_type: 'image/jpeg',
        file_size: 51200,
        file_path: '/tmp/uploads/avatars/user-1_123456.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [oldAvatarFile] }) // Check old avatar
        .mockResolvedValueOnce({ rows: [] }) // DELETE old avatar
        .mockResolvedValueOnce({ rows: [mockNewAvatarFile] }) // INSERT new avatar
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await saveAvatarFile(mockPool as any, 'user-1', mockFile, uploadsDir);

      // Verify old file deletion
      expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/uploads/avatars/old-avatar.jpg');
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM avatar_files WHERE user_id = $1',
        ['user-1']
      );
    });

    it('should handle old file deletion errors gracefully', async () => {
      const oldAvatarFile = {
        id: 'old-avatar-id',
        user_id: 'user-1',
        filename: 'old-avatar.jpg',
        file_path: '/tmp/uploads/avatars/old-avatar.jpg',
      };

      const unlinkError = new Error('File not found');
      mockFs.unlink.mockRejectedValue(unlinkError);

      const mockNewAvatarFile = {
        id: 'avatar-uuid-1234',
        user_id: 'user-1',
        filename: 'user-1_123456.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [oldAvatarFile] }) // Check old avatar
        .mockResolvedValueOnce({ rows: [] }) // DELETE old avatar record
        .mockResolvedValueOnce({ rows: [mockNewAvatarFile] }) // INSERT new avatar
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await saveAvatarFile(mockPool as any, 'user-1', mockFile, uploadsDir);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to delete old avatar file:',
        { error: unlinkError, filePath: '/tmp/uploads/avatars/old-avatar.jpg' }
      );

      // Should still continue and save new avatar
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Avatar file saved successfully',
        { userId: 'user-1', filename: 'user-1_123456.jpg' }
      );
    });

    it('should handle database errors with rollback', async () => {
      const error = new Error('Database insert failed');
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check old avatar
        .mockRejectedValueOnce(error); // INSERT fails

      await expect(saveAvatarFile(mockPool as any, 'user-1', mockFile, uploadsDir)).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error saving avatar file:',
        { error, userId: 'user-1' }
      );
    });
  });

  describe('deleteAvatarFile', () => {
    it('should delete avatar file and update profile successfully', async () => {
      const avatarFile = {
        id: 'avatar-id',
        user_id: 'user-1',
        filename: 'user-1_avatar.jpg',
        file_path: '/tmp/uploads/avatars/user-1_avatar.jpg',
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [avatarFile] }) // Get avatar file
        .mockResolvedValueOnce({ rows: [] }) // DELETE from database
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await deleteAvatarFile(mockPool as any, 'user-1');

      expect(mockFs.unlink).toHaveBeenCalledWith('/tmp/uploads/avatars/user-1_avatar.jpg');
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM avatar_files WHERE user_id = $1',
        ['user-1']
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_profiles'),
        ['user-1']
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Avatar file deleted successfully',
        { userId: 'user-1' }
      );
    });

    it('should update profile even when no avatar file exists', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // No avatar file found
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await deleteAvatarFile(mockPool as any, 'user-1');

      expect(mockFs.unlink).not.toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE user_profiles'),
        ['user-1']
      );
    });

    it('should handle file deletion errors gracefully', async () => {
      const avatarFile = {
        id: 'avatar-id',
        user_id: 'user-1',
        filename: 'user-1_avatar.jpg',
        file_path: '/tmp/uploads/avatars/user-1_avatar.jpg',
      };

      const unlinkError = new Error('File not found');
      mockFs.unlink.mockRejectedValue(unlinkError);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [avatarFile] }) // Get avatar file
        .mockResolvedValueOnce({ rows: [] }) // DELETE from database
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await deleteAvatarFile(mockPool as any, 'user-1');

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to delete avatar file from disk:',
        { error: unlinkError, filePath: '/tmp/uploads/avatars/user-1_avatar.jpg' }
      );

      // Should still complete the operation
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Avatar file deleted successfully',
        { userId: 'user-1' }
      );
    });

    it('should handle database errors with rollback', async () => {
      const error = new Error('Database delete failed');
      
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(error); // Get avatar file fails

      await expect(deleteAvatarFile(mockPool as any, 'user-1')).rejects.toThrow(error);

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error deleting avatar file:',
        { error, userId: 'user-1' }
      );
    });
  });

  describe('getOrCreateUserProfile', () => {
    it('should return existing profile when found', async () => {
      const existingProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        username: 'existinguser',
        full_name: 'Existing User',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getUserProfile returning existing profile
      mockPool.query.mockResolvedValue({
        rows: [existingProfile],
      });

      const result = await getOrCreateUserProfile(mockPool as any, 'user-1', 'user@example.com', 'User Name');

      expect(result).toEqual(existingProfile);
      expect(mockPool.query).toHaveBeenCalledTimes(1); // Only getUserProfile call
    });

    it('should create new profile with email-derived username when profile not found', async () => {
      const newProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        username: 'testuser',
        full_name: 'Test User',
        preferred_language: 'en',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getUserProfile returning null (no profile)
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock createUserProfile
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Username check
        .mockResolvedValueOnce({ rows: [newProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await getOrCreateUserProfile(
        mockPool as any,
        'user-1',
        'testuser@example.com',
        'Test User'
      );

      expect(result).toEqual(newProfile);

      // Verify createUserProfile was called with email-derived username
      const createCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('INSERT INTO user_profiles')
      );
      expect(createCall[1]).toEqual(expect.arrayContaining(['testuser']));
    });

    it('should create new profile with provided userName when available', async () => {
      const newProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        username: 'customuser',
        full_name: 'Custom User',
        preferred_language: 'en',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getUserProfile returning null
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock createUserProfile
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Username check
        .mockResolvedValueOnce({ rows: [newProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await getOrCreateUserProfile(
        mockPool as any,
        'user-1',
        'user@example.com',
        'Custom User'
      );

      expect(result).toEqual(newProfile);
    });

    it('should create profile without userName when not provided', async () => {
      const newProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        username: 'user',
        full_name: 'User',
        preferred_language: 'en',
        created_at: new Date(),
        updated_at: new Date(),
      };

      // Mock getUserProfile returning null
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      // Mock createUserProfile
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Username check
        .mockResolvedValueOnce({ rows: [newProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await getOrCreateUserProfile(mockPool as any, 'user-1', 'user@example.com');

      expect(result).toEqual(newProfile);
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Database connection failed');
      mockPool.query.mockRejectedValue(error);

      await expect(
        getOrCreateUserProfile(mockPool as any, 'user-1', 'user@example.com')
      ).rejects.toThrow(error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting or creating user profile:',
        { error, userId: 'user-1' }
      );
    });
  });

  describe('User Settings', () => {
    describe('getUserSetting', () => {
      it('should return user setting when found', async () => {
        const mockSetting = {
          id: 'setting-1',
          user_id: 'user-1',
          setting_key: 'theme',
          setting_value: '"dark"',
          category: 'appearance',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockPool.query.mockResolvedValue({
          rows: [mockSetting],
        });

        const result = await getUserSetting(mockPool as any, 'user-1', 'theme');

        expect(result).toEqual(mockSetting);
        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM user_settings WHERE user_id = $1 AND setting_key = $2',
          ['user-1', 'theme']
        );
      });

      it('should return null when setting not found', async () => {
        mockPool.query.mockResolvedValue({
          rows: [],
        });

        const result = await getUserSetting(mockPool as any, 'user-1', 'nonexistent');

        expect(result).toBeNull();
      });

      it('should handle database errors', async () => {
        const error = new Error('Database query failed');
        mockPool.query.mockRejectedValue(error);

        await expect(getUserSetting(mockPool as any, 'user-1', 'theme')).rejects.toThrow(error);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error fetching user setting:',
          { error, userId: 'user-1', settingKey: 'theme' }
        );
      });
    });

    describe('getUserSettings', () => {
      it('should return all user settings', async () => {
        const mockSettings = [
          {
            id: 'setting-1',
            user_id: 'user-1',
            setting_key: 'theme',
            setting_value: '"dark"',
            category: 'appearance',
          },
          {
            id: 'setting-2',
            user_id: 'user-1',
            setting_key: 'language',
            setting_value: '"en"',
            category: 'general',
          },
        ];

        mockPool.query.mockResolvedValue({
          rows: mockSettings,
        });

        const result = await getUserSettings(mockPool as any, 'user-1');

        expect(result).toEqual(mockSettings);
        expect(mockPool.query).toHaveBeenCalledWith(
          'SELECT * FROM user_settings WHERE user_id = $1 ORDER BY setting_key',
          ['user-1']
        );
      });

      it('should return empty array when no settings found', async () => {
        mockPool.query.mockResolvedValue({
          rows: [],
        });

        const result = await getUserSettings(mockPool as any, 'user-1');

        expect(result).toEqual([]);
      });
    });

    describe('setUserSetting', () => {
      it('should create new setting successfully', async () => {
        const mockSetting = {
          id: 'test-uuid-1234',
          user_id: 'user-1',
          setting_key: 'theme',
          setting_value: '"dark"',
          category: 'appearance',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockPool.query.mockResolvedValue({
          rows: [mockSetting],
        });

        const result = await setUserSetting(mockPool as any, 'user-1', 'theme', 'dark', 'appearance');

        expect(result).toEqual(mockSetting);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO user_settings'),
          ['test-uuid-1234', 'user-1', 'theme', '"dark"', 'appearance']
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'User setting updated successfully',
          { userId: 'user-1', settingKey: 'theme', category: 'appearance' }
        );
      });

      it('should update existing setting with ON CONFLICT', async () => {
        const mockSetting = {
          id: 'existing-setting-1',
          user_id: 'user-1',
          setting_key: 'theme',
          setting_value: '"light"',
          category: 'appearance',
          updated_at: new Date(),
        };

        mockPool.query.mockResolvedValue({
          rows: [mockSetting],
        });

        const result = await setUserSetting(mockPool as any, 'user-1', 'theme', 'light', 'appearance');

        expect(result).toEqual(mockSetting);
        expect(mockPool.query).toHaveBeenCalledWith(
          expect.stringContaining('ON CONFLICT (user_id, setting_key) DO UPDATE'),
          expect.any(Array)
        );
      });

      it('should use default category when not provided', async () => {
        const mockSetting = {
          id: 'test-uuid-1234',
          user_id: 'user-1',
          setting_key: 'notifications',
          setting_value: 'true',
          category: 'general',
          created_at: new Date(),
          updated_at: new Date(),
        };

        mockPool.query.mockResolvedValue({
          rows: [mockSetting],
        });

        await setUserSetting(mockPool as any, 'user-1', 'notifications', true);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          ['test-uuid-1234', 'user-1', 'notifications', 'true', 'general']
        );
      });

      it('should handle complex setting values with JSON serialization', async () => {
        const complexValue = {
          notifications: { email: true, push: false },
          preferences: ['option1', 'option2'],
        };

        const mockSetting = {
          id: 'test-uuid-1234',
          user_id: 'user-1',
          setting_key: 'preferences',
          setting_value: JSON.stringify(complexValue),
          category: 'general',
        };

        mockPool.query.mockResolvedValue({
          rows: [mockSetting],
        });

        await setUserSetting(mockPool as any, 'user-1', 'preferences', complexValue);

        expect(mockPool.query).toHaveBeenCalledWith(
          expect.any(String),
          expect.arrayContaining([JSON.stringify(complexValue)])
        );
      });

      it('should handle database errors', async () => {
        const error = new Error('Database insert failed');
        mockPool.query.mockRejectedValue(error);

        await expect(
          setUserSetting(mockPool as any, 'user-1', 'theme', 'dark')
        ).rejects.toThrow(error);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error setting user setting:',
          { error, userId: 'user-1', settingKey: 'theme' }
        );
      });
    });

    describe('deleteUserSetting', () => {
      it('should delete user setting successfully', async () => {
        mockPool.query.mockResolvedValue({});

        await deleteUserSetting(mockPool as any, 'user-1', 'theme');

        expect(mockPool.query).toHaveBeenCalledWith(
          'DELETE FROM user_settings WHERE user_id = $1 AND setting_key = $2',
          ['user-1', 'theme']
        );

        expect(mockLogger.info).toHaveBeenCalledWith(
          'User setting deleted successfully',
          { userId: 'user-1', settingKey: 'theme' }
        );
      });

      it('should handle database errors', async () => {
        const error = new Error('Database delete failed');
        mockPool.query.mockRejectedValue(error);

        await expect(deleteUserSetting(mockPool as any, 'user-1', 'theme')).rejects.toThrow(error);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error deleting user setting:',
          { error, userId: 'user-1', settingKey: 'theme' }
        );
      });
    });

    describe('getUserProfileWithSettings', () => {
      it('should return profile and settings together', async () => {
        const mockProfile = {
          id: 'profile-1',
          user_id: 'user-1',
          username: 'testuser',
          full_name: 'Test User',
        };

        const mockSettings = [
          {
            id: 'setting-1',
            user_id: 'user-1',
            setting_key: 'theme',
            setting_value: '"dark"',
            category: 'appearance',
          },
        ];

        // Mock parallel calls
        mockPool.query
          .mockResolvedValueOnce({ rows: [mockProfile] }) // getUserProfile
          .mockResolvedValueOnce({ rows: mockSettings }); // getUserSettings

        const result = await getUserProfileWithSettings(mockPool as any, 'user-1');

        expect(result).toEqual({
          profile: mockProfile,
          settings: mockSettings,
        });

        expect(mockPool.query).toHaveBeenCalledTimes(2);
      });

      it('should handle null profile with empty settings', async () => {
        mockPool.query
          .mockResolvedValueOnce({ rows: [] }) // No profile
          .mockResolvedValueOnce({ rows: [] }); // No settings

        const result = await getUserProfileWithSettings(mockPool as any, 'user-1');

        expect(result).toEqual({
          profile: null,
          settings: [],
        });
      });

      it('should handle database errors', async () => {
        const error = new Error('Database query failed');
        mockPool.query.mockRejectedValue(error);

        await expect(getUserProfileWithSettings(mockPool as any, 'user-1')).rejects.toThrow(error);

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Error fetching user profile with settings:',
          { error, userId: 'user-1' }
        );
      });
    });
  });

  describe('Edge Cases and Security', () => {
    it('should handle SQL injection attempts in updateUserProfile', async () => {
      const maliciousUpdate = {
        title: "'; DROP TABLE users; --",
        bio: 'Normal bio',
      };

      const mockUpdatedProfile = {
        id: 'profile-1',
        user_id: 'user-1',
        title: "'; DROP TABLE users; --",
        bio: 'Normal bio',
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [mockUpdatedProfile] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      await updateUserProfile(mockPool as any, 'user-1', maliciousUpdate);

      // Should use parameterized queries, so malicious SQL is treated as data
      const updateCall = mockClient.query.mock.calls.find(call => 
        call[0] && call[0].includes('UPDATE user_profiles')
      );
      
      expect(updateCall[1]).toEqual(["'; DROP TABLE users; --", 'Normal bio', 'user-1']);
    });

    it('should handle extremely long usernames gracefully', async () => {
      const longUsername = 'a'.repeat(1000);
      const profileData = {
        username: longUsername,
        full_name: 'Test User',
      };

      const mockCreatedProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        username: longUsername,
        full_name: 'Test User',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Username check
        .mockResolvedValueOnce({ rows: [mockCreatedProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileData);

      expect(result.username).toBe(longUsername);
    });

    it('should handle null and undefined values in profile data', async () => {
      const profileDataWithNulls = {
        username: null,
        full_name: undefined,
        title: '',
        bio: null,
      };

      const mockCreatedProfile = {
        id: 'test-uuid-1234',
        user_id: 'user-1',
        username: null,
        full_name: undefined,
        title: '',
        bio: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check existing profile
        .mockResolvedValueOnce({ rows: [mockCreatedProfile] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await createUserProfile(mockPool as any, 'user-1', profileDataWithNulls as any);

      expect(result).toEqual(mockCreatedProfile);
    });

    it('should handle file upload edge cases in saveAvatarFile', async () => {
      const largeFile: Express.Multer.File = {
        ...mockFile,
        size: 10 * 1024 * 1024, // 10MB
        buffer: Buffer.alloc(10 * 1024 * 1024),
      };

      const mockAvatarFile = {
        id: 'avatar-uuid-1234',
        user_id: 'user-1',
        filename: 'user-1_123456.jpg',
        original_name: 'large-avatar.jpg',
        mime_type: 'image/jpeg',
        file_size: 10 * 1024 * 1024,
        file_path: '/tmp/uploads/avatars/user-1_123456.jpg',
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // Check old avatar
        .mockResolvedValueOnce({ rows: [mockAvatarFile] }) // INSERT avatar
        .mockResolvedValueOnce({ rows: [] }) // UPDATE profile
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await saveAvatarFile(mockPool as any, 'user-1', largeFile, '/tmp/uploads');

      expect(result.file_size).toBe(10 * 1024 * 1024);
    });
  });
});