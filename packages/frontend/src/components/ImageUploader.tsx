import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { useImageLoadPerformance } from '../utils/performance';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Trash2, Upload, ImagePlus } from 'lucide-react';

interface UploadedFile {
  id: string;
  file: File;
  previewUrl: string;
}

interface ImageUploaderProps {
  projectId: string;
  onUploadComplete: (projectId: string, uploadedImages: any[]) => void;
  maxSize?: number;
  accept?: string[];
  dropzoneText?: string;
  className?: string;
  segmentAfterUpload?: boolean;
  onSegmentAfterUploadChange?: (value: boolean) => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  projectId,
  onUploadComplete,
  maxSize = 10 * 1024 * 1024,
  accept = ['image/jpeg', 'image/png', 'image/tiff', 'image/bmp'],
  dropzoneText,
  className = '',
}) => {
  const { t } = useLanguage();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { trackImageLoad } = useImageLoadPerformance();
  const [internalSegmentAfterUpload, setInternalSegmentAfterUpload] = useState<boolean>(false);

  // Use translation or fallback to prop
  const translatedDropzoneText = dropzoneText || t('uploader.dragDrop');

  // Use passed segmentAfterUpload prop if available, otherwise use internal state

  // Function to update segmentation state that calls the prop handler if provided
  const handleSegmentAfterUploadChange = (value: boolean) => {
    setInternalSegmentAfterUpload(value);
    if (onSegmentAfterUploadChange) {
      onSegmentAfterUploadChange(value);
    }
  };

  const clearAllFiles = useCallback(() => {
    uploadedFiles.forEach(uploadedFile => URL.revokeObjectURL(uploadedFile.previewUrl));
    setUploadedFiles([]);
    setError(null);
  }, [uploadedFiles]);

  const removeFile = useCallback((fileId: string) => {
    setUploadedFiles(prevFiles => {
      const fileToRemove = prevFiles.find(f => f.id === fileId);
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.previewUrl);
      }
      return prevFiles.filter(f => f.id !== fileId);
    });
  }, []);

  useEffect(() => {
    return () => {
      uploadedFiles.forEach(uploadedFile => URL.revokeObjectURL(uploadedFile.previewUrl));
    };
  }, [uploadedFiles]);

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
      setError(null);
      if (rejectedFiles.length > 0) {
        const firstRejection = rejectedFiles[0];
        if (firstRejection.errors[0]?.code === 'file-too-large') {
          setError(`File is too large. Maximum size is ${Math.round(maxSize / (1024 * 1024))}MB`);
        } else if (firstRejection.errors[0]?.code === 'file-invalid-type') {
          setError(`Invalid file type. Accepted formats: ${accept.join(', ')}`);
        } else {
          setError('Error uploading some files. Please check them and try again.');
        }
      }

      if (acceptedFiles.length > 0) {
        const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).substring(2, 9)}`,
          file,
          previewUrl: URL.createObjectURL(file),
        }));
        setUploadedFiles(prevFiles => [...prevFiles, ...newFiles]);
      }
    },
    [maxSize, accept]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: accept.reduce((obj, type) => ({ ...obj, [type]: [] }), {}),
    maxSize,
    multiple: true,
    noClick: false, // Ensure clicking on the dropzone opens the file dialog
    noKeyboard: false, // Allow keyboard navigation
  });

  // Handle opening the file dialog explicitly
  const handleOpenFileDialog = useCallback(() => {
    // Use the open method from react-dropzone to open the file dialog
    if (open) {
      open();
    } else if (fileInputRef.current) {
      // Fallback to directly clicking the input if open method is not available
      fileInputRef.current.click();
    }
  }, [open]);

  const handleUploadClick = () => {
    if (uploadedFiles.length === 0) {
      setError(t('uploader.uploadError', {}, 'Please select some files to upload.'));
      return;
    }
    console.log('Uploading files:', uploadedFiles.map(f => f.file));
    console.log('Segment after upload:', internalSegmentAfterUpload);

    // Create mock ProjectImage objects from uploaded files
    const mockProjectImages = uploadedFiles.map(f => ({
      id: f.id,
      project_id: projectId,
      name: f.file.name,
      url: f.previewUrl,
      thumbnail_url: f.previewUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
      width: 800,
      height: 600,
      segmentationStatus: 'pending'
    }));

    // Call onUploadComplete with the projectId and the mock ProjectImage objects
    onUploadComplete(projectId, mockProjectImages);
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className={`image-uploader ${className} space-y-4`}>
      <div
        {...getRootProps()}
        className={`dropzone border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-lg'
            : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 hover:shadow-md dark:border-gray-600 dark:hover:border-blue-500 dark:bg-gray-700 dark:hover:bg-gray-600/80'
          }
          transform hover:scale-[1.01] active:scale-[0.99]
        `}
        data-testid="dropzone-area"
        role="button"
        tabIndex={0}
        aria-label="Click to upload files or drag and drop files here"
        onClick={handleOpenFileDialog}
      >
        <input
          {...getInputProps()}
          ref={fileInputRef}
          aria-label="File upload input"
          data-testid="file-input"
        />
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
            <ImagePlus className="h-8 w-8 text-blue-500 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">{translatedDropzoneText}</p>
            <label
              htmlFor="direct-file-input"
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 active:bg-blue-700 transition-colors mb-3 cursor-pointer inline-block"
            >
              {t('uploader.clickToSelect', {}, 'Click to select files')}
            </label>
            <input
              id="direct-file-input"
              type="file"
              accept={accept.join(',')}
              multiple={true}
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  const files = Array.from(e.target.files);
                  onDrop(files, []); // Simulate calling onDrop function with empty rejectedFiles
                }
              }}
            />
            <div className="flex flex-col items-center space-y-3 mt-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('uploader.or', {}, 'Or')} {t('uploader.dragAndDropFiles', {}, 'drag and drop files here')}
              </p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('common.maxFileSize', {size: maxSize / (1024*1024)}, `Max file size: ${maxSize / (1024*1024)}MB`)}.
              {t('common.accepted', {}, 'Accepted')}: {accept.join(', ')}
            </p>
          </div>
        </div>
      </div>

      {error && <div className="text-red-500 text-sm p-2 bg-red-50 dark:bg-red-900 rounded-md">{error}</div>}

      {uploadedFiles.length > 0 && (
        <div className="image-previews-grid grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-4 mt-4">
          {uploadedFiles.map((uploadedFile) => (
            <div key={uploadedFile.id} className="image-card-wrapper relative group border rounded-lg overflow-hidden shadow-sm">
              <img
                src={uploadedFile.previewUrl}
                alt={uploadedFile.file.name}
                className="w-full h-32 object-cover"
                onLoad={() => trackImageLoad(uploadedFile.previewUrl)}
              />
              <div className="absolute top-1 right-1">
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(uploadedFile.id);
                  }}
                  className="opacity-75 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${uploadedFile.file.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="p-2 bg-white dark:bg-gray-800">
                <p className="text-xs font-medium truncate text-gray-800 dark:text-gray-200" title={uploadedFile.file.name}>{uploadedFile.file.name}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{formatBytes(uploadedFile.file.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <div className="controls mt-6 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 sm:space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg shadow">
          <div className="flex items-center space-x-2">
            <Switch
              id="segment-toggle"
              checked={internalSegmentAfterUpload}
              onCheckedChange={handleSegmentAfterUploadChange}
            />
            <Label htmlFor="segment-toggle" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {t('uploader.segmentAfterUploadLabel', {}, 'Segment images immediately after upload')}
            </Label>
          </div>
          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={clearAllFiles}
              disabled={uploadedFiles.length === 0}
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4" /> {t('common.removeAll', {}, 'Remove All')} ({uploadedFiles.length})
            </Button>
            <Button
              onClick={handleUploadClick}
              disabled={uploadedFiles.length === 0}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
            >
              {t('uploader.uploadBtn', {}, 'Upload')} ({uploadedFiles.length}) {t('common.files', {}, 'Files')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;
