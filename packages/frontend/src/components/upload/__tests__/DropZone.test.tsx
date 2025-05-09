import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import DropZone from '../DropZone';
import '@testing-library/jest-dom';
import { setupFileUploadMocks } from '../../../../shared/test-utils/file-upload-test-utils';

// Setup mocks
setupFileUploadMocks();

describe('DropZone Component', () => {
  const mockOnDrop = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component in enabled state', () => {
    render(<DropZone disabled={false} onDrop={mockOnDrop} isDragActive={false} />);
    
    // Check if the component renders correctly
    expect(screen.getByText('images.dragDrop')).toBeInTheDocument();
    expect(screen.getByText('images.clickToSelect')).toBeInTheDocument();
    expect(screen.getByText('images.acceptedFormats')).toBeInTheDocument();
  });

  it('renders the component in disabled state', () => {
    render(<DropZone disabled={true} onDrop={mockOnDrop} isDragActive={false} />);
    
    // Check if the component shows disabled message
    expect(screen.getByText('images.uploadingTo')).toBeInTheDocument();
  });

  it('shows different text when drag is active', () => {
    render(<DropZone disabled={false} onDrop={mockOnDrop} isDragActive={true} />);
    
    // Check if the component shows drag active text
    expect(screen.getByText('images.dropImagesHere')).toBeInTheDocument();
  });

  it('applies the correct styles based on props', () => {
    const { rerender } = render(
      <DropZone disabled={false} onDrop={mockOnDrop} isDragActive={false} />
    );
    
    // Initial state should have the default styles
    const dropzone = screen.getByTestId('dropzone');
    expect(dropzone).toHaveClass('border-dashed');
    expect(dropzone).not.toHaveClass('bg-primary-100');
    
    // Rerender with isDragActive=true
    rerender(
      <DropZone disabled={false} onDrop={mockOnDrop} isDragActive={true} />
    );
    
    // Check if active styles are applied
    expect(dropzone).toHaveClass('bg-primary-100');
    
    // Rerender with disabled=true
    rerender(
      <DropZone disabled={true} onDrop={mockOnDrop} isDragActive={false} />
    );
    
    // Check if disabled styles are applied
    expect(dropzone).toHaveClass('opacity-50');
  });
});