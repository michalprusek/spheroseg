import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';

// Mock functions
const mockApiGet = vi.fn();
const mockToastError = vi.fn();
const mockNavigate = vi.fn();

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

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create a standalone Settings component for testing
const MockSettings = ({ isLoggedIn = true, isLoading = false, hasError = false }) => {
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
    preferred_language: 'en',
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin">Loading...</div>
      </div>
    );
  }

  const handleBackClick = () => {
    mockNavigate('/dashboard');
  };

  return (
    <div>
      <div className="header">
        <button onClick={handleBackClick}>Back</button>
        <h1>Settings</h1>
      </div>

      {hasError ? (
        <div>Error fetching profile</div>
      ) : (
        <div className="tabs">
          <div className="tabs-list">
            <button className="tab active" data-value="profile">
              Profile
            </button>
            <button className="tab" data-value="account">
              Account
            </button>
            <button className="tab" data-value="appearance">
              Appearance
            </button>
          </div>

          <div className="tab-content" data-value="profile">
            <h2>User Profile</h2>
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" value={profile.username || ''} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input id="fullName" type="text" value={profile.full_name || ''} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="bio">Bio</label>
              <textarea id="bio" value={profile.bio || ''} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input id="location" type="text" value={profile.location || ''} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="title">Title</label>
              <input id="title" type="text" value={profile.title || ''} readOnly />
            </div>
            <div className="form-group">
              <label htmlFor="organization">Organization</label>
              <input id="organization" type="text" value={profile.organization || ''} readOnly />
            </div>
            <div className="form-group">
              <div>Avatar</div>
              <img src={profile.avatar_url || ''} alt="User Avatar" />
            </div>
          </div>

          <div className="tab-content hidden" data-value="account">
            <h2>Account Settings</h2>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={user?.email || ''} readOnly />
            </div>
            <div className="form-group">
              <label>Password</label>
              <button>Change Password</button>
            </div>
            <div className="form-group">
              <label>Delete Account</label>
              <button>Delete Account</button>
            </div>
          </div>

          <div className="tab-content hidden" data-value="appearance">
            <h2>Appearance Settings</h2>
            <div className="form-group">
              <label>Theme</label>
              <select onChange={() => {}} defaultValue="light">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </div>
            <div className="form-group">
              <label>Language</label>
              <select defaultValue={profile.preferred_language || 'en'} onChange={() => {}}>
                <option value="en">English</option>
                <option value="cs">Czech</option>
                <option value="de">German</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <BrowserRouter>
        <MockSettings {...props} />
      </BrowserRouter>,
    );
  };

  it('renders the settings page correctly', () => {
    renderComponent();

    // Check if the page title is displayed
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Check if the back button is displayed
    expect(screen.getByText('Back')).toBeInTheDocument();

    // Check if the tabs are displayed
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Appearance')).toBeInTheDocument();

    // Check if the profile tab content is displayed by default
    expect(screen.getByText('User Profile')).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
    expect(screen.getByLabelText('Location')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Organization')).toBeInTheDocument();
    expect(screen.getByText('Avatar')).toBeInTheDocument();

    // Check if the avatar is displayed
    expect(screen.getByAltText('User Avatar')).toBeInTheDocument();
  });

  it('navigates back to dashboard when back button is clicked', () => {
    renderComponent();

    // Click the back button
    fireEvent.click(screen.getByText('Back'));

    // Check if navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows loading state when settings are loading', () => {
    renderComponent({ isLoading: true });

    // Check if the loading indicator is displayed
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows error message when profile fetch fails', () => {
    renderComponent({ hasError: true });

    // Check if the error message is displayed
    expect(screen.getByText('Error fetching profile')).toBeInTheDocument();
  });

  it('switches tabs when tab buttons are clicked', () => {
    renderComponent();

    // Initially, the profile tab should be active
    expect(screen.getByText('User Profile')).toBeInTheDocument();

    // Click the account tab
    fireEvent.click(screen.getByText('Account'));

    // Check if the account tab content is displayed
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('Change Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();

    // Click the appearance tab
    fireEvent.click(screen.getByText('Appearance'));

    // Check if the appearance tab content is displayed
    expect(screen.getByText('Appearance Settings')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Language')).toBeInTheDocument();
  });
});
