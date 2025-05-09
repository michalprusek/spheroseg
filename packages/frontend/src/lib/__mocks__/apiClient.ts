import { vi } from 'vitest';

// Create mock functions for all HTTP methods
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();
const mockPatch = vi.fn();

// Default implementation for queue status
mockGet.mockImplementation((url) => {
  if (url.includes('/queue-status/project-123')) {
    return Promise.resolve({
      data: {
        queueLength: 1,
        runningTasks: ['task-1'],
        queuedTasks: ['task-2'],
        processingImages: [
          { id: 'task-1', name: 'Image 1', projectId: 'project-123' }
        ]
      }
    });
  } else if (url.includes('/queue-status')) {
    return Promise.resolve({
      data: {
        queueLength: 2,
        runningTasks: ['task-1', 'task-3'],
        queuedTasks: ['task-2', 'task-4'],
        processingImages: [
          { id: 'task-1', name: 'Image 1', projectId: 'project-123' },
          { id: 'task-3', name: 'Image 3', projectId: 'project-456' }
        ]
      }
    });
  }
  return Promise.reject(new Error('Not found'));
});

// Reset all mocks
const resetMocks = () => {
  mockGet.mockClear();
  mockPost.mockClear();
  mockPut.mockClear();
  mockDelete.mockClear();
  mockPatch.mockClear();

  // Restore default implementation for queue status
  mockGet.mockImplementation((url) => {
    if (url.includes('/queue-status/project-123')) {
      return Promise.resolve({
        data: {
          queueLength: 1,
          runningTasks: ['task-1'],
          queuedTasks: ['task-2'],
          processingImages: [
            { id: 'task-1', name: 'Image 1', projectId: 'project-123' }
          ]
        }
      });
    } else if (url.includes('/queue-status')) {
      return Promise.resolve({
        data: {
          queueLength: 2,
          runningTasks: ['task-1', 'task-3'],
          queuedTasks: ['task-2', 'task-4'],
          processingImages: [
            { id: 'task-1', name: 'Image 1', projectId: 'project-123' },
            { id: 'task-3', name: 'Image 3', projectId: 'project-456' }
          ]
        }
      });
    }
    return Promise.reject(new Error('Not found'));
  });
};

// Export the mock API client
const apiClient = {
  get: mockGet,
  post: mockPost,
  put: mockPut,
  delete: mockDelete,
  patch: mockPatch,
  resetMocks
};

export default apiClient;