import { vi } from 'vitest';

const mockApiClient = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
};

// Reset all mocks
export const resetApiClientMocks = () => {
  Object.values(mockApiClient).forEach(mock => mock.mockReset());
};

// Setup default mock responses
export const setupDefaultMocks = () => {
  mockApiClient.get.mockResolvedValue({ data: {}, status: 200 });
  mockApiClient.post.mockResolvedValue({ data: {}, status: 200 });
  mockApiClient.put.mockResolvedValue({ data: {}, status: 200 });
  mockApiClient.patch.mockResolvedValue({ data: {}, status: 200 });
  mockApiClient.delete.mockResolvedValue({ data: {}, status: 200 });
};

export default mockApiClient;