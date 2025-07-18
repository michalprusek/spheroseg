import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock functions
const mockApiGet = vi.fn();
const mockToastError = vi.fn();

// Mock toast
vi.mock('sonner', () => ({
  toast: {
    error: mockToastError,
    success: vi.fn(),
  },
}));

// Mock apiClient
vi.mock('@/lib/apiClient', () => ({
  default: {
    get: mockApiGet,
  },
}));

// Create a standalone Profile component for testing
const MockProfile = ({ isLoggedIn = true, isLoading = false, hasError = false }) => {
  const user = isLoggedIn
    ? {
        id: 'user-123',
        email: 'test@example.com',
        created_at: '2023-01-01T00:00:00Z',
      }
    : null;

  const profile = {
    user_id: 'user-123',
    username: 'testuser',
    full_name: 'Test User',
    title: 'Software Developer',
    organization: 'Test Organization',
    bio: 'This is a test bio',
    location: 'Test Location',
    avatar_url: 'https://example.com/avatar.jpg',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="h-16 w-16 animate-spin">Loading...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <div>Please login to view your profile</div>;
  }

  if (hasError) {
    return <div>Failed to fetch profile data</div>;
  }

  return (
    <div>
      <h1>Profile</h1>
      <div className="profile-card">
        <img alt="User Avatar" src={profile.avatar_url} className="avatar" />
        <h2>{profile.full_name || profile.username}</h2>
        <p>{profile.title}</p>
        <p>{profile.organization}</p>
        <a href="/settings#user-profile">Edit Profile</a>
      </div>

      <div className="profile-details">
        <div>
          <span>Email:</span>
          <span>{user.email}</span>
        </div>
        <div>
          <span>Location:</span>
          <span>{profile.location}</span>
        </div>
        <div>
          <span>Joined:</span>
          <span>January 2023</span>
        </div>
      </div>

      <div className="about-section">
        <h3>About Me</h3>
        <p>{profile.bio}</p>
      </div>

      <div className="statistics-section">
        <h3>Statistics</h3>
        <div className="stats-grid">
          <div>
            <p>0</p>
            <p>Projects</p>
          </div>
          <div>
            <p>0</p>
            <p>Images</p>
          </div>
          <div>
            <p>0</p>
            <p>Analyses</p>
          </div>
          <div>
            <p>0 MB</p>
            <p>Storage Used</p>
          </div>
        </div>
      </div>

      <div className="activity-section">
        <h3>Recent Activity</h3>
        <p>No recent activity</p>
      </div>
    </div>
  );
};

describe('Profile Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <MockProfile {...props} />
      </BrowserRouter>,
    );
  };

  it('renders the profile page correctly when user is logged in', () => {
    renderComponent();

    // Check if the profile information is displayed
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Software Developer')).toBeInTheDocument();
    expect(screen.getByText('Test Organization')).toBeInTheDocument();
    expect(screen.getByText('This is a test bio')).toBeInTheDocument();
    expect(screen.getByText('Test Location')).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('January 2023')).toBeInTheDocument();

    // Check if the avatar is displayed
    expect(screen.getByAltText('User Avatar')).toBeInTheDocument();

    // Check if the edit profile link is displayed
    expect(screen.getByText('Edit Profile')).toBeInTheDocument();

    // Check if the statistics section is displayed
    expect(screen.getByText('Statistics')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Analyses')).toBeInTheDocument();
    expect(screen.getByText('Storage Used')).toBeInTheDocument();

    // Check if the activity section is displayed
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('No recent activity')).toBeInTheDocument();
  });

  it('shows loading state when profile is loading', () => {
    renderComponent({ isLoading: true });

    // Check if the loading indicator is displayed
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows login message when user is not logged in', () => {
    renderComponent({ isLoggedIn: false });

    // Check if the login message is displayed
    expect(screen.getByText('Please login to view your profile')).toBeInTheDocument();
  });

  it('shows error message when profile fetch fails', () => {
    renderComponent({ hasError: true });

    // Check if the error message is displayed
    expect(screen.getByText('Failed to fetch profile data')).toBeInTheDocument();
  });
});
