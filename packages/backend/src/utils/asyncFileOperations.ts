/**
 * Async File Operations Utility
 * 
 * Provides async versions of common file operations to prevent blocking the event loop.
 * All operations return promises and should be used with async/await.
 */

import fs from 'fs';
import { promisify } from 'util';
import path from 'path';

// Promisified versions of fs methods
export const fsExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const fsStat = fs.promises.stat;
export const fsReadFile = fs.promises.readFile;
export const fsWriteFile = fs.promises.writeFile;
export const fsUnlink = fs.promises.unlink;
export const fsMkdir = fs.promises.mkdir;
export const fsCopyFile = fs.promises.copyFile;
export const fsReaddir = fs.promises.readdir;
export const fsRename = fs.promises.rename;

/**
 * Async version of ensureDirectoryExists
 * Creates a directory and all parent directories if they don't exist
 */
export const ensureDirectoryExistsAsync = async (dirPath: string): Promise<void> => {
  try {
    await fsMkdir(dirPath, { recursive: true });
  } catch (error) {
    // If directory already exists, that's fine
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error;
    }
  }
};

/**
 * Async version of checking if a file is writable
 */
export const isWritableAsync = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Async version of checking if a file is readable
 */
export const isReadableAsync = async (filePath: string): Promise<boolean> => {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
};

/**
 * Safely write a file with atomic operation (write to temp file then rename)
 */
export const writeFileAtomicAsync = async (
  filePath: string,
  data: string | Buffer
): Promise<void> => {
  const tempPath = `${filePath}.tmp.${Date.now()}`;
  try {
    await fsWriteFile(tempPath, data);
    await fsRename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fsUnlink(tempPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
};

/**
 * Copy file with progress callback support
 */
export const copyFileWithProgressAsync = async (
  source: string,
  destination: string,
  onProgress?: (bytesWritten: number, totalBytes: number) => void
): Promise<void> => {
  const stats = await fsStat(source);
  const totalBytes = stats.size;
  
  if (onProgress) {
    // For progress tracking, we need to use streams
    const readStream = fs.createReadStream(source);
    const writeStream = fs.createWriteStream(destination);
    
    let bytesWritten = 0;
    
    return new Promise((resolve, reject) => {
      readStream.on('data', (chunk) => {
        bytesWritten += chunk.length;
        onProgress(bytesWritten, totalBytes);
      });
      
      readStream.on('error', reject);
      writeStream.on('error', reject);
      writeStream.on('finish', resolve);
      
      readStream.pipe(writeStream);
    });
  } else {
    // Without progress, use the simpler copyFile
    await fsCopyFile(source, destination);
  }
};

/**
 * Delete file if it exists (no error if file doesn't exist)
 */
export const deleteFileIfExistsAsync = async (filePath: string): Promise<boolean> => {
  try {
    await fsUnlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // File doesn't exist, that's fine
      return false;
    }
    throw error;
  }
};

/**
 * Get directory size recursively
 */
export const getDirectorySizeAsync = async (dirPath: string): Promise<number> => {
  let totalSize = 0;
  
  const processDirectory = async (currentPath: string): Promise<void> => {
    const items = await fsReaddir(currentPath, { withFileTypes: true });
    
    await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(currentPath, item.name);
        
        if (item.isDirectory()) {
          await processDirectory(itemPath);
        } else if (item.isFile()) {
          const stats = await fsStat(itemPath);
          totalSize += stats.size;
        }
      })
    );
  };
  
  await processDirectory(dirPath);
  return totalSize;
};

/**
 * List files in directory with optional filtering
 */
export const listFilesAsync = async (
  dirPath: string,
  options?: {
    recursive?: boolean;
    filter?: (filePath: string) => boolean;
    extensions?: string[];
  }
): Promise<string[]> => {
  const files: string[] = [];
  const { recursive = false, filter, extensions } = options || {};
  
  const processDirectory = async (currentPath: string): Promise<void> => {
    const items = await fsReaddir(currentPath, { withFileTypes: true });
    
    await Promise.all(
      items.map(async (item) => {
        const itemPath = path.join(currentPath, item.name);
        
        if (item.isDirectory() && recursive) {
          await processDirectory(itemPath);
        } else if (item.isFile()) {
          // Apply extension filter if provided
          if (extensions) {
            const ext = path.extname(itemPath).toLowerCase();
            if (!extensions.includes(ext)) {
              return;
            }
          }
          
          // Apply custom filter if provided
          if (filter && !filter(itemPath)) {
            return;
          }
          
          files.push(itemPath);
        }
      })
    );
  };
  
  await processDirectory(dirPath);
  return files;
};

export default {
  fsExists,
  fsStat,
  fsReadFile,
  fsWriteFile,
  fsUnlink,
  fsMkdir,
  fsCopyFile,
  fsReaddir,
  fsRename,
  ensureDirectoryExistsAsync,
  isWritableAsync,
  isReadableAsync,
  writeFileAtomicAsync,
  copyFileWithProgressAsync,
  deleteFileIfExistsAsync,
  getDirectorySizeAsync,
  listFilesAsync,
};