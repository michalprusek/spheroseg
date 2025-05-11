import { describe, it, expect } from 'vitest';
import { FileWithPreview } from '@/components/upload/FileList';

// Helper function to format file size (extracted from FileList.tsx)
const formatFileSize = (sizeInBytes: number): string => {
  if (sizeInBytes === 0) return '0 KB';

  if (isNaN(sizeInBytes)) return 'Unknown size';

  if (sizeInBytes < 1024) {
    return `${sizeInBytes} B`;
  } else if (sizeInBytes < 1024 * 1024) {
    return `${(sizeInBytes / 1024).toFixed(0)} KB`;
  } else {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }
};

// Helper function to create a file with preview
const createFileWithPreview = (
  name: string,
  size: number,
  type: string = 'image/jpeg',
  status: 'pending' | 'uploading' | 'complete' | 'error' = 'pending',
  preview?: string,
): FileWithPreview => {
  const file = new File([''], name, { type }) as FileWithPreview;
  Object.defineProperty(file, 'size', { value: size });
  file.preview = preview;
  file.status = status;
  file.id = `file-${Math.random().toString(36).substring(2, 9)}`;
  return file;
};

describe('File Handling Utilities', () => {
  describe('formatFileSize function', () => {
    it('formats file sizes correctly', () => {
      // Test bytes
      expect(formatFileSize(0)).toBe('0 KB');
      expect(formatFileSize(100)).toBe('100 B');
      expect(formatFileSize(1023)).toBe('1023 B');

      // Test kilobytes
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1536)).toBe('2 KB'); // 1.5 KB rounded to 2 KB
      expect(formatFileSize(10240)).toBe('10 KB');
      expect(formatFileSize(1048575)).toBe('1024 KB');

      // Test megabytes
      expect(formatFileSize(1048576)).toBe('1.0 MB');
      expect(formatFileSize(1572864)).toBe('1.5 MB');
      expect(formatFileSize(10485760)).toBe('10.0 MB');
    });

    it('handles invalid inputs', () => {
      expect(formatFileSize(NaN)).toBe('Unknown size');
    });
  });

  describe('createFileWithPreview function', () => {
    it('creates a file with preview', () => {
      const file = createFileWithPreview('test.jpg', 1024, 'image/jpeg', 'pending', 'data:image/jpeg;base64,test');

      // Check file properties
      expect(file.name).toBe('test.jpg');
      expect(file.size).toBe(1024);
      expect(file.type).toBe('image/jpeg');
      expect(file.status).toBe('pending');
      expect(file.preview).toBe('data:image/jpeg;base64,test');
      expect(file.id).toBeDefined();
    });

    it('creates a file with default values', () => {
      const file = createFileWithPreview('test.jpg', 1024);

      // Check file properties
      expect(file.name).toBe('test.jpg');
      expect(file.size).toBe(1024);
      expect(file.type).toBe('image/jpeg');
      expect(file.status).toBe('pending');
      expect(file.preview).toBeUndefined();
      expect(file.id).toBeDefined();
    });

    it('creates a file with different status', () => {
      const file = createFileWithPreview('test.jpg', 1024, 'image/jpeg', 'complete');

      // Check file properties
      expect(file.status).toBe('complete');
    });
  });

  describe('FileWithPreview interface', () => {
    it('supports all required properties', () => {
      const file = createFileWithPreview('test.jpg', 1024);
      file.uploadProgress = 50;

      // Check if all properties are accessible
      expect(file.name).toBeDefined();
      expect(file.size).toBeDefined();
      expect(file.type).toBeDefined();
      expect(file.status).toBeDefined();
      expect(file.id).toBeDefined();
      expect(file.uploadProgress).toBe(50);
    });
  });
});
