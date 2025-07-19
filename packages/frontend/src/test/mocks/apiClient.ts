import { vi } from 'vitest';

export const mockApiClient = {
  get: vi.fn().mockResolvedValue({ data: {} }),
  post: vi.fn().mockResolvedValue({ data: {} }),
  put: vi.fn().mockResolvedValue({ data: {} }),
  patch: vi.fn().mockResolvedValue({ data: {} }),
  delete: vi.fn().mockResolvedValue({ data: {} }),
  request: vi.fn().mockResolvedValue({ data: {} }),
  withRetry: vi.fn((fn) => fn()),
  upload: vi.fn().mockResolvedValue({ data: {} }),
  download: vi.fn().mockResolvedValue(new Blob()),
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
  cancelAllRequests: vi.fn(),
  getBaseURL: vi.fn(() => 'http://localhost:5001'),
};

// Setup module mock
vi.mock('@/lib/apiClient', () => ({
  default: mockApiClient,
  apiClient: mockApiClient,
}));

vi.mock('@/services/api/client', () => ({
  default: mockApiClient,
  apiClient: mockApiClient,
  ApiClient: vi.fn(() => mockApiClient),
}));