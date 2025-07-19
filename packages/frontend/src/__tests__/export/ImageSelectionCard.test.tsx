import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, beforeEach, expect } from 'vitest';
import ImageSelectionCard from '@/pages/export/components/ImageSelectionCard';

// Mock language context
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
  }),
}));

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Mock radix-optimized library
vi.mock('@/lib/radix-optimized', () => ({
  CheckboxRoot: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CheckboxIndicator: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogRoot: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogTrigger: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  DialogPortal: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogOverlay: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  DialogDescription: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  DialogClose: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: ({ checked, onCheckedChange, ...props }: any) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange?.(e.target.checked)} {...props} />
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon" />,
  Check: () => <div data-testid="check-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock date utils
vi.mock('@/utils/dateUtils', () => ({
  safeFormatDate: (_date: any) => 'mocked-date',
}));

// Mock types
vi.mock('@/types', () => ({}));

describe('ImageSelectionCard', () => {
  const mockImages = [
    {
      id: 'image1',
      name: 'test1.jpg',
      url: '/images/test1.jpg',
      thumbnail_url: '/thumbnails/test1.jpg',
      width: 800,
      height: 600,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      segmentationStatus: 'completed',
      segmentationResult: JSON.stringify({
        polygons: [
          {
            id: 'polygon1',
            type: 'external',
            points: [
              { x: 100, y: 100 },
              { x: 200, y: 100 },
              { x: 200, y: 200 },
              { x: 100, y: 200 },
            ],
          },
        ],
      }),
    },
    {
      id: 'image2',
      name: 'test2.jpg',
      url: '/images/test2.jpg',
      thumbnail_url: null,
      width: 800,
      height: 600,
      createdAt: new Date('2023-01-02'),
      updatedAt: new Date('2023-01-02'),
      segmentationStatus: 'pending',
      segmentationResult: null,
    },
  ];

  const mockProps = {
    images: mockImages,
    loading: false,
    selectedImages: { image1: true, image2: false },
    handleSelectAll: vi.fn(),
    handleSelectImage: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the image selection card with images', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Check if images are rendered
    expect(screen.getByText('test1.jpg')).toBeInTheDocument();
    expect(screen.getByText('test2.jpg')).toBeInTheDocument();
  });

  it('shows loading state when loading is true', () => {
    render(<ImageSelectionCard {...mockProps} loading={true} />);

    // Check for loading spinner by data-testid
    expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
  });

  it('shows empty state when no images are available', () => {
    render(<ImageSelectionCard {...mockProps} images={[]} />);

    // Look for translation key since we're mocking t() to return keys
    expect(screen.getByText(/no.*images|export\.noImages|images\.none/i)).toBeInTheDocument();
  });

  it('calls handleSelectAll when select all button is clicked', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Find the select all button by translation key
    const selectAllButton = screen.getByText(/select.*all|common\.selectAll|export\.selectAll/i);
    fireEvent.click(selectAllButton);

    expect(mockProps.handleSelectAll).toHaveBeenCalled();
  });

  it('calls handleSelectImage when an image checkbox is clicked', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Find the image checkbox
    const imageCheckbox = document.getElementById('check-image2');
    fireEvent.click(imageCheckbox);

    expect(mockProps.handleSelectImage).toHaveBeenCalledWith('image2');
  });

  it('shows correct segmentation status icons', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Check if status icons are displayed by data-testid
    expect(screen.getByTestId('check-icon')).toBeInTheDocument(); // For completed image
  });

  it('renders image thumbnails and "No preview" for missing thumbnails', () => {
    render(<ImageSelectionCard {...mockProps} />);

    // Check if image names are displayed
    expect(screen.getByText('test1.jpg')).toBeInTheDocument();
    expect(screen.getByText('test2.jpg')).toBeInTheDocument();

    // Check if "No preview" is displayed for the second image
    expect(screen.getByText('No preview')).toBeInTheDocument();
  });
});
