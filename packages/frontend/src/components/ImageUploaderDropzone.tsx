import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface ImageUploaderDropzoneProps {
  onDrop: (files: File[]) => void;
  isDragActive?: boolean;
  className?: string;
}

const ImageUploaderDropzone: React.FC<ImageUploaderDropzoneProps> = ({
  onDrop,
  isDragActive = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    onDrop(files);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      onDrop(files);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer ${
        isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
      } ${className} transition-all duration-200 hover:shadow-md`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onClick={handleClick}
      data-testid="dropzone-area"
      role="button"
      tabIndex={0}
      aria-label="Click to upload files or drag and drop files here"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInputChange}
        className="hidden"
        data-testid="file-input"
      />
      <div className="flex flex-col items-center justify-center">
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t('uploader.dragDrop')}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          {t('uploader.imageOnly')}
        </p>
        <p className="mt-2 text-xs text-blue-500 dark:text-blue-400">
          {t('uploader.clickToSelect')}
        </p>
      </div>
    </div>
  );
};

export default ImageUploaderDropzone;
