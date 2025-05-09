import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import AvatarUploader from '../AvatarUploader';
import '@testing-library/jest-dom';
import { 
  setupAvatarUploaderMocks, 
  createMockFile
} from '../../../../shared/test-utils/file-upload-test-utils';
import { toast } from 'sonner';

// Setup mocks
setupAvatarUploaderMocks();

describe('AvatarUploader Component', () => {
  const mockUpdateAvatar = vi.fn();
  const mockRemoveAvatar = vi.fn();
  
  // Setup profile context with custom behavior
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Update the mocked functions to return Promises
    mockUpdateAvatar.mockResolvedValue({ success: true });
    mockRemoveAvatar.mockResolvedValue({ success: true });
    
    // Update the mocked context
    vi.mocked(vi.importActual('@/contexts/ProfileContext')).useProfile = vi.fn().mockReturnValue({
      updateAvatar: mockUpdateAvatar,
      removeAvatar: mockRemoveAvatar,
      profile: {
        id: 'test-user-id',
        avatarUrl: 'https://example.com/avatar.jpg'
      }
    });
  });

  it('renders the component with current avatar', () => {
    render(<AvatarUploader />);
    
    // Check if the avatar image is displayed
    const avatar = screen.getByRole('img');
    expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
    
    // Verify the upload and remove buttons are rendered
    expect(screen.getByLabelText('profile.avatarHelp')).toBeInTheDocument();
    expect(screen.getByTestId('remove-avatar-button')).toBeInTheDocument();
  });

  it('renders without avatar when avatarUrl is null', () => {
    // Update the mocked context to return null avatarUrl
    vi.mocked(vi.importActual('@/contexts/ProfileContext')).useProfile = vi.fn().mockReturnValue({
      updateAvatar: mockUpdateAvatar,
      removeAvatar: mockRemoveAvatar,
      profile: {
        id: 'test-user-id',
        avatarUrl: null
      }
    });
    
    render(<AvatarUploader />);
    
    // Check if the placeholder is displayed instead of image
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    
    // Verify only the upload button is rendered (no remove button)
    expect(screen.getByLabelText('profile.avatarHelp')).toBeInTheDocument();
    expect(screen.queryByTestId('remove-avatar-button')).not.toBeInTheDocument();
  });

  it('uploads new avatar when valid file is selected', async () => {
    render(<AvatarUploader />);
    
    // Create a mock file
    const file = createMockFile('avatar.jpg', 1024 * 500, undefined, undefined, 'image/jpeg');
    
    // Get the file input
    const fileInput = screen.getByLabelText('profile.avatarHelp');
    
    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Wait for the upload process to complete
    await waitFor(() => {
      expect(mockUpdateAvatar).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('profile.avatarUpdated');
    });
  });

  it('validates file type when uploading', async () => {
    render(<AvatarUploader />);
    
    // Create a non-image file
    const file = createMockFile('document.pdf', 1024 * 500, undefined, undefined, 'application/pdf');
    
    // Get the file input
    const fileInput = screen.getByLabelText('profile.avatarHelp');
    
    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Check that the error toast was shown
    expect(toast.error).toHaveBeenCalledWith('profile.avatarImageOnly');
    expect(mockUpdateAvatar).not.toHaveBeenCalled();
  });

  it('validates file size when uploading', async () => {
    render(<AvatarUploader />);
    
    // Create a file that exceeds the size limit
    const file = createMockFile('large_avatar.jpg', 1024 * 1024 * 6, undefined, undefined, 'image/jpeg');
    
    // Get the file input
    const fileInput = screen.getByLabelText('profile.avatarHelp');
    
    // Simulate file selection
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Check that the error toast was shown
    expect(toast.error).toHaveBeenCalledWith('profile.avatarTooLarge');
    expect(mockUpdateAvatar).not.toHaveBeenCalled();
  });

  it('removes avatar when remove button is clicked', async () => {
    render(<AvatarUploader />);
    
    // Click the remove button
    const removeButton = screen.getByTestId('remove-avatar-button');
    fireEvent.click(removeButton);
    
    // Wait for the remove process to complete
    await waitFor(() => {
      expect(mockRemoveAvatar).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('profile.avatarRemoved');
    });
  });

  it('handles errors during avatar removal', async () => {
    // Mock a failure when removing avatar
    mockRemoveAvatar.mockRejectedValue(new Error('Failed to remove avatar'));
    
    render(<AvatarUploader />);
    
    // Click the remove button
    const removeButton = screen.getByTestId('remove-avatar-button');
    fireEvent.click(removeButton);
    
    // Wait for the error to be handled
    await waitFor(() => {
      expect(mockRemoveAvatar).toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith('profile.avatarRemoveError');
    });
  });
});