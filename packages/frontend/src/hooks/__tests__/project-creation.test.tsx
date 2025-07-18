import { renderHook, act } from '@testing-library/react';
import { useProjectForm } from '../useProjectForm';
import { toast } from 'sonner';
import apiClient from '@/lib/apiClient';

// Mock dependencies
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/apiClient', () => ({
  post: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
  }),
}));

vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key, // Return the key as the translation
  }),
}));

describe('Project Creation', () => {
  const mockOnClose = vi.fn();
  const mockOnSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API response
    (apiClient.post as vi.Mock).mockResolvedValue({
      data: {
        id: 'test-project-id',
        title: 'Test Project',
      },
    });
  });

  it('should create a project with trimmed title', async () => {
    const { result } = renderHook(() => useProjectForm({ onClose: mockOnClose, onSuccess: mockOnSuccess }));

    // Set project name with whitespace
    act(() => {
      result.current.setProjectName('  Test Project  ');
    });

    // Create form event
    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;

    // Submit the form
    await act(async () => {
      await result.current.handleCreateProject(mockEvent);
    });

    // Verify API was called with trimmed title
    expect(apiClient.post).toHaveBeenCalledWith('/projects', {
      title: 'Test Project',
      description: undefined,
    });

    // Verify success toast was shown
    expect(toast.success).toHaveBeenCalled();

    // Verify callbacks were called
    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnSuccess).toHaveBeenCalledWith('test-project-id');
  });

  it('should not create a project with empty title', async () => {
    const { result } = renderHook(() => useProjectForm({ onClose: mockOnClose }));

    // Set empty project name
    act(() => {
      result.current.setProjectName('   ');
    });

    // Create form event
    const mockEvent = {
      preventDefault: vi.fn(),
    } as unknown as React.FormEvent<HTMLFormElement>;

    // Submit the form
    await act(async () => {
      await result.current.handleCreateProject(mockEvent);
    });

    // Verify API was not called
    expect(apiClient.post).not.toHaveBeenCalled();

    // Verify error toast was shown
    expect(toast.error).toHaveBeenCalled();

    // Verify callbacks were not called
    expect(mockOnClose).not.toHaveBeenCalled();
  });
});
