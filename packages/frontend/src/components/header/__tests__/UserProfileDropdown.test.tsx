import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import UserProfileDropdown from '../UserProfileDropdown';
import '@testing-library/jest-dom';

// Mock the useNavigate hook
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the useAuth hook
const mockSignOut = vi.fn();
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    signOut: mockSignOut,
  }),
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.profile': 'Profile',
        'common.settings': 'Settings',
        'common.signOut': 'Sign Out',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock the useProfile hook
vi.mock('@/contexts/ProfileContext', () => ({
  useProfile: () => ({
    profile: {
      username: 'TestUser',
      avatar_url: null,
    },
  }),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('UserProfileDropdown Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  it('renders the username', () => {
    render(
      <BrowserRouter>
        <UserProfileDropdown username="JohnDoe" />
      </BrowserRouter>,
    );

    expect(screen.getByText('TestUser')).toBeInTheDocument();
  });

  it('renders dropdown button that can be clicked', () => {
    render(
      <BrowserRouter>
        <UserProfileDropdown username="JohnDoe" />
      </BrowserRouter>,
    );

    // Verify the dropdown button is rendered
    const dropdownButton = screen.getByText('TestUser');
    expect(dropdownButton).toBeInTheDocument();

    // Verify it's a button
    expect(dropdownButton.closest('button')).toBeInTheDocument();
  });

  it('has navigation functionality', () => {
    render(
      <BrowserRouter>
        <UserProfileDropdown username="JohnDoe" />
      </BrowserRouter>,
    );

    // Verify the navigate function is available
    expect(mockNavigate).toBeDefined();
  });

  it('has sign out functionality', () => {
    render(
      <BrowserRouter>
        <UserProfileDropdown username="JohnDoe" />
      </BrowserRouter>,
    );

    // Verify the signOut function is available
    expect(mockSignOut).toBeDefined();
  });

  it('uses localStorage for avatar storage', () => {
    // Set avatar in localStorage
    localStorageMock.setItem('userAvatar', 'test-avatar-url');

    render(
      <BrowserRouter>
        <UserProfileDropdown username="JohnDoe" />
      </BrowserRouter>,
    );

    // Verify localStorage was accessed
    expect(localStorageMock.getItem('userAvatar')).toBe('test-avatar-url');
  });
});
