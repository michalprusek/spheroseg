import React from 'react';
import { vi } from 'vitest';

interface MockResponse {
  data?: any;
  error?: Error;
  status?: number;
  delay?: number;
  progressEvents?: Array<{ loaded: number; total: number }>;
}

interface MockResponses {
  [key: string]: MockResponse;
}

interface MockApiClientProviderProps {
  children: React.ReactNode;
  mockResponses?: MockResponses;
  timeoutMs?: number;
}

// Create mock API client that properly handles the expected responses
const createMockApiClient = (mockResponses: MockResponses, timeoutMs?: number) => {
  const findResponse = (url: string, method: string) => {
    // Try to find exact match first
    for (const [key, response] of Object.entries(mockResponses)) {
      if (url.includes(key)) {
        return response;
      }
    }
    
    // Try method-based keys
    const methodKey = method.toLowerCase() + url.replace(/[^a-zA-Z]/g, '');
    return mockResponses[methodKey] || mockResponses[method.toLowerCase()] || null;
  };

  const handleResponse = async (url: string, method: string, options?: any) => {
    const response = findResponse(url, method);
    
    if (!response) {
      // Default successful response
      return Promise.resolve({ data: {}, status: 200 });
    }
    
    // Handle delay/timeout
    if (response.delay) {
      if (timeoutMs && response.delay > timeoutMs) {
        return Promise.reject(new Error('Request timed out'));
      }
      await new Promise(resolve => setTimeout(resolve, response.delay));
    }
    
    // Handle error responses
    if (response.error) {
      return Promise.reject(response.error);
    }
    
    // Handle progress events for uploads
    if (options?.onUploadProgress && response.progressEvents) {
      for (const event of response.progressEvents) {
        await new Promise(resolve => setTimeout(resolve, 50));
        options.onUploadProgress(event);
      }
    }
    
    // Return successful response
    return Promise.resolve({
      data: response.data || {},
      status: response.status || 200,
    });
  };

  return {
    get: vi.fn((url: string) => handleResponse(url, 'get')),
    post: vi.fn((url: string, _data: any, options?: any) => handleResponse(url, 'post', options)),
    put: vi.fn((url: string, _data: any, options?: any) => handleResponse(url, 'put', options)),
    patch: vi.fn((url: string, _data: any, options?: any) => handleResponse(url, 'patch', options)),
    delete: vi.fn((url: string, options?: any) => handleResponse(url, 'delete', options)),
  };
};

// Mock the apiClient module at the module level
let mockApiClient = createMockApiClient({});

vi.mock('@/lib/apiClient', () => ({
  default: mockApiClient,
}));

// Mock API client provider component
export const MockApiClientProvider: React.FC<MockApiClientProviderProps> = ({
  children,
  mockResponses = {},
  timeoutMs,
}) => {
  // Update the mock client with new responses
  React.useEffect(() => {
    mockApiClient = createMockApiClient(mockResponses, timeoutMs);
    // Update the mock
    vi.mocked(mockApiClient);
  }, [mockResponses, timeoutMs]);

  return <>{children}</>;
};

// Helper to extract operation key from URL
export function getOperationKeyFromUrl(url: string, method: string): string {
  // Handle specific patterns
  if (url.includes('/projects') && method === 'GET' && !url.includes('/images')) {
    return 'getProjects';
  }
  if (url.match(/\/projects\/[^/]+$/) && method === 'GET') {
    return 'getProjectDetails';
  }
  if (url.includes('/projects') && method === 'POST') {
    return 'createProject';
  }
  if (url.match(/\/projects\/[^/]+$/) && method === 'PUT') {
    return 'updateProject';
  }
  if (url.match(/\/projects\/[^/]+$/) && method === 'DELETE') {
    return 'deleteProject';
  }
  if (url.match(/\/projects\/[^/]+\/images$/) && method === 'GET') {
    return 'getProjectImages';
  }
  if (url.match(/\/projects\/[^/]+\/images$/) && method === 'POST') {
    return 'uploadImage';
  }
  if (url.match(/\/projects\/[^/]+\/images\/[^/]+$/) && method === 'GET') {
    return 'getImageDetails';
  }
  if (url.match(/\/projects\/[^/]+\/images\/[^/]+$/) && method === 'DELETE') {
    return 'deleteImage';
  }
  if (url.match(/\/projects\/[^/]+\/images\/[^/]+$/) && method === 'PATCH') {
    return 'updateImageStatus';
  }
  if (url.includes('/export') && method === 'POST') {
    return 'startExport';
  }
  if (url.includes('/export/download')) {
    return 'getExportDownloadUrl';
  }
  if (url.includes('/export/jobs')) {
    return 'getExportJob';
  }
  
  return '';
}