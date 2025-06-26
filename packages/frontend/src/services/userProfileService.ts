/**
 * User Profile Service
 * Handles user profile and settings operations via API
 */

import apiClient from '@/lib/apiClient';

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
  created_at: string;
  updated_at: string;
}

export interface UserSetting {
  key: string;
  value: any;
  category: string;
  updated_at?: string;
}

export interface ProfileWithSettings {
  profile: UserProfile | null;
  settings: Record<string, any>;
}

class UserProfileService {
  private readonly baseUrl = '/api/user-profile';

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const response = await apiClient.get(this.baseUrl);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get user profile with settings
   */
  async getUserProfileWithSettings(): Promise<ProfileWithSettings> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/with-settings`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user profile with settings:', error);
      throw error;
    }
  }

  /**
   * Create user profile
   */
  async createUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await apiClient.post(this.baseUrl, profileData);
      return response.data;
    } catch (error) {
      console.error('Error creating user profile:', error);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await apiClient.put(this.baseUrl, profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Upload avatar
   */
  async uploadAvatar(file: File): Promise<{ message: string; avatar: { filename: string; url: string } }> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await apiClient.post(`${this.baseUrl}/avatar`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  }

  /**
   * Delete avatar
   */
  async deleteAvatar(): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/avatar`);
      return response.data;
    } catch (error) {
      console.error('Error deleting avatar:', error);
      throw error;
    }
  }

  /**
   * Get user setting by key
   */
  async getUserSetting(key: string): Promise<UserSetting | null> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/settings/${key}`);
      return {
        key: response.data.key,
        value: response.data.value,
        category: response.data.category,
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get all user settings
   */
  async getUserSettings(): Promise<Record<string, UserSetting>> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/settings`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user settings:', error);
      throw error;
    }
  }

  /**
   * Set user setting
   */
  async setUserSetting(key: string, value: any, category: string = 'general'): Promise<UserSetting> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/settings/${key}`, {
        value,
        category,
      });
      return {
        key: response.data.key,
        value: response.data.value,
        category: response.data.category,
        updated_at: response.data.updated_at,
      };
    } catch (error) {
      console.error('Error setting user setting:', error);
      throw error;
    }
  }

  /**
   * Delete user setting
   */
  async deleteUserSetting(key: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/settings/${key}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting user setting:', error);
      throw error;
    }
  }

  /**
   * Batch update user settings
   */
  async batchUpdateUserSettings(settings: Record<string, { value: any; category?: string }>): Promise<Record<string, UserSetting>> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/settings/batch`, { settings });
      return response.data;
    } catch (error) {
      console.error('Error batch updating user settings:', error);
      throw error;
    }
  }

  /**
   * Sync setting from localStorage to database
   */
  async syncSettingToDatabase(key: string, localStorageKey: string, category: string = 'ui'): Promise<void> {
    try {
      const localValue = localStorage.getItem(localStorageKey);
      if (localValue !== null) {
        let parsedValue;
        try {
          parsedValue = JSON.parse(localValue);
        } catch {
          parsedValue = localValue;
        }
        await this.setUserSetting(key, parsedValue, category);
      }
    } catch (error) {
      console.error(`Error syncing ${key} to database:`, error);
    }
  }

  /**
   * Load setting from database to localStorage
   */
  async loadSettingFromDatabase(key: string, localStorageKey: string, defaultValue?: any): Promise<any> {
    try {
      const setting = await this.getUserSetting(key);
      if (setting) {
        localStorage.setItem(localStorageKey, JSON.stringify(setting.value));
        return setting.value;
      } else if (defaultValue !== undefined) {
        localStorage.setItem(localStorageKey, JSON.stringify(defaultValue));
        await this.setUserSetting(key, defaultValue, 'ui');
        return defaultValue;
      }
      return null;
    } catch (error) {
      console.error(`Error loading ${key} from database:`, error);
      if (defaultValue !== undefined) {
        localStorage.setItem(localStorageKey, JSON.stringify(defaultValue));
        return defaultValue;
      }
      return null;
    }
  }

  /**
   * Migrate localStorage data to database
   */
  async migrateLocalStorageToDatabase(): Promise<void> {
    try {
      const migrationsMap = [
        { localKey: 'theme', dbKey: 'theme', category: 'ui' },
        { localKey: 'language', dbKey: 'language', category: 'ui' },
      ];

      const settingsToUpdate: Record<string, { value: any; category: string }> = {};

      for (const migration of migrationsMap) {
        const localValue = localStorage.getItem(migration.localKey);
        if (localValue !== null) {
          try {
            const parsedValue = JSON.parse(localValue);
            settingsToUpdate[migration.dbKey] = {
              value: parsedValue,
              category: migration.category,
            };
          } catch {
            settingsToUpdate[migration.dbKey] = {
              value: localValue,
              category: migration.category,
            };
          }
        }
      }

      if (Object.keys(settingsToUpdate).length > 0) {
        await this.batchUpdateUserSettings(settingsToUpdate);
        console.log('Successfully migrated localStorage settings to database');
      }
    } catch (error) {
      console.error('Error migrating localStorage to database:', error);
    }
  }

  /**
   * Initialize user settings from database
   */
  async initializeUserSettings(): Promise<void> {
    try {
      const settings = await this.getUserSettings();
      
      // Update localStorage with database values
      Object.entries(settings).forEach(([key, setting]) => {
        const localStorageKey = this.getLocalStorageKey(key);
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, JSON.stringify(setting.value));
        }
      });
    } catch (error) {
      console.error('Error initializing user settings:', error);
    }
  }

  /**
   * Get localStorage key for a setting
   */
  private getLocalStorageKey(settingKey: string): string | null {
    const keyMap: Record<string, string> = {
      theme: 'theme',
      language: 'language',
    };
    return keyMap[settingKey] || null;
  }
}

export default new UserProfileService();