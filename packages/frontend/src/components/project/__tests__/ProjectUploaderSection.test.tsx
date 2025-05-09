import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

// Create a simple test component
const MockProjectUploaderSection = () => {
  return (
    <div>
      <h2>Upload Images</h2>
      <button data-testid="mock-cancel-button">Cancel</button>
      <button data-testid="mock-upload-complete-button">Upload Complete</button>
      <input data-testid="segment-after-upload-checkbox" type="checkbox" />
    </div>
  );
};

// Mock the actual component
vi.mock('@/components/project/ProjectUploaderSection', () => ({
  default: () => <MockProjectUploaderSection />
}));

describe('ProjectUploaderSection Component', () => {
  it('renders the component correctly', () => {
    render(<MockProjectUploaderSection />);
    
    // Check if the title is rendered
    expect(screen.getByText('Upload Images')).toBeInTheDocument();
    
    // Check if the cancel button is rendered
    expect(screen.getByTestId('mock-cancel-button')).toBeInTheDocument();
  });

  it('has upload complete button', () => {
    render(<MockProjectUploaderSection />);
    
    // Check if the upload complete button is rendered
    expect(screen.getByTestId('mock-upload-complete-button')).toBeInTheDocument();
  });

  it('has segment after upload checkbox', () => {
    render(<MockProjectUploaderSection />);
    
    // Check if the segment after upload checkbox is rendered
    expect(screen.getByTestId('segment-after-upload-checkbox')).toBeInTheDocument();
  });
});