/**
 * User Profile Service
 * Handles user profile and settings operations via API
 */

import apiClient, { type ApiError } from '@/services/api/client';
import { uploadClient } from '@/services/api/client';
import logger from '@/utils/logger';

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
  value: unknown;
  category: string;
  updated_at?: string;
}

export interface ProfileWithSettings {
  profile: UserProfile | null;
  settings: Record<string, unknown>;
}

class UserProfileService {
  private readonly baseUrl = '/api/user-profile';

  /**
   * Check localStorage usage and available space
   */
  private getLocalStorageUsage(): { used: number; estimated: number; total: number } {
    let used = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }
    
    const estimated = used * 2; // Account for UTF-16 encoding
    const total = 5 * 1024 * 1024; // Most browsers limit to 5MB
    
    return { used, estimated, total };
  }

  /**
   * Safely set item in localStorage with quota error handling
   */
  private safeSetLocalStorage(key: string, value: string): boolean {
    try {
      // Validate and clean theme/language values
      let cleanValue = value;
      if (key === 'theme' || key === 'language') {
        const validValues = ['system', 'light', 'dark', 'en', 'cs', 'de', 'es', 'fr', 'zh'];
        
        // Try to extract the actual value if it's JSON-encoded
        let actualValue = value;
        try {
          // Only parse once to avoid infinite loops
          const parsed = JSON.parse(value);
          if (typeof parsed === 'string') {
            actualValue = parsed;
          }
        } catch {
          // Value is not JSON, use as-is
          actualValue = value.replace(/['"]/g, ''); // Remove quotes if present
        }
        
        // Validate the actual value
        if (validValues.includes(actualValue)) {
          cleanValue = JSON.stringify(actualValue);
        } else {
          console.warn(`[UserProfileService] Invalid ${key} value: ${actualValue}, using default`);
          cleanValue = JSON.stringify(key === 'theme' ? 'system' : 'en');
        }
      }

      // Check if the value is too large
      const newItemSize = (key.length + cleanValue.length) * 2; // UTF-16 encoding
      if (newItemSize > 1024 * 1024) { // 1MB per item limit
        console.error(`[UserProfileService] Value too large for key ${key}: ${newItemSize} bytes`);
        return false;
      }

      // Check overall localStorage usage
      const usage = this.getLocalStorageUsage();
      const spaceNeeded = newItemSize;
      const availableSpace = usage.total - usage.estimated;

      if (spaceNeeded > availableSpace) {
        console.warn(`[UserProfileService] Insufficient space for ${key}. Need: ${spaceNeeded}, Available: ${availableSpace}. Attempting cleanup...`);
        
        // Aggressive cleanup if space is tight
        this.cleanupLocalStorage();
        
        // Recheck after cleanup
        const newUsage = this.getLocalStorageUsage();
        const newAvailableSpace = newUsage.total - newUsage.estimated;
        
        if (spaceNeeded > newAvailableSpace) {
          console.error(`[UserProfileService] Still insufficient space after cleanup. Need: ${spaceNeeded}, Available: ${newAvailableSpace}`);
          return false;
        }
      }

      localStorage.setItem(key, cleanValue);
      return true;
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)) {
        console.warn(`[UserProfileService] localStorage quota exceeded for key: ${key}. Attempting emergency cleanup...`);

        // Emergency cleanup - more aggressive
        this.emergencyCleanup();

        // Try one more time after emergency cleanup
        try {
          localStorage.setItem(key, cleanValue);
          return true;
        } catch (retryError) {
          console.error(`[UserProfileService] Failed to set ${key} even after emergency cleanup:`, retryError);
          
          // Try to use minimal fallback storage
          return this.setMinimalStorage(key, cleanValue);
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
      const keysToCheck = Object.keys(localStorage);
      const now = Date.now();
      let spaceFreed = 0;

      keysToCheck.forEach((key) => {
        const originalSize = localStorage.getItem(key)?.length || 0;

        // Remove old image cache entries (older than 24 hours)
        if (key.startsWith('image-cache-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (!parsed.timestamp || now - parsed.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
                spaceFreed += originalSize;
                console.log(`[UserProfileService] Removed old cache entry: ${key} (${originalSize} chars)`);
              }
            }
          } catch (_e) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
            spaceFreed += originalSize;
          }
        }

        // Remove old uploaded images (older than 7 days)
        if (key.startsWith('spheroseg_uploaded_images_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const images = JSON.parse(data);
              const filteredImages = images.filter((img: unknown) => {
                if (typeof img !== 'object' || img === null) return true;
                const imgObj = img as { createdAt?: string | Date; uploadedAt?: string | Date };
                const createdAt = imgObj.createdAt || imgObj.uploadedAt;
                if (!createdAt) return true; // Keep if no timestamp
                return now - new Date(createdAt).getTime() < 7 * 24 * 60 * 60 * 1000;
              });

              if (filteredImages.length < images.length) {
                try {
                  const newData = JSON.stringify(filteredImages);
                  localStorage.setItem(key, newData);
                  spaceFreed += originalSize - newData.length;
                  console.log(
                    `[UserProfileService] Cleaned up ${images.length - filteredImages.length} old images from ${key}`,
                  );
                } catch (_e) {
                  // If we can't save the filtered list, remove the whole key
                  localStorage.removeItem(key);
                  spaceFreed += originalSize;
                  console.log(`[UserProfileService] Removed entire key ${key} due to quota issues`);
                }
              }
            }
          } catch (_e) {
            console.error(`[UserProfileService] Error cleaning up ${key}:`, _e);
          }
        }

        // Remove old analytics data (older than 30 days)
        if (key.startsWith('analytics-') || key.startsWith('performance-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed.timestamp && now - parsed.timestamp > 30 * 24 * 60 * 60 * 1000) {
                localStorage.removeItem(key);
                spaceFreed += originalSize;
                console.log(`[UserProfileService] Removed old analytics data: ${key}`);
              }
            }
          } catch (_e) {
            // If we can't parse it, remove it
            localStorage.removeItem(key);
            spaceFreed += originalSize;
          }
        }
      });

      console.log(`[UserProfileService] Cleanup completed. Space freed: ${spaceFreed} characters`);
    } catch (error) {
      console.error('[UserProfileService] Error during localStorage cleanup:', error);
    }
  }

  /**
   * Emergency cleanup - more aggressive space freeing
   */
  private emergencyCleanup(): void {
    try {
      const keysToCheck = Object.keys(localStorage);
      const now = Date.now();
      let spaceFreed = 0;

      // Sort keys by size (largest first) to maximize space recovery
      const keysBySize = keysToCheck
        .map(key => ({ key, size: localStorage.getItem(key)?.length || 0 }))
        .sort((a, b) => b.size - a.size);

      keysBySize.forEach(({ key, size }) => {
        // Remove any cache entries older than 1 hour
        if (key.startsWith('image-cache-') || key.startsWith('cache-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (!parsed.timestamp || now - parsed.timestamp > 60 * 60 * 1000) { // 1 hour
                localStorage.removeItem(key);
                spaceFreed += size;
                console.log(`[UserProfileService] Emergency removal of cache: ${key} (${size} chars)`);
              }
            }
          } catch (_e) {
            localStorage.removeItem(key);
            spaceFreed += size;
          }
        }

        // Remove uploaded images older than 1 day
        if (key.startsWith('spheroseg_uploaded_images_')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const images = JSON.parse(data);
              const filteredImages = images.filter((img: unknown) => {
                if (typeof img !== 'object' || img === null) return false;
                const imgObj = img as { createdAt?: string | Date; uploadedAt?: string | Date };
                const createdAt = imgObj.createdAt || imgObj.uploadedAt;
                if (!createdAt) return false; // Remove if no timestamp
                return now - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000; // 1 day
              });

              if (filteredImages.length === 0) {
                localStorage.removeItem(key);
                spaceFreed += size;
              } else if (filteredImages.length < images.length) {
                try {
                  const newData = JSON.stringify(filteredImages);
                  localStorage.setItem(key, newData);
                  spaceFreed += size - newData.length;
                } catch (_e) {
                  localStorage.removeItem(key);
                  spaceFreed += size;
                }
              }
            }
          } catch (_e) {
            localStorage.removeItem(key);
            spaceFreed += size;
          }
        }

        // Remove any temporary or debug data
        if (key.startsWith('debug-') || key.startsWith('temp-') || key.startsWith('test-')) {
          localStorage.removeItem(key);
          spaceFreed += size;
          console.log(`[UserProfileService] Emergency removal of temp data: ${key}`);
        }

        // Remove old AB testing data
        if (key.startsWith('ab-test-') || key.startsWith('experiment-')) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              if (parsed.timestamp && now - parsed.timestamp > 7 * 24 * 60 * 60 * 1000) { // 7 days
                localStorage.removeItem(key);
                spaceFreed += size;
              }
            }
          } catch (_e) {
            localStorage.removeItem(key);
            spaceFreed += size;
          }
        }
      });

      console.log(`[UserProfileService] Emergency cleanup completed. Space freed: ${spaceFreed} characters`);
    } catch (error) {
      console.error('[UserProfileService] Error during emergency cleanup:', error);
    }
  }

  /**
   * Fallback storage for critical settings when localStorage is full
   */
  private setMinimalStorage(key: string, value: string): boolean {
    try {
      // For critical settings like theme and language, try to store in sessionStorage
      if (key === 'theme' || key === 'language') {
        sessionStorage.setItem(`fallback_${key}`, value);
        console.warn(`[UserProfileService] Stored ${key} in sessionStorage as fallback`);
        
        // Try to use IndexedDB for persistence
        this.tryIndexedDBStorage(key, value);
        return true;
      }
      
      console.error(`[UserProfileService] Cannot store non-critical key ${key} when localStorage is full`);
      return false;
    } catch (error) {
      console.error(`[UserProfileService] Even fallback storage failed for ${key}:`, error);
      return false;
    }
  }

  /**
   * Try to store critical settings in IndexedDB
   */
  private async tryIndexedDBStorage(key: string, value: string): Promise<void> {
    try {
      const request = indexedDB.open('spheroseg_settings', 1);
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
      
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        store.put({ key, value, timestamp: Date.now() });
        console.log(`[UserProfileService] Stored ${key} in IndexedDB as backup`);
      };
    } catch (error) {
      console.warn(`[UserProfileService] IndexedDB fallback failed for ${key}:`, error);
    }
  }

  /**
   * Get user profile
   */
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const response = await apiClient.get<UserProfile>(this.baseUrl);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404) {
        return null;
      }
      logger.error('Error fetching user profile:', apiError);
      throw error;
    }
  }

  /**
   * Get user profile with settings
   */
  async getUserProfileWithSettings(): Promise<ProfileWithSettings> {
    try {
      const response = await apiClient.get<ProfileWithSettings>(`${this.baseUrl}/with-settings`);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error fetching user profile with settings:', apiError);
      throw error;
    }
  }

  /**
   * Create user profile
   */
  async createUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await apiClient.post<UserProfile>(this.baseUrl, profileData);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error creating user profile:', apiError);
      throw error;
    }
  }

  /**
   * Update user profile
   */
  async updateUserProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
    try {
      const response = await apiClient.put<UserProfile>(this.baseUrl, profileData);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error updating user profile:', apiError);
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
      const response = await apiClient.delete<{ message: string }>(`${this.baseUrl}/avatar`);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error deleting avatar:', apiError);
      throw error;
    }
  }

  /**
   * Get user setting by key
   */
  async getUserSetting(key: string): Promise<UserSetting | null> {
    try {
      const response = await apiClient.get<UserSetting>(`${this.baseUrl}/settings/${key}`);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.status === 404) {
        return null;
      }
      logger.error('Error fetching user setting:', apiError);
      throw error;
    }
  }

  /**
   * Get all user settings
   */
  async getUserSettings(): Promise<Record<string, UserSetting>> {
    try {
      const response = await apiClient.get<Record<string, UserSetting>>(`${this.baseUrl}/settings`);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error fetching user settings:', apiError);
      throw error;
    }
  }

  /**
   * Set user setting
   */
  async setUserSetting(key: string, value: unknown, category: string = 'general'): Promise<UserSetting> {
    try {
      const response = await apiClient.put<UserSetting>(`${this.baseUrl}/settings/${key}`, {
        value,
        category,
      });
      logger.info(`[UserProfileService] Successfully saved ${key} to database:`, value);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      const errorMessage = apiError.status === 502 ? 'API Gateway error (502)' : 'API error';
      logger.warn(`[UserProfileService] Error setting user setting ${key} (${errorMessage}):`, apiError.message);
      throw error;
    }
  }

  /**
   * Delete user setting
   */
  async deleteUserSetting(key: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete<{ message: string }>(`${this.baseUrl}/settings/${key}`);
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error deleting user setting:', apiError);
      throw error;
    }
  }

  /**
   * Batch update user settings
   */
  async batchUpdateUserSettings(
    settings: Record<string, { value: unknown; category?: string }>,
  ): Promise<Record<string, UserSetting>> {
    try {
      const response = await apiClient.post<Record<string, UserSetting>>(`${this.baseUrl}/settings/batch`, { settings });
      return response.data;
    } catch (error) {
      const apiError = error as ApiError;
      logger.error('Error batch updating user settings:', apiError);
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
      logger.error(`Error syncing ${key} to database:`, error);
    }
  }

  /**
   * Load setting from database to localStorage
   */
  async loadSettingFromDatabase(key: string, localStorageKey: string, defaultValue?: unknown): Promise<unknown> {
    try {
      const setting = await this.getUserSetting(key);
      if (setting && setting.value !== undefined && setting.value !== null) {
        // Only update localStorage if the DB value is different from current localStorage
        const currentLocalValue = localStorage.getItem(localStorageKey);
        const dbValueStr = JSON.stringify(setting.value);

        if (currentLocalValue !== dbValueStr) {
          if (this.safeSetLocalStorage(localStorageKey, dbValueStr)) {
            console.log(`[UserProfileService] Updated localStorage ${localStorageKey} with DB value:`, setting.value);
          } else {
            console.warn(`[UserProfileService] Failed to update localStorage ${localStorageKey}, using current value`);
          }
        }

        return setting.value;
      } else if (defaultValue !== undefined) {
        // Check if localStorage already has a value before setting default
        const existingValue = localStorage.getItem(localStorageKey);
        if (!existingValue) {
          if (this.safeSetLocalStorage(localStorageKey, JSON.stringify(defaultValue))) {
            console.log(`[UserProfileService] Set default value for ${localStorageKey}:`, defaultValue);
          } else {
            console.warn(`[UserProfileService] Failed to set default value for ${localStorageKey}, storage may be full`);
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
          console.warn(
            `[UserProfileService] Failed to parse localStorage ${localStorageKey} as JSON, treating as plain string:`,
            parseError,
          );
          // If it's a valid non-JSON value (like 'system', 'light', 'dark' for theme), return as-is
          if (['system', 'light', 'dark', 'en', 'cs', 'de', 'es', 'fr', 'zh'].includes(localValue)) {
            console.log(`[UserProfileService] Using plain string value for ${localStorageKey}:`, localValue);
            // Store it as JSON for future consistency
            this.safeSetLocalStorage(localStorageKey, JSON.stringify(localValue));
            return localValue;
          }
          // For other values, return as string
          return localValue;
        }
      }

      // If nothing in localStorage and we have a default, use it
      if (defaultValue !== undefined) {
        this.safeSetLocalStorage(localStorageKey, JSON.stringify(defaultValue));
        console.log(
          `[UserProfileService] Using default value for ${localStorageKey} due to API failure:`,
          defaultValue,
        );
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

      const settingsToUpdate: Record<string, { value: unknown; category: string }> = {};

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
          if (!this.safeSetLocalStorage(localStorageKey, JSON.stringify(setting.value))) {
            console.warn(`[UserProfileService] Failed to initialize setting ${key} in localStorage`);
          }
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
