import { screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import '@testing-library/jest-dom';
import EditorHeader from '../EditorHeader';
import {
  resetAllMocks,
  defaultEditorHeaderProps,
  renderEditorComponent,
} from '../../../../../shared/test-utils/componentTestUtils';

// Import shared mock setup
import { setupEditorMocks } from '../../../../../shared/test-utils/mock-contexts';

// Setup all mocks
setupEditorMocks();

describe('EditorHeader Component', () => {
  const renderComponent = (props = {}) => {
    return renderEditorComponent(<EditorHeader {...defaultEditorHeaderProps} {...props} />);
  };

  beforeEach(() => {
    resetAllMocks();
  });

  it('renders the project title and image name', () => {
    renderComponent();

    expect(screen.getByText('Test Project')).toBeInTheDocument();
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
  });

  it('disables navigation buttons when canNavigate is false', () => {
    renderComponent({ canNavigate: false });

    const prevButton = screen.getByTestId('prev-image-button');
    const nextButton = screen.getByTestId('next-image-button');

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('calls navigate function when next/prev buttons are clicked', () => {
    const mockOnNavigate = vi.fn();
    renderComponent({ onNavigate: mockOnNavigate });

    const prevButton = screen.getByTestId('prev-image-button');
    const nextButton = screen.getByTestId('next-image-button');

    fireEvent.click(prevButton);
    expect(mockOnNavigate).toHaveBeenCalledWith('prev');

    fireEvent.click(nextButton);
    expect(mockOnNavigate).toHaveBeenCalledWith('next');
  });

  it('shows image counter correctly', () => {
    renderComponent();

    const counter = screen.getByText('1 / 3');
    expect(counter).toBeInTheDocument();
  });

  it('calls save function when save button is clicked', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    renderComponent({ onSave: mockOnSave });

    const saveButton = screen.getByTestId('save-button');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('disables save button when saving', () => {
    renderComponent({ saving: true });

    const saveButton = screen.getByTestId('save-button');
    expect(saveButton).toBeDisabled();
  });

  it('calls export mask function when export button is clicked', () => {
    const mockOnExportMask = vi.fn();
    renderComponent({ onExportMask: mockOnExportMask });

    const exportButton = screen.getByTestId('export-mask-button');
    fireEvent.click(exportButton);

    expect(mockOnExportMask).toHaveBeenCalledTimes(1);
  });
});
