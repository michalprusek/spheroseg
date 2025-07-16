import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

// Create a new QueryClient for each test
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
    },
  });

// Mock authentication context values
export const mockAuthContextValues = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    username: 'testuser',
  },
  token: 'test-token',
  loading: false,
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
};

// Mock language context values
export const mockLanguageContextValues = {
  language: 'en',
  setLanguage: vi.fn(),
  t: (key: string) => key,
  availableLanguages: ['en', 'cs', 'de', 'fr', 'es', 'ru'],
};

// Mock theme context values
export const mockThemeContextValues = {
  theme: 'light',
  setTheme: vi.fn(),
};

// Mock profile context values
export const mockProfileContextValues = {
  profile: {
    user_id: 'test-user-id',
    username: 'testuser',
    full_name: 'Test User',
    title: 'Software Developer',
    organization: 'Test Organization',
    bio: 'This is a test bio',
    location: 'Test Location',
    avatar_url: 'https://example.com/avatar.jpg',
    preferred_language: 'en',
  },
  loading: false,
  error: null,
  updateProfile: vi.fn(),
  uploadAvatar: vi.fn(),
};

// Mock the context hooks
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContextValues,
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => mockLanguageContextValues,
  LanguageProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => mockThemeContextValues,
  ThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock('@/contexts/ProfileContext', () => ({
  useProfile: () => mockProfileContextValues,
  ProfileProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Wrapper component for testing components that require context providers
export const TestWrapper = ({ children }: { children: ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  );
};

// Wrapper component with custom mocked context values
export const MockedContextWrapper = ({
  children,
  authValues = mockAuthContextValues,
  languageValues = mockLanguageContextValues,
  themeValues = mockThemeContextValues,
  profileValues = mockProfileContextValues,
}: {
  children: ReactNode;
  authValues?: typeof mockAuthContextValues;
  languageValues?: typeof mockLanguageContextValues;
  themeValues?: typeof mockThemeContextValues;
  profileValues?: typeof mockProfileContextValues;
}) => {
  const queryClient = createTestQueryClient();

  // Override the default mocks with custom values
  vi.mocked(require('@/contexts/AuthContext').useAuth).mockReturnValue(authValues);
  vi.mocked(require('@/contexts/LanguageContext').useLanguage).mockReturnValue(languageValues);
  vi.mocked(require('@/contexts/ThemeContext').useTheme).mockReturnValue(themeValues);
  vi.mocked(require('@/contexts/ProfileContext').useProfile).mockReturnValue(profileValues);

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  );
};

// Mock API response data
export const mockApiResponses = {
  projects: [
    {
      id: 'project-1',
      title: 'Test Project 1',
      description: 'This is test project 1',
      user_id: 'test-user-id',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      image_count: 5,
      thumbnail_url: 'https://example.com/thumbnail1.jpg',
    },
    {
      id: 'project-2',
      title: 'Test Project 2',
      description: 'This is test project 2',
      user_id: 'test-user-id',
      created_at: '2023-01-03T00:00:00Z',
      updated_at: '2023-01-04T00:00:00Z',
      image_count: 3,
      thumbnail_url: 'https://example.com/thumbnail2.jpg',
    },
  ],
  images: [
    {
      id: 'image-1',
      project_id: 'project-1',
      name: 'test-image-1.jpg',
      url: 'https://example.com/image1.jpg',
      thumbnail_url: 'https://example.com/thumbnail1.jpg',
      segmentationStatus: 'completed',
      createdAt: '2023-01-01T00:00:00Z',
      updatedAt: '2023-01-02T00:00:00Z',
    },
    {
      id: 'image-2',
      project_id: 'project-1',
      name: 'test-image-2.jpg',
      url: 'https://example.com/image2.jpg',
      thumbnail_url: 'https://example.com/thumbnail2.jpg',
      segmentationStatus: 'pending',
      createdAt: '2023-01-03T00:00:00Z',
      updatedAt: '2023-01-04T00:00:00Z',
    },
  ],
  segmentations: [
    {
      id: 'segmentation-1',
      image_id: 'image-1',
      polygons: [
        {
          id: 'polygon-1',
          points: [
            { x: 10, y: 10 },
            { x: 20, y: 10 },
            { x: 20, y: 20 },
            { x: 10, y: 20 },
          ],
          type: 'external',
        },
      ],
      metrics: {
        area: 100,
        perimeter: 40,
        circularity: 0.8,
      },
      created_at: '2023-01-02T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
    },
  ],
};

// Mock file data
export const createMockFile = (name: string, type: string, size: number) => {
  const file = new File(['mock file content'], name, { type });
  Object.defineProperty(file, 'size', {
    get() {
      return size;
    },
  });
  return file;
};

// Mock drag and drop events
export const createMockDragEvent = (type: string, files: File[] = []) => {
  const event = {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    type,
    dataTransfer: {
      files,
      items: files.map((file) => ({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
      })),
      clearData: vi.fn(),
    },
  };
  return event;
};
