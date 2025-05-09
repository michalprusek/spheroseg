import React, { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Camera, Loader2, UserIcon, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { showSuccess, showError } from '@/utils/toastUtils';
import { tryCatch } from '@/utils/errorUtils';
import ImageCropper from '@/components/ui/image-cropper';

interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
  onAvatarChange: (newAvatarUrl: string) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const AvatarUploader: React.FC<AvatarUploaderProps> = ({
  currentAvatarUrl,
  onAvatarChange,
  size = 'md'
}) => {
  const { t } = useLanguage();
  const { updateAvatar } = useProfile();
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
    xl: 'h-40 w-40'
  };

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showError(t('profile.avatarImageOnly') || 'Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showError(t('profile.avatarTooLarge') || 'Image must be less than 5MB');
      return;
    }

    // Store the original file
    setOriginalFile(file);

    // Create a URL for the cropper
    const objectUrl = URL.createObjectURL(file);
    setCropperImageSrc(objectUrl);

    // Open the cropper modal
    setIsCropperOpen(true);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle cropper completion
  const handleCropComplete = async (cropData: any) => {
    if (!cropData.croppedImageData) {
      showError(t('profile.cropError') || 'Failed to crop image');
      setIsCropperOpen(false);
      return;
    }

    // Set the preview URL to the cropped image
    setPreviewUrl(cropData.croppedImageData);

    // Close the cropper modal
    setIsCropperOpen(false);

    // Upload the cropped image
    await uploadAvatar(cropData.croppedImageData);
  };

  // Upload the avatar
  const uploadAvatar = async (dataUrl: string) => {
    setIsUploading(true);

    await tryCatch(async () => {
      // Implement a client-side simulation of avatar upload
      console.log('Simulating avatar upload to localStorage');

      // Generate a unique avatar URL
      const timestamp = new Date().getTime();
      const avatarUrl = `/uploads/avatars/avatar-${timestamp}.jpg`;

      // Store the data URL in localStorage
      localStorage.setItem('userAvatar', dataUrl);
      localStorage.setItem('userAvatarUrl', avatarUrl);

      // Update profile context
      updateAvatar(avatarUrl);

      console.log('Avatar stored in localStorage and profile context updated');

      // Call the callback with the new avatar URL
      onAvatarChange(dataUrl);

      showSuccess(t('profile.avatarUpdated') || 'Profile picture updated');
    }, t('profile.avatarUploadError') || 'Failed to upload profile picture');

    setIsUploading(false);
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    setIsUploading(true);

    await tryCatch(async () => {
      // Implement a client-side simulation of avatar removal
      console.log('Simulating avatar removal from localStorage');

      // Remove the avatar from localStorage
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userAvatarUrl');

      // Update profile context
      updateAvatar('');

      console.log('Avatar removed from localStorage and profile context updated');

      // Call the callback with null or a default avatar URL
      onAvatarChange('');

      // Clear preview
      setPreviewUrl(null);

      showSuccess(t('profile.avatarRemoved') || 'Profile picture removed');
    }, t('profile.avatarRemoveError') || 'Failed to remove profile picture');

    setIsUploading(false);
  };

  // Get avatar from localStorage if available
  useEffect(() => {
    const storedAvatar = localStorage.getItem('userAvatar');
    if (storedAvatar && !previewUrl && (!currentAvatarUrl || currentAvatarUrl.length === 0)) {
      // If we have a stored avatar and no preview or current avatar, use the stored one
      setPreviewUrl(storedAvatar);
    }
  }, [previewUrl, currentAvatarUrl]);

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (cropperImageSrc) {
        URL.revokeObjectURL(cropperImageSrc);
      }
    };
  }, [cropperImageSrc]);

  // Determine which avatar URL to display (preview, current, or fallback)
  const displayUrl = previewUrl || (currentAvatarUrl && currentAvatarUrl.length > 0 ? currentAvatarUrl : null);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar
          className={`${sizeClasses[size]} border-2 border-gray-200 dark:border-gray-700`}
        >
          {displayUrl ? (
            <AvatarImage src={displayUrl} alt="Profile" />
          ) : (
            <AvatarFallback>
              <UserIcon className="h-1/2 w-1/2 text-gray-400" />
            </AvatarFallback>
          )}
        </Avatar>

        {/* Upload button overlay */}
        <Button
          type="button"
          size="icon"
          variant="info"
          className="absolute bottom-0 right-0 rounded-full h-8 w-8 shadow-md border-2 border-white dark:border-gray-800"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>

        {/* Remove button (only show if there's an avatar) */}
        {(currentAvatarUrl || previewUrl) && (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="absolute top-0 right-0 rounded-full h-6 w-6 shadow-md"
            onClick={handleRemoveAvatar}
            disabled={isUploading}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      <p className="text-xs text-muted-foreground">
        {t('profile.avatarHelp') || 'Click the camera icon to upload a profile picture'}
      </p>

      {/* Image Cropper Dialog */}
      <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('profile.cropAvatar') || 'Crop Profile Picture'}
            </DialogTitle>
            <DialogDescription>
              {t('profile.cropAvatarDescription') || 'Adjust the cropping area to set your profile picture.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {cropperImageSrc && (
              <div className="max-h-[500px] overflow-auto">
                <ImageCropper
                  src={cropperImageSrc}
                  aspectRatio="square"
                  cropShape="round"
                  showControls={true}
                  onComplete={handleCropComplete}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCropperOpen(false)}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvatarUploader;
