import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AvatarUploader from '../AvatarUploader';
import '@testing-library/jest-dom';

// Mock UI components
vi.mock('@/components/ui/avatar', () => ({
  Avatar: ({ children, className }: any) => <div className={className}>{children}</div>,
  AvatarImage: ({ src, alt }: any) => <img src={src} alt={alt} role="img" />,
  AvatarFallback: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h3>{children}</h3>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/ui/image-cropper', () => ({
  default: ({ onComplete }: any) => (
    <div>
      <button onClick={() => onComplete({ croppedImageData: 'data:image/jpeg;base64,cropped' })}>Complete Crop</button>
    </div>
  ),
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Camera: () => <div data-testid="camera-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
  UserIcon: () => <div data-testid="user-icon" />,
  X: () => <div data-testid="x-icon" />,
}));

// Mock contexts
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
  }),
}));

// Create mock functions that will be reused
const mockUpdateAvatar = vi.fn().mockResolvedValue({ success: true });
const mockRemoveAvatar = vi.fn().mockResolvedValue({ success: true });
const mockUpdateProfile = vi.fn();

vi.mock('@/contexts/ProfileContext', () => ({
  useProfile: () => ({
    updateAvatar: mockUpdateAvatar,
    removeAvatar: mockRemoveAvatar,
    updateProfile: mockUpdateProfile,
  }),
}));

// Mock utils
vi.mock('@/utils/toastUtils', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('@/utils/errorUtils', () => ({
  tryCatch: async (fn: Function, errorMessage: string) => {
    try {
      await fn();
    } catch (error) {
      console.error(errorMessage, error);
    }
  },
}));

vi.mock('@/utils/tiffPreview', () => ({
  generateTiffPreview: vi.fn().mockResolvedValue('data:image/jpeg;base64,preview'),
}));

// Helper to create mock file
const createMockFile = (name: string, size: number, type: string = 'image/jpeg'): File => {
  const file = new File([''], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Import mocked functions
import { showSuccess, showError } from '@/utils/toastUtils';

describe('AvatarUploader Component', () => {
  const mockOnAvatarChange = vi.fn();

  // Default props
  const defaultProps = {
    currentAvatarUrl: 'https://example.com/avatar.jpg',
    onAvatarChange: mockOnAvatarChange,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the component with current avatar', () => {
    render(<AvatarUploader {...defaultProps} />);

    // Check if the avatar image is displayed
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');

    // Verify the upload button is rendered
    const cameraButton = screen.getByTestId('camera-icon').closest('button');
    expect(cameraButton).toBeInTheDocument();

    // Verify remove button is present when there's an avatar
    const removeButton = screen.getByTestId('x-icon').closest('button');
    expect(removeButton).toBeInTheDocument();
  });

  it('renders without avatar when currentAvatarUrl is null', () => {
    render(<AvatarUploader currentAvatarUrl={null} onAvatarChange={mockOnAvatarChange} />);

    // Check if the placeholder is displayed instead of image
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByTestId('user-icon')).toBeInTheDocument();

    // Verify only the upload button is rendered (no remove button)
    const cameraButton = screen.getByTestId('camera-icon').closest('button');
    expect(cameraButton).toBeInTheDocument();
    const removeButton = screen.queryByTestId('x-icon');
    expect(removeButton).not.toBeInTheDocument();
  });

  it('opens cropper when valid file is selected', async () => {
    render(<AvatarUploader {...defaultProps} />);

    // Create a mock file
    const file = createMockFile('avatar.jpg', 1024 * 500, 'image/jpeg');

    // Get the file input - it's hidden but we can query it
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Wait for the cropper to open
    await waitFor(() => {
      expect(screen.getByText('profile.cropAvatar')).toBeInTheDocument();
    });
  });

  it('validates file type when uploading', async () => {
    render(<AvatarUploader {...defaultProps} />);

    // Create a non-image file
    const file = createMockFile('document.pdf', 1024 * 500, 'application/pdf');

    // Get the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Check that the error was shown
    expect(showError).toHaveBeenCalledWith('profile.avatarImageOnly');
  });

  it('validates file size when uploading', async () => {
    render(<AvatarUploader {...defaultProps} />);

    // Create a file that exceeds the size limit
    const file = createMockFile('large_avatar.jpg', 1024 * 1024 * 6, 'image/jpeg');

    // Get the file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Check that the error was shown
    expect(showError).toHaveBeenCalledWith('profile.avatarTooLarge');
  });

  it('removes avatar when remove button is clicked', async () => {
    render(<AvatarUploader {...defaultProps} />);

    // Click the remove button
    const removeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(removeButton);

    // Wait for the remove process to complete
    await waitFor(() => {
      expect(mockRemoveAvatar).toHaveBeenCalled();
      expect(showSuccess).toHaveBeenCalledWith('profile.avatarRemoved');
      expect(mockOnAvatarChange).toHaveBeenCalledWith('', false);
    });
  });

  it('handles errors during avatar removal', async () => {
    // Mock a failure when removing avatar
    mockRemoveAvatar.mockRejectedValueOnce(new Error('Failed to remove avatar'));

    render(<AvatarUploader {...defaultProps} />);

    // Click the remove button
    const removeButton = screen.getByTestId('x-icon').closest('button') as HTMLButtonElement;
    fireEvent.click(removeButton);

    // Wait for the error to be handled - note that tryCatch will catch and log the error
    await waitFor(() => {
      expect(mockRemoveAvatar).toHaveBeenCalled();
    });
  });
});
