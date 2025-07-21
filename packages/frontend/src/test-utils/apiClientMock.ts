/**
 * API Client mock utilities for testing
 * This provides a consistent way to mock the API client across all tests
 */
import { vi } from 'vitest';

/**
 * Creates a comprehensive mock for the API client that can be used in tests
 * @returns An object containing the mock API client and helper methods
 */
export const createApiClientMock = () => {
  // Create base mock functions
  const mockApi = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    request: vi.fn(),
    getUri: vi.fn().mockReturnValue('http://localhost:3000'),
    defaults: {
      baseURL: '/api',
      headers: {
        common: {},
        get: {},
        post: {},
        put: {},
        delete: {},
        patch: {},
      },
    },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn(), clear: vi.fn() },
    },
  };

  // Common mock response data
  const mockResponses = {
    user: {
      id: 'test-user-id',
      email: 'test@example.com',
      name: 'Test User',
      created_at: '2023-01-01T00:00:00Z',
    },
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
    auth: {
      token: 'test-token',
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        name: 'Test User',
      },
    },
    project: {
      id: 'test-project-id',
      name: 'Test Project',
      description: 'This is a test project',
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      user_id: 'test-user-id',
    },
    projects: [
      {
        id: 'test-project-id-1',
        name: 'Test Project 1',
        description: 'This is test project 1',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        user_id: 'test-user-id',
      },
      {
        id: 'test-project-id-2',
        name: 'Test Project 2',
        description: 'This is test project 2',
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        user_id: 'test-user-id',
      },
    ],
    image: {
      id: 'test-image-id',
      name: 'test-image.jpg',
      url: '/images/test-image.jpg',
      thumbnail_url: '/thumbnails/test-image.jpg',
      width: 800,
      height: 600,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
      project_id: 'test-project-id',
      segmentation_status: 'completed',
    },
    segmentation: {
      id: 'test-segmentation-id',
      image_id: 'test-image-id',
      polygons: [
        {
          id: 'test-polygon-id',
          type: 'external',
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 },
          ],
        },
      ],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-01T00:00:00Z',
    },
    error: {
      message: 'Test error message',
      code: 'TEST_ERROR',
    },
  };

  // Helper function to set up success responses
  const mockSuccess = (method: keyof typeof mockApi, path: string, data: any) => {
    mockApi[method].mockImplementationOnce(() => Promise.resolve({ data, status: 200, statusText: 'OK' }));
  };

  // Helper function to set up error responses
  const mockError = (method: keyof typeof mockApi, path: string, status = 400, data = mockResponses.error) => {
    mockApi[method].mockImplementationOnce(() =>
      Promise.reject({
        response: {
          data,
          status,
          statusText: 'Error',
        },
      }),
    );
  };

  // Helper to set up auth-related mocks
  const mockAuth = () => {
    // Mock login
    mockSuccess('post', '/auth/login', mockResponses.auth);
    // Mock signup
    mockSuccess('post', '/auth/signup', mockResponses.auth);
    // Mock user profile
    mockSuccess('get', '/users/me', mockResponses.user);
    // Mock user profile update
    mockSuccess('put', '/users/me', mockResponses.user);
  };

  // Helper to set up project-related mocks
  const mockProjects = () => {
    // Mock project list
    mockSuccess('get', '/projects', mockResponses.projects);
    // Mock single project
    mockSuccess('get', '/projects/:id', mockResponses.project);
    // Mock project creation
    mockSuccess('post', '/projects', mockResponses.project);
    // Mock project update
    mockSuccess('put', '/projects/:id', mockResponses.project);
    // Mock project deletion
    mockSuccess('delete', '/projects/:id', { success: true });
  };

  // Helper to set up image-related mocks
  const mockImages = () => {
    // Mock image list
    mockSuccess('get', '/projects/:id/images', [mockResponses.image]);
    // Mock single image
    mockSuccess('get', '/images/:id', mockResponses.image);
    // Mock image upload
    mockSuccess('post', '/projects/:id/images', mockResponses.image);
    // Mock image deletion
    mockSuccess('delete', '/images/:id', { success: true });
  };

  // Helper to set up segmentation-related mocks
  const mockSegmentation = () => {
    // Mock segmentation result
    mockSuccess('get', '/images/:id/segmentation', mockResponses.segmentation);
    // Mock segmentation update
    mockSuccess('put', '/images/:id/segmentation', mockResponses.segmentation);
    // Mock segmentation request
    mockSuccess('post', '/images/:id/segmentation', {
      status: 'pending',
      message: 'Segmentation request submitted',
    });
  };

  // Helper to mock all common endpoints
  const mockAll = () => {
    mockAuth();
    mockProjects();
    mockImages();
    mockSegmentation();
  };

  return {
    mockApi,
    mockResponses,
    mockSuccess,
    mockError,
    mockAuth,
    mockProjects,
    mockImages,
    mockSegmentation,
    mockAll,
  };
};

/**
 * Sets up a mock for the API client in Vitest
 * This needs to be called BEFORE any component that uses the API client is rendered
 */
export const setupApiClientMock = () => {
  const { mockApi, mockAll } = createApiClientMock();

  // Mock the API client module
  vi.mock('@/services/api/client', () => ({
    default: mockApi,
    apiClient: mockApi,
  }));

  // Setup default mocks for common endpoints
  mockAll();

  return mockApi;
};

/**
 * Utility to create a mock Blob for testing file downloads
 */
export const createMockBlob = (data: string | object, type = 'application/json') => {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  return new Blob([content], { type });
};

/**
 * Setup mock for file upload responses
 */
export const mockFileUpload = (api: unknown, response: unknown) => {
  // Mock the form data append
  const formDataAppendMock = vi.fn();

  // Mock FormData
  global.FormData = vi.fn().mockImplementation(() => ({
    append: formDataAppendMock,
    get: vi.fn(),
    getAll: vi.fn(),
    has: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    forEach: vi.fn(),
    entries: vi.fn(),
    keys: vi.fn(),
    values: vi.fn(),
  }));

  // Mock the post response for file upload
  api.post.mockResolvedValueOnce({ data: response });

  return formDataAppendMock;
};
