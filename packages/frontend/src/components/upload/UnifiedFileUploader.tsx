/**
 * Unified File Uploader Component
 * 
 * This component provides a consistent file upload interface using the unified upload service.
 * It supports drag-and-drop, file selection, preview generation, and upload progress tracking.
 */

import React, { useMemo } from 'react';
import { 
  Upload, 
  X, 
  Check, 
  AlertCircle, 
  FileIcon,
  Image as ImageIcon,
  File,
  Loader2,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useUnifiedFileUpload, UseFileUploadOptions } from '@/hooks/useUnifiedFileUpload';
import { UploadStatus } from '@/services/unifiedFileUploadService';
import { formatFileSize } from '@/utils/formatters';

// ===========================
// Types and Interfaces
// ===========================

export interface UnifiedFileUploaderProps extends UseFileUploadOptions {
  // UI Options
  className?: string;
  title?: string;
  description?: string;
  maxHeight?: string;
  showFileList?: boolean;
  showActions?: boolean;
  compact?: boolean;
  
  // Custom UI
  renderDropzone?: (props: {
    getRootProps: () => any;
    getInputProps: () => any;
    isDragActive: boolean;
    files: any[];
  }) => React.ReactNode;
  
  renderFileItem?: (file: any, actions: any) => React.ReactNode;
}

// ===========================
// Main Component
// ===========================

export function UnifiedFileUploader({
  className,
  title = 'Upload Files',
  description,
  maxHeight = '400px',
  showFileList = true,
  showActions = true,
  compact = false,
  renderDropzone,
  renderFileItem,
  ...uploadOptions
}: UnifiedFileUploaderProps) {
  const {
    files,
    isUploading,
    uploadProgress,
    selectFiles,
    uploadFiles,
    cancelUpload,
    removeFile,
    clearFiles,
    retryFailed,
    getRootProps,
    getInputProps,
    isDragActive,
  } = useUnifiedFileUpload(uploadOptions);
  
  // Calculate stats
  const stats = useMemo(() => {
    const total = files.length;
    const pending = files.filter(f => f.status === UploadStatus.PENDING).length;
    const uploading = files.filter(f => f.status === UploadStatus.UPLOADING).length;
    const complete = files.filter(f => f.status === UploadStatus.COMPLETE).length;
    const failed = files.filter(f => f.status === UploadStatus.ERROR).length;
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    
    return { total, pending, uploading, complete, failed, totalSize };
  }, [files]);
  
  // File actions
  const fileActions = {
    remove: removeFile,
    retry: (fileId: string) => {
      const file = files.find(f => f.id === fileId);
      if (file) {
        uploadFiles([file.file]);
      }
    },
  };
  
  // Default dropzone renderer
  const defaultDropzoneRenderer = () => (
    <div
      {...getRootProps()}
      className={cn(
        'relative border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer',
        'hover:border-primary hover:bg-primary/5',
        isDragActive && 'border-primary bg-primary/10',
        compact && 'p-4',
        className
      )}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center justify-center text-center">
        <Upload className={cn('h-10 w-10 text-muted-foreground mb-4', compact && 'h-8 w-8 mb-2')} />
        
        {!compact && (
          <>
            <h3 className="text-lg font-semibold mb-2">{title}</h3>
            {description && (
              <p className="text-sm text-muted-foreground mb-4">{description}</p>
            )}
          </>
        )}
        
        <p className="text-sm text-muted-foreground">
          {isDragActive ? 'Drop files here' : 'Drag & drop files here, or click to select'}
        </p>
        
        {!compact && (
          <Button variant="outline" size="sm" className="mt-4">
            Select Files
          </Button>
        )}
      </div>
    </div>
  );
  
  // Default file item renderer
  const defaultFileItemRenderer = (file: any) => (
    <div
      key={file.id}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card',
        file.status === UploadStatus.ERROR && 'border-destructive bg-destructive/5',
        file.status === UploadStatus.COMPLETE && 'border-green-500 bg-green-500/5'
      )}
    >
      {/* File preview or icon */}
      <div className="relative h-12 w-12 flex-shrink-0">
        {file.preview ? (
          <img
            src={file.preview}
            alt={file.name}
            className="h-full w-full object-cover rounded"
          />
        ) : file.type.startsWith('image/') ? (
          <ImageIcon className="h-full w-full text-muted-foreground" />
        ) : (
          <FileIcon className="h-full w-full text-muted-foreground" />
        )}
        
        {/* Status overlay */}
        {file.status === UploadStatus.UPLOADING && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
        {file.status === UploadStatus.COMPLETE && (
          <div className="absolute inset-0 flex items-center justify-center bg-green-500/20 rounded">
            <Check className="h-6 w-6 text-green-500" />
          </div>
        )}
        {file.status === UploadStatus.ERROR && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/20 rounded">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
        )}
      </div>
      
      {/* File info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{file.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
          {file.error && <span className="text-destructive ml-2">{file.error}</span>}
        </p>
        
        {/* Progress bar */}
        {file.status === UploadStatus.UPLOADING && (
          <Progress value={file.progress} className="h-1 mt-2" />
        )}
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-1">
        {file.status === UploadStatus.ERROR && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileActions.retry(file.id)}
            title="Retry upload"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        )}
        
        {file.status !== UploadStatus.UPLOADING && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileActions.remove(file.id)}
            title="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
  
  return (
    <div className={cn('space-y-4', className)}>
      {/* Dropzone */}
      {renderDropzone ? 
        renderDropzone({ getRootProps, getInputProps, isDragActive, files }) : 
        defaultDropzoneRenderer()
      }
      
      {/* File list */}
      {showFileList && files.length > 0 && (
        <Card className="p-4">
          {/* Header with stats */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4 text-sm">
              <span>{stats.total} files</span>
              <span className="text-muted-foreground">
                {formatFileSize(stats.totalSize)}
              </span>
              {stats.failed > 0 && (
                <span className="text-destructive">{stats.failed} failed</span>
              )}
            </div>
            
            {showActions && (
              <div className="flex items-center gap-2">
                {stats.failed > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryFailed}
                    disabled={isUploading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Failed
                  </Button>
                )}
                
                {stats.pending > 0 && !isUploading && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => uploadFiles()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload {stats.pending} Files
                  </Button>
                )}
                
                {isUploading && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelUpload()}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel Upload
                  </Button>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFiles}
                  disabled={isUploading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          
          {/* Overall progress */}
          {isUploading && (
            <div className="mb-4">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
          
          {/* File items */}
          <div 
            className="space-y-2 overflow-y-auto"
            style={{ maxHeight }}
          >
            {files.map(file => 
              renderFileItem ? 
                renderFileItem(file, fileActions) : 
                defaultFileItemRenderer(file)
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ===========================
// Specialized Components
// ===========================

/**
 * Image uploader component
 */
export function ImageUploader(props: Omit<UnifiedFileUploaderProps, 'configPreset'>) {
  return (
    <UnifiedFileUploader
      {...props}
      configPreset="IMAGE"
      title={props.title || 'Upload Images'}
      description={props.description || 'Supported formats: JPG, PNG, TIFF, BMP, WebP (max 10MB)'}
    />
  );
}

/**
 * Avatar uploader component
 */
export function AvatarUploader(props: Omit<UnifiedFileUploaderProps, 'configPreset' | 'multiple'>) {
  return (
    <UnifiedFileUploader
      {...props}
      configPreset="AVATAR"
      multiple={false}
      title={props.title || 'Upload Avatar'}
      description={props.description || 'Choose a profile picture (max 5MB)'}
      compact
      showActions={false}
    />
  );
}

/**
 * Document uploader component
 */
export function DocumentUploader(props: Omit<UnifiedFileUploaderProps, 'configPreset'>) {
  return (
    <UnifiedFileUploader
      {...props}
      configPreset="DOCUMENT"
      title={props.title || 'Upload Documents'}
      description={props.description || 'Supported formats: PDF, TXT, JSON (max 50MB)'}
    />
  );
}

// ===========================
// Export
// ===========================

export default UnifiedFileUploader;