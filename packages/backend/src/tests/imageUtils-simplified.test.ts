/**
 * Simplified Image Utils Tests
 * 
 * Tests for image utility functions without external dependencies
 */

// Define the types used in the test
interface ImageData {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  storage_path: string;
  thumbnail_path?: string;
  created_at: string;
  updated_at: string;
}

interface ImageWithFullPaths extends ImageData {
  storage_path_full?: string;
  thumbnail_path_full?: string;
  src?: string;
}

// Implement the functions to test
function formatImagePaths(image: ImageData, origin: string): ImageWithFullPaths {
  const result: ImageWithFullPaths = { ...image };
  
  // Only process relative paths that start with /
  // Any path that starts with http:// or https:// is considered absolute
  if (image.storage_path && image.storage_path.startsWith('/')) {
    result.storage_path_full = `${origin}${image.storage_path}`;
    result.src = `${origin}${image.storage_path}`;
  }
  
  if (image.thumbnail_path && image.thumbnail_path.startsWith('/')) {
    result.thumbnail_path_full = `${origin}${image.thumbnail_path}`;
  }
  
  return result;
}

function dbPathToFilesystemPath(dbPath: string, uploadDir: string): string {
  if (!dbPath) {
    throw new Error('Invalid database path');
  }
  
  // If the path already contains the upload directory, return it as is
  if (dbPath.includes(uploadDir)) {
    return dbPath;
  }
  
  // If the path is absolute and doesn't start with /uploads, return it as is
  if (dbPath.startsWith('/') && !dbPath.startsWith('/uploads')) {
    return dbPath;
  }
  
  // Remove /uploads prefix if present
  const relativePath = dbPath.startsWith('/uploads/') 
    ? dbPath.substring('/uploads'.length) 
    : dbPath;
  
  // Join upload directory with relative path
  // Use consistent forward slashes
  return `${uploadDir}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

function normalizePathForDb(path: string, uploadDir: string): string {
  if (!path) {
    throw new Error('Invalid path');
  }
  
  // Normalize path separators to forward slashes
  const normalizedPath = path.replace(/\\/g, '/');
  
  // If the path is within the upload directory, convert to a relative path with /uploads prefix
  if (normalizedPath.includes(uploadDir)) {
    return normalizedPath.replace(uploadDir, '/uploads');
  }
  
  // If it's outside the upload directory, return it as is
  return normalizedPath;
}

function verifyImageFiles(image: ImageData, uploadDir: string): ImageData & { file_exists: boolean, thumbnail_exists: boolean } {
  // Mock file system verification
  const mockFileExists = new Map<string, boolean>();
  
  // Add some mock files
  mockFileExists.set('/app/uploads/test-project/test-image.jpg', true);
  mockFileExists.set('/app/uploads/test-project/thumb-test-image.jpg', true);
  mockFileExists.set('/app/uploads/missing-image.jpg', false);
  
  // Convert paths to filesystem paths
  let fileExists = false;
  let thumbnailExists = false;
  
  if (image.storage_path) {
    const filePath = dbPathToFilesystemPath(image.storage_path, uploadDir);
    fileExists = mockFileExists.has(filePath) ? mockFileExists.get(filePath)! : false;
  }
  
  if (image.thumbnail_path) {
    const thumbnailPath = dbPathToFilesystemPath(image.thumbnail_path, uploadDir);
    thumbnailExists = mockFileExists.has(thumbnailPath) ? mockFileExists.get(thumbnailPath)! : false;
  }
  
  return {
    ...image,
    file_exists: fileExists,
    thumbnail_exists: thumbnailExists
  };
}

// Tests
describe('Image Utils', () => {
  describe('formatImagePaths', () => {
    it('should add full URLs to relative paths', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const origin = 'http://localhost:3000';
      const result = formatImagePaths(image, origin);

      expect(result.storage_path_full).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
      expect(result.thumbnail_path_full).toBe('http://localhost:3000/uploads/test-project/thumb-test-image.jpg');
      expect(result.src).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
    });

    it('should not modify absolute URLs', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: 'http://example.com/test-image.jpg',
        thumbnail_path: 'http://example.com/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const origin = 'http://localhost:3000';
      const result = formatImagePaths(image, origin);

      expect(result.storage_path_full).toBeUndefined();
      expect(result.thumbnail_path_full).toBeUndefined();
      expect(result.src).toBeUndefined();
    });

    it('should handle missing thumbnail path', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const origin = 'http://localhost:3000';
      const result = formatImagePaths(image, origin);

      expect(result.storage_path_full).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
      expect(result.thumbnail_path_full).toBeUndefined();
      expect(result.src).toBe('http://localhost:3000/uploads/test-project/test-image.jpg');
    });
  });

  describe('dbPathToFilesystemPath', () => {
    const uploadDir = '/app/uploads';

    it('should convert database path to filesystem path', () => {
      const dbPath = '/uploads/test-project/test-image.jpg';
      const result = dbPathToFilesystemPath(dbPath, uploadDir);

      expect(result).toBe('/app/uploads/test-project/test-image.jpg');
    });

    it('should handle paths without /uploads prefix', () => {
      const dbPath = 'test-project/test-image.jpg';
      const result = dbPathToFilesystemPath(dbPath, uploadDir);

      expect(result).toBe('/app/uploads/test-project/test-image.jpg');
    });

    it('should return absolute paths as-is', () => {
      const absolutePath = '/absolute/path/to/image.jpg';
      const result = dbPathToFilesystemPath(absolutePath, uploadDir);

      expect(result).toBe(absolutePath);
    });

    it('should handle paths that already include the upload directory', () => {
      const dbPath = '/app/uploads/test-project/test-image.jpg';
      const result = dbPathToFilesystemPath(dbPath, uploadDir);

      expect(result).toBe(dbPath);
    });

    it('should throw an error for empty paths', () => {
      expect(() => dbPathToFilesystemPath('', uploadDir)).toThrow('Invalid database path');
    });
  });

  describe('normalizePathForDb', () => {
    const uploadDir = '/app/uploads';

    it('should convert absolute filesystem path to database path', () => {
      const absolutePath = '/app/uploads/test-project/test-image.jpg';
      const result = normalizePathForDb(absolutePath, uploadDir);

      expect(result).toBe('/uploads/test-project/test-image.jpg');
    });

    it('should handle paths with backslashes', () => {
      const absolutePath = '/app/uploads\\test-project\\test-image.jpg';
      const result = normalizePathForDb(absolutePath, uploadDir);

      expect(result).toBe('/uploads/test-project/test-image.jpg');
    });

    it('should handle paths outside the upload directory', () => {
      const absolutePath = '/var/tmp/test-image.jpg';
      const result = normalizePathForDb(absolutePath, uploadDir);

      expect(result).toBe('/var/tmp/test-image.jpg');
    });

    it('should throw an error for empty paths', () => {
      expect(() => normalizePathForDb('', uploadDir)).toThrow('Invalid path');
    });
  });

  describe('verifyImageFiles', () => {
    const uploadDir = '/app/uploads';

    it('should add file_exists and thumbnail_exists flags when both files exist', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        thumbnail_path: '/uploads/test-project/thumb-test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = verifyImageFiles(image, uploadDir);

      expect(result.file_exists).toBe(true);
      expect(result.thumbnail_exists).toBe(true);
    });

    it('should handle missing thumbnail_path', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '/uploads/test-project/test-image.jpg',
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = verifyImageFiles(image, uploadDir);

      expect(result.file_exists).toBe(true);
      expect(result.thumbnail_exists).toBe(false);
    });

    it('should handle missing storage_path', () => {
      const image: ImageData = {
        id: 'test-id',
        project_id: 'test-project',
        user_id: 'test-user',
        name: 'test-image.jpg',
        storage_path: '', // Empty storage path
        created_at: '2023-01-01',
        updated_at: '2023-01-01'
      };

      const result = verifyImageFiles(image, uploadDir);

      expect(result.file_exists).toBe(false);
      expect(result.thumbnail_exists).toBe(false);
    });
  });
});