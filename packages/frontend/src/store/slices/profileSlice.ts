import type { StateCreator } from 'zustand';
import type { StoreState } from '../index';
import { apiClient } from '../../services/apiClient';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  fullName?: string;
  avatar?: string;
  bio?: string;
  organization?: string;
  location?: string;
  website?: string;
  createdAt: string;
  updatedAt: string;
  preferences: {
    theme?: string;
    language?: string;
    colorScheme?: string;
    notifications?: {
      email: boolean;
      push: boolean;
      inApp: boolean;
    };
  };
}

export interface ProfileSlice {
  // State
  profile: UserProfile | null;
  isLoadingProfile: boolean;
  profileError: string | null;
  
  // Actions
  fetchProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  deleteAvatar: () => Promise<void>;
  updatePreferences: (preferences: Partial<UserProfile['preferences']>) => Promise<void>;
}

export const createProfileSlice: StateCreator<
  StoreState,
  [
    ['zustand/devtools', never],
    ['zustand/persist', unknown],
    ['zustand/subscribeWithSelector', never],
    ['zustand/immer', never]
  ],
  [],
  ProfileSlice
> = (set, get) => ({
  // Initial state
  profile: null,
  isLoadingProfile: false,
  profileError: null,
  
  // Actions
  fetchProfile: async () => {
    const { isAuthenticated, user } = get();
    if (!isAuthenticated || !user) return;
    
    set((state) => {
      state.isLoadingProfile = true;
      state.profileError = null;
    });
    
    try {
      const response = await apiClient.get(`/api/users/profile/${user.id}`);
      const profile = response.data;
      
      set((state) => {
        state.profile = profile;
        state.isLoadingProfile = false;
      });
      
      // Apply user preferences
      if (profile.preferences) {
        const { theme, language, colorScheme } = profile.preferences;
        if (theme) get().setTheme(theme as any);
        if (language) get().setLanguage(language as any);
        if (colorScheme) get().setColorScheme(colorScheme as any);
      }
    } catch (error) {
      set((state) => {
        state.isLoadingProfile = false;
        state.profileError = error instanceof Error ? error.message : 'Failed to fetch profile';
      });
    }
  },
  
  updateProfile: async (data) => {
    const { profile } = get();
    if (!profile) return;
    
    set((state) => {
      state.isLoadingProfile = true;
      state.profileError = null;
    });
    
    try {
      const response = await apiClient.patch(`/api/users/profile/${profile.id}`, data);
      const updatedProfile = response.data;
      
      set((state) => {
        state.profile = updatedProfile;
        state.isLoadingProfile = false;
      });
      
      // Update user in auth slice if needed
      if (data.username || data.email) {
        get().updateUser({
          username: updatedProfile.username,
          email: updatedProfile.email,
        });
      }
    } catch (error) {
      set((state) => {
        state.isLoadingProfile = false;
        state.profileError = error instanceof Error ? error.message : 'Failed to update profile';
      });
      throw error;
    }
  },
  
  uploadAvatar: async (file) => {
    const { profile } = get();
    if (!profile) throw new Error('No profile found');
    
    const formData = new FormData();
    formData.append('avatar', file);
    
    try {
      const response = await apiClient.post(
        `/api/users/profile/${profile.id}/avatar`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      
      const { avatarUrl } = response.data;
      
      set((state) => {
        if (state.profile) {
          state.profile.avatar = avatarUrl;
        }
      });
      
      return avatarUrl;
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to upload avatar');
    }
  },
  
  deleteAvatar: async () => {
    const { profile } = get();
    if (!profile) return;
    
    try {
      await apiClient.delete(`/api/users/profile/${profile.id}/avatar`);
      
      set((state) => {
        if (state.profile) {
          state.profile.avatar = undefined;
        }
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to delete avatar');
    }
  },
  
  updatePreferences: async (preferences) => {
    const { profile } = get();
    if (!profile) return;
    
    try {
      const response = await apiClient.patch(
        `/api/users/profile/${profile.id}/preferences`,
        preferences
      );
      
      set((state) => {
        if (state.profile) {
          state.profile.preferences = {
            ...state.profile.preferences,
            ...preferences,
          };
        }
      });
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to update preferences');
    }
  },
});