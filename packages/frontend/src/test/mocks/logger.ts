import { vi } from 'vitest';

export const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
  setLevel: vi.fn(),
  getLevel: vi.fn(() => 'info'),
  child: vi.fn(() => mockLogger),
};

export const createLogger = vi.fn(() => mockLogger);
export const createNamespacedLogger = vi.fn(() => mockLogger);
export const getLogger = vi.fn(() => mockLogger);

// Setup module mock
vi.mock('@/utils/logger', () => ({
  createLogger,
  createNamespacedLogger,
  getLogger,
  default: mockLogger,
  logger: mockLogger,
}));

// Also mock @/lib/logger path
vi.mock('@/lib/logger', () => ({
  createLogger,
  createNamespacedLogger,
  getLogger,
  default: mockLogger,
  logger: mockLogger,
}));