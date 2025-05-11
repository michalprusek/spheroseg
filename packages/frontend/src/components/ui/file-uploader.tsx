import React, { useCallback, useState } from 'react';
import { UploadCloud, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  accept?: string | Record<string, string[]>;
  multiple?: boolean;
  maxSize?: number;
  disabled?: boolean;
  onDrop: (acceptedFiles: File[]) => void;
  onError?: (error: string) => void;
  uploadState?: 'idle' | 'uploading' | 'success' | 'error';
  uploadProgress?: number;
  uploadText?: string;
  dragActiveText?: string;
  successText?: string;
  errorText?: string;
  showPreview?: boolean;
  previewType?: 'grid' | 'list';
  variant?: 'default' | 'ghost' | 'outline';
  state?: 'idle' | 'active' | 'disabled';
  className?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  accept = 'image/*',
  multiple = false,
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
  onDrop,
  onError,
  uploadState = 'idle',
  uploadProgress = 0,
  uploadText = 'Drag and drop files here, or click to select files',
  dragActiveText = 'Drop files here...',
  successText = 'Upload successful',
  errorText = 'Upload failed',
  showPreview = false,
  previewType = 'grid',
  variant = 'default',
  state,
  className,
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);

  const handleDrop = useCallback(
    (acceptedFiles: File[], fileRejections: any[]) => {
      if (disabled) return;

      // Handle file rejections (file type, size, etc.)
      if (fileRejections.length > 0) {
        const errors = fileRejections.map((rejection) => `${rejection.file.name}: ${rejection.errors[0].message}`);
        if (onError) {
          onError(errors.join(', '));
        }
        return;
      }

      setFiles(acceptedFiles);
      onDrop(acceptedFiles);
    },
    [disabled, onDrop, onError],
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
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    onDrop(newFiles);
  };

  // Render upload status
  const renderUploadStatus = () => {
    if (uploadState === 'uploading') {
      return (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-1">{uploadProgress.toFixed(0)}% - Uploading...</p>
        </div>
      );
    }

    if (uploadState === 'success') {
      return (
        <div className="mt-4 flex items-center text-green-500">
          <CheckCircle className="w-5 h-5 mr-2" />
          <span>{successText}</span>
        </div>
      );
    }

    if (uploadState === 'error') {
      return (
        <div className="mt-4 flex items-center text-red-500">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{errorText}</span>
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
        className={`mt-4 ${previewType === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4' : 'space-y-2'}`}
      >
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className={`relative group ${
              previewType === 'grid'
                ? 'aspect-square rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800'
                : 'flex items-center p-2 rounded-md bg-gray-100 dark:bg-gray-800'
            }`}
          >
            {file.type.startsWith('image/') ? (
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className={`${
                  previewType === 'grid' ? 'w-full h-full object-cover' : 'w-12 h-12 object-cover rounded-md mr-3'
                }`}
              />
            ) : (
              <div
                className={`${
                  previewType === 'grid'
                    ? 'w-full h-full flex items-center justify-center'
                    : 'w-12 h-12 flex items-center justify-center rounded-md mr-3'
                } bg-gray-200 dark:bg-gray-700`}
              >
                <span className="text-2xl font-semibold text-gray-500">
                  {file.name.split('.').pop()?.toUpperCase()}
                </span>
              </div>
            )}

            {previewType === 'list' && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{file.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{(file.size / 1024).toFixed(2)} kB</p>
              </div>
            )}

            <button
              type="button"
              onClick={() => removeFile(index)}
              disabled={uploadState === 'uploading'}
              className={`absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 
                opacity-0 group-hover:opacity-100 transition-opacity 
                ${uploadState === 'uploading' ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    );
  };

  // Determine CSS classes based on variant and state
  const getContainerClasses = () => {
    let baseClasses = 'relative rounded-lg transition-all duration-200 focus-within:ring-2 focus-within:ring-offset-2';

    // Add variant classes
    if (variant === 'default') {
      baseClasses += ' border-2 border-dashed border-gray-300 dark:border-gray-700';
    } else if (variant === 'outline') {
      baseClasses += ' border-2 border-gray-300 dark:border-gray-700';
    } else {
      baseClasses += ' bg-transparent';
    }

    // Add state classes
    if (disabled || state === 'disabled') {
      baseClasses += ' opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800';
    } else if (dragActive || isDragActive || state === 'active') {
      baseClasses += ' border-blue-500 bg-blue-50 dark:bg-blue-900/20';
    } else {
      baseClasses += ' hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/10';
    }

    return baseClasses;
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div {...getRootProps()} className={getContainerClasses()}>
        <input {...getInputProps()} />

        <div className="p-8 text-center">
          <UploadCloud className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            {dragActive || isDragActive ? dragActiveText : uploadText}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {multiple ? 'You can upload multiple files' : 'You can upload only one file'}
            {maxSize && ` (max ${(maxSize / (1024 * 1024)).toFixed(0)} MB per file)`}
          </p>
        </div>
      </div>

      {renderPreview()}
      {renderUploadStatus()}
    </div>
  );
};

export default FileUploader;
