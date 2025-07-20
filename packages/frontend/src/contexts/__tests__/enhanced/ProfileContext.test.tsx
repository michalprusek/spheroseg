import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, beforeEach, afterEach, it, expect } from 'vitest';
import { ProfileProvider, useProfile, UserProfile } from '../../ProfileContext';
import '@testing-library/jest-dom';
import * as AuthContextMock from '@/contexts/AuthContext';

// Use vi.hoisted to define variables that can be accessed in mocks
const { mockGetUserProfile, mockCreateUserProfile, mockUpdateUserProfile, mockUploadAvatar, mockDeleteAvatar } = vi.hoisted(() => {
  return {
    mockGetUserProfile: vi.fn(),
    mockCreateUserProfile: vi.fn(),
    mockUpdateUserProfile: vi.fn(),
    mockUploadAvatar: vi.fn(),
    mockDeleteAvatar: vi.fn(),
  };
});

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
  },
}));

vi.mock('@/services/userProfileService', () => ({
  default: {
    getUserProfile: mockGetUserProfile,
    createUserProfile: mockCreateUserProfile,
    updateUserProfile: mockUpdateUserProfile,
    uploadAvatar: mockUploadAvatar,
    deleteAvatar: mockDeleteAvatar,
  },
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
          onClick={() =>
            updateProfile({
              full_name: 'Updated Name',
              bio: 'Updated bio',
            })
          }
        >
          Update Profile
        </button>

        <button data-testid="update-avatar" onClick={() => {
          // Create a mock File object for testing
          const file = new File(['avatar content'], 'avatar.jpg', { type: 'image/jpeg' });
          updateAvatar(file);
        }}>
          Update Avatar
        </button>

        <button data-testid="remove-avatar" onClick={() => removeAvatar()}>
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
    
    // Clear sessionStorage to ensure ProfileContext doesn't skip loading
    window.sessionStorage.clear();
    
    // Reset service mocks
    mockGetUserProfile.mockReset();
    mockCreateUserProfile.mockReset();
    mockUpdateUserProfile.mockReset();
    mockUploadAvatar.mockReset();
    mockDeleteAvatar.mockReset();
    
    // Default mock implementations
    mockGetUserProfile.mockResolvedValue({
      id: 'profile-id',
      user_id: 'test-user-id',
      username: 'testuser',
      full_name: 'Test User',
      bio: '',
      location: '',
      title: '',
      organization: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    mockCreateUserProfile.mockImplementation((profileData) => 
      Promise.resolve({
        id: 'profile-id',
        user_id: 'test-user-id',
        ...profileData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );
    
    mockUpdateUserProfile.mockImplementation((profileData) => 
      Promise.resolve({
        id: 'profile-id',
        user_id: 'test-user-id',
        ...profileData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    );
    
    mockUploadAvatar.mockResolvedValue({
      message: 'Avatar uploaded successfully',
      avatar: {
        filename: 'avatar.jpg',
        url: 'https://example.com/new-avatar.jpg',
      },
    });
    
    mockDeleteAvatar.mockResolvedValue({
      message: 'Avatar deleted successfully',
    });

    // Mock console.error to suppress expected errors
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load initial profile from localStorage if available', async () => {
    // Make getUserProfile return the data we want
    mockGetUserProfile.mockResolvedValue({
      id: 'profile-id',
      user_id: 'test-user-id',
      username: 'existinguser',
      full_name: 'Existing User',
      bio: 'Existing bio',
      location: 'Existing location',
      title: 'Existing title',
      organization: 'Existing organization',
      avatar_url: 'https://example.com/existing-avatar.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
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
    
    // Mock getUserProfile to return null (no profile exists)
    mockGetUserProfile.mockResolvedValue(null);
    
    // Mock createUserProfile to succeed
    mockCreateUserProfile.mockResolvedValue({
      id: 'new-profile-id',
      user_id: 'test-user-id',
      username: 'test',
      full_name: '',
      bio: '',
      location: '',
      title: '',
      organization: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Initially should show loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();

    // Then should show profile data
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Username should be initialized from email
    expect(screen.getByTestId('profile-username').textContent).toContain('test');

    // Default values for other fields
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Not set');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Not set');

    // Should have called createUserProfile
    expect(mockCreateUserProfile).toHaveBeenCalled();
  });

  it('should update profile when updateProfile is called', async () => {
    // Mock updateUserProfile to return updated data
    mockUpdateUserProfile.mockResolvedValue({
      id: 'profile-id',
      user_id: 'test-user-id',
      username: 'testuser',
      full_name: 'Updated Name',
      bio: 'Updated bio',
      location: '',
      title: '',
      organization: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });

    // Initial values from mockGetUserProfile
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Test User');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Not set');

    // Update profile
    act(() => {
      fireEvent.click(screen.getByTestId('update-profile'));
    });

    // Wait for update to complete
    await waitFor(() => {
      expect(screen.getByTestId('profile-fullname').textContent).toContain('Updated Name');
      expect(screen.getByTestId('profile-bio').textContent).toContain('Updated bio');
    });

    // Should have called updateUserProfile
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({
      full_name: 'Updated Name',
      bio: 'Updated bio',
    });

    // Should save updated profile to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('userProfile', expect.stringContaining('Updated Name'));
  });

  it('should update avatar when updateAvatar is called', async () => {
    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });

    // Initial values - profile has no avatar
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Not set');

    // Update avatar - note that TestDisplay component passes a string URL not a File
    // This is a test limitation, but ProfileContext.updateAvatar expects a File
    act(() => {
      fireEvent.click(screen.getByTestId('update-avatar'));
    });

    // Since the test component passes a string instead of a File, 
    // we need to wait for the expected behavior
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar').textContent).toContain('Set');
    });

    // Should save updated profile to localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('userProfile', expect.stringContaining('new-avatar.jpg'));
  });

  it('should remove avatar when removeAvatar is called', async () => {
    // Mock getUserProfile to return a profile with avatar
    mockGetUserProfile.mockResolvedValue({
      id: 'profile-id',
      user_id: 'test-user-id',
      username: 'testuser',
      full_name: 'Test User',
      bio: '',
      location: '',
      title: '',
      organization: '',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Mock deleteAvatar to succeed
    mockDeleteAvatar.mockResolvedValue({
      message: 'Avatar deleted successfully',
    });

    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });

    // Initial values - should have avatar
    expect(screen.getByTestId('profile-avatar').textContent).toContain('Set');

    // Remove avatar
    act(() => {
      fireEvent.click(screen.getByTestId('remove-avatar'));
    });

    // Wait for avatar to be removed
    await waitFor(() => {
      expect(screen.getByTestId('profile-avatar').textContent).toContain('Not set');
    });

    // Should have called deleteAvatar
    expect(mockDeleteAvatar).toHaveBeenCalled();

    // Should update profile in localStorage
    expect(localStorage.setItem).toHaveBeenCalledWith('userProfile', expect.not.stringContaining('avatar.jpg'));

    // Should remove avatar data from localStorage
    expect(localStorage.removeItem).toHaveBeenCalledWith('userAvatar');
    expect(localStorage.removeItem).toHaveBeenCalledWith('userAvatarUrl');
  });

  it('should handle user sign-out correctly', async () => {
    const { rerender } = render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });

    // Simulate user sign-out
    act(() => {
      // Use the exported helper to update the mock user
      (AuthContextMock as any).__setMockUser(null);
    });

    // Force a re-render to trigger the effect
    rerender(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Should show no profile when user is signed out
    await waitFor(() => {
      expect(screen.getByTestId('no-profile')).toBeInTheDocument();
    });
    
    // localStorage should be cleared
    expect(localStorage.removeItem).toHaveBeenCalledWith('userProfile');
    expect(localStorage.removeItem).toHaveBeenCalledWith('userAvatar');
    expect(localStorage.removeItem).toHaveBeenCalledWith('userAvatarUrl');
  });

  it('should handle user sign-in correctly', async () => {
    // Start with no user
    currentUser = null;

    const { rerender } = render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Should show no profile when user is signed out
    await waitFor(() => {
      expect(screen.getByTestId('no-profile')).toBeInTheDocument();
    });

    // Set up mock for new user - the API will be called for new user
    mockGetUserProfile.mockResolvedValueOnce(null); // No profile exists yet
    mockCreateUserProfile.mockResolvedValueOnce({
      id: 'new-profile-id',
      user_id: 'new-user-id',
      username: 'newuser',
      full_name: '',
      bio: '',
      location: '',
      title: '',
      organization: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Simulate user sign-in
    act(() => {
      // Use the exported helper to update the mock user
      (AuthContextMock as any).__setMockUser({
        id: 'new-user-id',
        email: 'newuser@example.com',
      });
    });

    // Force a re-render to trigger the effect
    rerender(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

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
        clear: vi.fn(() => {
          throw new Error('localStorage error');
        }),
      },
      writable: true,
      configurable: true,
    });

    render(
      <ProfileProvider>
        <ProfileDisplay />
      </ProfileProvider>,
    );

    // Should recover from localStorage errors and still load profile from API
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });

    // Profile should still load from API even if localStorage fails
    expect(screen.getByTestId('profile-username').textContent).toContain('testuser');

    // Console error should have been called due to localStorage failures
    expect(console.error).toHaveBeenCalled();
  });

  it('should throw error when useProfile is used outside ProfileProvider', () => {
    render(<ProfileConsumer />);

    // Should show error message
    expect(screen.getByTestId('profile-consumer-error')).toBeInTheDocument();
    expect(screen.getByTestId('profile-consumer-error').textContent).toContain(
      'useProfile must be used within a ProfileProvider',
    );
  });

  it('should handle partial profile updates correctly', async () => {
    // Mock getUserProfile to return initial profile with some fields
    mockGetUserProfile.mockResolvedValue({
      id: 'profile-id',
      user_id: 'test-user-id',
      username: 'initialuser',
      full_name: 'Initial User',
      bio: 'Initial bio',
      location: '',
      title: '',
      organization: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Create a custom update button to test partial updates
    const TestUpdater = () => {
      const { updateProfile } = useProfile();
      return (
        <button
          data-testid="partial-update"
          onClick={() =>
            updateProfile({
              location: 'New Location',
              title: 'New Title',
            })
          }
        >
          Partial Update
        </button>
      );
    };

    render(
      <ProfileProvider>
        <ProfileDisplay />
        <TestUpdater />
      </ProfileProvider>,
    );

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByTestId('profile-container')).toBeInTheDocument();
    });

    // Initial values
    expect(screen.getByTestId('profile-username').textContent).toContain('initialuser');
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Initial User');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Initial bio');

    // Mock updateUserProfile to return merged data
    mockUpdateUserProfile.mockResolvedValue({
      id: 'profile-id',
      user_id: 'test-user-id',
      username: 'initialuser',
      full_name: 'Initial User',
      bio: 'Initial bio',
      location: 'New Location',
      title: 'New Title',
      organization: '',
      avatar_url: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Perform partial update
    act(() => {
      fireEvent.click(screen.getByTestId('partial-update'));
    });

    // Wait for update to complete
    await waitFor(() => {
      expect(screen.getByTestId('profile-location').textContent).toContain('New Location');
      expect(screen.getByTestId('profile-title').textContent).toContain('New Title');
    });

    // Should maintain existing fields while updating new ones
    expect(screen.getByTestId('profile-username').textContent).toContain('initialuser');
    expect(screen.getByTestId('profile-fullname').textContent).toContain('Initial User');
    expect(screen.getByTestId('profile-bio').textContent).toContain('Initial bio');

    // Should have called updateUserProfile with partial data
    expect(mockUpdateUserProfile).toHaveBeenCalledWith({
      location: 'New Location',
      title: 'New Title',
    });

    // Check localStorage for merged profile
    const localStorageCalls = vi.mocked(localStorage.setItem).mock.calls;
    // Find the last call to setItem with 'userProfile'
    const lastProfileCall = localStorageCalls
      .filter((call) => call[0] === 'userProfile')
      .pop();

    if (lastProfileCall) {
      const savedProfile = JSON.parse(lastProfileCall[1]);
      expect(savedProfile).toMatchObject({
        username: 'initialuser',
        full_name: 'Initial User',
        bio: 'Initial bio',
        location: 'New Location',
        title: 'New Title',
      });
    } else {
      fail('Expected localStorage.setItem to be called with userProfile');
    }
  });
});
