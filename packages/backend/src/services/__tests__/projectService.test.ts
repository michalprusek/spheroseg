/**
 * Tests for the Project Service
 */
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import projectService from '../projectService';
import config from '../../config';
import { ApiError } from '../../utils/errors';

// Mock the database pool
jest.mock('pg', () => {
  const mPool = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
    on: jest.fn(),
  };
  return { Pool: jest.fn(() => mPool) };
});

// Mock the file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  rmSync: jest.fn(),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('Project Service', () => {
  let pool: jest.Mocked<Pool>;
  let mockClient: any;
  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';
  
  beforeEach(() => {
    jest.resetAllMocks();
    
    pool = new Pool() as jest.Mocked<Pool>;
    
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
      connect: jest.fn(),
    };
    
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
  });
  
  describe('createProject', () => {
    it('should create a new project in the database and create project directories', async () => {
      // Mock client transaction methods
      mockClient.query.mockImplementation((query, params) => {
        if (query === 'BEGIN' || query === 'COMMIT') {
          return Promise.resolve();
        }
        
        if (query.includes('SELECT id FROM projects WHERE user_id = $1 AND title = $2')) {
          return Promise.resolve({ rows: [] }); // No duplicate project
        }
        
        if (query.includes('INSERT INTO projects')) {
          return Promise.resolve({
            rows: [{
              id: mockProjectId,
              title: 'Test Project',
              description: 'A test project',
              user_id: mockUserId,
              created_at: new Date(),
              updated_at: new Date(),
            }]
          });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Mock fs operations
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
      
      const result = await projectService.createProject(pool, {
        title: 'Test Project',
        description: 'A test project',
        userId: mockUserId,
      });
      
      // Check that transaction was started and committed
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      
      // Check that the project was created in the database
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        [mockUserId, 'Test Project', 'A test project']
      );
      
      // Check that project directories were created
      expect(fs.mkdirSync).toHaveBeenCalledTimes(5);
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(mockProjectId),
        { recursive: true }
      );
      
      // Check that the result includes the project data with is_owner flag
      expect(result).toEqual(expect.objectContaining({
        id: mockProjectId,
        title: 'Test Project',
        description: 'A test project',
        user_id: mockUserId,
        is_owner: true,
      }));
      
      // Check that client was released
      expect(mockClient.release).toHaveBeenCalled();
    });
    
    it('should throw an ApiError if a project with the same title already exists', async () => {
      // Mock duplicate project check
      mockClient.query.mockImplementation((query) => {
        if (query.includes('SELECT id FROM projects WHERE user_id = $1 AND title = $2')) {
          return Promise.resolve({ 
            rows: [{ id: 'existing-project' }] 
          });
        }
        return Promise.resolve({ rows: [] });
      });
      
      // Expect the service to throw an ApiError
      await expect(projectService.createProject(pool, {
        title: 'Existing Project',
        description: 'This title already exists',
        userId: mockUserId,
      })).rejects.toThrow(ApiError);
      
      // Transaction should be rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      
      // Client should be released
      expect(mockClient.release).toHaveBeenCalled();
    });
    
    it('should rollback transaction if directory creation fails', async () => {
      // Mock successful database queries
      mockClient.query.mockImplementation((query) => {
        if (query.includes('SELECT id FROM projects WHERE user_id = $1 AND title = $2')) {
          return Promise.resolve({ rows: [] }); // No duplicate
        }
        
        if (query.includes('INSERT INTO projects')) {
          return Promise.resolve({
            rows: [{
              id: mockProjectId,
              title: 'Test Project',
              description: 'A test project',
              user_id: mockUserId,
              created_at: new Date(),
              updated_at: new Date(),
            }]
          });
        }
        
        return Promise.resolve();
      });
      
      // Mock fs operations to fail
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Directory creation failed');
      });
      
      // Expect the service to throw an ApiError
      await expect(projectService.createProject(pool, {
        title: 'Test Project',
        description: 'A test project',
        userId: mockUserId,
      })).rejects.toThrow(ApiError);
      
      // Transaction should be rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      
      // Client should be released
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
  
  describe('getProjectById', () => {
    it('should return a project owned by the user', async () => {
      // Mock owned project query
      (pool.query as jest.Mock).mockImplementation((query) => {
        if (query.includes('SELECT * FROM projects WHERE id = $1 AND user_id = $2')) {
          return Promise.resolve({
            rows: [{
              id: mockProjectId,
              title: 'Test Project',
              description: 'A test project',
              user_id: mockUserId,
              created_at: new Date(),
              updated_at: new Date(),
            }]
          });
        }
        return Promise.resolve({ rows: [] });
      });
      
      const project = await projectService.getProjectById(pool, mockProjectId, mockUserId);
      
      // Project should be returned with is_owner flag
      expect(project).toEqual(expect.objectContaining({
        id: mockProjectId,
        title: 'Test Project',
        description: 'A test project',
        user_id: mockUserId,
        is_owner: true,
      }));
    });
    
    it('should return a project shared with the user', async () => {
      // First query returns no owned project
      // Second query returns a shared project
      (pool.query as jest.Mock).mockImplementation((query) => {
        if (query.includes('SELECT * FROM projects WHERE id = $1 AND user_id = $2')) {
          return Promise.resolve({ rows: [] }); // Not owned
        }
        
        if (query.includes('JOIN project_shares')) {
          return Promise.resolve({
            rows: [{
              id: mockProjectId,
              title: 'Shared Project',
              description: 'A shared project',
              user_id: 'other-user',
              created_at: new Date(),
              updated_at: new Date(),
              permission: 'edit',
              is_owner: false,
            }]
          });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      const project = await projectService.getProjectById(pool, mockProjectId, mockUserId);
      
      // Shared project should be returned
      expect(project).toEqual(expect.objectContaining({
        id: mockProjectId,
        title: 'Shared Project',
        permission: 'edit',
        is_owner: false,
      }));
    });
    
    it('should return null if the project is not found or user has no access', async () => {
      // Both queries return no results
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
      
      const project = await projectService.getProjectById(pool, mockProjectId, mockUserId);
      
      // Project should be null
      expect(project).toBeNull();
    });
  });
  
  describe('getUserProjects', () => {
    it('should return owned and shared projects with count', async () => {
      // Mock database queries
      (pool.query as jest.Mock).mockImplementation((query, params) => {
        if (query.includes('SELECT EXISTS') && query.includes('images')) {
          return Promise.resolve({ rows: [{ exists: true }] });
        }
        
        if (query.includes('SELECT EXISTS') && query.includes('project_shares')) {
          return Promise.resolve({ rows: [{ exists: true }] });
        }
        
        if (query.includes('UNION ALL')) {
          return Promise.resolve({
            rows: [
              {
                id: 'project-1',
                title: 'Owned Project',
                description: 'An owned project',
                user_id: mockUserId,
                created_at: new Date(),
                updated_at: new Date(),
                is_owner: true,
                image_count: 5,
                thumbnail_url: '/path/to/thumbnail.jpg',
              },
              {
                id: 'project-2',
                title: 'Shared Project',
                description: 'A shared project',
                user_id: 'other-user',
                created_at: new Date(),
                updated_at: new Date(),
                is_owner: false,
                permission: 'view',
                image_count: 3,
                thumbnail_url: '/path/to/other-thumbnail.jpg',
              }
            ]
          });
        }
        
        if (query.includes('SELECT COUNT(*) FROM projects')) {
          return Promise.resolve({ rows: [{ count: 1 }] }); // One owned project
        }
        
        if (query.includes('SELECT COUNT(*) FROM project_shares')) {
          return Promise.resolve({ rows: [{ count: 1 }] }); // One shared project
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      const result = await projectService.getUserProjects(pool, mockUserId);
      
      // Check results contain both projects and correct count
      expect(result.projects).toHaveLength(2);
      expect(result.total).toBe(2);
      
      // Check that owned project data is correct
      expect(result.projects[0]).toEqual(expect.objectContaining({
        id: 'project-1',
        title: 'Owned Project',
        is_owner: true,
        image_count: 5,
      }));
      
      // Check that shared project data is correct
      expect(result.projects[1]).toEqual(expect.objectContaining({
        id: 'project-2',
        title: 'Shared Project',
        is_owner: false,
        permission: 'view',
      }));
    });
    
    it('should return only owned projects when includeShared is false', async () => {
      // Mock database queries
      (pool.query as jest.Mock).mockImplementation((query, params) => {
        if (query.includes('SELECT EXISTS') && query.includes('images')) {
          return Promise.resolve({ rows: [{ exists: true }] });
        }
        
        if (!query.includes('UNION ALL')) {
          return Promise.resolve({
            rows: [
              {
                id: 'project-1',
                title: 'Owned Project',
                description: 'An owned project',
                user_id: mockUserId,
                created_at: new Date(),
                updated_at: new Date(),
                is_owner: true,
                image_count: 5,
                thumbnail_url: '/path/to/thumbnail.jpg',
              }
            ]
          });
        }
        
        if (query.includes('SELECT COUNT(*) FROM projects')) {
          return Promise.resolve({ rows: [{ count: 1 }] }); // One owned project
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      const result = await projectService.getUserProjects(pool, mockUserId, 10, 0, false);
      
      // Check results contain only owned project
      expect(result.projects).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.projects[0].is_owner).toBe(true);
    });
  });
  
  describe('deleteProject', () => {
    it('should delete a project and its associated resources', async () => {
      // Mock client transaction methods
      mockClient.query.mockImplementation((query, params) => {
        if (query === 'BEGIN' || query === 'COMMIT') {
          return Promise.resolve();
        }
        
        if (query.includes('SELECT id FROM projects WHERE id = $1 AND user_id = $2')) {
          return Promise.resolve({ rows: [{ id: mockProjectId }] });
        }
        
        if (query.includes('DELETE FROM projects')) {
          return Promise.resolve({ rowCount: 1 });
        }
        
        return Promise.resolve({ rows: [] });
      });
      
      // Mock fs operations
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.rmSync as jest.Mock).mockReturnValue(undefined);
      
      const result = await projectService.deleteProject(pool, mockProjectId, mockUserId);
      
      // Check that transaction was started and committed
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      
      // Check that project directory was deleted
      expect(fs.rmSync).toHaveBeenCalledWith(
        expect.stringContaining(mockProjectId),
        { recursive: true, force: true }
      );
      
      // Check that database deletion was performed
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM projects'),
        [mockProjectId, mockUserId]
      );
      
      // Check result is true
      expect(result).toBe(true);
      
      // Check that client was released
      expect(mockClient.release).toHaveBeenCalled();
    });
    
    it('should throw an ApiError if the project is not found or user has no access', async () => {
      // Mock project not found
      mockClient.query.mockImplementation((query) => {
        if (query.includes('SELECT id FROM projects WHERE id = $1 AND user_id = $2')) {
          return Promise.resolve({ rows: [] }); // Not found or no access
        }
        return Promise.resolve();
      });
      
      // Expect the service to throw an ApiError
      await expect(projectService.deleteProject(pool, mockProjectId, mockUserId))
        .rejects.toThrow(ApiError);
      
      // Transaction should be rolled back
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      
      // Client should be released
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});