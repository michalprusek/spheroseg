/**
 * ImageUploader Component - Using Unified Upload Service
 * 
 * This is the migrated version using the new unified upload service.
 * It provides the same functionality with better performance and reliability.
 */

import React, { useEffect } from 'react';
import { useImageUpload } from '@spheroseg/shared/services/upload';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Trash2, 
  Upload, 
  ImagePlus, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  RotateCcw,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import type { Image } from '@spheroseg/types';
import { cn } from '@/lib/utils';

interface ImageUploaderProps {
  projectId: string;
  onUploadComplete: (projectId: string, uploadedImages: Image[]) => void;
  maxSize?: number;
  accept?: string[];
  dropzoneText?: string;
  className?: string;
  segmentAfterUpload?: boolean;
  onSegmentAfterUploadChange?: (value: boolean) => void;
}

const ImageUploaderV2: React.FC<ImageUploaderProps> = ({
  projectId,
  onUploadComplete,
  maxSize = 10 * 1024 * 1024,
  accept = ['image/jpeg', 'image/png', 'image/tiff', 'image/tif', 'image/bmp'],
  dropzoneText,
  className = '',
  segmentAfterUpload = true,
  onSegmentAfterUploadChange,
}) => {
  const { t } = useLanguage();
  const [internalSegmentAfterUpload, setInternalSegmentAfterUpload] = React.useState(segmentAfterUpload);

  // Use the unified image upload hook
  const {
    files,
    isUploading,
    uploadProgress,
    _activeUploads,
    selectFiles,
    uploadFiles,
    _cancelUpload,
    cancelAllUploads,
    removeFile,
    clearFiles,
    retryFailed,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useImageUpload({
    projectId,
    generatePreviews: true,
    chunkedUpload: true,
    resumable: true,
    config: {
      maxFileSize: maxSize,
      acceptedTypes: accept,
      autoSegment: internalSegmentAfterUpload,
    },
    onFilesSelected: (selectedFiles) => {
      toast.info(t('uploader.filesSelected', { count: selectedFiles.length }, `${selectedFiles.length} files selected`));
    },
    onUploadProgress: (_progress, _fileId) => {
      // Individual file progress is handled by the hook
      // This is for any additional progress tracking needs
    },
    onUploadComplete: (result) => {
      if (result.successful.length > 0) {
        const uploadedImages = result.successful.map(file => file.result as Image);
        onUploadComplete(projectId, uploadedImages);
        
        toast.success(
          t('uploader.uploadSuccess', { count: result.successful.length }, 
          `Successfully uploaded ${result.successful.length} files`)
        );
      }

      if (result.failed.length > 0) {
        toast.error(
          t('uploader.uploadPartialError', { failed: result.failed.length, total: result.totalFiles },
          `Failed to upload ${result.failed.length} of ${result.totalFiles} files`)
        );
      }
    },
    onError: (error, _file) => {
      toast.error(
        t('uploader.uploadError', { error: error.message }, `Upload error: ${error.message}`)
      );
    },
  });

  // Update internal state when prop changes
  useEffect(() => {
    setInternalSegmentAfterUpload(segmentAfterUpload);
  }, [segmentAfterUpload]);

  // Handle segmentation toggle
  const handleSegmentAfterUploadChange = (value: boolean) => {
    setInternalSegmentAfterUpload(value);
    onSegmentAfterUploadChange?.(value);
  };

  // Calculate stats
  const pendingFiles = files.filter(f => f.status === 'pending');
  const uploadingFiles = files.filter(f => f.status === 'uploading');
  const completedFiles = files.filter(f => f.status === 'complete');
  const failedFiles = files.filter(f => f.status === 'error');

  // Translated dropzone text
  const translatedDropzoneText = dropzoneText || t('uploader.dragDrop');

  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={cn(
          'relative overflow-hidden rounded-lg border-2 border-dashed p-8 text-center transition-all duration-200',
          isDragActive
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/5',
          'cursor-pointer'
        )}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className={cn(
            'rounded-full p-3 transition-colors',
            isDragActive ? 'bg-primary/10' : 'bg-muted'
          )}>
            <ImagePlus className={cn(
              'h-8 w-8 transition-colors',
              isDragActive ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          
          <div className="space-y-1">
            <p className="text-lg font-medium">
              {isDragActive 
                ? t('uploader.dropFiles', {}, 'Drop files here')
                : translatedDropzoneText
              }
            </p>
            <p className="text-sm text-muted-foreground">
              {t('uploader.supportedFormats', {}, 'Supported: JPG, PNG, TIFF, BMP')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('uploader.maxSize', { size: Math.round(maxSize / (1024 * 1024)) }, 
                `Max size: ${Math.round(maxSize / (1024 * 1024))}MB per file`)}
            </p>
          </div>

          <Button type="button" variant="secondary" size="sm" onClick={selectFiles}>
            <ImagePlus className="mr-2 h-4 w-4" />
            {t('uploader.selectFiles', {}, 'Select Files')}
          </Button>
        </div>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-4">
          {/* Summary stats */}
          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
            <div className="flex items-center space-x-4 text-sm">
              <span>{t('uploader.totalFiles', { count: files.length }, `${files.length} files`)}</span>
              {uploadingFiles.length > 0 && (
                <span className="text-blue-600">
                  {t('uploader.uploading', { count: uploadingFiles.length }, `${uploadingFiles.length} uploading`)}
                </span>
              )}
              {completedFiles.length > 0 && (
                <span className="text-green-600">
                  {t('uploader.completed', { count: completedFiles.length }, `${completedFiles.length} completed`)}
                </span>
              )}
              {failedFiles.length > 0 && (
                <span className="text-red-600">
                  {t('uploader.failed', { count: failedFiles.length }, `${failedFiles.length} failed`)}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {failedFiles.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryFailed}
                  disabled={isUploading}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {t('common.retry')}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={clearFiles}
                disabled={isUploading}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t('common.clearAll')}
              </Button>
            </div>
          </div>

          {/* Overall progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{t('uploader.overallProgress', {}, 'Overall Progress')}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* File grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {files.map((file) => (
              <div
                key={file.id}
                className={cn(
                  'group relative overflow-hidden rounded-lg border bg-card',
                  file.status === 'error' && 'border-destructive',
                  file.status === 'complete' && 'border-green-600',
                  file.status === 'uploading' && 'border-blue-600'
                )}
              >
                {/* Preview */}
                <div className="relative aspect-square">
                  {file.preview ? (
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}

                  {/* Status overlay */}
                  {file.status === 'uploading' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="text-center text-white">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                        <span className="mt-1 text-xs">{file.progress}%</span>
                      </div>
                    </div>
                  )}

                  {file.status === 'complete' && (
                    <div className="absolute right-1 top-1 rounded-full bg-green-600 p-1">
                      <CheckCircle className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {file.status === 'error' && (
                    <div className="absolute right-1 top-1 rounded-full bg-destructive p-1">
                      <AlertCircle className="h-4 w-4 text-white" />
                    </div>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={() => removeFile(file.id)}
                    className={cn(
                      'absolute right-1 top-1 rounded-full bg-black/50 p-1 opacity-0 transition-opacity',
                      'group-hover:opacity-100',
                      'hover:bg-black/70',
                      (file.status === 'complete' || file.status === 'error') && 'hidden'
                    )}
                    disabled={file.status === 'uploading'}
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>

                {/* File info */}
                <div className="p-2">
                  <p className="truncate text-xs font-medium" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                  {file.error && (
                    <p className="mt-1 truncate text-xs text-destructive" title={file.error}>
                      {file.error}
                    </p>
                  )}
                </div>

                {/* Progress bar for uploading files */}
                {file.status === 'uploading' && (
                  <Progress value={file.progress} className="absolute bottom-0 h-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-segment"
            checked={internalSegmentAfterUpload}
            onCheckedChange={handleSegmentAfterUploadChange}
            disabled={isUploading}
          />
          <Label htmlFor="auto-segment" className="cursor-pointer">
            {t('uploader.segmentAfterUpload', {}, 'Segment images after upload')}
          </Label>
        </div>

        <div className="flex items-center space-x-2">
          {isUploading ? (
            <Button
              type="button"
              variant="outline"
              onClick={cancelAllUploads}
            >
              <X className="mr-2 h-4 w-4" />
              {t('common.cancel')}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => uploadFiles()}
              disabled={pendingFiles.length === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              {t('uploader.uploadImages', { count: pendingFiles.length }, 
                `Upload ${pendingFiles.length} images`)}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default ImageUploaderV2;