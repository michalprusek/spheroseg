import React from 'react';
import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SegmentationProvider } from '@/pages/segmentation/contexts/SegmentationContext';

// Mock setup for editor tests
export const setupEditorMocks = () => {
  // Mock i18next
  vi.mock('react-i18next', () => ({
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: {
        changeLanguage: vi.fn(),
        language: 'en',
      },
    }),
    Trans: ({ children }: { children: React.ReactNode }) => children,
  }));

  // Mock LanguageContext
  vi.mock('@/contexts/LanguageContext', () => ({
    useLanguage: () => ({
      t: (key: string) => key,
      language: 'en',
    }),
    LanguageProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }));

  // Mock SegmentationContext
  vi.mock('@/pages/segmentation/contexts/SegmentationContext', () => ({
    useSegmentationContext: () => ({
      segmentation: null,
      loading: false,
    }),
    SegmentationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }));

  // Mock framer-motion
  vi.mock('framer-motion', () => ({
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    },
  }));

  // Mock lucide-react icons
  vi.mock('lucide-react', () => ({
    Loader2: () => <div data-testid="loader-icon" />,
    ChevronLeft: () => <div data-testid="chevron-left-icon" />,
    ChevronRight: () => <div data-testid="chevron-right-icon" />,
    Save: () => <div data-testid="save-icon" />,
    Download: () => <div data-testid="download-icon" />,
    RefreshCcw: () => <div data-testid="refresh-icon" />,
    Image: () => <div data-testid="image-icon" />,
  }));

  // Mock UI components
  vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  }));

  vi.mock('@/components/ui/tooltip', () => ({
    Tooltip: ({ children }: any) => <>{children}</>,
    TooltipProvider: ({ children }: any) => <>{children}</>,
    TooltipTrigger: ({ children }: any) => <>{children}</>,
    TooltipContent: ({ children }: any) => <div>{children}</div>,
  }));

  // Mock ProjectImageExport component
  vi.mock('../project/ProjectImageExport', () => ({
    default: () => <div data-testid="project-image-export" />,
  }));
};

// Default props for EditorHeader component
export const defaultEditorHeaderProps = {
  projectId: 'test-project-id',
  projectTitle: 'Test Project',
  imageName: 'test-image.jpg',
  imageId: 'test-image-id',
  saving: false,
  loading: false,
  currentImageIndex: 0,
  totalImages: 3,
  onNavigate: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
  onResegmentCurrentImage: vi.fn(),
  onExportMask: vi.fn(),
};

// Default props for EditorToolbar component
export const defaultEditorToolbarProps = {
  zoom: 1,
  onZoomIn: vi.fn(),
  onZoomOut: vi.fn(),
  onResetView: vi.fn(),
  onSave: vi.fn().mockResolvedValue(undefined),
  editMode: false,
  slicingMode: false,
  pointAddingMode: false,
  onToggleEditMode: vi.fn(),
  onToggleSlicingMode: vi.fn(),
  onTogglePointAddingMode: vi.fn(),
  onUndo: vi.fn(),
  onRedo: vi.fn(),
  canUndo: false,
  canRedo: false,
};

// Create test providers wrapper
const TestProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <MemoryRouter>
      <LanguageProvider>
        <SegmentationProvider projectId="test-project-id" imageId="test-image-id">
          {children}
        </SegmentationProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
};

// Render helper for editor components
export function renderEditorComponent(ui: React.ReactElement, options = {}) {
  return render(ui, {
    wrapper: TestProviders,
    ...options,
  });
}

// Reset all mocks
export function resetAllMocks() {
  vi.clearAllMocks();
  vi.resetAllMocks();
}