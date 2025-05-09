import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ImageUploader from '../ImageUploader';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { AuthProvider } from '@/contexts/AuthContext';
import apiClient from '@/lib/apiClient';

// Mock dependencies
vi.mock('@/lib/apiClient', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: () => ({
    getRootProps: () => ({}),
    getInputProps: () => ({}),
    isDragActive: false
  })
}));

// Mock URL.createObjectURL and URL.revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

describe('ImageUploader Component', () => {
  const mockProjectId = 'test-project-id';
  const mockOnUploadComplete = vi.fn();

  beforeEach(() => {
    // Mock API responses
    (apiClient.get as any).mockResolvedValue({
      data: [
        {
          id: 'test-project-id',
          title: 'Test Project',
          description: 'Test Description'
        }
      ]
    });

    (apiClient.post as any).mockResolvedValue({
      data: [
        {
          id: 'test-image-id',
          project_id: 'test-project-id',
          name: 'test-image.jpg',
          storage_path: '/path/to/image.jpg'
        }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <LanguageProvider>
        <AuthProvider>
          <ImageUploader
            projectId={mockProjectId}
            onUploadComplete={mockOnUploadComplete}
            {...props}
          />
        </AuthProvider>
      </LanguageProvider>
    );
  };

  it('renders the component correctly', async () => {
    renderComponent();
    
    // Wait for projects to load
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/projects?limit=1000');
    });
    
    // Check if the dropzone area is rendered
    expect(screen.getByText(/uploader.dragDrop/i)).toBeInTheDocument();
    expect(screen.getByText(/uploader.imageOnly/i)).toBeInTheDocument();
  });

  it('handles file selection', async () => {
    renderComponent();
    
    // Wait for projects to load
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/projects?limit=1000');
    });
    
    // Create a mock file
    const file = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
    
    // Simulate file drop (since we can't directly test the dropzone)
    const { onDrop } = require('react-dropzone').useDropzone();
    onDrop([file]);
    
    // Check if the file is added to the state
    // This would typically show the file in the UI
    // but since we're mocking react-dropzone, we can't directly test this
  });

  it('handles file upload', async () => {
    renderComponent();
    
    // Wait for projects to load
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith('/projects?limit=1000');
    });
    
    // Create a mock file
    const file = new File(['test'], 'test-image.jpg', { type: 'image/jpeg' });
    
    // Simulate file drop
    const { onDrop } = require('react-dropzone').useDropzone();
    onDrop([file]);
    
    // Simulate upload button click
    // Since we're mocking the component, we can't directly click the button
    // Instead, we'll call the handleUpload function directly
    const { handleUpload } = require('../ImageUploader').default;
    await handleUpload();
    
    // Check if the API was called with the correct parameters
    expect(apiClient.post).toHaveBeenCalledWith(
      `/projects/${mockProjectId}/images`,
      expect.any(FormData),
      expect.objectContaining({
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
    );
    
    // Check if the onUploadComplete callback was called
    expect(mockOnUploadComplete).toHaveBeenCalled();
  });
});
