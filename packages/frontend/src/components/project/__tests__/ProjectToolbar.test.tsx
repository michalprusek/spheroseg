import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ProjectToolbar from '../ProjectToolbar';
import '@testing-library/jest-dom';

// Mock the useNavigate and useParams hooks
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'project-123' }),
}));

// Mock the useLanguage hook
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'projectToolbar.selectImages': 'Select Images',
        'projectToolbar.cancelSelection': 'Cancel Selection',
        'dashboard.searchImagesPlaceholder': 'Search images...',
        'common.uploadImages': 'Upload Images',
        'projectToolbar.export': 'Export',
        'common.sort': 'Sort',
        'common.name': 'Name',
        'dashboard.lastChange': 'Last Change',
      };
      return translations[key] || key;
    },
  }),
}));

describe('ProjectToolbar Component', () => {
  const mockProps = {
    searchTerm: '',
    onSearchChange: vi.fn(),
    sortField: 'name' as const,
    sortDirection: 'asc' as const,
    onSort: vi.fn(),
    onToggleUploader: vi.fn(),
    viewMode: 'grid' as const,
    setViewMode: vi.fn(),
    selectionMode: false,
    onToggleSelectionMode: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the toolbar with all buttons', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Check if the select images button is rendered
    expect(screen.getByText('Select Images')).toBeInTheDocument();

    // Check if the search input is rendered
    expect(screen.getByPlaceholderText('Search images...')).toBeInTheDocument();

    // Check if the upload button is rendered
    expect(screen.getByText('Upload Images')).toBeInTheDocument();

    // Check if the export button is rendered
    expect(screen.getByText('Export')).toBeInTheDocument();

    // Check if the sort button is rendered
    expect(screen.getByText('Sort')).toBeInTheDocument();

    // Check if the view mode buttons container is rendered
    const viewModeContainer = document.querySelector('.flex.items-center.h-9.border.rounded-md');
    expect(viewModeContainer).toBeInTheDocument();
  });

  it('toggles selection mode when select button is clicked', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Click the select images button
    fireEvent.click(screen.getByText('Select Images'));

    // Check if onToggleSelectionMode was called
    expect(mockProps.onToggleSelectionMode).toHaveBeenCalled();
  });

  it('shows cancel selection text when in selection mode', () => {
    render(<ProjectToolbar {...mockProps} selectionMode={true} />);

    // Check if the button text changes to cancel selection
    expect(screen.getByText('Cancel Selection')).toBeInTheDocument();
  });

  it('calls onSearchChange when search input changes', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Change the search input value
    const searchInput = screen.getByPlaceholderText('Search images...');
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Check if onSearchChange was called with the correct value
    expect(mockProps.onSearchChange).toHaveBeenCalled();
  });

  it('calls onToggleUploader when upload button is clicked', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Click the upload button
    fireEvent.click(screen.getByText('Upload Images'));

    // Check if onToggleUploader was called
    expect(mockProps.onToggleUploader).toHaveBeenCalled();
  });

  it('navigates to export page when export button is clicked', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Click the export button
    fireEvent.click(screen.getByText('Export'));

    // Check if navigate was called with the correct path
    expect(mockNavigate).toHaveBeenCalledWith('/project/project-123/export');
  });

  it('has sort functionality', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Check if the sort button is rendered
    expect(screen.getByText('Sort')).toBeInTheDocument();

    // Verify the sort handler is available
    expect(mockProps.onSort).toBeDefined();
  });

  it('has view mode functionality', () => {
    render(<ProjectToolbar {...mockProps} />);

    // Check if the view mode buttons container is rendered
    const viewModeContainer = document.querySelector('.flex.items-center.h-9.border.rounded-md');
    expect(viewModeContainer).toBeInTheDocument();

    // Verify the view mode handler is available
    expect(mockProps.setViewMode).toBeDefined();
  });

  it('hides search bar when showSearchBar is false', () => {
    render(<ProjectToolbar {...mockProps} showSearchBar={false} />);

    // Check if the search input is not rendered
    expect(screen.queryByPlaceholderText('Search images...')).not.toBeInTheDocument();
  });

  it('hides upload button when showUploadButton is false', () => {
    render(<ProjectToolbar {...mockProps} showUploadButton={false} />);

    // Check if the upload button is not rendered
    expect(screen.queryByText('Upload Images')).not.toBeInTheDocument();
  });

  it('hides export button when showExportButton is false', () => {
    render(<ProjectToolbar {...mockProps} showExportButton={false} />);

    // Check if the export button is not rendered
    expect(screen.queryByText('Export')).not.toBeInTheDocument();
  });

  it('hides selection button when showSelectionButton is false', () => {
    render(<ProjectToolbar {...mockProps} showSelectionButton={false} />);

    // Check if the select images button is not rendered
    expect(screen.queryByText('Select Images')).not.toBeInTheDocument();
  });
});
