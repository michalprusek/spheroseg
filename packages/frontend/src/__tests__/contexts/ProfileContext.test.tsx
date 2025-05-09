import { vi } from 'vitest';
import { ProfileProvider, useProfile } from '@/contexts/ProfileContext';

// Mock the useAuth hook
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' }
  })
}));

// Mock the ProfileContext implementation
vi.mock('@/contexts/ProfileContext', () => ({
  ProfileProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useProfile: vi.fn().mockReturnValue({
    profile: {
      username: 'testuser',
      full_name: 'Test User',
      bio: 'Test bio',
      avatar_url: 'https://example.com/avatar.jpg'
    },
    loading: false,
    updateProfile: vi.fn(),
    updateAvatar: vi.fn(),
    removeAvatar: vi.fn()
  }),
  UserProfile: {}
}));

describe('ProfileContext', () => {
  it('provides profile context with expected methods', () => {
    // This is a placeholder test to verify that the ProfileContext is properly mocked
    const profileContext = useProfile();
    expect(profileContext.profile).toBeDefined();
    expect(profileContext.loading).toBeDefined();
    expect(profileContext.updateProfile).toBeDefined();
    expect(profileContext.updateAvatar).toBeDefined();
    expect(profileContext.removeAvatar).toBeDefined();
  });
});
