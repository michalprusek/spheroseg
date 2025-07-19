import { vi } from 'vitest';

export const mockConfig = {
  api: {
    baseUrl: 'http://localhost:5001',
    timeout: 30000,
  },
  auth: {
    tokenKey: 'authToken',
    refreshTokenKey: 'refreshToken',
  },
  app: {
    name: 'SpherosegV4',
    version: '1.0.0',
  },
  features: {
    enableWebSocket: true,
    enablePerformanceMonitoring: false,
  },
};

export const getConfig = vi.fn(() => mockConfig);

// Setup module mock
vi.mock('@/config/app.config', () => ({
  getConfig,
  config: mockConfig,
  default: mockConfig,
}));