import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FileUploader } from '../file-uploader';
import '@testing-library/jest-dom';

// Mock react-dropzone
vi.mock('react-dropzone', () => ({
  useDropzone: vi.fn(() => ({
    getRootProps: () => ({
      onClick: vi.fn(),
      onKeyDown: vi.fn(),
      tabIndex: 0,
    }),
    getInputProps: () => ({
      type: 'file',
      multiple: false,
      accept: 'image/*',
    }),
    isDragActive: false,
    open: vi.fn(),
  })),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn(() => 'mocked-url');

describe('FileUploader Component', () => {
  const mockOnDrop = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with default props', () => {
    render(<FileUploader onDrop={mockOnDrop} />);

    // Check that the component renders with default text
    expect(screen.getByText('Drag and drop files here, or click to select files')).toBeInTheDocument();
    expect(screen.getByText('You can upload only one file')).toBeInTheDocument();
    expect(screen.getByText('(max 5 MB per file)')).toBeInTheDocument();
  });

  it('renders with custom text props', () => {
    render(
      <FileUploader 
        onDrop={mockOnDrop} 
        uploadText="Custom upload text"
        dragActiveText="Custom drag text"
        multiple={true}
        maxSize={10 * 1024 * 1024}
      />
    );

    expect(screen.getByText('Custom upload text')).toBeInTheDocument();
    expect(screen.getByText('You can upload multiple files')).toBeInTheDocument();
    expect(screen.getByText('(max 10 MB per file)')).toBeInTheDocument();
  });

  it('shows uploading state with progress', () => {
    render(
      <FileUploader 
        onDrop={mockOnDrop} 
        uploadState="uploading"
        uploadProgress={42}
      />
    );

    expect(screen.getByText('42% - Uploading...')).toBeInTheDocument();
    const progressBar = document.querySelector('.bg-blue-600');
    expect(progressBar).toHaveStyle('width: 42%');
  });

  it('shows success state with message', () => {
    render(
      <FileUploader 
        onDrop={mockOnDrop} 
        uploadState="success"
        successText="Files uploaded successfully!"
      />
    );

    expect(screen.getByText('Files uploaded successfully!')).toBeInTheDocument();
  });

  it('shows error state with message', () => {
    render(
      <FileUploader 
        onDrop={mockOnDrop} 
        uploadState="error"
        errorText="Failed to upload files!"
      />
    );

    expect(screen.getByText('Failed to upload files!')).toBeInTheDocument();
  });

  it('applies disabled state correctly', () => {
    render(<FileUploader onDrop={mockOnDrop} disabled={true} />);
    
    // The dropzone area should have disabled styling
    const dropzone = screen.getByText('Drag and drop files here, or click to select files').closest('div');
    expect(dropzone?.parentElement).toHaveClass('opacity-50');
    expect(dropzone?.parentElement).toHaveClass('cursor-not-allowed');
  });

  it('renders with different variants', () => {
    const { rerender } = render(<FileUploader onDrop={mockOnDrop} variant="default" />);
    
    // Default variant should have dashed border
    let dropzone = screen.getByText('Drag and drop files here, or click to select files').closest('div');
    expect(dropzone?.parentElement).toHaveClass('border-dashed');
    
    // Outline variant should have solid border
    rerender(<FileUploader onDrop={mockOnDrop} variant="outline" />);
    dropzone = screen.getByText('Drag and drop files here, or click to select files').closest('div');
    expect(dropzone?.parentElement).not.toHaveClass('border-dashed');
    
    // Ghost variant should have transparent background
    rerender(<FileUploader onDrop={mockOnDrop} variant="ghost" />);
    dropzone = screen.getByText('Drag and drop files here, or click to select files').closest('div');
    expect(dropzone?.parentElement).toHaveClass('bg-transparent');
  });

  // Note: Testing actual file drop events is challenging since react-dropzone is mocked
  // and we can't directly test the callback behavior with real files.
  // In a real application, we might use a more comprehensive integration test for this.
});