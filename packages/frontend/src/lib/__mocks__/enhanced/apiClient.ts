import { vi } from 'vitest';
import { AxiosResponse, AxiosError } from 'axios';

// Type definitions for better mock typing
type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';
type MockEndpoint = {
  url: string | RegExp;
  method: HttpMethod;
  response: any;
  status?: number;
  delay?: number;
};

type MockConfig = {
  endpoints: MockEndpoint[];
  fallbackHandler?: (url: string, method: HttpMethod, data?: any) => Promise<any>;
  defaultErrorStatus?: number;
  defaultDelay?: number;
  throwNetworkErrorProbability?: number;
};

// Default mock configuration
const defaultConfig: MockConfig = {
  endpoints: [],
  defaultErrorStatus: 404,
  defaultDelay: 0, // No delay by default
  throwNetworkErrorProbability: 0, // No random network errors by default
};

// Current mock configuration
let mockConfig: MockConfig = { ...defaultConfig };

// Create mock functions for all HTTP methods
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

// Function to match URL patterns (supports regex and string)
const matchUrl = (pattern: string | RegExp, url: string): boolean => {
  if (pattern instanceof RegExp) {
    return pattern.test(url);
  }
  return pattern === url;
};

// Helper to create a mock response
const createMockResponse = (data: any, status = 200): AxiosResponse => {
  return {
    data,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {},
    config: {} as any,
  };
};

// Helper to create a mock error
const createMockError = (status: number, message: string): AxiosError => {
  const error = new Error(message) as AxiosError;
  error.isAxiosError = true;
  error.response = {
    data: { message },
    status,
    statusText: 'Error',
    headers: {},
    config: {} as any,
  };
  return error;
};

// Helper to simulate network delay
const simulateDelay = async (ms: number): Promise<void> => {
  if (ms <= 0) return;
  return new Promise((resolve) => setTimeout(resolve, ms));
};

// Helper to simulate random network errors
const maybeThrowNetworkError = (): void => {
  if (mockConfig.throwNetworkErrorProbability && Math.random() < mockConfig.throwNetworkErrorProbability) {
    const networkError = new Error('Network Error') as AxiosError;
    networkError.isAxiosError = true;
    networkError.code = 'ECONNABORTED';
    throw networkError;
  }
};

// Handler function for all HTTP methods
const handleRequest = async (url: string, method: HttpMethod, data?: any): Promise<AxiosResponse> => {
  console.log(`[MockApiClient] ${method.toUpperCase()} ${url}`, data);

  // Maybe throw random network error
  maybeThrowNetworkError();

  // Find a matching endpoint
  const endpoint = mockConfig.endpoints.find((e) => e.method === method && matchUrl(e.url, url));

  if (endpoint) {
    // Simulate network delay
    const delay = endpoint.delay ?? mockConfig.defaultDelay ?? 0;
    await simulateDelay(delay);

    // Return error if status is error code
    if (endpoint.status && endpoint.status >= 400) {
      throw createMockError(
        endpoint.status,
        typeof endpoint.response === 'string' ? endpoint.response : JSON.stringify(endpoint.response),
      );
    }

    // Return successful response
    return createMockResponse(endpoint.response, endpoint.status);
  }

  // Use fallback handler if provided
  if (mockConfig.fallbackHandler) {
    return mockConfig.fallbackHandler(url, method, data);
  }

  // Default: return 404 Not Found
  throw createMockError(mockConfig.defaultErrorStatus || 404, `Endpoint not found: ${method.toUpperCase()} ${url}`);
};

// Implement mock functions for all HTTP methods
mockGet.mockImplementation((url: string) => handleRequest(url, 'get'));
mockPost.mockImplementation((url: string, data: any) => handleRequest(url, 'post', data));
mockPut.mockImplementation((url: string, data: any) => handleRequest(url, 'put', data));
mockPatch.mockImplementation((url: string, data: any) => handleRequest(url, 'patch', data));
mockDelete.mockImplementation((url: string) => handleRequest(url, 'delete'));

// Configuration functions
const configureMock = (config: Partial<MockConfig>) => {
  mockConfig = {
    ...defaultConfig,
    ...config,
    endpoints: [...(config.endpoints || [])],
  };
};

const addMockEndpoint = (endpoint: MockEndpoint) => {
  // Replace existing endpoint if URL and method match
  const existingIndex = mockConfig.endpoints.findIndex(
    (e) => e.method === endpoint.method && String(e.url) === String(endpoint.url),
  );

  if (existingIndex >= 0) {
    mockConfig.endpoints[existingIndex] = endpoint;
  } else {
    mockConfig.endpoints.push(endpoint);
  }
};

const addMockEndpoints = (endpoints: MockEndpoint[]) => {
  endpoints.forEach((endpoint) => addMockEndpoint(endpoint));
};

const removeMockEndpoint = (url: string | RegExp, method: HttpMethod) => {
  mockConfig.endpoints = mockConfig.endpoints.filter((e) => !(e.method === method && String(e.url) === String(url)));
};

const resetMocks = () => {
  mockConfig = { ...defaultConfig };
  mockGet.mockClear();
  mockPost.mockClear();
  mockPut.mockClear();
  mockPatch.mockClear();
  mockDelete.mockClear();
};

// Standard mock data for common endpoints
const mockProjects = [
  {
    id: 'project-1',
    name: 'Test Project 1',
    description: 'A test project',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    image_count: 5,
    owner_id: 'user-1',
  },
  {
    id: 'project-2',
    name: 'Test Project 2',
    description: 'Another test project',
    created_at: '2023-02-01T00:00:00Z',
    updated_at: '2023-02-02T00:00:00Z',
    image_count: 3,
    owner_id: 'user-1',
  },
];

const mockImages = [
  {
    id: 'image-1',
    name: 'test-image-1.jpg',
    url: 'https://example.com/test-image-1.jpg',
    thumbnail_url: 'https://example.com/test-image-1-thumb.jpg',
    width: 800,
    height: 600,
    project_id: 'project-1',
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z',
    has_segmentation: true,
  },
  {
    id: 'image-2',
    name: 'test-image-2.jpg',
    url: 'https://example.com/test-image-2.jpg',
    thumbnail_url: 'https://example.com/test-image-2-thumb.jpg',
    width: 1024,
    height: 768,
    project_id: 'project-1',
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-04T00:00:00Z',
    has_segmentation: false,
  },
];

const mockSegmentation = {
  id: 'segmentation-1',
  image_id: 'image-1',
  polygons: [
    {
      id: 'polygon-1',
      points: [
        { x: 100, y: 100 },
        { x: 200, y: 100 },
        { x: 200, y: 200 },
        { x: 100, y: 200 },
      ],
      type: 'external',
      color: '#FF0000',
      label: 'Cell 1',
    },
    {
      id: 'polygon-2',
      points: [
        { x: 300, y: 300 },
        { x: 400, y: 300 },
        { x: 400, y: 400 },
        { x: 300, y: 400 },
      ],
      type: 'external',
      color: '#00FF00',
      label: 'Cell 2',
    },
  ],
  width: 800,
  height: 600,
  created_at: '2023-01-02T00:00:00Z',
  updated_at: '2023-01-02T00:00:00Z',
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  created_at: '2023-01-01T00:00:00Z',
};

// Function to set up standard mock data for common endpoints
const setupStandardMocks = () => {
  resetMocks();

  addMockEndpoints([
    // Auth endpoints
    {
      url: '/auth/me',
      method: 'get',
      response: mockUser,
    },
    {
      url: '/auth/login',
      method: 'post',
      response: { token: 'mock-token', user: mockUser },
    },
    {
      url: '/auth/register',
      method: 'post',
      response: { message: 'User registered successfully' },
    },
    {
      url: '/auth/logout',
      method: 'post',
      response: { message: 'Logged out successfully' },
    },

    // Projects endpoints
    {
      url: '/projects',
      method: 'get',
      response: mockProjects,
    },
    {
      url: /\/projects\/project-[12]/,
      method: 'get',
      response: mockProjects[0],
    },
    {
      url: '/projects',
      method: 'post',
      response: mockProjects[0],
    },

    // Images endpoints
    {
      url: /\/projects\/project-[12]\/images/,
      method: 'get',
      response: mockImages,
    },
    {
      url: /\/images\/image-[12]/,
      method: 'get',
      response: mockImages[0],
    },

    // Segmentation endpoints
    {
      url: /\/images\/image-[12]\/segmentation/,
      method: 'get',
      response: mockSegmentation,
    },
    {
      url: /\/images\/image-[12]\/segmentation/,
      method: 'put',
      response: { message: 'Segmentation updated successfully' },
    },

    // User endpoints
    {
      url: '/users/me',
      method: 'get',
      response: mockUser,
    },
  ]);
};

// Create API client mock with configuration methods
const apiClient = {
  get: mockGet,
  post: mockPost,
  put: mockPut,
  patch: mockPatch,
  delete: mockDelete,
  // Configuration methods
  configureMock,
  addMockEndpoint,
  addMockEndpoints,
  removeMockEndpoint,
  resetMocks,
  setupStandardMocks,
  // Export mock data for reuse
  mockData: {
    projects: mockProjects,
    images: mockImages,
    segmentation: mockSegmentation,
    user: mockUser,
  },
};

// Initialize with standard mocks
setupStandardMocks();

// React component for providing mock API client in tests
import React from 'react';

export const MockApiClientProvider: React.FC<{
  children: React.ReactNode;
  mockResponses?: Record<string, any>;
}> = ({ children, mockResponses = {} }) => {
  // Configure mock responses if provided
  React.useEffect(() => {
    if (mockResponses) {
      const endpoints: Array<{
        url: string | RegExp;
        method: 'get' | 'post' | 'put' | 'patch' | 'delete';
        response: any;
        status?: number;
      }> = [];
      
      // Convert mockResponses to endpoints
      Object.entries(mockResponses).forEach(([key, response]) => {
        if (key === 'login') {
          endpoints.push({
            url: '/auth/login',
            method: 'post',
            response: response.data,
            status: response.status || 200,
          });
        } else if (key === 'register') {
          endpoints.push({
            url: '/auth/register',
            method: 'post',
            response: response.data,
            status: response.status || 200,
          });
        } else if (key === 'logout') {
          endpoints.push({
            url: '/auth/logout',
            method: 'post',
            response: response.data || {},
            status: response.status || 200,
          });
        }
        // Add more endpoint mappings as needed
      });
      
      if (endpoints.length > 0) {
        addMockEndpoints(endpoints);
      }
    }
    
    return () => {
      resetMocks();
      setupStandardMocks();
    };
  }, [mockResponses]);
  
  return <>{children}</>;
};

export default apiClient;
