import React, { useCallback, useState, useEffect } from 'react';
import { UploadCloud, X, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface EnhancedFileUploaderProps {
  accept?: string | Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  maxFiles?: number;
  disabled?: boolean;
  onDrop: (acceptedFiles: File[]) => void;
  onError?: (error: string) => void;
  uploadState?: 'idle' | 'uploading' | 'success' | 'error';
  uploadProgress?: number;
  showPreview?: boolean;
  previewType?: 'grid' | 'list';
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
  retryLabel?: string;
  cancelLabel?: string;
  removeLabel?: string;
  initialFiles?: File[];
}

export const EnhancedFileUploader: React.FC<EnhancedFileUploaderProps> = ({
  accept = 'image/*',
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 100,
  disabled = false,
  onDrop,
  onError,
  uploadState = 'idle',
  uploadProgress = 0,
  showPreview = true,
  previewType = 'grid',
  variant = 'default',
  className,
  retryLabel,
  cancelLabel,
  removeLabel,
  initialFiles = [],
}) => {
  const { t } = useLanguage();
  const [files, setFiles] = useState<File[]>(initialFiles);
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Update files if initialFiles changes
  useEffect(() => {
    if (initialFiles.length > 0) {
      setFiles(initialFiles);
    }
  }, [initialFiles]);

  const handleDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      if (disabled) return;
      setErrorMessage(null);

      // Check for max files
      if (multiple && files.length + acceptedFiles.length > maxFiles) {
        const error =
          t('upload.tooManyFiles', { max: maxFiles }) || `Too many files. Maximum ${maxFiles} files allowed.`;
        setErrorMessage(error);
        if (onError) onError(error);
        return;
      }

      // Handle file rejections (file type, size, etc.)
      if (fileRejections.length > 0) {
        // Group rejections by error code
        const errorGroups: Record<string, string[]> = {};
        fileRejections.forEach((rejection) => {
          const errorCode = rejection.errors[0].code;
          if (!errorGroups[errorCode]) {
            errorGroups[errorCode] = [];
          }
          errorGroups[errorCode].push(rejection.file.name);
        });

        // Create error messages based on error types
        const errors: string[] = [];
        if (errorGroups['file-too-large']) {
          errors.push(
            t('upload.filesTooLarge', {
              count: errorGroups['file-too-large'].length,
              max: (maxSize / (1024 * 1024)).toFixed(0),
            }) ||
              `${errorGroups['file-too-large'].length} file(s) exceed the ${(maxSize / (1024 * 1024)).toFixed(0)}MB size limit`,
          );
        }
        if (errorGroups['file-invalid-type']) {
          errors.push(
            t('upload.unsupportedFileTypes', {
              count: errorGroups['file-invalid-type'].length,
            }) || `${errorGroups['file-invalid-type'].length} file(s) have unsupported formats`,
          );
        }

        const errorMessage = errors.join('. ');
        setErrorMessage(errorMessage);
        if (onError) {
          onError(errorMessage);
        }
        return;
      }

      // If single file mode, replace current file
      const newFiles = multiple ? [...files, ...acceptedFiles] : acceptedFiles;

      setFiles(newFiles);
      onDrop(newFiles);
    },
    [disabled, multiple, maxFiles, files.length, onDrop, onError, maxSize, t],
  );

  // Convert accept string to the format expected by react-dropzone v14+
  const acceptProp =
    typeof accept === 'string'
      ? { [accept]: [] } // Convert 'image/*' to { 'image/*': [] }
      : accept;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: acceptProp,
    multiple,
    maxSize,
    disabled: disabled || uploadState === 'uploading',
    onDrop: handleDrop,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  // Handle file removal
  const removeFile = (index: number) => {
    if (uploadState === 'uploading') return;

    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    onDrop(newFiles);
  };

  // Clear all files
  const clearFiles = () => {
    setFiles([]);
    onDrop([]);
  };

  // Generate a file preview URL safely
  const getFilePreviewUrl = (file: File): string => {
    try {
      return URL.createObjectURL(file);
    } catch (error) {
      console.error('Error creating object URL for file:', error);
      return '';
    }
  };

  // Get file type category (image, document, video, etc.)
  const getFileCategory = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.includes('pdf')) return 'pdf';
    if (file.type.includes('word') || file.type.includes('document')) return 'document';
    if (file.type.includes('excel') || file.type.includes('spreadsheet')) return 'spreadsheet';
    return 'other';
  };

  // Render appropriate file preview based on file type
  const renderFilePreview = (file: File, index: number) => {
    const category = getFileCategory(file);

    // Calculate file size in a readable format
    const formatFileSize = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Base container classes based on preview type
    const containerClass = cn(
      'relative group',
      previewType === 'grid'
        ? 'aspect-square rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800'
        : 'flex items-center p-2 rounded-md bg-gray-100 dark:bg-gray-800',
    );

    // Image preview
    if (category === 'image') {
      const previewUrl = getFilePreviewUrl(file);
      return (
        <div key={`${file.name}-${index}`} className={containerClass}>
          <img
            src={previewUrl}
            alt={file.name}
            className={cn(
              previewType === 'grid' ? 'w-full h-full object-cover' : 'w-12 h-12 object-cover rounded-md mr-3',
            )}
            onLoad={() => URL.revokeObjectURL(previewUrl)} // Clean up
          />
          {renderFileInfo(file, previewType)}
          {renderRemoveButton(index)}
        </div>
      );
    }

    // Non-image file preview
    return (
      <div key={`${file.name}-${index}`} className={containerClass}>
        <div
          className={cn(
            previewType === 'grid'
              ? 'w-full h-full flex flex-col items-center justify-center'
              : 'w-12 h-12 flex items-center justify-center rounded-md mr-3 bg-gray-200 dark:bg-gray-700',
          )}
        >
          <ImageIcon className="w-8 h-8 text-gray-500" />
          {previewType === 'grid' && (
            <span className="text-xs text-center mt-1 text-gray-500 px-2 truncate max-w-full">
              {file.name.split('.').pop()?.toUpperCase()}
            </span>
          )}
        </div>
        {renderFileInfo(file, previewType)}
        {renderRemoveButton(index)}
      </div>
    );
  };

  // Render file information (name, size, etc.)
  const renderFileInfo = (file: File, type: 'grid' | 'list') => {
    if (type === 'list') {
      return (
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(2)} kB</p>
        </div>
      );
    }
    return null;
  };

  // Render remove file button
  const renderRemoveButton = (index: number) => {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          removeFile(index);
        }}
        disabled={uploadState === 'uploading'}
        aria-label={removeLabel || t('upload.removeFile') || 'Remove file'}
        title={removeLabel || t('upload.removeFile') || 'Remove file'}
        className={cn(
          'absolute top-1 right-1 bg-red-500 text-white rounded-full p-1',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          uploadState === 'uploading' ? 'cursor-not-allowed opacity-50' : '',
        )}
      >
        <X className="w-3 h-3" />
      </button>
    );
  };

  // Render upload status
  const renderUploadStatus = () => {
    if (uploadState === 'uploading') {
      return (
        <div className="mt-4 space-y-2">
          <Progress value={uploadProgress} className="h-2" />
          <div className="flex justify-between text-xs text-gray-500">
            <span>{uploadProgress.toFixed(0)}%</span>
            <span>{t('upload.uploading') || 'Uploading...'}</span>
          </div>
        </div>
      );
    }

    if (uploadState === 'success') {
      return (
        <div className="mt-4 flex items-center text-green-500">
          <CheckCircle className="w-5 h-5 mr-2" />
          <span>{t('upload.success') || 'Upload successful'}</span>
        </div>
      );
    }

    if (uploadState === 'error') {
      return (
        <div className="mt-4 flex flex-col space-y-2">
          <div className="flex items-center text-red-500">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{errorMessage || t('upload.error') || 'Upload failed'}</span>
          </div>
          {files.length > 0 && (
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => onDrop(files)}>
                {retryLabel || t('upload.retry') || 'Retry'}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearFiles}>
                {cancelLabel || t('upload.cancel') || 'Cancel'}
              </Button>
            </div>
          )}
        </div>
      );
    }

    // Show error message if there's one but we're not in error state
    if (errorMessage) {
      return (
        <div className="mt-4 flex items-center text-red-500 text-sm">
          <AlertCircle className="w-4 h-4 mr-2" />
          <span>{errorMessage}</span>
        </div>
      );
    }

    return null;
  };

  // File preview section
  const renderPreview = () => {
    if (!showPreview || files.length === 0) return null;

    return (
      <div
        className={cn(
          'mt-4',
          previewType === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' : 'space-y-2',
        )}
      >
        {files.map((file, index) => renderFilePreview(file, index))}
      </div>
    );
  };

  // Determine CSS classes based on variant and state
  const getContainerClasses = () => {
    const baseClasses =
      'relative rounded-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-offset-2';

    // Add variant classes
    const variantClasses = {
      default: 'border-2 border-dashed border-gray-300 dark:border-gray-700',
      outline: 'border-2 border-gray-300 dark:border-gray-700',
      ghost: 'bg-transparent',
    }[variant];

    // Add state classes
    let stateClasses = '';
    if (disabled) {
      stateClasses = 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800';
    } else if (dragActive || isDragActive) {
      stateClasses = 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    } else {
      stateClasses = 'hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10';
    }

    return `${baseClasses} ${variantClasses} ${stateClasses}`;
  };

  // Get text content based on context
  const getDropzoneText = () => {
    if (dragActive || isDragActive) {
      return t('upload.dropFiles') || 'Drop files here...';
    }

    if (disabled) {
      return t('upload.uploaderDisabled') || 'File upload disabled';
    }

    if (multiple) {
      return t('upload.dragDropMultiple') || 'Drag and drop files here, or click to select files';
    }

    return t('upload.dragDropSingle') || 'Drag and drop a file here, or click to select a file';
  };

  // Get restrictions text
  const getRestrictionsText = () => {
    const restrictions: string[] = [];

    if (!multiple) {
      restrictions.push(t('upload.singleFileOnly') || 'Single file only');
    } else if (maxFiles) {
      restrictions.push(t('upload.maxFiles', { max: maxFiles }) || `Max ${maxFiles} files`);
    }

    if (maxSize) {
      restrictions.push(
        t('upload.maxSize', { max: (maxSize / (1024 * 1024)).toFixed(0) }) ||
          `Max ${(maxSize / (1024 * 1024)).toFixed(0)} MB per file`,
      );
    }

    return restrictions.join(' • ');
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div {...getRootProps()} className={getContainerClasses()}>
        <input {...getInputProps()} />

        <div className="p-8 text-center">
          <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">{getDropzoneText()}</p>
          <p className="mt-1 text-xs text-gray-500">{getRestrictionsText()}</p>
        </div>
      </div>

      {renderPreview()}
      {renderUploadStatus()}
    </div>
  );
};

export default EnhancedFileUploader;
