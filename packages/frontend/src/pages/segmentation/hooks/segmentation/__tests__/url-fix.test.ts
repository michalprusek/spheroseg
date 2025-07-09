import { describe, it, expect } from 'vitest';

// Test the URL processing logic
describe('URL Processing Fix', () => {
  // Simulate the processImageUrl logic
  const processStoragePath = (storage_path: string): string => {
    const baseUrl = 'http://localhost';

    // Check if storage_path is already a full URL
    if (storage_path.startsWith('http://') || storage_path.startsWith('https://')) {
      // It's already a full URL, use it as is
      return storage_path;
    } else if (storage_path.startsWith('/')) {
      return `${baseUrl}${storage_path}`;
    } else {
      return `${baseUrl}/${storage_path}`;
    }
  };

  it('should not double-prepend URLs that are already absolute', () => {
    const fullUrl = 'http://localhost/uploads/project1/image.jpg';
    const result = processStoragePath(fullUrl);
    expect(result).toBe('http://localhost/uploads/project1/image.jpg');
    expect(result).not.toContain('http://localhosthttp://');
  });

  it('should properly handle relative paths starting with /', () => {
    const relativePath = '/uploads/project1/image.jpg';
    const result = processStoragePath(relativePath);
    expect(result).toBe('http://localhost/uploads/project1/image.jpg');
  });

  it('should properly handle relative paths without leading /', () => {
    const relativePath = 'uploads/project1/image.jpg';
    const result = processStoragePath(relativePath);
    expect(result).toBe('http://localhost/uploads/project1/image.jpg');
  });

  it('should handle https URLs correctly', () => {
    const httpsUrl = 'https://example.com/uploads/image.jpg';
    const result = processStoragePath(httpsUrl);
    expect(result).toBe('https://example.com/uploads/image.jpg');
  });
});
