import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import ProjectCard from '../ProjectCard';

// Mock the useTranslation hook
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === 'project.image') return 'image';
      if (key === 'project.images') return 'images';
      if (key === 'project.noDescription') return 'No description';
      return key;
    },
  }),
}));

// Mock the ProjectActions component
vi.mock('@/components/project/ProjectActions', () => ({
  default: ({ projectId, onDelete, onDuplicate }: any) => (
    <div data-testid="project-actions">
      <button data-testid="delete-button" onClick={() => onDelete?.()}>
        Delete
      </button>
      <button
        data-testid="duplicate-button"
        onClick={() => onDuplicate?.({ id: 'new-id', title: 'Duplicated Project' })}
      >
        Duplicate
      </button>
    </div>
  ),
}));

describe('ProjectCard Component', () => {
  const mockProject = {
    id: 'project-1',
    title: 'Test Project',
    description: 'This is a test project',
    created_at: '2023-01-01T00:00:00.000Z',
    updated_at: '2023-01-02T00:00:00.000Z',
    image_count: 5,
    thumbnail_url: 'https://example.com/thumbnail.jpg',
  };

  const mockProjectNoThumbnail = {
    ...mockProject,
    thumbnail_url: undefined,
  };

  const mockProjectNoDescription = {
    ...mockProject,
    description: '',
  };

  const mockProjectSingleImage = {
    ...mockProject,
    image_count: 1,
  };

  const defaultProps = {
    project: mockProject,
    onProjectDeleted: vi.fn(),
    onProjectDuplicated: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(
      <MemoryRouter>
        <ProjectCard {...defaultProps} {...props} />
      </MemoryRouter>,
    );
  };

  it('renders project title and description', () => {
    renderComponent();

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('This is a test project')).toBeInTheDocument();
  });

  it('renders "No description" when description is empty', () => {
    renderComponent({ project: mockProjectNoDescription });

    expect(screen.getByText('No description')).toBeInTheDocument();
  });

  it('renders thumbnail image when available', () => {
    renderComponent();

    const image = screen.getByAltText('Test Project');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', '/api' + mockProject.thumbnail_url);
  });

  it('renders placeholder when thumbnail is not available', () => {
    renderComponent({ project: mockProjectNoThumbnail });

    expect(screen.queryByAltText('Test Project')).not.toBeInTheDocument();
    expect(screen.getByTestId('project-actions')).toBeInTheDocument();
  });

  it('renders correct image count text for multiple images', () => {
    renderComponent();

    expect(screen.getByText('5 images')).toBeInTheDocument();
  });

  it('renders correct image count text for a single image', () => {
    renderComponent({ project: mockProjectSingleImage });

    expect(screen.getByText('1 image')).toBeInTheDocument();
  });

  it('calls onProjectDeleted when delete button is clicked', () => {
    renderComponent();

    const deleteButton = screen.getByTestId('delete-button');
    fireEvent.click(deleteButton);

    expect(defaultProps.onProjectDeleted).toHaveBeenCalledWith('project-1');
  });

  it('calls onProjectDuplicated when duplicate button is clicked', () => {
    renderComponent();

    const duplicateButton = screen.getByTestId('duplicate-button');
    fireEvent.click(duplicateButton);

    expect(defaultProps.onProjectDuplicated).toHaveBeenCalledWith({
      id: 'new-id',
      title: 'Duplicated Project',
    });
  });

  it('renders a link to the project detail page', () => {
    renderComponent();

    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);

    // Check that at least one link has the correct href
    const hasCorrectLink = links.some((link) => link.getAttribute('href') === '/projects/project-1');
    expect(hasCorrectLink).toBe(true);
  });
});
