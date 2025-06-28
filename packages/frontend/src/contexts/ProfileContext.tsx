import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import userProfileService, { UserProfile as APIUserProfile } from '../services/userProfileService';

// Define the profile data structure
export interface UserProfile {
  username?: string;
  full_name?: string;
  bio?: string;
  location?: string;
  title?: string;
  organization?: string;
  avatar_url?: string;
}

interface ProfileContextType {
  profile: UserProfile | null;
  loading: boolean;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
  updateAvatar: (file: File) => Promise<void>;
  removeAvatar: () => Promise<void>;
  syncToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile from database when user changes
  useEffect(() => {
    const loadProfile = async () => {
      setLoading(true);
      try {
        if (user) {
          // Prevent multiple concurrent API calls for the same user
          const lastUserId = window.sessionStorage.getItem('spheroseg_profile_last_user');
          if (lastUserId === user.id) {
            console.log('[ProfileContext] Profile already loaded for user', user.id, ', using localStorage fallback');
            // Use localStorage fallback
            try {
              const storedProfile = localStorage.getItem('userProfile');
              if (storedProfile) {
                setProfile(JSON.parse(storedProfile));
              }
            } catch (fallbackError) {
              console.error('Error loading profile from localStorage:', fallbackError);
            }
            setLoading(false);
            return;
          }

          // Mark this user as processed
          window.sessionStorage.setItem('spheroseg_profile_last_user', user.id);
          
          // Add a small delay to ensure auth is fully initialized
          await new Promise(resolve => setTimeout(resolve, 500));
          
          await loadFromDatabase();
        } else {
          setProfile(null);
          // Clear profile-related localStorage when user is null
          localStorage.removeItem('userProfile');
          localStorage.removeItem('userAvatar');
          localStorage.removeItem('userAvatarUrl');
          // Clear session markers
          window.sessionStorage.removeItem('spheroseg_profile_last_user');
        }
      } catch (error) {
        // Clear the user marker if API fails so we can retry later
        window.sessionStorage.removeItem('spheroseg_profile_last_user');
        console.error('Error loading profile:', error);
        // Fallback to localStorage if database fails
        try {
          const storedProfile = localStorage.getItem('userProfile');
          if (storedProfile) {
            setProfile(JSON.parse(storedProfile));
          }
        } catch (fallbackError) {
          console.error('Error loading profile from localStorage:', fallbackError);
        }
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Load profile from database
  const loadFromDatabase = async (): Promise<void> => {
    try {
      // Skip if no user is authenticated
      if (!user) {
        console.log('[ProfileContext] Skipping profile load - no authenticated user');
        return;
      }

      const apiProfile = await userProfileService.getUserProfile();
      if (apiProfile) {
        const profile: UserProfile = {
          username: apiProfile.username,
          full_name: apiProfile.full_name,
          bio: apiProfile.bio,
          location: apiProfile.location,
          title: apiProfile.title,
          organization: apiProfile.organization,
          avatar_url: apiProfile.avatar_url,
        };
        setProfile(profile);
        // Cache in localStorage for offline use
        localStorage.setItem('userProfile', JSON.stringify(profile));
        
        // If there's an avatar URL from API, also store it separately for easier access
        if (apiProfile.avatar_url) {
          localStorage.setItem('userAvatarUrl', apiProfile.avatar_url);
        }
      } else {
        // Create default profile if none exists
        const defaultProfile: UserProfile = {
          username: user?.email?.split('@')[0] || '',
          full_name: user?.name || '',
        };
        const createdProfile = await userProfileService.createUserProfile(defaultProfile);
        const profile: UserProfile = {
          username: createdProfile.username,
          full_name: createdProfile.full_name,
          bio: createdProfile.bio,
          location: createdProfile.location,
          title: createdProfile.title,
          organization: createdProfile.organization,
          avatar_url: createdProfile.avatar_url,
        };
        setProfile(profile);
        localStorage.setItem('userProfile', JSON.stringify(profile));
      }
    } catch (error) {
      console.error('Error loading profile from database:', error);
      throw error;
    }
  };

  // Sync current profile to database
  const syncToDatabase = async (): Promise<void> => {
    if (!profile) return;
    
    try {
      await userProfileService.updateUserProfile(profile);
      console.log('Profile synced to database successfully');
    } catch (error) {
      console.error('Error syncing profile to database:', error);
      throw error;
    }
  };

  // Update profile data
  const updateProfile = async (data: Partial<UserProfile>): Promise<void> => {
    try {
      const updatedProfile = await userProfileService.updateUserProfile(data);
      const profile: UserProfile = {
        username: updatedProfile.username,
        full_name: updatedProfile.full_name,
        bio: updatedProfile.bio,
        location: updatedProfile.location,
        title: updatedProfile.title,
        organization: updatedProfile.organization,
        avatar_url: updatedProfile.avatar_url,
      };
      setProfile(profile);
      // Cache in localStorage
      localStorage.setItem('userProfile', JSON.stringify(profile));
    } catch (error) {
      console.error('Error updating profile:', error);
      // Fallback to local update if API fails
      setProfile((prev) => {
        const updatedProfile = { ...prev, ...data };
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        return updatedProfile;
      });
      throw error;
    }
  };

  // Update avatar
  const updateAvatar = async (file: File): Promise<void> => {
    try {
      const result = await userProfileService.uploadAvatar(file);
      setProfile((prev) => {
        const updatedProfile = { ...prev, avatar_url: result.avatar.url };
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        return updatedProfile;
      });
    } catch (error) {
      console.error('Error updating avatar:', error);
      throw error;
    }
  };

  // Remove avatar
  const removeAvatar = async (): Promise<void> => {
    try {
      await userProfileService.deleteAvatar();
      setProfile((prev) => {
        const updatedProfile = { ...prev, avatar_url: '' };
        localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
        localStorage.removeItem('userAvatar');
        localStorage.removeItem('userAvatarUrl');
        return updatedProfile;
      });
    } catch (error) {
      console.error('Error removing avatar:', error);
      throw error;
    }
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        updateProfile,
        updateAvatar,
        removeAvatar,
        syncToDatabase,
        loadFromDatabase,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
