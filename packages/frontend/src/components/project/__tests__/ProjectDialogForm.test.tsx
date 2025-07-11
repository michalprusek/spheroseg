import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ProjectDialogForm from '../ProjectDialogForm';
import '@testing-library/jest-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProjectForm } from '@/hooks/useProjectForm';
import { Dialog, DialogContent } from '@/components/ui/dialog';

// Mock dependencies
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: vi.fn(() => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'projects.createProject': 'Create Project',
        'projects.createProjectDesc': 'Create a new project to upload and segment images',
        'common.projectName': 'Project Name',
        'projects.projectNamePlaceholder': 'Enter project name',
        'common.description': 'Description',
        'common.optional': 'optional',
        'projects.projectDescPlaceholder': 'Enter project description',
        'projects.creatingProject': 'Creating Project...',
      };
      return translations[key] || key;
    },
  })),
}));

vi.mock('@/hooks/useProjectForm', () => ({
  useProjectForm: vi.fn(),
}));

describe('ProjectDialogForm Component', () => {
  // Mock form handlers and state
  const mockSetProjectName = vi.fn();
  const mockSetProjectDescription = vi.fn();
  const mockHandleCreateProject = vi.fn((e) => {
    e.preventDefault();
    return Promise.resolve({ id: 'test-project-id' });
  });
  const mockOnSuccess = vi.fn();
  const mockOnClose = vi.fn();

  // Helper function to render the component with Dialog wrapper
  const renderWithDialog = (ui: React.ReactElement) => {
    return render(
      <Dialog open={true}>
        <DialogContent>{ui}</DialogContent>
      </Dialog>,
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementation
    (useProjectForm as any).mockReturnValue({
      projectName: 'Test Project',
      setProjectName: mockSetProjectName,
      projectDescription: 'Test Description',
      setProjectDescription: mockSetProjectDescription,
      isCreating: false,
      handleCreateProject: mockHandleCreateProject,
    });
  });

  it('renders the form with correct elements', () => {
    renderWithDialog(<ProjectDialogForm onSuccess={mockOnSuccess} onClose={mockOnClose} />);

    // Check for header elements - use more specific queries
    expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument();
    expect(screen.getByText('Create a new project to upload and segment images')).toBeInTheDocument();

    // Check for form inputs
    expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter project name')).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter project description')).toBeInTheDocument();

    // Check for submit button
    expect(screen.getByRole('button', { name: 'Create Project' })).toBeInTheDocument();
  });

  it('handles input changes correctly', () => {
    renderWithDialog(<ProjectDialogForm onSuccess={mockOnSuccess} onClose={mockOnClose} />);

    // Get inputs
    const nameInput = screen.getByLabelText('Project Name');
    const descInput = screen.getByLabelText(/Description/);

    // Change name input
    fireEvent.change(nameInput, { target: { value: 'New Project Name' } });
    expect(mockSetProjectName).toHaveBeenCalledWith('New Project Name');

    // Change description input
    fireEvent.change(descInput, { target: { value: 'New Description' } });
    expect(mockSetProjectDescription).toHaveBeenCalledWith('New Description');
  });

  it('handles form submission correctly', async () => {
    renderWithDialog(<ProjectDialogForm onSuccess={mockOnSuccess} onClose={mockOnClose} />);

    // Get the submit button
    const submitButton = screen.getByRole('button', { name: 'Create Project' });

    // Click the submit button
    fireEvent.click(submitButton);

    // Check if handleCreateProject was called
    expect(mockHandleCreateProject).toHaveBeenCalled();
  });

  it('disables submit button when isCreating is true', () => {
    // Mock isCreating state to be true
    (useProjectForm as any).mockReturnValue({
      projectName: 'Test Project',
      setProjectName: mockSetProjectName,
      projectDescription: 'Test Description',
      setProjectDescription: mockSetProjectDescription,
      isCreating: true,
      handleCreateProject: mockHandleCreateProject,
    });

    renderWithDialog(<ProjectDialogForm onSuccess={mockOnSuccess} onClose={mockOnClose} />);

    // Get submit button
    const submitButton = screen.getByRole('button', {
      name: 'Creating Project...',
    });

    // Check if button is disabled
    expect(submitButton).toBeDisabled();
  });

  it('passes onSuccess and onClose to useProjectForm', () => {
    renderWithDialog(<ProjectDialogForm onSuccess={mockOnSuccess} onClose={mockOnClose} />);

    // Check if useProjectForm was called with correct props
    expect(useProjectForm).toHaveBeenCalledWith({
      onSuccess: mockOnSuccess,
      onClose: mockOnClose,
    });
  });
});
