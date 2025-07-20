import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useProjectForm } from '../useProjectForm';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/services/api/client';
import { toast } from 'sonner';
import axios from 'axios';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test-user-id' },
  })),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => key,
  })),
}));

vi.mock('@/services/api/client', () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock window.dispatchEvent
const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

describe('useProjectForm Hook', () => {
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  // Event mock for form submission
  const mockEvent = {
    preventDefault: vi.fn(),
  } as unknown as React.FormEvent<HTMLFormElement>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset auth mock to default (authenticated user)
    (useAuth as unknown).mockReturnValue({
      user: { id: 'test-user-id' },
    });

    // Reset API mock to successful response
    (apiClient.post as unknown).mockResolvedValue({
      data: {
        id: 'test-project-id',
        title: 'Test Project',
        description: 'Test Description',
      },
    });
  });

  it('initializes with default values', () => {
    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    expect(result.current.projectName).toBe('');
    expect(result.current.projectDescription).toBe('');
    expect(result.current.isCreating).toBe(false);
    expect(typeof result.current.handleCreateProject).toBe('function');
  });

  it('updates state when setters are called', () => {
    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    act(() => {
      result.current.setProjectName('New Project');
      result.current.setProjectDescription('New Description');
    });

    expect(result.current.projectName).toBe('New Project');
    expect(result.current.projectDescription).toBe('New Description');
  });

  it('successfully creates a project', async () => {
    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    // Set project name and description
    act(() => {
      result.current.setProjectName('Test Project');
      result.current.setProjectDescription('Test Description');
    });

    // Submit the form
    await act(async () => {
      await result.current.handleCreateProject(mockEvent);
    });

    // Check if API was called with correct data
    expect(apiClient.post).toHaveBeenCalledWith('/api/projects', {
      title: 'Test Project',
      description: 'Test Description',
    });

    // Check if success callback was called
    expect(mockOnSuccess).toHaveBeenCalledWith('test-project-id');

    // Check if form was closed
    expect(mockOnClose).toHaveBeenCalled();

    // Check if toast success was shown
    expect(toast.success).toHaveBeenCalled();

    // Check if state was reset
    expect(result.current.projectName).toBe('');
    expect(result.current.projectDescription).toBe('');
    expect(result.current.isCreating).toBe(false);
  });

  it('handles empty description correctly', async () => {
    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    // Set project name with empty description
    act(() => {
      result.current.setProjectName('Test Project');
      result.current.setProjectDescription('   '); // Only whitespace
    });

    // Submit the form
    await act(async () => {
      await result.current.handleCreateProject(mockEvent);
    });

    // Check if API was called with correct data (description should be undefined)
    expect(apiClient.post).toHaveBeenCalledWith('/api/projects', {
      title: 'Test Project',
      description: undefined,
    });
  });

  it('shows error when user is not authenticated', async () => {
    // Mock user as null (not authenticated)
    (useAuth as unknown).mockReturnValue({
      user: null,
    });

    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    // Set project name and description
    act(() => {
      result.current.setProjectName('Test Project');
    });

    // Submit the form
    await act(async () => {
      const returnValue = await result.current.handleCreateProject(mockEvent);
      expect(returnValue).toBeNull();
    });

    // Check if error toast was shown
    expect(toast.error).toHaveBeenCalledWith('projects.loginRequired');

    // Check if API was NOT called
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('shows error when project name is empty', async () => {
    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    // Set empty project name
    act(() => {
      result.current.setProjectName('   '); // Only whitespace
    });

    // Submit the form
    await act(async () => {
      const returnValue = await result.current.handleCreateProject(mockEvent);
      expect(returnValue).toBeNull();
    });

    // Check if error toast was shown
    expect(toast.error).toHaveBeenCalledWith('projects.projectNameRequired');

    // Check if API was NOT called
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('handles API error when creating project', async () => {
    // Mock API to throw error
    (apiClient.post as unknown).mockRejectedValue(
      new axios.AxiosError('Error', undefined, undefined, undefined, {
        status: 500,
        data: { message: 'Server error' },
      } as any),
    );

    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    // Set project name
    act(() => {
      result.current.setProjectName('Test Project');
    });

    // Submit the form
    await act(async () => {
      const returnValue = await result.current.handleCreateProject(mockEvent);
      expect(returnValue).toBeNull();
    });

    // Check if error toast was shown
    expect(toast.error).toHaveBeenCalled();

    // Check if onSuccess was NOT called
    expect(mockOnSuccess).not.toHaveBeenCalled();

    // Check if onClose was NOT called
    expect(mockOnClose).not.toHaveBeenCalled();

    // Check if isCreating was reset to false
    expect(result.current.isCreating).toBe(false);
  });

  it('handles validation errors from API', async () => {
    // Mock API to throw validation error
    (apiClient.post as unknown).mockRejectedValue(
      new axios.AxiosError('Error', undefined, undefined, undefined, {
        status: 400,
        data: {
          message: 'Validation failed',
          errors: [
            { path: 'title', message: 'Title is required' },
            { path: 'description', message: 'Description too long' },
          ],
        },
      } as any),
    );

    const { result } = renderHook(() => useProjectForm({ onSuccess: mockOnSuccess, onClose: mockOnClose }));

    // Set project name
    act(() => {
      result.current.setProjectName('Test Project');
    });

    // Submit the form
    await act(async () => {
      await result.current.handleCreateProject(mockEvent);
    });

    // Check if error toast was shown with validation errors
    expect(toast.error).toHaveBeenCalledWith(
      'Validation Failed: title: Title is required; description: Description too long',
    );
  });

  it('dispatches custom event when onSuccess is not provided', async () => {
    // Render hook without onSuccess callback
    const { result } = renderHook(() => useProjectForm({ onClose: mockOnClose }));

    // Set project name
    act(() => {
      result.current.setProjectName('Test Project');
    });

    // Submit the form
    await act(async () => {
      await result.current.handleCreateProject(mockEvent);
    });

    // Check if custom event was dispatched
    expect(dispatchEventSpy).toHaveBeenCalled();
    expect(dispatchEventSpy.mock.calls[0][0].type).toBe('project-created');
    expect((dispatchEventSpy.mock.calls[0][0] as CustomEvent).detail).toEqual({
      projectId: 'test-project-id',
    });
  });
});
