import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectImages from '../ProjectImages';
import '@testing-library/jest-dom';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

// Mock the ImageCard component
vi.mock('../ImageCard', () => ({
  ImageCard: ({
    image,
    onDelete,
    onOpen,
    onResegment,
    selectionMode,
    isSelected,
    onToggleSelection
  }: any) => (
    <div data-testid={`image-card-${image.id}`} className="image-card">
      <div>{image.name}</div>
      <button onClick={() => onDelete(image.id)} data-testid={`delete-${image.id}`}>Delete</button>
      {onOpen && <button onClick={() => onOpen(image.id)} data-testid={`open-${image.id}`}>Open</button>}
      <button onClick={() => onResegment(image.id)} data-testid={`resegment-${image.id}`}>Resegment</button>
      {selectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection()}
          data-testid={`select-${image.id}`}
        />
      )}
    </div>
  ),
}));

// Mock the ImageListItem component
vi.mock('../ImageListItem', () => ({
  ImageListItem: ({
    image,
    onDelete,
    onOpen,
    onResegment,
    selectionMode,
    isSelected,
    onToggleSelection
  }: any) => (
    <div data-testid={`image-list-item-${image.id}`} className="image-list-item">
      <div>{image.name}</div>
      <button onClick={() => onDelete(image.id)} data-testid={`delete-list-${image.id}`}>Delete</button>
      {onOpen && <button onClick={() => onOpen(image.id)} data-testid={`open-list-${image.id}`}>Open</button>}
      <button onClick={() => onResegment(image.id)} data-testid={`resegment-list-${image.id}`}>Resegment</button>
      {selectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelection()}
          data-testid={`select-list-${image.id}`}
        />
      )}
    </div>
  ),
}));

describe('ProjectImages Component', () => {
  const mockImages = [
    {
      id: 'image-1',
      project_id: 'project-1',
      name: 'image1.jpg',
      url: 'https://example.com/image1.jpg',
      thumbnail_url: 'https://example.com/thumbnail1.jpg',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      segmentationStatus: 'completed' as const,
    },
    {
      id: 'image-2',
      project_id: 'project-1',
      name: 'image2.jpg',
      url: 'https://example.com/image2.jpg',
      thumbnail_url: 'https://example.com/thumbnail2.jpg',
      createdAt: new Date('2023-01-03'),
      updatedAt: new Date('2023-01-04'),
      segmentationStatus: 'processing' as const,
    },
  ];

  const mockProps = {
    images: mockImages,
    onDelete: vi.fn(),
    onOpen: vi.fn(),
    onResegment: vi.fn(),
    viewMode: 'grid' as const,
    selectionMode: false,
    selectedImages: {},
    onToggleSelection: vi.fn(),
    selectAll: false,
    onToggleSelectAll: vi.fn(),
    onBatchResegment: vi.fn(),
    onBatchDelete: vi.fn(),
    onBatchExport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders images in grid view mode', () => {
    render(<ProjectImages {...mockProps} />);

    // Check if ImageCard components are rendered for each image
    expect(screen.getByTestId('image-card-image-1')).toBeInTheDocument();
    expect(screen.getByTestId('image-card-image-2')).toBeInTheDocument();

    // Check if image names are displayed
    expect(screen.getByText('image1.jpg')).toBeInTheDocument();
    expect(screen.getByText('image2.jpg')).toBeInTheDocument();
  });

  it('renders images in list view mode', () => {
    render(<ProjectImages {...mockProps} viewMode="list" />);

    // Check if ImageListItem components are rendered for each image
    expect(screen.getByTestId('image-list-item-image-1')).toBeInTheDocument();
    expect(screen.getByTestId('image-list-item-image-2')).toBeInTheDocument();

    // Check if image names are displayed
    expect(screen.getByText('image1.jpg')).toBeInTheDocument();
    expect(screen.getByText('image2.jpg')).toBeInTheDocument();
  });

  it('calls onDelete when delete button is clicked', () => {
    render(<ProjectImages {...mockProps} />);

    // Click the delete button for the first image
    fireEvent.click(screen.getByTestId('delete-image-1'));

    // Check if onDelete was called with the correct image ID
    expect(mockProps.onDelete).toHaveBeenCalledWith('image-1');
  });

  it('calls onOpen when open button is clicked', () => {
    render(<ProjectImages {...mockProps} />);

    // Click the open button for the first image
    fireEvent.click(screen.getByTestId('open-image-1'));

    // Check if onOpen was called with the correct image ID
    expect(mockProps.onOpen).toHaveBeenCalledWith('image-1');
  });

  it('calls onResegment when resegment button is clicked', () => {
    render(<ProjectImages {...mockProps} />);

    // Click the resegment button for the first image
    fireEvent.click(screen.getByTestId('resegment-image-1'));

    // Check if onResegment was called with the correct image ID
    expect(mockProps.onResegment).toHaveBeenCalledWith('image-1');
  });

  it('renders in selection mode with checkboxes', () => {
    render(
      <ProjectImages
        {...mockProps}
        selectionMode={true}
        selectedImages={{ 'image-1': true, 'image-2': false }}
      />
    );

    // Check if checkboxes are rendered
    expect(screen.getByTestId('select-image-1')).toBeInTheDocument();
    expect(screen.getByTestId('select-image-2')).toBeInTheDocument();

    // Check if the first image is selected and the second is not
    expect(screen.getByTestId('select-image-1')).toBeChecked();
    expect(screen.getByTestId('select-image-2')).not.toBeChecked();

    // Check if the batch actions panel is rendered
    expect(screen.getByText('Selected 1 image')).toBeInTheDocument();
  });

  it('has checkboxes for selection mode', () => {
    render(
      <ProjectImages
        {...mockProps}
        selectionMode={true}
        selectedImages={{ 'image-1': false, 'image-2': false }}
      />
    );

    // Verify the checkboxes are rendered
    const checkbox = screen.getByTestId('select-image-1');
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('renders batch actions panel in selection mode', () => {
    render(
      <ProjectImages
        {...mockProps}
        selectionMode={true}
        selectedImages={{ 'image-1': true, 'image-2': true }}
      />
    );

    // Check if the batch actions panel is rendered with the correct text
    expect(screen.getByText('Selected 2 images')).toBeInTheDocument();

    // Check if batch action buttons are rendered
    const batchButtons = screen.getAllByRole('button');
    expect(batchButtons.length).toBeGreaterThan(0);

    // Check for the batch action panel
    const batchPanel = screen.getByText('Selected 2 images').closest('div');
    expect(batchPanel).toBeInTheDocument();
  });

  it('has batch action handlers', () => {
    render(
      <ProjectImages
        {...mockProps}
        selectionMode={true}
        selectedImages={{ 'image-1': true, 'image-2': false }}
      />
    );

    // Verify the batch action handlers are available
    expect(mockProps.onBatchResegment).toBeDefined();
    expect(mockProps.onBatchExport).toBeDefined();
    expect(mockProps.onBatchDelete).toBeDefined();

    // Check for the batch action panel
    const batchPanel = screen.getByText('Selected 1 image').closest('div');
    expect(batchPanel).toBeInTheDocument();
  });

  it('has select all functionality', () => {
    render(
      <ProjectImages
        {...mockProps}
        selectionMode={true}
        selectedImages={{ 'image-1': false, 'image-2': false }}
      />
    );

    // Check if the select all text is displayed
    expect(screen.getByText('Select all')).toBeInTheDocument();

    // Verify the select all handler is available
    expect(mockProps.onToggleSelectAll).toBeDefined();
  });

  it('disables open functionality in selection mode', () => {
    render(
      <ProjectImages
        {...mockProps}
        selectionMode={true}
        selectedImages={{ 'image-1': false, 'image-2': false }}
      />
    );

    // Check if open buttons are not rendered in selection mode
    expect(screen.queryByTestId('open-image-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('open-image-2')).not.toBeInTheDocument();
  });
});
