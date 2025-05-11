import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import * as projectController from '../projects';
import * as projectService from '../../services/projectService';
import { ApiError } from '../../utils/errors';

// Mock services
vi.mock('../../services/projectService');

describe('Projects API Controller', () => {
  // Common mocks
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: vi.Mock;

  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();

    // Common mock response with jest-like spies for methods
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();
  });

  describe('getAllProjects', () => {
    it('successfully retrieves all user projects', async () => {
      // Mock project data
      const mockProjects = [
        {
          id: 'project-1',
          name: 'Test Project 1',
          description: 'A test project',
          status: 'active',
          userId: 'user-123',
          createdAt: '2023-06-01T10:00:00Z',
          updatedAt: '2023-06-01T10:00:00Z',
        },
        {
          id: 'project-2',
          name: 'Test Project 2',
          description: 'Another test project',
          status: 'active',
          userId: 'user-123',
          createdAt: '2023-06-02T10:00:00Z',
          updatedAt: '2023-06-02T10:00:00Z',
        },
      ];

      // Set up mock to return the data
      vi.mocked(projectService.getAllProjects).mockResolvedValue(mockProjects);

      // Mock request with user
      mockRequest = {
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getAllProjects(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.getAllProjects).toHaveBeenCalledWith('user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProjects);
    });

    it('handles errors when user is not authenticated', async () => {
      // Mock request without user
      mockRequest = {};

      // Call the controller
      await projectController.getAllProjects(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
    });

    it('handles server errors when fetching projects', async () => {
      // Set up mock to throw server error
      vi.mocked(projectService.getAllProjects).mockRejectedValue(new Error('Database connection error'));

      // Mock request with user
      mockRequest = {
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getAllProjects(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('getProjectById', () => {
    it('successfully retrieves a project by ID', async () => {
      // Mock project data
      const mockProject = {
        id: 'project-1',
        name: 'Test Project 1',
        description: 'A test project',
        status: 'active',
        userId: 'user-123',
        createdAt: '2023-06-01T10:00:00Z',
        updatedAt: '2023-06-01T10:00:00Z',
      };

      // Set up mock to return the data
      vi.mocked(projectService.getProjectById).mockResolvedValue(mockProject);

      // Mock request
      mockRequest = {
        params: { id: 'project-1' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getProjectById(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.getProjectById).toHaveBeenCalledWith('project-1', 'user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockProject);
    });

    it('handles project not found errors', async () => {
      // Set up mock to throw not found error
      vi.mocked(projectService.getProjectById).mockRejectedValue(new ApiError(404, 'Project not found'));

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getProjectById(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles unauthorized access errors', async () => {
      // Set up mock to throw unauthorized error
      vi.mocked(projectService.getProjectById).mockRejectedValue(new ApiError(403, 'Unauthorized access to project'));

      // Mock request with different user
      mockRequest = {
        params: { id: 'project-1' },
        user: { id: 'different-user' },
      };

      // Call the controller
      await projectController.getProjectById(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('createProject', () => {
    it('successfully creates a new project', async () => {
      // Mock project data
      const mockProjectData = {
        name: 'New Project',
        description: 'A new test project',
      };

      const mockCreatedProject = {
        id: 'new-project-id',
        name: 'New Project',
        description: 'A new test project',
        status: 'active',
        userId: 'user-123',
        createdAt: '2023-06-10T10:00:00Z',
        updatedAt: '2023-06-10T10:00:00Z',
      };

      // Set up mock to return the created project
      vi.mocked(projectService.createProject).mockResolvedValue(mockCreatedProject);

      // Mock request
      mockRequest = {
        body: mockProjectData,
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.createProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.createProject).toHaveBeenCalledWith({
        ...mockProjectData,
        userId: 'user-123',
      });

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockCreatedProject);
    });

    it('handles validation errors when creating a project', async () => {
      // Mock invalid project data (missing name)
      const mockInvalidData = {
        description: 'Missing name',
      };

      // Set up mock to throw validation error
      vi.mocked(projectService.createProject).mockRejectedValue(new ApiError(400, 'Project name is required'));

      // Mock request
      mockRequest = {
        body: mockInvalidData,
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.createProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(400);
    });

    it('handles unauthenticated users', async () => {
      // Mock request without user
      mockRequest = {
        body: { name: 'New Project' },
      };

      // Call the controller
      await projectController.createProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(401);
    });
  });

  describe('updateProject', () => {
    it('successfully updates a project', async () => {
      // Mock update data
      const mockUpdateData = {
        name: 'Updated Project',
        description: 'Updated description',
      };

      const mockUpdatedProject = {
        id: 'project-1',
        name: 'Updated Project',
        description: 'Updated description',
        status: 'active',
        userId: 'user-123',
        createdAt: '2023-06-01T10:00:00Z',
        updatedAt: '2023-06-10T12:00:00Z',
      };

      // Set up mock to return the updated project
      vi.mocked(projectService.updateProject).mockResolvedValue(mockUpdatedProject);

      // Mock request
      mockRequest = {
        params: { id: 'project-1' },
        body: mockUpdateData,
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.updateProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.updateProject).toHaveBeenCalledWith('project-1', mockUpdateData, 'user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockUpdatedProject);
    });

    it('handles project not found errors when updating', async () => {
      // Set up mock to throw not found error
      vi.mocked(projectService.updateProject).mockRejectedValue(new ApiError(404, 'Project not found'));

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        body: { name: 'Updated Name' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.updateProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles unauthorized update attempts', async () => {
      // Set up mock to throw unauthorized error
      vi.mocked(projectService.updateProject).mockRejectedValue(
        new ApiError(403, 'Unauthorized to update this project'),
      );

      // Mock request with different user
      mockRequest = {
        params: { id: 'project-1' },
        body: { name: 'Updated Name' },
        user: { id: 'different-user' },
      };

      // Call the controller
      await projectController.updateProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('deleteProject', () => {
    it('successfully deletes a project', async () => {
      // Set up mock for successful deletion
      vi.mocked(projectService.deleteProject).mockResolvedValue({
        success: true,
      });

      // Mock request
      mockRequest = {
        params: { id: 'project-1' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.deleteProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.deleteProject).toHaveBeenCalledWith('project-1', 'user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true });
    });

    it('handles project not found errors when deleting', async () => {
      // Set up mock to throw not found error
      vi.mocked(projectService.deleteProject).mockRejectedValue(new ApiError(404, 'Project not found'));

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.deleteProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles unauthorized delete attempts', async () => {
      // Set up mock to throw unauthorized error
      vi.mocked(projectService.deleteProject).mockRejectedValue(
        new ApiError(403, 'Unauthorized to delete this project'),
      );

      // Mock request with different user
      mockRequest = {
        params: { id: 'project-1' },
        user: { id: 'different-user' },
      };

      // Call the controller
      await projectController.deleteProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });

  describe('getProjectStats', () => {
    it('successfully retrieves project statistics', async () => {
      // Mock project stats
      const mockStats = {
        projectId: 'project-1',
        imageCount: 10,
        completedImageCount: 7,
        pendingImageCount: 3,
        totalPolygons: 250,
        averagePolygonsPerImage: 25,
        lastActivity: '2023-06-10T15:30:00Z',
      };

      // Set up mock to return the stats
      vi.mocked(projectService.getProjectStats).mockResolvedValue(mockStats);

      // Mock request
      mockRequest = {
        params: { id: 'project-1' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getProjectStats(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.getProjectStats).toHaveBeenCalledWith('project-1', 'user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockStats);
    });

    it('handles project not found errors when getting stats', async () => {
      // Set up mock to throw not found error
      vi.mocked(projectService.getProjectStats).mockRejectedValue(new ApiError(404, 'Project not found'));

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getProjectStats(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });
  });

  describe('getProjectActivity', () => {
    it('successfully retrieves project activity log', async () => {
      // Mock activity data
      const mockActivity = [
        {
          id: 'activity-1',
          projectId: 'project-1',
          userId: 'user-123',
          userName: 'Test User',
          actionType: 'UPDATE_IMAGE',
          details: { imageId: 'image-1' },
          timestamp: '2023-06-10T15:30:00Z',
        },
        {
          id: 'activity-2',
          projectId: 'project-1',
          userId: 'user-123',
          userName: 'Test User',
          actionType: 'ADD_IMAGE',
          details: { imageId: 'image-2' },
          timestamp: '2023-06-09T14:20:00Z',
        },
      ];

      // Set up mock to return the activity
      vi.mocked(projectService.getProjectActivity).mockResolvedValue(mockActivity);

      // Mock request
      mockRequest = {
        params: { id: 'project-1' },
        query: { limit: '10', offset: '0' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getProjectActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.getProjectActivity).toHaveBeenCalledWith('project-1', 'user-123', { limit: 10, offset: 0 });

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(mockActivity);
    });

    it('handles invalid pagination parameters', async () => {
      // Mock request with invalid params
      mockRequest = {
        params: { id: 'project-1' },
        query: { limit: 'abc', offset: 'def' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.getProjectActivity(mockRequest as Request, mockResponse as Response, mockNext);

      // Should use default values
      expect(projectService.getProjectActivity).toHaveBeenCalledWith(
        'project-1',
        'user-123',
        { limit: 20, offset: 0 }, // Default values
      );
    });
  });

  describe('duplicateProject', () => {
    it('successfully duplicates a project', async () => {
      // Mock duplicate request data
      const mockDuplicateData = {
        name: 'Duplicated Project',
        includeImages: true,
      };

      // Mock the duplicated project
      const mockDuplicatedProject = {
        id: 'duplicated-id',
        name: 'Duplicated Project',
        description: 'Duplicate of Test Project 1',
        status: 'active',
        userId: 'user-123',
        createdAt: '2023-06-10T16:00:00Z',
        updatedAt: '2023-06-10T16:00:00Z',
        sourceProjectId: 'project-1',
      };

      // Set up mock to return the duplicated project
      vi.mocked(projectService.duplicateProject).mockResolvedValue(mockDuplicatedProject);

      // Mock request
      mockRequest = {
        params: { id: 'project-1' },
        body: mockDuplicateData,
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.duplicateProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify service was called with correct params
      expect(projectService.duplicateProject).toHaveBeenCalledWith('project-1', mockDuplicateData, 'user-123');

      // Verify response
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(mockDuplicatedProject);
    });

    it('handles source project not found errors', async () => {
      // Set up mock to throw not found error
      vi.mocked(projectService.duplicateProject).mockRejectedValue(new ApiError(404, 'Source project not found'));

      // Mock request
      mockRequest = {
        params: { id: 'non-existent' },
        body: { name: 'Duplicate Project' },
        user: { id: 'user-123' },
      };

      // Call the controller
      await projectController.duplicateProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(404);
    });

    it('handles unauthorized duplication attempts', async () => {
      // Set up mock to throw unauthorized error
      vi.mocked(projectService.duplicateProject).mockRejectedValue(
        new ApiError(403, 'Unauthorized to duplicate this project'),
      );

      // Mock request with different user
      mockRequest = {
        params: { id: 'project-1' },
        body: { name: 'Duplicate Project' },
        user: { id: 'different-user' },
      };

      // Call the controller
      await projectController.duplicateProject(mockRequest as Request, mockResponse as Response, mockNext);

      // Verify error was passed to next
      expect(mockNext).toHaveBeenCalledWith(expect.any(ApiError));
      expect(mockNext.mock.calls[0][0].statusCode).toBe(403);
    });
  });
});
