import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import ImageSelectionCard from '../ImageSelectionCard';

// Mock format from date-fns
vi.mock('date-fns', () => ({
  format: vi.fn(() => '2023-05-15'),
}));

// Mock radix-optimized components
vi.mock('@/lib/radix-optimized', () => ({
  CheckboxRoot: ({ children, onCheckedChange, checked, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      {...props}
    />
  ),
  CheckboxIndicator: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onCheckedChange && onCheckedChange(e.target.checked)}
      {...props}
    />
  ),
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children, htmlFor, ...props }: any) => (
    <label htmlFor={htmlFor} {...props}>{children}</label>
  ),
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => (
    <div className={className} {...props}>Loading...</div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Check: () => <div data-testid="check-icon" />,
  Image: () => <div data-testid="image-icon" />,
  X: () => <div data-testid="x-icon" />,
  Loader2: () => <div data-testid="loader2-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'export.selectImagesToExport': 'Select Images to Export',
        'common.selectAll': 'Select All',
        'common.deselectAll': 'Deselect All',
        'export.noImagesAvailable': 'No images available for export',
        'export.imageSelection.loading': 'Loading images...',
        'export.imageSelection.noPreview': 'No preview',
        'export.imageSelection.imageStatus.completed': 'Completed',
        'export.imageSelection.imageStatus.processing': 'Processing',
        'export.imageSelection.imageStatus.failed': 'Failed',
        'export.imageSelection.imageStatus.pending': 'Pending',
        'export.imageSelection.createdAt': 'Created',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock date utils
vi.mock('@/utils/dateUtils', () => ({
  safeFormatDate: vi.fn(() => 'July 16, 2025'),
}));

describe('ImageSelectionCard Component', () => {
  const mockImages = [
    {
      id: 'image-1',
      name: 'Test Image 1.jpg',
      thumbnail_url: 'http://example.com/thumb1.jpg',
      segmentationStatus: 'completed',
      createdAt: new Date(),
    },
    {
      id: 'image-2',
      name: 'Test Image 2.jpg',
      thumbnail_url: null,
      segmentationStatus: 'in_progress',
      createdAt: new Date(),
    },
    {
      id: 'image-3',
      name: 'Test Image 3.jpg',
      thumbnail_url: 'http://example.com/thumb3.jpg',
      segmentationStatus: 'failed',
      createdAt: new Date(),
    },
  ];

  const defaultProps = {
    images: mockImages,
    loading: false,
    selectedImages: {
      'image-1': true,
      'image-2': false,
      'image-3': true,
    },
    handleSelectAll: vi.fn(),
    handleSelectImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders correctly with images', () => {
    render(<ImageSelectionCard {...defaultProps} />);

    // Check title and button
    expect(screen.getByText('export.selectImagesToExport')).toBeInTheDocument();
    expect(screen.getByText('common.deselectAll')).toBeInTheDocument();

    // Check if all images are rendered
    expect(screen.getByText('Test Image 1.jpg')).toBeInTheDocument();
    expect(screen.getByText('Test Image 2.jpg')).toBeInTheDocument();
    expect(screen.getByText('Test Image 3.jpg')).toBeInTheDocument();

    // Check checkboxes
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked(); // image-1 is selected
    expect(checkboxes[1]).not.toBeChecked(); // image-2 is not selected
    expect(checkboxes[2]).toBeChecked(); // image-3 is selected
  });

  it('shows loading spinner when loading is true', () => {
    render(<ImageSelectionCard {...defaultProps} loading={true} />);

    // Check loading spinner
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Images should not be rendered
    expect(screen.queryByText('Test Image 1.jpg')).not.toBeInTheDocument();
  });

  it('shows message when no images are available', () => {
    render(<ImageSelectionCard {...defaultProps} images={[]} />);

    // Check empty message
    expect(screen.getByText('export.noImagesAvailable')).toBeInTheDocument();
  });

  it('calls handleSelectAll when select all button is clicked', () => {
    render(<ImageSelectionCard {...defaultProps} />);

    // Click select all button
    fireEvent.click(screen.getByText('Odznačit vše'));

    // Check if handleSelectAll was called
    expect(defaultProps.handleSelectAll).toHaveBeenCalledTimes(1);
  });

  it('shows "Select all" button text when no images are selected', () => {
    render(
      <ImageSelectionCard
        {...defaultProps}
        selectedImages={{
          'image-1': false,
          'image-2': false,
          'image-3': false,
        }}
      />,
    );

    expect(screen.getByText('common.selectAll')).toBeInTheDocument();
  });

  it('calls handleSelectImage when an image item is clicked', () => {
    render(<ImageSelectionCard {...defaultProps} />);

    // Click on first image
    fireEvent.click(screen.getByText('Test Image 1.jpg').closest('div'));

    // Check if handleSelectImage was called with correct ID
    expect(defaultProps.handleSelectImage).toHaveBeenCalledTimes(1);
    expect(defaultProps.handleSelectImage).toHaveBeenCalledWith('image-1');
  });

  it('calls handleSelectImage when a checkbox is clicked', () => {
    render(<ImageSelectionCard {...defaultProps} />);

    // Get all checkboxes
    const checkboxes = screen.getAllByRole('checkbox');

    // Click second checkbox
    fireEvent.click(checkboxes[1]);

    // Check if handleSelectImage was called with correct ID
    expect(defaultProps.handleSelectImage).toHaveBeenCalledTimes(1);
    expect(defaultProps.handleSelectImage).toHaveBeenCalledWith('image-2');
  });

  it('displays appropriate status icons for images', () => {
    render(<ImageSelectionCard {...defaultProps} />);

    // Check for check icon (completed)
    const checkIcons = screen.getAllByTestId('check');
    expect(checkIcons).toHaveLength(1);

    // Check for x icon (failed)
    const xIcons = screen.getAllByTestId('x');
    expect(xIcons).toHaveLength(1);
  });

  it('displays placeholder for missing thumbnails', () => {
    render(<ImageSelectionCard {...defaultProps} />);

    // Check for "No preview" text in the second image (no thumbnail)
    expect(screen.getByText('No preview')).toBeInTheDocument();
  });
});
