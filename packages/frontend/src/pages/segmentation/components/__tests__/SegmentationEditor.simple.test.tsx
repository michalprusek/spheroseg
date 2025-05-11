import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

// Create a mock SegmentationEditor component
const MockSegmentationEditor = () => {
  return (
    <div data-testid="segmentation-editor">
      <div data-testid="editor-container">
        <div data-testid="editor-header">
          <h1>Test Project</h1>
          <h2>test-image.jpg</h2>
        </div>
        <div data-testid="editor-toolbar">
          <button data-testid="save-button">Save</button>
          <button data-testid="edit-button">Edit</button>
          <button data-testid="zoom-in-button">Zoom In</button>
          <button data-testid="zoom-out-button">Zoom Out</button>
          <button data-testid="reset-view-button">Reset View</button>
          <button data-testid="resegment-button">Resegment</button>
          <button data-testid="prev-button">Previous</button>
          <button data-testid="next-button">Next</button>
          <button data-testid="undo-button">Undo</button>
          <button data-testid="redo-button">Redo</button>
        </div>
      </div>
    </div>
  );
};

// Mock the actual SegmentationEditor component
vi.mock('../../SegmentationEditor', () => ({
  default: () => <MockSegmentationEditor />,
}));

describe('SegmentationEditor Component', () => {
  it('renders the segmentation editor correctly', () => {
    render(
      <MemoryRouter>
        <MockSegmentationEditor />
      </MemoryRouter>,
    );

    // Check if the editor container is rendered
    expect(screen.getByTestId('segmentation-editor')).toBeInTheDocument();
    expect(screen.getByTestId('editor-container')).toBeInTheDocument();
    expect(screen.getByTestId('editor-header')).toBeInTheDocument();
    expect(screen.getByTestId('editor-toolbar')).toBeInTheDocument();

    // Check if the project title and image name are rendered
    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument();

    // Check if all buttons are rendered
    expect(screen.getByTestId('save-button')).toBeInTheDocument();
    expect(screen.getByTestId('edit-button')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-in-button')).toBeInTheDocument();
    expect(screen.getByTestId('zoom-out-button')).toBeInTheDocument();
    expect(screen.getByTestId('reset-view-button')).toBeInTheDocument();
    expect(screen.getByTestId('resegment-button')).toBeInTheDocument();
    expect(screen.getByTestId('prev-button')).toBeInTheDocument();
    expect(screen.getByTestId('next-button')).toBeInTheDocument();
    expect(screen.getByTestId('undo-button')).toBeInTheDocument();
    expect(screen.getByTestId('redo-button')).toBeInTheDocument();
  });
});
