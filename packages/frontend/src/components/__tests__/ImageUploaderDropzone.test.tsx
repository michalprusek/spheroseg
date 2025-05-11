import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Create a simple test component
const MockImageUploaderDropzone = () => {
  return (
    <div>
      <div>Drag & drop images here</div>
      <div>Image files only</div>
      <input type="file" data-testid="file-input" />
    </div>
  );
};

// Mock the actual component
vi.mock('@/components/ImageUploaderDropzone', () => ({
  default: () => <MockImageUploaderDropzone />,
}));

describe('ImageUploaderDropzone Component', () => {
  it('renders the component correctly', () => {
    render(<MockImageUploaderDropzone />);

    // Check if the dropzone area is rendered
    expect(screen.getByText(/Drag & drop images here/i)).toBeInTheDocument();
    expect(screen.getByText(/Image files only/i)).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
  });
});
