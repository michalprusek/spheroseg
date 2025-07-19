import React from 'react';
import { vi } from 'vitest';

interface MockResponse {
  data?: any;
  error?: Error;
  status?: number;
}

interface MockResponses {
  [key: string]: MockResponse;
}

interface MockApiClientProviderProps {
  children: React.ReactNode;
  mockResponses?: MockResponses;
}

// Create a mock API client context
const MockApiClientContext = React.createContext<{
  mockResponses: MockResponses;
}>({
  mockResponses: {},
});

// Mock API client provider component
export const MockApiClientProvider: React.FC<MockApiClientProviderProps> = ({
  children,
  mockResponses = {},
}) => {
  // Setup mock API client
  React.useEffect(() => {
    // Mock the apiClient module
    vi.mock('@/lib/apiClient', () => ({
      default: {
        get: vi.fn((url: string) => {
          const key = Object.keys(mockResponses).find(k => url.includes(k));
          const response = key ? mockResponses[key] : null;
          
          if (response?.error) {
            return Promise.reject(response.error);
          }
          
          return Promise.resolve({
            data: response?.data || {},
            status: response?.status || 200,
          });
        }),
        post: vi.fn((url: string, data: unknown) => {
          const key = Object.keys(mockResponses).find(k => url.includes(k));
          const response = key ? mockResponses[key] : mockResponses[getOperationFromUrl(url)];
          
          if (response?.error) {
            return Promise.reject(response.error);
          }
          
          return Promise.resolve({
            data: response?.data || {},
            status: response?.status || 200,
          });
        }),
        put: vi.fn((url: string, data: unknown) => {
          const key = Object.keys(mockResponses).find(k => url.includes(k));
          const response = key ? mockResponses[key] : null;
          
          if (response?.error) {
            return Promise.reject(response.error);
          }
          
          return Promise.resolve({
            data: response?.data || {},
            status: response?.status || 200,
          });
        }),
        delete: vi.fn((url: string) => {
          const key = Object.keys(mockResponses).find(k => url.includes(k));
          const response = key ? mockResponses[key] : null;
          
          if (response?.error) {
            return Promise.reject(response.error);
          }
          
          return Promise.resolve({
            data: response?.data || {},
            status: response?.status || 200,
          });
        }),
      },
    }));
  }, [mockResponses]);

  return (
    <MockApiClientContext.Provider value={{ mockResponses }}>
      {children}
    </MockApiClientContext.Provider>
  );
};

// Helper function to extract operation from URL
function getOperationFromUrl(url: string): string {
  // Extract operation from URL patterns like /api/projects/:id/export
  if (url.includes('/export')) return 'startExport';
  if (url.includes('/download')) return 'getExportDownloadUrl';
  if (url.includes('/jobs')) return 'getExportJob';
  return '';
}

// Export mock client for direct usage in tests
export const createMockApiClient = (mockResponses: MockResponses = {}) => {
  return {
    get: vi.fn((url: string) => {
      const key = Object.keys(mockResponses).find(k => url.includes(k));
      const response = key ? mockResponses[key] : null;
      
      if (response?.error) {
        return Promise.reject(response.error);
      }
      
      return Promise.resolve({
        data: response?.data || {},
        status: response?.status || 200,
      });
    }),
    post: vi.fn((url: string, data: unknown) => {
      const key = Object.keys(mockResponses).find(k => url.includes(k));
      const response = key ? mockResponses[key] : mockResponses[getOperationFromUrl(url)];
      
      if (response?.error) {
        return Promise.reject(response.error);
      }
      
      return Promise.resolve({
        data: response?.data || {},
        status: response?.status || 200,
      });
    }),
    put: vi.fn((url: string, data: unknown) => {
      const key = Object.keys(mockResponses).find(k => url.includes(k));
      const response = key ? mockResponses[key] : null;
      
      if (response?.error) {
        return Promise.reject(response.error);
      }
      
      return Promise.resolve({
        data: response?.data || {},
        status: response?.status || 200,
      });
    }),
    delete: vi.fn((url: string) => {
      const key = Object.keys(mockResponses).find(k => url.includes(k));
      const response = key ? mockResponses[key] : null;
      
      if (response?.error) {
        return Promise.reject(response.error);
      }
      
      return Promise.resolve({
        data: response?.data || {},
        status: response?.status || 200,
      });
    }),
  };
};