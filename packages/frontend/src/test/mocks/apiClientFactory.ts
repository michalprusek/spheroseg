/**
 * API Client Mock Factory
 * 
 * Creates type-safe mocks for API services that match the actual
 * service interfaces.
 */

import { vi } from 'vitest';

// Common API response types
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

// Factory function to create API client mock
export function createApiClientMock() {
  const mockResponses = new Map<string, any>();
  
  const apiMock = {
    get: vi.fn((url: string) => {
      const response = mockResponses.get(`GET:${url}`);
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve({ data: response || {} });
    }),
    
    post: vi.fn((url: string, data?: any) => {
      const response = mockResponses.get(`POST:${url}`);
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve({ data: response || { id: '1', ...data } });
    }),
    
    put: vi.fn((url: string, data?: any) => {
      const response = mockResponses.get(`PUT:${url}`);
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve({ data: response || { ...data, updated: true } });
    }),
    
    patch: vi.fn((url: string, data?: any) => {
      const response = mockResponses.get(`PATCH:${url}`);
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve({ data: response || { ...data, updated: true } });
    }),
    
    delete: vi.fn((url: string) => {
      const response = mockResponses.get(`DELETE:${url}`);
      if (response instanceof Error) {
        return Promise.reject(response);
      }
      return Promise.resolve({ data: response || { success: true } });
    }),
    
    // Helper methods for tests
    __setMockResponse: (method: string, url: string, response: any) => {
      mockResponses.set(`${method}:${url}`, response);
    },
    
    __setMockError: (method: string, url: string, error: Error | ApiError) => {
      mockResponses.set(`${method}:${url}`, error);
    },
    
    __clearMocks: () => {
      mockResponses.clear();
      apiMock.get.mockClear();
      apiMock.post.mockClear();
      apiMock.put.mockClear();
      apiMock.patch.mockClear();
      apiMock.delete.mockClear();
    },
  };
  
  return apiMock;
}

// Pre-configured mock responses for common endpoints
export const commonMockResponses = {
  // Auth endpoints
  signIn: {
    user: { id: '1', email: 'test@example.com', username: 'testuser' },
    token: 'mock-jwt-token',
  },
  
  // User profile
  userProfile: {
    id: '1',
    user_id: '1',
    username: 'testuser',
    full_name: 'Test User',
    email: 'test@example.com',
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  
  // Projects
  projects: [
    {
      id: '1',
      name: 'Test Project',
      description: 'Test project description',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  
  // Images
  images: [
    {
      id: '1',
      project_id: '1',
      name: 'test-image.jpg',
      storage_path: '/uploads/test-image.jpg',
      thumbnail_path: '/uploads/thumb-test-image.jpg',
      width: 1920,
      height: 1080,
      segmentation_status: 'completed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  
  // Segmentation results
  segmentationResults: {
    id: '1',
    image_id: '1',
    status: 'completed',
    result_path: '/results/1.json',
    cell_count: 42,
    processing_time: 2.5,
    created_at: new Date().toISOString(),
  },
};

// Service-specific mock factories
export function createAuthServiceMock() {
  return {
    signIn: vi.fn().mockResolvedValue(commonMockResponses.signIn),
    signUp: vi.fn().mockResolvedValue(commonMockResponses.signIn),
    signOut: vi.fn().mockResolvedValue(undefined),
    getCurrentUser: vi.fn().mockResolvedValue(commonMockResponses.signIn.user),
    resetPassword: vi.fn().mockResolvedValue({ message: 'Email sent' }),
    updatePassword: vi.fn().mockResolvedValue({ message: 'Password updated' }),
  };
}

export function createProjectServiceMock() {
  return {
    getProjects: vi.fn().mockResolvedValue(commonMockResponses.projects),
    getProject: vi.fn().mockResolvedValue(commonMockResponses.projects[0]),
    createProject: vi.fn().mockResolvedValue(commonMockResponses.projects[0]),
    updateProject: vi.fn().mockResolvedValue(commonMockResponses.projects[0]),
    deleteProject: vi.fn().mockResolvedValue({ success: true }),
    duplicateProject: vi.fn().mockResolvedValue(commonMockResponses.projects[0]),
  };
}

export function createImageServiceMock() {
  return {
    getImages: vi.fn().mockResolvedValue(commonMockResponses.images),
    getImage: vi.fn().mockResolvedValue(commonMockResponses.images[0]),
    uploadImages: vi.fn().mockResolvedValue(commonMockResponses.images),
    deleteImage: vi.fn().mockResolvedValue({ success: true }),
    batchDeleteImages: vi.fn().mockResolvedValue({ success: true, deleted: 1 }),
    updateImageStatus: vi.fn().mockResolvedValue(commonMockResponses.images[0]),
  };
}

export function createSegmentationServiceMock() {
  return {
    startSegmentation: vi.fn().mockResolvedValue({ taskId: 'task-1' }),
    getSegmentationStatus: vi.fn().mockResolvedValue(commonMockResponses.segmentationResults),
    getSegmentationResults: vi.fn().mockResolvedValue(commonMockResponses.segmentationResults),
    retrySegmentation: vi.fn().mockResolvedValue({ taskId: 'task-2' }),
  };
}

// Export everything
export default {
  createApiClientMock,
  commonMockResponses,
  createAuthServiceMock,
  createProjectServiceMock,
  createImageServiceMock,
  createSegmentationServiceMock,
};