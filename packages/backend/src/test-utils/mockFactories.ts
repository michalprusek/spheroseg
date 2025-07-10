/**
 * Mock factories for common test dependencies
 */
import { Pool, PoolClient, QueryResult } from 'pg';
import { Request, Response } from 'express';
import { Socket } from 'socket.io';

/**
 * Create a mock database pool
 */
export const createMockPool = (): jest.Mocked<Pool> => {
  const mockClient = createMockPoolClient();

  return {
    query: jest.fn(),
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    totalCount: 0,
    idleCount: 0,
    waitingCount: 0,
  } as unknown as jest.Mocked<Pool>;
};

/**
 * Create a mock pool client
 */
export const createMockPoolClient = (): jest.Mocked<PoolClient> => {
  return {
    query: jest.fn(),
    release: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
    off: jest.fn(),
    emit: jest.fn(),
    addListener: jest.fn(),
    once: jest.fn(),
    prependListener: jest.fn(),
    prependOnceListener: jest.fn(),
    eventNames: jest.fn(),
    listeners: jest.fn(),
    listenerCount: jest.fn(),
    getMaxListeners: jest.fn(),
    setMaxListeners: jest.fn(),
    rawListeners: jest.fn(),
    removeAllListeners: jest.fn(),
  } as unknown as jest.Mocked<PoolClient>;
};

/**
 * Create a mock query result
 */
export const createMockQueryResult = <T extends Record<string, any> = any>(
  rows: T[]
): QueryResult<T> => {
  return {
    rows,
    command: 'SELECT',
    rowCount: rows.length,
    oid: 0,
    fields: [],
  };
};

/**
 * Create a mock Express request
 */
export const createMockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    get: jest.fn(),
    header: jest.fn(),
    ...overrides,
  } as Request;
};

/**
 * Create a mock Express response
 */
export const createMockResponse = (): Response => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.end = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.header = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  return res;
};

/**
 * Create a mock Socket.IO socket
 */
export const createMockSocket = (): jest.Mocked<Socket> => {
  return {
    id: 'mock-socket-id',
    emit: jest.fn(),
    on: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn().mockReturnThis(),
    broadcast: {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    },
  } as unknown as jest.Mocked<Socket>;
};

/**
 * Create a mock segmentation queue service response
 */
export const createMockQueueStatus = () => {
  return {
    pendingTasks: [],
    runningTasks: [],
    queueLength: 0,
    activeTasksCount: 0,
    mlServiceStatus: 'online' as const,
    timestamp: new Date().toISOString(),
    processingImages: [],
  };
};

/**
 * Create a mock Sharp instance
 */
export const createMockSharpInstance = () => {
  const mockInstance = {
    metadata: jest.fn().mockResolvedValue({ width: 100, height: 100, format: 'jpeg' }),
    resize: jest.fn().mockReturnThis(),
    toFile: jest.fn().mockResolvedValue({}),
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock image data')),
    jpeg: jest.fn().mockReturnThis(),
    png: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    rotate: jest.fn().mockReturnThis(),
    flip: jest.fn().mockReturnThis(),
    flop: jest.fn().mockReturnThis(),
    sharpen: jest.fn().mockReturnThis(),
    blur: jest.fn().mockReturnThis(),
    extend: jest.fn().mockReturnThis(),
    extract: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
  };
  return mockInstance;
};

/**
 * Create a mock Sharp module
 */
export const createMockSharp = () => {
  const mockSharpInstance = createMockSharpInstance();
  const mockSharp = jest.fn(() => mockSharpInstance);

  // Add static methods
  Object.assign(mockSharp, {
    format: {
      jpeg: { id: 'jpeg' },
      png: { id: 'png' },
      webp: { id: 'webp' },
      tiff: { id: 'tiff' },
      bmp: { id: 'bmp' },
    },
    versions: {
      vips: '8.11.3',
      sharp: '0.29.3',
    },
  });

  return mockSharp;
};

/**
 * Helper to mock async function with proper typing
 */
export function mockAsync<T>(value: T): jest.Mock<Promise<T>> {
  return jest.fn().mockResolvedValue(value);
}

/**
 * Helper to create typed mock
 */
export function createTypedMock<T>(partial: Partial<T> = {}): jest.Mocked<T> {
  return partial as jest.Mocked<T>;
}
