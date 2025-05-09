import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { ProfileProvider, useProfile, UserProfile } from '../../ProfileContext';
import '@testing-library/jest-dom';

// Configure AuthContext mock with ability to change user state
let currentUser = { id: 'test-user-id', email: 'test@example.com' };

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: currentUser,
    signOut: vi.fn(() => {
      currentUser = null;
      return Promise.resolve();
    }),
    signIn: vi.fn(() => {
      currentUser = { id: 'test-user-id', email: 'test@example.com' };
      return Promise.resolve({ user: currentUser });
    }),
  })),
  // Export test helper to manipulate mock user
  __setMockUser: (user: any) => {
    currentUser = user;
  }
}));

// Create test component that uses the profile context
const ProfileDisplay: React.FC = () => {
  const { profile, loading, updateProfile, updateAvatar, removeAvatar } = useProfile();
  
  if (loading) {
    return <div data-testid="loading">Loading profile...</div>;
  }
  
  if (!profile) {
    return <div data-testid="no-profile">No profile available</div>;
  }
  
  return (
    <div data-testid="profile-container">
      <h2>User Profile</h2>
      <div data-testid="profile-username">Username: {profile.username || 'Not set'}</div>
      <div data-testid="profile-fullname">Full Name: {profile.full_name || 'Not set'}</div>
      <div data-testid="profile-bio">Bio: {profile.bio || 'Not set'}</div>
      <div data-testid="profile-location">Location: {profile.location || 'Not set'}</div>
      <div data-testid="profile-title">Title: {profile.title || 'Not set'}</div>
      <div data-testid="profile-organization">Organization: {profile.organization || 'Not set'}</div>
      <div data-testid="profile-avatar">
        Avatar: {profile.avatar_url ? 'Set' : 'Not set'}
        {profile.avatar_url && <img src={profile.avatar_url} alt="Avatar" width={50} height={50} />}
      </div>
      
      <div className="actions">
        <button 
          data-testid="update-profile"
          onClick={() => updateProfile({ 
            full_name: 'Updated Name',
            bio: 'Updated bio'
          })}
        >
          Update Profile
        </button>
        
        <button 
          data-testid="update-avatar"
          onClick={() => updateAvatar('https://example.com/new-avatar.jpg')}
        >
          Update Avatar
        </button>
        
        <button 
          data-testid="remove-avatar"
          onClick={() => removeAvatar()}
        >
          Remove Avatar
        </button>
      </div>
    </div>
  );
};

// Component to test error boundaries
const ProfileConsumer: React.FC = () => {
  try {
    useProfile();
    return <div data-testid="profile-consumer-success">Profile consumer working</div>;
  } catch (error) {
    return <div data-testid="profile-consumer-error">Error: {(error as Error).message}</div>;
  }
};

describe('ProfileContext (Enhanced)', () => {
  // Mock localStorage
  let localStorageMock: { [key: string]: string } = {};
  
  beforeEach(() => {
    // Reset user to logged in state for most tests
    currentUser = { id: 'test-user-id', email: 'test@example.com' };
    
    // Mock localStorage
    localStorageMock = {};
    
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key) => localStorageMock[key] || null),
        setItem: vi.fn((key, value) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key) => delete localStorageMock[key]),
        clear: vi.fn(() => (localStorageMock = {})),
      },
      writable: true,
    });
    
    // Mock console.error to suppress expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should load initial profile from localStorage if available', async () => {
    // Set up a profile in localStorage
    const storedProfile: UserProfile = {
      username: 'existinguser',
      full_name: 'Existing User',
      bio: 'Existing bio',
      location: 'Existing location',
      title: 'Existing title',
      organization: 'Existing organization',
      avatar_url: 'https://example.com/existing-avatar.jpg',
    };
    
    localStorageMock['userProfile'] = JSON.stringify(storedProfile);
    
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Initially should show loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Then should show profile data
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Check all profile fields
    expect(screen.getByTestId('profile-username').textContent).toContain('existinguser');
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Existing User');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Existing bio');
    expect(screen.getByTestId('profile-location').textContent).toContain('Existing location');
    expect(screen.getByTestId('profile-title').textContent).toContain('Existing title');
    expect(screen.getByTestId('profile-organization').textContent).toContain('Existing organization');
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Set');
  });
  
  it('should create initial profile if none exists in localStorage', async () => {
    // Ensure no profile in localStorage
    localStorageMock = {};
    
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Initially should show loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Then should show profile data
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Username should be initialized from email
    expect(screen.getByTestId('profile-username').textContent).toContain('test');
    
    // Default values for other fields
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Not set');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Not set');
    
    // Should save initial profile to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'userProfile',
      expect.any(String)
    );
    
    // Parse the saved profile to verify content
    const savedProfile = JSON.parse(
      vi.mocked(localStorage.setItem).mock.calls.find(
        call => call[0] === 'userProfile'
      )?.[1] || '{}'
    );
    
    expect(savedProfile.username).toBe('test');
  });
  
  it('should update profile when updateProfile is called', async () => {
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Initial values
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Not set');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Not set');
    
    // Update profile
    act(() => {
      fireEvent.click(screen.getByTestId('update-profile'));
    });
    
    // Check updated values
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Updated Name');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Updated bio');
    
    // Should save updated profile to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'userProfile',
      expect.stringContaining('Updated Name')
    );
  });
  
  it('should update avatar when updateAvatar is called', async () => {
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Initial values
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Not set');
    
    // Update avatar
    act(() => {
      fireEvent.click(screen.getByTestId('update-avatar'));
    });
    
    // Check updated values
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Set');
    
    // Should save updated profile to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'userProfile',
      expect.stringContaining('new-avatar.jpg')
    );
  });
  
  it('should remove avatar when removeAvatar is called', async () => {
    // Set up a profile with avatar
    const profileWithAvatar: UserProfile = {
      username: 'user',
      avatar_url: 'https://example.com/avatar.jpg',
    };
    
    localStorageMock['userProfile'] = JSON.stringify(profileWithAvatar);
    localStorageMock['userAvatar'] = 'base64data'; // Mock avatar data
    localStorageMock['userAvatarUrl'] = 'https://example.com/avatar.jpg';
    
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Initial values
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Set');
    
    // Remove avatar
    act(() => {
      fireEvent.click(screen.getByTestId('remove-avatar'));
    });
    
    // Check updated values
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Not set');
    
    // Should update profile in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'userProfile',
      expect.not.stringContaining('avatar.jpg')
    );
    
    // Should remove avatar data from localStorage
    expect(localStorage.removeItem).toHaveBeenCalledWith('userAvatar');
    expect(localStorage.removeItem).toHaveBeenCalledWith('userAvatarUrl');
  });
  
  it('should handle user sign-out correctly', async () => {
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Simulate user sign-out
    act(() => {
      // Use the exported helper to update the mock user
      require('@/contexts/AuthContext').__setMockUser(null);
      
      // Manually trigger a re-render since we're changing the mock outside React
      render(
        <ProfileProvider>
          <ProfileDisplay />
        </ProfileProvider>
      );
    });
    
    // Should show no profile when user is signed out
    await waitFor(() => {
      expect(screen.getByTestId('no-profile')).toBeInTheDocument();
    });
  });
  
  it('should handle user sign-in correctly', async () => {
    // Start with no user
    currentUser = null;
    
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Should show no profile when user is signed out
    await waitFor(() => {
      expect(screen.getByTestId('no-profile')).toBeInTheDocument();
    });
    
    // Simulate user sign-in
    act(() => {
      // Use the exported helper to update the mock user
      require('@/contexts/AuthContext').__setMockUser({ 
        id: 'new-user-id', 
        email: 'newuser@example.com' 
      });
      
      // Manually trigger a re-render
      render(
        <ProfileProvider>
          <ProfileDisplay />
        </ProfileProvider>
      );
    });
    
    // Should load profile for new user
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Username should be initialized from new email
    expect(screen.getByTestId('profile-username').textContent).toContain('newuser');
  });
  
  it('should handle localStorage errors gracefully', async () => {
    // Mock localStorage to throw errors
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => {
          throw new Error('localStorage error');
        }),
        setItem: vi.fn(() => {
          throw new Error('localStorage error');
        }),
        removeItem: vi.fn(() => {
          throw new Error('localStorage error');
        }),
      },
      writable: true,
    });
    
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Should recover from localStorage errors
    await waitFor(() => {
      // Either shows loading followed by empty profile, or directly empty profile
      expect(
        screen.queryByTestId('profile-container') || 
        screen.queryByTestId('no-profile')
      ).toBeInTheDocument();
    });
    
    // Console error should have been called
    expect(console.error).toHaveBeenCalled();
  });
  
  it('should throw error when useProfile is used outside ProfileProvider', () => {
    render(<ProfileConsumer />);
    
    // Should show error message
    expect(screen.getByTestId('profile-consumer-error')).toBeInTheDocument();
    expect(screen.getByTestId('profile-consumer-error').textContent).toContain(
      'useProfile must be used within a ProfileProvider'
    );
  });
  
  it('should handle partial profile updates correctly', async () => {
    // Set up initial profile with some fields
    const initialProfile: UserProfile = {
      username: 'initialuser',
      full_name: 'Initial User',
      bio: 'Initial bio',
    };
    
    localStorageMock['userProfile'] = JSON.stringify(initialProfile);
    
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>
    );
    
    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });
    
    // Create a custom update button to test partial updates
    const TestUpdater = () => {
      const { updateProfile } = useProfile();
      return (
        <button 
          data-testid="partial-update"
          onClick={() => updateProfile({ 
            location: 'New Location',
            title: 'New Title'
          })}
        >
          Partial Update
        </button>
      );
    };
    
    // Re-render with the test updater
    const { rerender } = render(
      <ProfileProvider>
        <ProfileDisplay />
        <TestUpdater />
      </ProfileProvider>
    );
    
    // Perform partial update
    act(() => {
      fireEvent.click(screen.getByTestId('partial-update'));
    });
    
    // Should maintain existing fields while updating new ones
    expect(screen.getByTestId('profile-username').textContent).toContain('initialuser');
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Initial User');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Initial bio');
    expect(screen.getByTestId('profile-location').textContent).toContain('New Location');
    expect(screen.getByTestId('profile-title').textContent).toContain('New Title');
    
    // Check localStorage for merged profile
    const savedProfileJSON = vi.mocked(localStorage.setItem).mock.calls.find(
      call => call[0] === 'userProfile'
    )?.[1];
    
    if (savedProfileJSON) {
      const savedProfile = JSON.parse(savedProfileJSON);
      expect(savedProfile).toEqual({
        username: 'initialuser',
        full_name: 'Initial User',
        bio: 'Initial bio',
        location: 'New Location',
        title: 'New Title'
      });
    } else {
      fail('Expected localStorage.setItem to be called with userProfile');
    }
  });
});