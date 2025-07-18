import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import FileList, { FileWithPreview } from '../FileList';
import '@testing-library/jest-dom';

// Mock UI components
vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
}));

vi.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => <div role="progressbar" aria-valuenow={value} {...props} />,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  ImagePlus: () => <div data-testid="image-plus-icon" />,
  FileX: () => <div data-testid="file-x-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock language context
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

// Create sample mock files
const createSampleMockFiles = (): FileWithPreview[] => [
  {
    name: 'image1.jpg',
    size: 500 * 1024, // 500 KB
    type: 'image/jpeg',
    preview: 'preview-url-1',
    status: 'pending',
    lastModified: Date.now(),
  } as FileWithPreview,
  {
    name: 'image2.jpg',
    size: 2.5 * 1024 * 1024, // 2.5 MB
    type: 'image/jpeg',
    status: 'uploading',
    lastModified: Date.now(),
  } as FileWithPreview,
  {
    name: 'image3.jpg',
    size: 100 * 1024, // 100 KB
    type: 'image/jpeg',
    preview: 'preview-url-3',
    status: 'complete',
    lastModified: Date.now(),
  } as FileWithPreview,
  {
    name: 'image4.jpg',
    size: 5 * 1024 * 1024, // 5 MB
    type: 'image/jpeg',
    status: 'error',
    lastModified: Date.now(),
  } as FileWithPreview,
];

describe('FileList Component', () => {
  const mockFiles = createSampleMockFiles();
  const mockOnRemoveFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when files array is empty', () => {
    const { container } = render(<FileList files={[]} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders file items when files are provided', () => {
    render(<FileList files={mockFiles} uploadProgress={50} onRemoveFile={mockOnRemoveFile} />);

    // Check if all file names are rendered
    expect(screen.getByText('image1.jpg')).toBeInTheDocument();
    expect(screen.getByText('image2.jpg')).toBeInTheDocument();
    expect(screen.getByText('image3.jpg')).toBeInTheDocument();
    expect(screen.getByText('image4.jpg')).toBeInTheDocument();
  });

  it('shows file size in appropriate format', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Check if file sizes are formatted correctly
    expect(screen.getByText('500 KB')).toBeInTheDocument();
    expect(screen.getByText('2.5 MB')).toBeInTheDocument();
    expect(screen.getByText('100 KB')).toBeInTheDocument();
    expect(screen.getByText('5.0 MB')).toBeInTheDocument(); // toFixed(1) produces "5.0" not "5"
  });

  it('displays preview images when available', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Get all img elements
    const previewImages = screen.getAllByRole('img');

    // Check if we have preview images for files with preview URLs (mockFiles[0] and mockFiles[2])
    expect(previewImages.length).toBe(2);
    expect(previewImages[0]).toHaveAttribute('src', 'preview-url-1');
    expect(previewImages[1]).toHaveAttribute('src', 'preview-url-3');
  });

  it('calls onRemoveFile when remove button is clicked', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Find all remove buttons and click the first one
    const removeButtons = screen.getAllByRole('button');
    fireEvent.click(removeButtons[0]);

    // Check if onRemoveFile was called with the correct file
    expect(mockOnRemoveFile).toHaveBeenCalledTimes(1);
    expect(mockOnRemoveFile).toHaveBeenCalledWith(mockFiles[0]);
  });

  it('shows upload progress for uploading files', () => {
    render(<FileList files={mockFiles} uploadProgress={75} onRemoveFile={mockOnRemoveFile} />);

    // Check if progress bars are rendered for files in uploading state
    const progressBars = screen.getAllByRole('progressbar');
    expect(progressBars.length).toBe(1); // Only the second file is in 'uploading' state

    // Check if the progress value is correctly set
    expect(progressBars[0]).toHaveAttribute('aria-valuenow', '75');
  });

  it('displays appropriate status indicators', () => {
    render(<FileList files={mockFiles} uploadProgress={0} onRemoveFile={mockOnRemoveFile} />);

    // Pending status for first file
    expect(screen.getByText('dashboard.pending')).toBeInTheDocument();

    // Uploading status for second file - component uses 'dashboard.processing' not 'files.uploading'
    expect(screen.getByText('dashboard.processing')).toBeInTheDocument();

    // Complete status for third file - shown as icon
    expect(screen.getByTestId('check-circle-icon')).toBeInTheDocument();

    // Error status for fourth file - shown as icon
    expect(screen.getByTestId('file-x-icon')).toBeInTheDocument();
  });
});
