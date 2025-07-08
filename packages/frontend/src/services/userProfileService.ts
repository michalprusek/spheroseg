/**
 * User Profile Service
 * Handles user profile and settings operations via API
 */

import apiClient from '@/lib/apiClient';
import uploadClient from '@/lib/uploadClient';

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
   * Safely set item in localStorage with quota error handling
   */
  private safeSetLocalStorage(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (error) {
      if (error instanceof DOMException && 
          (error.name === 'QuotaExceededError' || error.code === 22)) {
        console.warn(`[UserProfileService] localStorage quota exceeded for key: ${key}. Attempting cleanup...`);
        
        // Try to clean up old data
        this.cleanupLocalStorage();
        
        // Try one more time after cleanup
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error(`[UserProfileService] Failed to set ${key} even after cleanup:`, retryError);
          return false;
        }
      }
      console.error(`[UserProfileService] Error setting localStorage item ${key}:`, error);
      return false;
    }
  }

  /**
   * Clean up localStorage to free space
   */
  private cleanupLocalStorage(): void {
    try {
      // Remove old cached data
      const keysToCheck = Object.keys(localStorage);
      const now = Date.now();
      
      keysToCheck.forEach(key => {
        // Remove old image cache entries (older than 24 hours)
        if (key.startsWith('image-cache-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (!parsed.timestamp || now - parsed.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
                console.log(`[UserProfileService] Removed old cache entry: ${key}`);
              }
            }
          } catch (e) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
          }
        }
        
        // Remove old uploaded images (older than 7 days)
        if (key.startsWith('spheroseg_uploaded_images_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const images = JSON.parse(data);
              const filteredImages = images.filter((img: any) => {
                const createdAt = img.createdAt || img.uploadedAt;
                if (!createdAt) return true; // Keep if no timestamp
                return now - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
              });
              
              if (filteredImages.length < images.length) {
                try {
                  localStorage.setItem(key, JSON.stringify(filteredImages));
                  console.log(`[UserProfileService] Cleaned up ${images.length - filteredImages.length} old images from ${key}`);
                } catch (e) {
                  // If we can't save the filtered list, remove the whole key
                  localStorage.removeItem(key);
                  console.log(`[UserProfileService] Removed entire key ${key} due to quota issues`);
                }
              }
            }
          } catch (e) {
            console.error(`[UserProfileService] Error cleaning up ${key}:`, e);
          }
        }
      });
    } catch (error) {
      console.error('[UserProfileService] Error during localStorage cleanup:', error);
    }
  }

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

      // Use uploadClient for file uploads - no explicit Content-Type needed
      const response = await uploadClient.post(`${this.baseUrl}/avatar`, formData);
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
      console.log(`[UserProfileService] Successfully saved ${key} to database:`, value);
      return {
        key: response.data.key,
        value: response.data.value,
        category: response.data.category,
        updated_at: response.data.updated_at,
      };
    } catch (error: any) {
      const errorMessage = error.response?.status === 502 ? 'API Gateway error (502)' : 'API error';
      console.warn(`[UserProfileService] Error setting user setting ${key} (${errorMessage}):`, error.message || error);
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
      if (setting && setting.value !== undefined && setting.value !== null) {
        // Only update localStorage if the DB value is different from current localStorage
        const currentLocalValue = localStorage.getItem(localStorageKey);
        const dbValueStr = JSON.stringify(setting.value);
        
        if (currentLocalValue !== dbValueStr) {
          if (this.safeSetLocalStorage(localStorageKey, dbValueStr)) {
            console.log(`[UserProfileService] Updated localStorage ${localStorageKey} with DB value:`, setting.value);
          }
        }
        
        return setting.value;
      } else if (defaultValue !== undefined) {
        // Check if localStorage already has a value before setting default
        const existingValue = localStorage.getItem(localStorageKey);
        if (!existingValue) {
          if (this.safeSetLocalStorage(localStorageKey, JSON.stringify(defaultValue))) {
            console.log(`[UserProfileService] Set default value for ${localStorageKey}:`, defaultValue);
          }
        }
        
        // Try to set default in database but don't fail if it doesn't work
        try {
          await this.setUserSetting(key, defaultValue, 'ui');
        } catch (dbError) {
          console.warn(`[UserProfileService] Failed to set default ${key} in database:`, dbError);
        }
        
        return defaultValue;
      }
      return null;
    } catch (error) {
      console.warn(`[UserProfileService] Error loading ${key} from database, using localStorage fallback:`, error);
      
      // Try to get from localStorage first
      const localValue = localStorage.getItem(localStorageKey);
      if (localValue) {
        try {
          // First try to parse as JSON
          return JSON.parse(localValue);
        } catch (parseError) {
          console.warn(`[UserProfileService] Failed to parse localStorage ${localStorageKey} as JSON, treating as plain string:`, parseError);
          // If it's a valid non-JSON value (like 'system', 'light', 'dark' for theme), return as-is
          if (['system', 'light', 'dark', 'en', 'cs', 'de', 'es', 'fr', 'zh'].includes(localValue)) {
            console.log(`[UserProfileService] Using plain string value for ${localStorageKey}:`, localValue);
            // Store it as JSON for future consistency
            localStorage.setItem(localStorageKey, JSON.stringify(localValue));
            return localValue;
          }
          // For other values, return as string
          return localValue;
        }
      }
      
      // If nothing in localStorage and we have a default, use it
      if (defaultValue !== undefined) {
        localStorage.setItem(localStorageKey, JSON.stringify(defaultValue));
        console.log(`[UserProfileService] Using default value for ${localStorageKey} due to API failure:`, defaultValue);
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