import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

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
  updateProfile: (data: Partial<UserProfile>) => void;
  updateAvatar: (avatarUrl: string) => void;
  removeAvatar: () => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load profile from localStorage on mount and when user changes
  useEffect(() => {
    const loadProfile = () => {
      setLoading(true);
      try {
        // Try to load profile from localStorage
        const storedProfile = localStorage.getItem('userProfile');
        if (storedProfile) {
          setProfile(JSON.parse(storedProfile));
        } else {
          // Initialize with empty profile if not found
          const initialProfile: UserProfile = {
            username: user?.email?.split('@')[0] || '',
            avatar_url: localStorage.getItem('userAvatarUrl') || '',
          };
          setProfile(initialProfile);
          localStorage.setItem('userProfile', JSON.stringify(initialProfile));
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadProfile();
    } else {
      setProfile(null);
      setLoading(false);
    }
  }, [user]);

  // Update profile data
  const updateProfile = (data: Partial<UserProfile>) => {
    setProfile((prev) => {
      const updatedProfile = { ...prev, ...data };
      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      return updatedProfile;
    });
  };

  // Update avatar URL
  const updateAvatar = (avatarUrl: string) => {
    setProfile((prev) => {
      const updatedProfile = { ...prev, avatar_url: avatarUrl };
      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      return updatedProfile;
    });
  };

  // Remove avatar
  const removeAvatar = () => {
    setProfile((prev) => {
      const updatedProfile = { ...prev, avatar_url: '' };
      localStorage.setItem('userProfile', JSON.stringify(updatedProfile));
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userAvatarUrl');
      return updatedProfile;
    });
  };

  return (
    <ProfileContext.Provider
      value={{
        profile,
        loading,
        updateProfile,
        updateAvatar,
        removeAvatar,
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
