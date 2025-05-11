import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MockApiClientProvider } from '../../lib/__mocks__/enhanced/apiClient';
import { useProjectApi } from '../../hooks/api/useProjectApi';
import { ProjectStatus } from '@spheroseg/types';

// Mock project data
const mockProjects = [
  {
    id: 'project-1',
    name: 'Test Project 1',
    description: 'A test project description',
    status: ProjectStatus.ACTIVE,
    createdAt: '2023-06-01T12:00:00Z',
    updatedAt: '2023-06-02T12:00:00Z',
    imageCount: 3,
    completedImageCount: 1,
  },
  {
    id: 'project-2',
    name: 'Test Project 2',
    description: 'Another test project',
    status: ProjectStatus.ACTIVE,
    createdAt: '2023-06-03T12:00:00Z',
    updatedAt: '2023-06-04T12:00:00Z',
    imageCount: 5,
    completedImageCount: 0,
  },
];

const mockNewProject = {
  name: 'New Project',
  description: 'A new project description',
};

const mockUpdatedProject = {
  id: 'project-1',
  name: 'Updated Project 1',
  description: 'Updated description',
};

describe('Project API Integration Tests', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchProjects', () => {
    it('should fetch projects successfully', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjects: {
                data: mockProjects,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let projects;
      await act(async () => {
        projects = await result.current.fetchProjects();
      });

      expect(projects).toEqual(mockProjects);
    });

    it('should handle fetch errors gracefully', async () => {
      const errorMessage = 'Failed to fetch projects';
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjects: {
                error: new Error(errorMessage),
                status: 500,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.fetchProjects()).rejects.toThrow(errorMessage);
      });
    });

    it('should handle network timeouts', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjects: {
                data: mockProjects,
                status: 200,
                delay: 5000, // 5s delay
              },
            }}
            timeoutMs={3000} // 3s timeout
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.fetchProjects()).rejects.toThrow('Request timed out');
      });
    });
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const createdProject = {
        ...mockNewProject,
        id: 'new-project-id',
        status: ProjectStatus.ACTIVE,
        createdAt: '2023-06-10T12:00:00Z',
        updatedAt: '2023-06-10T12:00:00Z',
        imageCount: 0,
        completedImageCount: 0,
      };

      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              createProject: {
                data: createdProject,
                status: 201,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let project;
      await act(async () => {
        project = await result.current.createProject(mockNewProject);
      });

      expect(project).toEqual(createdProject);
    });

    it('should handle validation errors', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              createProject: {
                error: new Error('Project name is required'),
                status: 400,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.createProject({ description: 'Missing name' })).rejects.toThrow(
          'Project name is required',
        );
      });
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      const updatedProject = {
        ...mockUpdatedProject,
        status: ProjectStatus.ACTIVE,
        createdAt: '2023-06-01T12:00:00Z',
        updatedAt: '2023-06-10T12:00:00Z',
        imageCount: 3,
        completedImageCount: 1,
      };

      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              updateProject: {
                data: updatedProject,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let project;
      await act(async () => {
        project = await result.current.updateProject(mockUpdatedProject);
      });

      expect(project).toEqual(updatedProject);
    });

    it('should handle project not found error', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              updateProject: {
                error: new Error('Project not found'),
                status: 404,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.updateProject({ id: 'non-existent', name: 'Test' })).rejects.toThrow(
          'Project not found',
        );
      });
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              deleteProject: {
                data: { success: true },
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let response;
      await act(async () => {
        response = await result.current.deleteProject('project-1');
      });

      expect(response).toEqual({ success: true });
    });

    it('should handle unauthorized deletion', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              deleteProject: {
                error: new Error('Unauthorized to delete this project'),
                status: 403,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.deleteProject('project-1')).rejects.toThrow('Unauthorized to delete this project');
      });
    });
  });

  describe('fetchProjectDetails', () => {
    it('should fetch project details successfully', async () => {
      const projectDetails = {
        ...mockProjects[0],
        images: [
          { id: 'img1', filename: 'test1.jpg', status: 'completed' },
          { id: 'img2', filename: 'test2.jpg', status: 'pending' },
          { id: 'img3', filename: 'test3.jpg', status: 'pending' },
        ],
      };

      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectDetails: {
                data: projectDetails,
                status: 200,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      let details;
      await act(async () => {
        details = await result.current.fetchProjectDetails('project-1');
      });

      expect(details).toEqual(projectDetails);
    });

    it('should handle access denied errors', async () => {
      const { result } = renderHook(() => useProjectApi(), {
        wrapper: ({ children }) => (
          <MockApiClientProvider
            mockResponses={{
              getProjectDetails: {
                error: new Error('Access denied'),
                status: 403,
              },
            }}
          >
            {children}
          </MockApiClientProvider>
        ),
      });

      await act(async () => {
        await expect(result.current.fetchProjectDetails('project-1')).rejects.toThrow('Access denied');
      });
    });
  });
});
