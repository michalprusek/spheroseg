import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import FileList, { FileWithPreview } from '../FileList';
import '@testing-library/jest-dom';
import { setupFileUploadMocks, createSampleMockFiles } from '../../../../shared/test-utils/file-upload-test-utils';

// Setup mocks
setupFileUploadMocks();

describe('FileList Component', () => {
  const mockFiles = createSampleMockFiles();
  const mockOnRemoveFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when files array is empty', () => {
    const { container } = render(<FileList files={[]} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders file items when files are provided', () => {
    render(<FileList files={mockFiles} uploadProgress={50} onRemoveFile={mockOnRemoveFile} />);

    // Check if all file names are rendered
    expect(screen.getByText('image1.jpg')).toBeInTheDocument();
    expect(screen.getByText('image2.jpg')).toBeInTheDocument();
    expect(screen.getByText('image3.jpg')).toBeInTheDocument();
    expect(screen.getByText('image4.jpg')).toBeInTheDocument();
  });

  it('shows file size in appropriate format', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Check if file sizes are formatted correctly
    expect(screen.getByText('500 KB')).toBeInTheDocument();
    expect(screen.getByText('2.5 MB')).toBeInTheDocument();
    expect(screen.getByText('100 KB')).toBeInTheDocument();
    expect(screen.getByText('5 MB')).toBeInTheDocument();
  });

  it('displays preview images when available', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Get all img elements
    const previewImages = screen.getAllByRole('img');

    // Check if we have preview images for files with preview URLs (mockFiles[0] and mockFiles[2])
    expect(previewImages.length).toBe(2);
    expect(previewImages[0]).toHaveAttribute('src', 'preview-url-1');
    expect(previewImages[1]).toHaveAttribute('src', 'preview-url-3');
  });

  it('calls onRemoveFile when remove button is clicked', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Find all remove buttons and click the first one
    const removeButtons = screen.getAllByRole('button');
    fireEvent.click(removeButtons[0]);

    // Check if onRemoveFile was called with the correct file
    expect(mockOnRemoveFile).toHaveBeenCalledTimes(1);
    expect(mockOnRemoveFile).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('shows upload progress for uploading files', () => {
    render(<FileList files={mockFiles} uploadProgress={75} onRemoveFile={mockOnRemoveFile} />);

    // Check if progress bars are rendered for files in uploading state
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(1); // Only the second file is in 'uploading' state

    // Check if the progress value is correctly set
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '75');
  });

  it('displays appropriate status indicators', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Pending status for first file
    expect(screen.getByText('dashboard.pending')).toBeInTheDocument();

    // Uploading status for second file
    expect(screen.getByText('files.uploading')).toBeInTheDocument();

    // Complete status for third file
    expect(screen.getByText('files.complete')).toBeInTheDocument();

    // Error status for fourth file
    expect(screen.getByText('files.error')).toBeInTheDocument();
  });
});
