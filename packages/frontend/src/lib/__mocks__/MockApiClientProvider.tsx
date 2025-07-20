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

  const handleResponse = async (url: string, method: string, options?: unknown) => {
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
    post: vi.fn((url: string, _data: unknown, options?: unknown) => handleResponse(url, 'post', options)),
    put: vi.fn((url: string, _data: unknown, options?: unknown) => handleResponse(url, 'put', options)),
    patch: vi.fn((url: string, _data: unknown, options?: unknown) => handleResponse(url, 'patch', options)),
    delete: vi.fn((url: string, options?: unknown) => handleResponse(url, 'delete', options)),
  };
};

// Import the mock apiClient from test-setup
import apiClient from '@/services/api/client';

// Mock API client provider component
export const MockApiClientProvider: React.FC<MockApiClientProviderProps> = ({
  children,
  mockResponses = {},
  timeoutMs,
}) => {
  // Configure the existing mock client with the provided responses
  React.useEffect(() => {
    const findResponse = (url: string, method: string) => {
      const key = getOperationKeyFromUrl(url, method);
      console.log(`[MockApiClientProvider] URL: ${url}, Method: ${method}, Key: ${key}, Found: ${!!mockResponses[key]}`);
      return mockResponses[key] || null;
    };

    const handleResponse = async (url: string, method: string, _data?: unknown, options?: any) => {
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

    // Check if apiClient is already mocked (with proper type checking)
    const mockApiClient = apiClient as any;
    if (!mockApiClient.get?.mockImplementation) {
      console.warn('MockApiClientProvider: apiClient is not properly mocked');
      return;
    }

    // Update the mock implementations
    mockApiClient.get.mockImplementation((url: string) => handleResponse(url, 'GET'));
    mockApiClient.post.mockImplementation((url: string, data: unknown, options?: unknown) => 
      handleResponse(url, 'POST', data, options));
    mockApiClient.put.mockImplementation((url: string, data: unknown, options?: unknown) => 
      handleResponse(url, 'PUT', data, options));
    mockApiClient.patch.mockImplementation((url: string, data: unknown, options?: unknown) => 
      handleResponse(url, 'PATCH', data, options));
    mockApiClient.delete.mockImplementation((url: string, options?: unknown) => 
      handleResponse(url, 'DELETE', undefined, options));
  }, [mockResponses, timeoutMs]);

  return <>{children}</>;
};

// Helper to extract operation key from URL
export function getOperationKeyFromUrl(url: string, method: string): string {
  // Handle authentication endpoints
  if (url.includes('/auth/login') && method === 'POST') {
    return 'login';
  }
  if (url.includes('/auth/register') && method === 'POST') {
    return 'register';
  }
  if (url.includes('/auth/logout') && method === 'POST') {
    return 'logout';
  }
  if (url.includes('/auth/refresh') && method === 'POST') {
    return 'refreshToken';
  }
  if (url.includes('/auth/me') && method === 'GET') {
    return 'getCurrentUser';
  }
  if (url.includes('/user/current') && method === 'GET') {
    return 'getCurrentUser';
  }
  
  // Handle user management endpoints
  if (url.includes('/users') && method === 'GET' && !url.match(/\/users\/[^/]+$/)) {
    return 'getUsers';
  }
  if (url.match(/\/users\/[^/]+$/) && method === 'GET') {
    return 'getUser';
  }
  if (url.includes('/users') && method === 'POST') {
    return 'createUser';
  }
  if (url.match(/\/users\/[^/]+$/) && method === 'PUT') {
    return 'updateUser';
  }
  if (url.match(/\/users\/[^/]+$/) && method === 'DELETE') {
    return 'deleteUser';
  }

  // Handle project endpoints
  if (url.includes('/projects') && method === 'GET' && !url.includes('/images')) {
    return 'getProjects';
  }
  if (url.match(/\/projects\/[^/]+$/) && method === 'GET') {
    return 'getProjectDetails';
  }
  if (url.includes('/projects') && method === 'POST' && !url.includes('/images')) {
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

  // Handle export endpoints
  if (url.includes('/export/start') && method === 'POST') {
    return 'startExport';
  }
  if (url.includes('/export') && url.includes('/status') && method === 'GET') {
    return 'getExportStatus';
  }
  if (url.includes('/export') && url.includes('/cancel') && method === 'POST') {
    return 'cancelExport';
  }
  if (url.includes('/export') && url.includes('/download-url') && method === 'GET') {
    return 'getExportDownloadUrl';
  }
  if (url.includes('/export') && method === 'POST' && !url.includes('/start') && !url.includes('/cancel')) {
    return 'exportProject';
  }
  if (url.includes('/export/jobs')) {
    return 'getExportJob';
  }
  if (url.includes('/export/history') && method === 'GET') {
    return 'getProjectExportHistory';
  }
  if (url.includes('/export/formats') && method === 'GET') {
    return 'getExportFormats';
  }
  
  return '';
}