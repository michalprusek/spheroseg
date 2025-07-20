/**
 * Project Creation Tests
 *
 * Tests for project creation functionality
 */
import { Pool } from 'pg';
import { createProject } from '../services/projectService';
import { ApiError } from '../utils/errors';

// Mock the database pool
jest.mock('pg', () => {
  const mockPool = {
    connect: jest.fn().mockReturnValue({
      query: jest.fn(),
      release: jest.fn(),
    }),
  };
  return { Pool: jest.fn(() => mockPool) };
});

// Mock the logger
jest.mock('../utils/logger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    http: jest.fn(),
    silly: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockLogger,
    createLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

// Mock the config
jest.mock('../config', () => ({
  storage: {
    uploadDir: '/tmp',
  },
}));

// Mock fs
jest.mock('fs', () => ({
  mkdirSync: jest.fn(),
}));

describe('Project Service - createProject', () => {
  let pool: Pool;
  let mockClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    pool = new Pool();
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });

  it('should create a project with a valid title', async () => {
    // Mock the database responses
    mockClient.query.mockImplementation((query: string, _params?: any[]) => {
      if (query.includes('SELECT id FROM projects WHERE user_id')) {
        // No existing project with this title
        return { rows: [] };
      } else if (query.includes('EXISTS') && query.includes('tags')) {
        return { rows: [{ exists: true }] };
      } else if (query.includes('EXISTS') && query.includes('public')) {
        return { rows: [{ exists: true }] };
      } else if (query.includes('INSERT INTO projects')) {
        // Return a mock project
        return {
          rows: [
            {
              id: 'test-project-id',
              title: 'Test Project',
              description: 'Test Description',
              user_id: 'test-user-id',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    // Call the createProject function
    const result = await createProject(pool, {
      title: 'Test Project',
      description: 'Test Description',
      userId: 'test-user-id',
    });

    // Verify the result
    expect(result).toBeDefined();
    expect(result.id).toBe('test-project-id');
    expect(result.title).toBe('Test Project');
    expect(result.description).toBe('Test Description');
    expect(result.user_id).toBe('test-user-id');
    expect(result.is_owner).toBe(true);

    // Verify that the database was called correctly
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT id FROM projects WHERE user_id = $1 AND title = $2',
      ['test-user-id', 'Test Project']
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should create a project with a short title', async () => {
    // Mock the database responses
    mockClient.query.mockImplementation((query: string, _params?: any[]) => {
      if (query.includes('SELECT id FROM projects WHERE user_id')) {
        // No existing project with this title
        return { rows: [] };
      } else if (query.includes('EXISTS') && query.includes('tags')) {
        return { rows: [{ exists: true }] };
      } else if (query.includes('EXISTS') && query.includes('public')) {
        return { rows: [{ exists: true }] };
      } else if (query.includes('INSERT INTO projects')) {
        // Return a mock project
        return {
          rows: [
            {
              id: 'test-project-id',
              title: 'test',
              description: 'Test Description',
              user_id: 'test-user-id',
              created_at: new Date(),
              updated_at: new Date(),
            },
          ],
        };
      }
      return { rows: [] };
    });

    // Call the createProject function with a short title
    const result = await createProject(pool, {
      title: 'test',
      description: 'Test Description',
      userId: 'test-user-id',
    });

    // Verify the result
    expect(result).toBeDefined();
    expect(result.id).toBe('test-project-id');
    expect(result.title).toBe('test');
    expect(result.description).toBe('Test Description');
    expect(result.user_id).toBe('test-user-id');
    expect(result.is_owner).toBe(true);
  });

  it('should throw an error if title is empty', async () => {
    // Call the createProject function with an empty title
    await expect(
      createProject(pool, {
        title: '',
        description: 'Test Description',
        userId: 'test-user-id',
      })
    ).rejects.toThrow(ApiError);
  });

  it('should throw an error if a project with the same title already exists', async () => {
    // Mock the database responses
    mockClient.query.mockImplementation((query: string, _params?: any[]) => {
      if (query.includes('SELECT id FROM projects WHERE user_id')) {
        // Existing project with this title
        return { rows: [{ id: 'existing-project-id' }] };
      }
      return { rows: [] };
    });

    // Call the createProject function
    await expect(
      createProject(pool, {
        title: 'Test Project',
        description: 'Test Description',
        userId: 'test-user-id',
      })
    ).rejects.toThrow(ApiError);
  });
});
