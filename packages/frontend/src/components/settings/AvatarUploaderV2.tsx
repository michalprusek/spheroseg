/**
 * AvatarUploader Component - Using Unified Upload Service
 * 
 * This is the migrated version using the new unified upload service.
 * It provides the same functionality with better performance and reliability.
 */

import React, { useState, useEffect } from 'react';
import { useAvatarUpload } from '@spheroseg/shared/services/upload';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Camera, Loader2, UserIcon, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useProfile } from '@/contexts/ProfileContext';
import { showSuccess, showError } from '@/utils/toastUtils';
import ImageCropper from '@/components/ui/image-cropper';

interface AvatarUploaderProps {
  currentAvatarUrl: string | null;
  onAvatarChange: (newAvatarUrl: string, hasChanges: boolean) => void;
  onUploadRequest?: (uploadFn: () => Promise<void>) => void;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const AvatarUploaderV2: React.FC<AvatarUploaderProps> = ({
  currentAvatarUrl,
  onAvatarChange,
  onUploadRequest,
  size = 'md',
}) => {
  const { t } = useLanguage();
  const { updateProfile } = useProfile();
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Use the unified avatar upload hook
  const {
    files,
    isUploading,
    selectFiles,
    uploadFiles,
    clearFiles,
    removeFile,
  } = useAvatarUpload({
    generatePreviews: true,
    autoUpload: false, // We'll handle upload manually after cropping
    onFilesSelected: async (selectedFiles) => {
      if (selectedFiles.length > 0) {
        const file = selectedFiles[0];
        setSelectedFile(file);
        
        // Generate preview for cropper
        const reader = new FileReader();
        reader.onload = (e) => {
          setCropperImageSrc(e.target?.result as string);
          setIsCropperOpen(true);
        };
        reader.readAsDataURL(file);
      }
    },
    onUploadComplete: async (result) => {
      if (result.successful.length > 0) {
        const uploadedFile = result.successful[0];
        const avatarUrl = uploadedFile.result?.url || uploadedFile.preview || '';
        
        // Update profile with new avatar
        try {
          await updateProfile({ avatar: avatarUrl });
          
          // Store in localStorage for immediate display
          localStorage.setItem('userAvatar', avatarUrl);
          
          // Notify parent component
          onAvatarChange(avatarUrl, false);
          
          showSuccess(t('profile.avatarUpdated') || 'Profile picture updated');
        } catch (error) {
          showError(t('profile.avatarUpdateError') || 'Failed to update profile picture');
        }
      }
    },
    onError: (error) => {
      showError(
        error.message || t('profile.avatarUploadError') || 'Failed to upload profile picture'
      );
    },
  });

  // Size classes based on the size prop
  const sizeClasses = {
    sm: 'h-16 w-16',
    md: 'h-24 w-24',
    lg: 'h-32 w-32',
    xl: 'h-40 w-40',
  };

  // Handle cropper completion
  const handleCropComplete = async (cropData: { croppedImageData: string }) => {
    if (!cropData.croppedImageData || !selectedFile) {
      showError(t('profile.cropError') || 'Failed to crop image');
      setIsCropperOpen(false);
      return;
    }

    try {
      // Convert cropped data URL to File
      const response = await fetch(cropData.croppedImageData);
      const blob = await response.blob();
      const croppedFile = new File([blob], selectedFile.name, { type: 'image/jpeg' });

      // Close cropper
      setIsCropperOpen(false);

      // Clear any existing files and add the cropped file
      clearFiles();
      
      // Manually add the cropped file to our upload queue
      // Since we disabled autoUpload, we need to trigger upload manually
      const formData = new FormData();
      formData.append('file', croppedFile);
      
      // Upload the cropped avatar
      await uploadFiles([croppedFile]);
    } catch (error) {
      showError(t('profile.cropError') || 'Failed to process cropped image');
    }
  };

  // Handle avatar removal
  const handleRemoveAvatar = async () => {
    try {
      // Remove avatar from profile
      await updateProfile({ avatar: '' });
      
      // Clear from localStorage
      localStorage.removeItem('userAvatar');
      localStorage.removeItem('userAvatarUrl');
      
      // Clear any pending uploads
      clearFiles();
      
      // Notify parent component
      onAvatarChange('', false);
      
      showSuccess(t('profile.avatarRemoved') || 'Profile picture removed');
    } catch (error) {
      showError(t('profile.avatarRemoveError') || 'Failed to remove profile picture');
    }
  };

  // Get the current display avatar
  const firstFile = files[0];
  const displayUrl = firstFile?.preview || currentAvatarUrl || '';

  // Check localStorage on mount
  useEffect(() => {
    if (!currentAvatarUrl) {
      const storedAvatar = localStorage.getItem('userAvatar');
      if (storedAvatar) {
        onAvatarChange(storedAvatar, false);
      }
    }
  }, []);

  // Pass upload function to parent if requested
  useEffect(() => {
    if (onUploadRequest && files.length > 0 && files[0].status === 'pending') {
      onUploadRequest(() => uploadFiles());
    }
  }, [files, onUploadRequest]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <Avatar className={`${sizeClasses[size]} border-2 border-gray-200 dark:border-gray-700`}>
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
          onClick={selectFiles}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
        </Button>

        {/* Remove button (only show if there's an avatar) */}
        {displayUrl && (
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

      <p className="text-xs text-muted-foreground">
        {t('profile.avatarHelp') || 'Click the camera icon to upload a profile picture'}
      </p>

      {/* Image Cropper Dialog */}
      <Dialog open={isCropperOpen} onOpenChange={setIsCropperOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('profile.cropAvatar') || 'Crop Profile Picture'}</DialogTitle>
            <DialogDescription>
              {t('profile.cropAvatarDescription') || 'Adjust the cropping area to set your profile picture.'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {cropperImageSrc && (
              <div className="max-h-[500px] overflow-auto">
                <ImageCropper
                  src={cropperImageSrc}
                  aspectRatio={1}
                  cropShape="round"
                  showControls={true}
                  showZoom={false}
                  showRotation={true}
                  onComplete={handleCropComplete}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsCropperOpen(false);
                clearFiles();
              }}
            >
              {t('common.cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvatarUploaderV2;