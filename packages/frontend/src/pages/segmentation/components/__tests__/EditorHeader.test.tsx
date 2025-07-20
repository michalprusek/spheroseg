import React from 'react';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';
import EditorHeader from '../EditorHeader';
import {
  resetAllMocks,
  defaultEditorHeaderProps,
  renderEditorComponent,
} from './editorTestUtils';

// Mock modules - must be hoisted
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
  LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/pages/segmentation/contexts/SegmentationContext', () => ({
  useSegmentationContext: () => ({
    segmentation: null,
    loading: false,
  }),
  SegmentationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon" />,
  ChevronLeft: () => <div data-testid="chevron-left-icon" />,
  ChevronRight: () => <div data-testid="chevron-right-icon" />,
  Save: () => <div data-testid="save-icon" />,
  Download: () => <div data-testid="download-icon" />,
  RefreshCcw: () => <div data-testid="refresh-icon" />,
  Image: () => <div data-testid="image-icon" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipProvider: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../project/ProjectImageExport', () => ({
  default: () => <div data-testid="project-image-export" />,
}));

describe('EditorHeader Component', () => {
  const renderComponent = (props = {}) => {
    return renderEditorComponent(<EditorHeader {...defaultEditorHeaderProps} {...props} />);
  };

  beforeEach(() => {
    resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the project title and image name', () => {
    renderComponent();

    // Use more specific selector for project title (h1 element)
    expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument();
    // Use getAllByText and check the first one for image name
    const imageNames = screen.getAllByText('test-image.jpg');
    expect(imageNames[0]).toBeInTheDocument();
  });

  it('disables navigation buttons when at boundaries', () => {
    // Test when at first image
    const { unmount } = renderComponent({ currentImageIndex: 0 });
    const prevButton = screen.getByLabelText('editor.previousImage');
    expect(prevButton).toBeDisabled();
    unmount();

    // Test when at last image
    renderComponent({ currentImageIndex: 2, totalImages: 3 });
    const buttons = screen.getAllByRole('button', { name: 'editor.nextImage' });
    // Get the last button (which should be the one we just rendered)
    const nextButton = buttons[buttons.length - 1];
    expect(nextButton).toBeDisabled();
  });

  it('calls navigate function when next/prev buttons are clicked', () => {
    const mockOnNavigate = vi.fn();
    renderComponent({ onNavigate: mockOnNavigate, currentImageIndex: 1 });

    const prevButton = screen.getByLabelText('editor.previousImage');
    const nextButton = screen.getByLabelText('editor.nextImage');

    fireEvent.click(prevButton);
    expect(mockOnNavigate).toHaveBeenCalledWith('prev');

    fireEvent.click(nextButton);
    expect(mockOnNavigate).toHaveBeenCalledWith('next');
  });

  it('shows image counter correctly', () => {
    renderComponent();

    // Check the counter text is present in the span element
    const counterSpan = screen.getByText(/test-image\.jpg \(1 \/ 3\)/);
    expect(counterSpan).toBeInTheDocument();
  });

  it('calls save function when save button is clicked', async () => {
    const mockOnSave = vi.fn().mockResolvedValue(undefined);
    renderComponent({ onSave: mockOnSave });

    const saveButton = screen.getByLabelText('editor.saveButton');
    fireEvent.click(saveButton);

    expect(mockOnSave).toHaveBeenCalledTimes(1);
  });

  it('disables save button when saving', () => {
    renderComponent({ saving: true });

    const saveButton = screen.getByLabelText('editor.saveButton');
    expect(saveButton).toBeDisabled();
  });

  it('calls export mask function when export button is clicked', () => {
    const mockOnExportMask = vi.fn();
    renderComponent({ onExportMask: mockOnExportMask });

    const exportButton = screen.getByLabelText('editor.exportMaskButton');
    fireEvent.click(exportButton);

    expect(mockOnExportMask).toHaveBeenCalledTimes(1);
  });
});
