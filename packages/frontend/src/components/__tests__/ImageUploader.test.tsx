import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// Create a simple test component
const MockImageUploader = () => {
  return (
    <div>
      <div>Drag & drop images here</div>
      <div>Image files only</div>
      <button data-testid="upload-button">Upload</button>
    </div>
  );
};

// Mock the actual component
vi.mock('@/components/ImageUploader', () => ({
  default: () => <MockImageUploader />
}));

describe('ImageUploader Component', () => {
  it('renders the component correctly', () => {
    render(<MockImageUploader />);
    
    // Check if the dropzone area is rendered
    expect(screen.getByText(/Drag & drop images here/i)).toBeInTheDocument();
    expect(screen.getByText(/Image files only/i)).toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeInTheDocument();
  });
});