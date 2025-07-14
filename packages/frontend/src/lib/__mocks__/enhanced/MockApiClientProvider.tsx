import React, { ReactNode } from 'react';
import { vi } from 'vitest';

interface MockApiClientProviderProps {
  children: ReactNode;
  mockResponses?: Record<string, any>;
}

export const MockApiClientProvider: React.FC<MockApiClientProviderProps> = ({ 
  children, 
  mockResponses = {} 
}) => {
  // Mock the API client context
  React.useEffect(() => {
    // Setup mock responses
    Object.entries(mockResponses).forEach(([endpoint, response]) => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        status: response.status || 200,
        json: () => Promise.resolve(response.data || response),
      } as Response);
    });
  }, [mockResponses]);

  return <>{children}</>;
};