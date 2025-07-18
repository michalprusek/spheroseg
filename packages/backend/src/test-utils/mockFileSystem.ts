/**
 * Mock File System Utilities for Testing
 *
 * This module provides utilities for mocking file system operations in tests.
 * It includes:
 * - In-memory storage for files and directories
 * - Mock fs functions with the same API as Node's fs module
 * - Helper functions for setting up test files
 */

import path from 'path';
import { Readable } from 'stream';
import { EventEmitter } from 'events';

// Types for mock filesystem
interface MockFileEntry {
  type: 'file';
  content: Buffer | string;
  mtime: Date;
  atime: Date;
  ctime: Date;
  birthtime: Date;
  mode: number;
  size: number;
}

interface MockDirectoryEntry {
  type: 'directory';
  mtime: Date;
  atime: Date;
  ctime: Date;
  birthtime: Date;
  mode: number;
}

type MockFSEntry = MockFileEntry | MockDirectoryEntry;

interface MockFS {
  [path: string]: MockFSEntry;
}

// Basic file stats implementation
class MockStats {
  public dev: number = 0;
  public ino: number = 0;
  public mode: number;
  public nlink: number = 1;
  public uid: number = 0;
  public gid: number = 0;
  public rdev: number = 0;
  public size: number;
  public blksize: number = 4096;
  public blocks: number = 0;
  public atimeMs: number;
  public mtimeMs: number;
  public ctimeMs: number;
  public birthtimeMs: number;
  public atime: Date;
  public mtime: Date;
  public ctime: Date;
  public birthtime: Date;

  constructor(entry: MockFSEntry) {
    this.mode = entry.mode;
    this.atime = entry.atime;
    this.mtime = entry.mtime;
    this.ctime = entry.ctime;
    this.birthtime = entry.birthtime;
    this.atimeMs = entry.atime.getTime();
    this.mtimeMs = entry.mtime.getTime();
    this.ctimeMs = entry.ctime.getTime();
    this.birthtimeMs = entry.birthtime.getTime();

    if (entry.type === 'file') {
      this.size = entry.size;
    } else {
      this.size = 0;
    }
  }

  isFile(): boolean {
    return this.mode & 0o100000 ? true : false;
  }

  isDirectory(): boolean {
    return this.mode & 0o040000 ? true : false;
  }

  isBlockDevice(): boolean {
    return false;
  }

  isCharacterDevice(): boolean {
    return false;
  }

  isSymbolicLink(): boolean {
    return false;
  }

  isFIFO(): boolean {
    return false;
  }

  isSocket(): boolean {
    return false;
  }
}

/**
 * MockFileSystem class to handle file operations
 */
export class MockFileSystem {
  private fs: MockFS = {};

  constructor(initialFs: MockFS = {}) {
    this.fs = { ...initialFs };

    // Always have root directory
    if (!this.fs['/']) {
      this.fs['/'] = {
        type: 'directory',
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        mode: 0o40755,
      };
    }
  }

  /**
   * Normalize a path to ensure consistent format
   */
  private normalizePath(p: string): string {
    // Resolve '..' and '.' segments
    const parts = path.normalize(p).split(path.sep).filter(Boolean);
    let result = path.isAbsolute(p) ? '/' : '';

    // Build path with forward slashes
    if (parts.length > 0) {
      result = path.isAbsolute(p) ? '/' + parts.join('/') : parts.join('/');
    }

    return result;
  }

  /**
   * Check if a file or directory exists
   */
  private exists(p: string): boolean {
    const normalizedPath = this.normalizePath(p);
    return normalizedPath in this.fs;
  }

  /**
   * Get the parent directory
   */
  private dirname(p: string): string {
    return path.dirname(p);
  }

  /**
   * Ensure parent directories exist recursively
   */
  private ensureDir(dirPath: string): void {
    const normalized = this.normalizePath(dirPath);
    if (normalized === '') return;

    if (!this.exists(normalized)) {
      // Ensure parent directory exists first
      this.ensureDir(this.dirname(normalized));

      // Create this directory
      this.fs[normalized] = {
        type: 'directory',
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        mode: 0o40755,
      };
    }
  }

  /**
   * Reset the mock file system
   */
  public reset(): void {
    this.fs = {
      '/': {
        type: 'directory',
        mtime: new Date(),
        atime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        mode: 0o40755,
      },
    };
  }

  /**
   * Add a file to the mock filesystem
   */
  public addFile(filePath: string, content: string | Buffer): void {
    const normalizedPath = this.normalizePath(filePath);
    const dirPath = this.dirname(normalizedPath);

    // Ensure parent directory exists
    this.ensureDir(dirPath);

    const now = new Date();
    const contentBuffer = typeof content === 'string' ? Buffer.from(content) : content;

    this.fs[normalizedPath] = {
      type: 'file',
      content: contentBuffer,
      mtime: now,
      atime: now,
      ctime: now,
      birthtime: now,
      mode: 0o100644,
      size: contentBuffer.length,
    };
  }

  /**
   * Add a directory to the mock filesystem
   */
  public addDirectory(dirPath: string): void {
    this.ensureDir(dirPath);
  }

  /**
   * Get a list of all files in the mock filesystem
   */
  public getAllFiles(): string[] {
    return Object.keys(this.fs).filter((p) => this.fs[p].type === 'file');
  }

  /**
   * Get a list of all directories in the mock filesystem
   */
  public getAllDirectories(): string[] {
    return Object.keys(this.fs).filter((p) => this.fs[p].type === 'directory');
  }

  /**
   * Get file content from the mock filesystem
   */
  public getFileContent(filePath: string): Buffer | string | null {
    const normalizedPath = this.normalizePath(filePath);

    if (this.exists(normalizedPath) && this.fs[normalizedPath].type === 'file') {
      return (this.fs[normalizedPath] as MockFileEntry).content;
    }

    return null;
  }

  // Implementation of fs-like functions

  /**
   * fs.readFile implementation
   */
  public readFile(
    filePath: string,
    options: { encoding?: string; flag?: string } | string | undefined | null,
    callback?: (err: Error | null, data: Buffer | string) => void
  ): void | Promise<Buffer | string> {
    const normalizedPath = this.normalizePath(filePath);

    // Handle different argument patterns
    if (typeof options === 'function') {
      callback = options as (err: Error | null, data: Buffer | string) => void;
      options = null;
    }

    // Determine encoding
    const encoding =
      typeof options === 'string' ? options : options && options.encoding ? options.encoding : null;

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.readFile(filePath, options, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });
    }

    // Check if file exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'open';
      (err as any).path = filePath;
      return callback(err, Buffer.from(''));
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type === 'directory') {
      const err = new Error(`EISDIR: illegal operation on a directory, read '${filePath}'`);
      (err as any).code = 'EISDIR';
      (err as any).syscall = 'read';
      (err as any).path = filePath;
      return callback(err, Buffer.from(''));
    }

    // Read file content
    const content = (this.fs[normalizedPath] as MockFileEntry).content;
    const data = encoding ? content.toString(encoding as BufferEncoding) : content;

    // Update access time
    (this.fs[normalizedPath] as MockFileEntry).atime = new Date();

    callback(null, data);
  }

  /**
   * fs.readFileSync implementation
   */
  public readFileSync(
    filePath: string,
    options?: { encoding?: string; flag?: string } | string | null
  ): Buffer | string {
    const normalizedPath = this.normalizePath(filePath);

    // Determine encoding
    const encoding =
      typeof options === 'string' ? options : options && options.encoding ? options.encoding : null;

    // Check if file exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'open';
      (err as any).path = filePath;
      throw err;
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type === 'directory') {
      const err = new Error(`EISDIR: illegal operation on a directory, read '${filePath}'`);
      (err as any).code = 'EISDIR';
      (err as any).syscall = 'read';
      (err as any).path = filePath;
      throw err;
    }

    // Read file content
    const content = (this.fs[normalizedPath] as MockFileEntry).content;

    // Update access time
    (this.fs[normalizedPath] as MockFileEntry).atime = new Date();

    return encoding ? content.toString(encoding as BufferEncoding) : content;
  }

  /**
   * fs.writeFile implementation
   */
  public writeFile(
    filePath: string,
    data: string | Buffer | Uint8Array,
    options: { encoding?: string; mode?: number; flag?: string } | string | undefined | null,
    callback?: (err: Error | null) => void
  ): void | Promise<void> {
    const normalizedPath = this.normalizePath(filePath);

    // Handle different argument patterns
    if (typeof options === 'function') {
      callback = options as (err: Error | null) => void;
      options = null;
    }

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.writeFile(filePath, data, options, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Ensure parent directory exists
    const dirPath = this.dirname(normalizedPath);

    try {
      this.ensureDir(dirPath);

      // Prepare data
      const contentBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
      const now = new Date();

      this.fs[normalizedPath] = {
        type: 'file',
        content: contentBuffer,
        mtime: now,
        atime: now,
        ctime: now,
        birthtime: this.exists(normalizedPath)
          ? (this.fs[normalizedPath] as MockFileEntry).birthtime
          : now,
        mode: options && typeof options === 'object' && options.mode ? options.mode : 0o100644,
        size: contentBuffer.length,
      };

      callback(null);
    } catch (err) {
      callback(err as Error);
    }
  }

  /**
   * fs.writeFileSync implementation
   */
  public writeFileSync(
    filePath: string,
    data: string | Buffer | Uint8Array,
    options?: { encoding?: string; mode?: number; flag?: string } | string | null
  ): void {
    const normalizedPath = this.normalizePath(filePath);

    // Ensure parent directory exists
    const dirPath = this.dirname(normalizedPath);
    this.ensureDir(dirPath);

    // Prepare data
    const contentBuffer = Buffer.isBuffer(data) ? data : Buffer.from(data as string);
    const now = new Date();

    this.fs[normalizedPath] = {
      type: 'file',
      content: contentBuffer,
      mtime: now,
      atime: now,
      ctime: now,
      birthtime: this.exists(normalizedPath)
        ? (this.fs[normalizedPath] as MockFileEntry).birthtime
        : now,
      mode: options && typeof options === 'object' && options.mode ? options.mode : 0o100644,
      size: contentBuffer.length,
    };
  }

  /**
   * fs.mkdir implementation
   */
  public mkdir(
    dirPath: string,
    options: { recursive?: boolean; mode?: number } | number | undefined | null,
    callback?: (err: Error | null) => void
  ): void | Promise<void> {
    const normalizedPath = this.normalizePath(dirPath);

    // Handle different argument patterns
    if (typeof options === 'function') {
      callback = options as (err: Error | null) => void;
      options = null;
    }

    // Normalize options
    const opts = typeof options === 'number' ? { mode: options } : options || {};

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.mkdir(dirPath, options, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Check if path exists and is not a directory when non-recursive
    if (this.exists(normalizedPath) && !opts.recursive) {
      const err = new Error(`EEXIST: file already exists, mkdir '${dirPath}'`);
      (err as any).code = 'EEXIST';
      (err as any).syscall = 'mkdir';
      (err as any).path = dirPath;
      return callback(err);
    }

    try {
      if (opts.recursive) {
        this.ensureDir(normalizedPath);
      } else {
        // Ensure parent exists
        const parentDir = this.dirname(normalizedPath);
        if (!this.exists(parentDir)) {
          const err = new Error(`ENOENT: no such file or directory, mkdir '${dirPath}'`);
          (err as any).code = 'ENOENT';
          (err as any).syscall = 'mkdir';
          (err as any).path = dirPath;
          return callback(err);
        }

        // Create directory
        const now = new Date();
        this.fs[normalizedPath] = {
          type: 'directory',
          mtime: now,
          atime: now,
          ctime: now,
          birthtime: now,
          mode: opts.mode || 0o40755,
        };
      }

      callback(null);
    } catch (err) {
      callback(err as Error);
    }
  }

  /**
   * fs.mkdirSync implementation
   */
  public mkdirSync(
    dirPath: string,
    options?: { recursive?: boolean; mode?: number } | number | null
  ): void {
    const normalizedPath = this.normalizePath(dirPath);

    // Normalize options
    const opts = typeof options === 'number' ? { mode: options } : options || {};

    // Check if path exists and is not a directory when non-recursive
    if (this.exists(normalizedPath) && !opts.recursive) {
      const err = new Error(`EEXIST: file already exists, mkdir '${dirPath}'`);
      (err as any).code = 'EEXIST';
      (err as any).syscall = 'mkdir';
      (err as any).path = dirPath;
      throw err;
    }

    if (opts.recursive) {
      this.ensureDir(normalizedPath);
    } else {
      // Ensure parent exists
      const parentDir = this.dirname(normalizedPath);
      if (!this.exists(parentDir)) {
        const err = new Error(`ENOENT: no such file or directory, mkdir '${dirPath}'`);
        (err as any).code = 'ENOENT';
        (err as any).syscall = 'mkdir';
        (err as any).path = dirPath;
        throw err;
      }

      // Create directory
      const now = new Date();
      this.fs[normalizedPath] = {
        type: 'directory',
        mtime: now,
        atime: now,
        ctime: now,
        birthtime: now,
        mode: opts.mode || 0o40755,
      };
    }
  }

  /**
   * fs.readdir implementation
   */
  public readdir(
    dirPath: string,
    options: { encoding?: string; withFileTypes?: boolean } | string | undefined | null,
    callback?: (err: Error | null, files: string[] | fs.Dirent[]) => void
  ): void | Promise<string[] | fs.Dirent[]> {
    const normalizedPath = this.normalizePath(dirPath);

    // Handle different argument patterns
    if (typeof options === 'function') {
      callback = options as (err: Error | null, files: string[] | fs.Dirent[]) => void;
      options = null;
    }

    // Normalize options
    const opts = typeof options === 'string' ? { encoding: options } : options || {};

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.readdir(dirPath, options, (err, files) => {
          if (err) reject(err);
          else resolve(files);
        });
      });
    }

    // Check if directory exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'scandir';
      (err as any).path = dirPath;
      return callback(err, []);
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type !== 'directory') {
      const err = new Error(`ENOTDIR: not a directory, scandir '${dirPath}'`);
      (err as any).code = 'ENOTDIR';
      (err as any).syscall = 'scandir';
      (err as any).path = dirPath;
      return callback(err, []);
    }

    // Get directory entries
    const files = Object.keys(this.fs)
      .filter((p) => {
        // Only direct children
        const relPath = path.relative(normalizedPath, p);
        return relPath && !relPath.includes('/') && relPath !== '';
      })
      .map((p) => {
        return path.basename(p);
      });

    // Update access time
    (this.fs[normalizedPath] as MockDirectoryEntry).atime = new Date();

    // Return with file types if requested
    if (opts.withFileTypes) {
      const dirents = files.map((file) => {
        const fullPath = path.join(normalizedPath, file);
        const isDirectory = this.fs[fullPath].type === 'directory';

        const dirent: any = {
          name: file,
          isFile: () => !isDirectory,
          isDirectory: () => isDirectory,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        };

        return dirent;
      });

      callback(null, dirents);
    } else {
      callback(null, files);
    }
  }

  /**
   * fs.readdirSync implementation
   */
  public readdirSync(
    dirPath: string,
    options?: { encoding?: string; withFileTypes?: boolean } | string | null
  ): string[] | fs.Dirent[] {
    const normalizedPath = this.normalizePath(dirPath);

    // Normalize options
    const opts = typeof options === 'string' ? { encoding: options } : options || {};

    // Check if directory exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, scandir '${dirPath}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'scandir';
      (err as any).path = dirPath;
      throw err;
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type !== 'directory') {
      const err = new Error(`ENOTDIR: not a directory, scandir '${dirPath}'`);
      (err as any).code = 'ENOTDIR';
      (err as any).syscall = 'scandir';
      (err as any).path = dirPath;
      throw err;
    }

    // Get directory entries
    const files = Object.keys(this.fs)
      .filter((p) => {
        // Only direct children
        const relPath = path.relative(normalizedPath, p);
        return relPath && !relPath.includes('/') && relPath !== '';
      })
      .map((p) => {
        return path.basename(p);
      });

    // Update access time
    (this.fs[normalizedPath] as MockDirectoryEntry).atime = new Date();

    // Return with file types if requested
    if (opts.withFileTypes) {
      return files.map((file) => {
        const fullPath = path.join(normalizedPath, file);
        const isDirectory = this.fs[fullPath].type === 'directory';

        const dirent: any = {
          name: file,
          isFile: () => !isDirectory,
          isDirectory: () => isDirectory,
          isBlockDevice: () => false,
          isCharacterDevice: () => false,
          isSymbolicLink: () => false,
          isFIFO: () => false,
          isSocket: () => false,
        };

        return dirent;
      });
    }

    return files;
  }

  /**
   * fs.stat implementation
   */
  public stat(
    path: string,
    options: { bigint?: boolean } | undefined | null,
    callback?: (err: Error | null, stats: fs.Stats) => void
  ): void | Promise<fs.Stats> {
    const normalizedPath = this.normalizePath(path);

    // Handle different argument patterns
    if (typeof options === 'function') {
      callback = options as (err: Error | null, stats: fs.Stats) => void;
      options = null;
    }

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.stat(path, options, (err, stats) => {
          if (err) reject(err);
          else resolve(stats);
        });
      });
    }

    // Check if path exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'stat';
      (err as any).path = path;
      return callback(err, {} as fs.Stats);
    }

    // Return stats
    const stats = new MockStats(this.fs[normalizedPath]);

    callback(null, stats as unknown as fs.Stats);
  }

  /**
   * fs.statSync implementation
   */
  public statSync(path: string, _options?: { bigint?: boolean } | null): fs.Stats {
    const normalizedPath = this.normalizePath(path);

    // Check if path exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, stat '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'stat';
      (err as any).path = path;
      throw err;
    }

    // Return stats
    const stats = new MockStats(this.fs[normalizedPath]);

    return stats as unknown as fs.Stats;
  }

  /**
   * fs.unlink implementation
   */
  public unlink(path: string, callback?: (err: Error | null) => void): void | Promise<void> {
    const normalizedPath = this.normalizePath(path);

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.unlink(path, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Check if path exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, unlink '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'unlink';
      (err as any).path = path;
      return callback(err);
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type === 'directory') {
      const err = new Error(`EISDIR: illegal operation on a directory, unlink '${path}'`);
      (err as any).code = 'EISDIR';
      (err as any).syscall = 'unlink';
      (err as any).path = path;
      return callback(err);
    }

    // Remove file
    delete this.fs[normalizedPath];

    callback(null);
  }

  /**
   * fs.unlinkSync implementation
   */
  public unlinkSync(path: string): void {
    const normalizedPath = this.normalizePath(path);

    // Check if path exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, unlink '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'unlink';
      (err as any).path = path;
      throw err;
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type === 'directory') {
      const err = new Error(`EISDIR: illegal operation on a directory, unlink '${path}'`);
      (err as any).code = 'EISDIR';
      (err as any).syscall = 'unlink';
      (err as any).path = path;
      throw err;
    }

    // Remove file
    delete this.fs[normalizedPath];
  }

  /**
   * fs.rmdir implementation
   */
  public rmdir(
    path: string,
    options?: { recursive?: boolean } | null,
    callback?: (err: Error | null) => void
  ): void | Promise<void> {
    const normalizedPath = this.normalizePath(path);

    // Handle different argument patterns
    if (typeof options === 'function') {
      callback = options as (err: Error | null) => void;
      options = null;
    }

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.rmdir(path, options, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Check if path exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, rmdir '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'rmdir';
      (err as any).path = path;
      return callback(err);
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type !== 'directory') {
      const err = new Error(`ENOTDIR: not a directory, rmdir '${path}'`);
      (err as any).code = 'ENOTDIR';
      (err as any).syscall = 'rmdir';
      (err as any).path = path;
      return callback(err);
    }

    // Check if directory is empty
    const hasChildren = Object.keys(this.fs).some((p) => {
      // Only direct children
      const relPath = path.relative(normalizedPath, p);
      return relPath && !relPath.includes('/') && relPath !== '';
    });

    if (hasChildren && (!options || !options.recursive)) {
      const err = new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`);
      (err as any).code = 'ENOTEMPTY';
      (err as any).syscall = 'rmdir';
      (err as any).path = path;
      return callback(err);
    }

    // Remove directory and all children if recursive
    if (options && options.recursive) {
      // Remove all descendants
      Object.keys(this.fs)
        .filter((p) => p.startsWith(normalizedPath + '/') || p === normalizedPath)
        .forEach((p) => {
          delete this.fs[p];
        });
    } else {
      // Just remove the directory
      delete this.fs[normalizedPath];
    }

    callback(null);
  }

  /**
   * fs.rmdirSync implementation
   */
  public rmdirSync(path: string, options?: { recursive?: boolean } | null): void {
    const normalizedPath = this.normalizePath(path);

    // Check if path exists
    if (!this.exists(normalizedPath)) {
      const err = new Error(`ENOENT: no such file or directory, rmdir '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'rmdir';
      (err as any).path = path;
      throw err;
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type !== 'directory') {
      const err = new Error(`ENOTDIR: not a directory, rmdir '${path}'`);
      (err as any).code = 'ENOTDIR';
      (err as any).syscall = 'rmdir';
      (err as any).path = path;
      throw err;
    }

    // Check if directory is empty
    const hasChildren = Object.keys(this.fs).some((p) => {
      // Only direct children
      const relPath = path.relative(normalizedPath, p);
      return relPath && !relPath.includes('/') && relPath !== '';
    });

    if (hasChildren && (!options || !options.recursive)) {
      const err = new Error(`ENOTEMPTY: directory not empty, rmdir '${path}'`);
      (err as any).code = 'ENOTEMPTY';
      (err as any).syscall = 'rmdir';
      (err as any).path = path;
      throw err;
    }

    // Remove directory and all children if recursive
    if (options && options.recursive) {
      // Remove all descendants
      Object.keys(this.fs)
        .filter((p) => p.startsWith(normalizedPath + '/') || p === normalizedPath)
        .forEach((p) => {
          delete this.fs[p];
        });
    } else {
      // Just remove the directory
      delete this.fs[normalizedPath];
    }
  }

  /**
   * fs.rename implementation
   */
  public rename(
    oldPath: string,
    newPath: string,
    callback?: (err: Error | null) => void
  ): void | Promise<void> {
    const normalizedOldPath = this.normalizePath(oldPath);
    const normalizedNewPath = this.normalizePath(newPath);

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve, reject) => {
        this.rename(oldPath, newPath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    // Check if old path exists
    if (!this.exists(normalizedOldPath)) {
      const err = new Error(
        `ENOENT: no such file or directory, rename '${oldPath}' -> '${newPath}'`
      );
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'rename';
      (err as any).path = oldPath;
      (err as any).dest = newPath;
      return callback(err);
    }

    // Ensure parent directory of new path exists
    const parentDir = this.dirname(normalizedNewPath);
    if (!this.exists(parentDir)) {
      const err = new Error(
        `ENOENT: no such file or directory, rename '${oldPath}' -> '${newPath}'`
      );
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'rename';
      (err as any).path = oldPath;
      (err as any).dest = newPath;
      return callback(err);
    }

    // If target is a directory and not empty, fail
    if (this.exists(normalizedNewPath) && this.fs[normalizedNewPath].type === 'directory') {
      const hasChildren = Object.keys(this.fs).some((p) => {
        const relPath = path.relative(normalizedNewPath, p);
        return relPath && !relPath.includes('/') && relPath !== '';
      });

      if (hasChildren) {
        const err = new Error(
          `ENOTEMPTY: directory not empty, rename '${oldPath}' -> '${newPath}'`
        );
        (err as any).code = 'ENOTEMPTY';
        (err as any).syscall = 'rename';
        (err as any).path = oldPath;
        (err as any).dest = newPath;
        return callback(err);
      }
    }

    // Move the file or directory
    this.fs[normalizedNewPath] = { ...this.fs[normalizedOldPath] };
    delete this.fs[normalizedOldPath];

    // If it's a directory, move all children
    if (this.fs[normalizedNewPath].type === 'directory') {
      Object.keys(this.fs)
        .filter((p) => p.startsWith(normalizedOldPath + '/'))
        .forEach((oldChildPath) => {
          const relativePath = path.relative(normalizedOldPath, oldChildPath);
          const newChildPath = path.join(normalizedNewPath, relativePath);

          this.fs[newChildPath] = { ...this.fs[oldChildPath] };
          delete this.fs[oldChildPath];
        });
    }

    callback(null);
  }

  /**
   * fs.renameSync implementation
   */
  public renameSync(oldPath: string, newPath: string): void {
    const normalizedOldPath = this.normalizePath(oldPath);
    const normalizedNewPath = this.normalizePath(newPath);

    // Check if old path exists
    if (!this.exists(normalizedOldPath)) {
      const err = new Error(
        `ENOENT: no such file or directory, rename '${oldPath}' -> '${newPath}'`
      );
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'rename';
      (err as any).path = oldPath;
      (err as any).dest = newPath;
      throw err;
    }

    // Ensure parent directory of new path exists
    const parentDir = this.dirname(normalizedNewPath);
    if (!this.exists(parentDir)) {
      const err = new Error(
        `ENOENT: no such file or directory, rename '${oldPath}' -> '${newPath}'`
      );
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'rename';
      (err as any).path = oldPath;
      (err as any).dest = newPath;
      throw err;
    }

    // If target is a directory and not empty, fail
    if (this.exists(normalizedNewPath) && this.fs[normalizedNewPath].type === 'directory') {
      const hasChildren = Object.keys(this.fs).some((p) => {
        const relPath = path.relative(normalizedNewPath, p);
        return relPath && !relPath.includes('/') && relPath !== '';
      });

      if (hasChildren) {
        const err = new Error(
          `ENOTEMPTY: directory not empty, rename '${oldPath}' -> '${newPath}'`
        );
        (err as any).code = 'ENOTEMPTY';
        (err as any).syscall = 'rename';
        (err as any).path = oldPath;
        (err as any).dest = newPath;
        throw err;
      }
    }

    // Move the file or directory
    this.fs[normalizedNewPath] = { ...this.fs[normalizedOldPath] };
    delete this.fs[normalizedOldPath];

    // If it's a directory, move all children
    if (this.fs[normalizedNewPath].type === 'directory') {
      Object.keys(this.fs)
        .filter((p) => p.startsWith(normalizedOldPath + '/'))
        .forEach((oldChildPath) => {
          const relativePath = path.relative(normalizedOldPath, oldChildPath);
          const newChildPath = path.join(normalizedNewPath, relativePath);

          this.fs[newChildPath] = { ...this.fs[oldChildPath] };
          delete this.fs[oldChildPath];
        });
    }
  }

  /**
   * fs.existsSync implementation
   */
  public existsSync(path: string): boolean {
    return this.exists(this.normalizePath(path));
  }

  /**
   * fs.exists implementation (deprecated in Node.js)
   */
  public exists(path: string, callback?: (exists: boolean) => void): void | Promise<boolean> {
    const normalizedPath = this.normalizePath(path);

    // Return Promise if no callback
    if (!callback) {
      return new Promise((resolve) => {
        this.exists(path, resolve);
      });
    }

    callback(this.exists(normalizedPath));
  }

  /**
   * fs.createReadStream implementation
   */
  public createReadStream(
    path: string,
    options?: {
      flags?: string;
      encoding?: string;
      fd?: number;
      mode?: number;
      autoClose?: boolean;
      start?: number;
      end?: number;
      highWaterMark?: number;
    }
  ): Readable {
    const normalizedPath = this.normalizePath(path);
    const stream = new Readable({
      read() {},
    });

    // Check if file exists
    if (!this.exists(normalizedPath)) {
      process.nextTick(() => {
        const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
        (err as any).code = 'ENOENT';
        (err as any).syscall = 'open';
        (err as any).path = path;
        stream.emit('error', err);
      });
      return stream;
    }

    // Check if path is a directory
    if (this.fs[normalizedPath].type === 'directory') {
      process.nextTick(() => {
        const err = new Error(`EISDIR: illegal operation on a directory, read '${path}'`);
        (err as any).code = 'EISDIR';
        (err as any).syscall = 'read';
        (err as any).path = path;
        stream.emit('error', err);
      });
      return stream;
    }

    // Get file content
    const content = (this.fs[normalizedPath] as MockFileEntry).content;

    // Handle start and end options
    let data = content;
    if (options) {
      if (options.start !== undefined || options.end !== undefined) {
        const start = options.start || 0;
        const end = options.end !== undefined ? options.end + 1 : content.length;
        data = content.slice(start, end);
      }
    }

    // Push data and end stream
    process.nextTick(() => {
      stream.push(data);
      stream.push(null);
    });

    return stream;
  }

  /**
   * fs.createWriteStream implementation
   */
  public createWriteStream(
    path: string,
    options?: {
      flags?: string;
      encoding?: string;
      fd?: number;
      mode?: number;
      autoClose?: boolean;
      start?: number;
    }
  ): fs.WriteStream {
    const normalizedPath = this.normalizePath(path);
    const parentDir = this.dirname(normalizedPath);

    // Ensure parent directory exists
    if (!this.exists(parentDir)) {
      const err = new Error(`ENOENT: no such file or directory, open '${path}'`);
      (err as any).code = 'ENOENT';
      (err as any).syscall = 'open';
      (err as any).path = path;
      throw err;
    }

    // Create a write stream emulator
    const chunks: Buffer[] = [];
    const stream = new EventEmitter() as fs.WriteStream;

    // Add required properties
    (stream as any).path = path;
    (stream as any).bytesWritten = 0;

    // Add required methods
    (stream as any).write = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buffer);
      (stream as any).bytesWritten += buffer.length;
      return true;
    };

    (stream as any).end = (chunk?: Buffer | string) => {
      if (chunk) {
        (stream as any).write(chunk);
      }

      // Combine all chunks and write to file
      const content = Buffer.concat(chunks);
      const now = new Date();

      this.fs[normalizedPath] = {
        type: 'file',
        content,
        mtime: now,
        atime: now,
        ctime: now,
        birthtime: this.exists(normalizedPath)
          ? (this.fs[normalizedPath] as MockFileEntry).birthtime
          : now,
        mode: options && options.mode ? options.mode : 0o100644,
        size: content.length,
      };

      process.nextTick(() => {
        stream.emit('finish');
        stream.emit('close');
      });
    };

    // Return stream-like object
    return stream;
  }
}

/**
 * Create a mock filesystem with common directories
 */
export function createMockFileSystem(): MockFileSystem {
  const fs = new MockFileSystem();

  // Create common directories
  fs.addDirectory('/app');
  fs.addDirectory('/app/uploads');
  fs.addDirectory('/app/uploads/images');
  fs.addDirectory('/app/uploads/thumbnails');
  fs.addDirectory('/app/tmp');

  return fs;
}

/**
 * Mock the fs module with our mock implementation
 * @param fileSystem MockFileSystem instance
 */
export function mockFsModule(fileSystem: MockFileSystem): void {
  jest.mock('fs', () => {
    return {
      constants: {
        F_OK: 0,
        R_OK: 4,
        W_OK: 2,
        X_OK: 1,
      },
      readFile: fileSystem.readFile.bind(fileSystem),
      readFileSync: fileSystem.readFileSync.bind(fileSystem),
      writeFile: fileSystem.writeFile.bind(fileSystem),
      writeFileSync: fileSystem.writeFileSync.bind(fileSystem),
      mkdir: fileSystem.mkdir.bind(fileSystem),
      mkdirSync: fileSystem.mkdirSync.bind(fileSystem),
      readdir: fileSystem.readdir.bind(fileSystem),
      readdirSync: fileSystem.readdirSync.bind(fileSystem),
      stat: fileSystem.stat.bind(fileSystem),
      statSync: fileSystem.statSync.bind(fileSystem),
      unlink: fileSystem.unlink.bind(fileSystem),
      unlinkSync: fileSystem.unlinkSync.bind(fileSystem),
      rmdir: fileSystem.rmdir.bind(fileSystem),
      rmdirSync: fileSystem.rmdirSync.bind(fileSystem),
      rename: fileSystem.rename.bind(fileSystem),
      renameSync: fileSystem.renameSync.bind(fileSystem),
      existsSync: fileSystem.existsSync.bind(fileSystem),
      exists: fileSystem.exists.bind(fileSystem),
      createReadStream: fileSystem.createReadStream.bind(fileSystem),
      createWriteStream: fileSystem.createWriteStream.bind(fileSystem),
      // Add more methods as needed
    };
  });

  // Also mock the fs/promises API
  jest.mock('fs/promises', () => {
    return {
      readFile: (path: string, options?: any) => fileSystem.readFile(path, options),
      writeFile: (path: string, data: any, options?: any) =>
        fileSystem.writeFile(path, data, options),
      mkdir: (path: string, options?: any) => fileSystem.mkdir(path, options),
      readdir: (path: string, options?: any) => fileSystem.readdir(path, options),
      stat: (path: string, options?: any) => fileSystem.stat(path, options),
      unlink: (path: string) => fileSystem.unlink(path),
      rmdir: (path: string, options?: any) => fileSystem.rmdir(path, options),
      rename: (oldPath: string, newPath: string) => fileSystem.rename(oldPath, newPath),
    };
  });
}

// Helper functions

/**
 * Helper to setup common test files
 * @param fileSystem MockFileSystem instance
 */
export function setupTestFiles(fileSystem: MockFileSystem): void {
  // Create project and image structure
  fileSystem.addDirectory('/app/uploads/images/project-1');
  fileSystem.addDirectory('/app/uploads/thumbnails/project-1');

  // Add some test images
  fileSystem.addFile('/app/uploads/images/project-1/image-1.jpg', Buffer.from('test-image-data'));
  fileSystem.addFile('/app/uploads/images/project-1/image-2.jpg', Buffer.from('test-image-data'));
  fileSystem.addFile(
    '/app/uploads/thumbnails/project-1/image-1.jpg',
    Buffer.from('test-thumb-data')
  );
  fileSystem.addFile(
    '/app/uploads/thumbnails/project-1/image-2.jpg',
    Buffer.from('test-thumb-data')
  );

  // Add a test configuration file
  fileSystem.addFile(
    '/app/config.json',
    JSON.stringify({
      uploadDir: '/app/uploads',
      maxImageSize: 10485760,
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif'],
    })
  );

  // Add a test segmentation data file
  fileSystem.addFile(
    '/app/uploads/images/project-1/image-1.segmentation.json',
    JSON.stringify({
      version: 1,
      polygons: [
        {
          id: 'poly-1',
          type: 'external',
          points: [
            { x: 100, y: 100 },
            { x: 200, y: 100 },
            { x: 200, y: 200 },
            { x: 100, y: 200 },
          ],
        },
      ],
    })
  );
}

// eslint-disable-next-line @typescript-eslint/no-namespace
namespace fs {
  // Define minimal Dirent interface needed for the mock
  export interface Dirent {
    isFile(): boolean;
    isDirectory(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
    name: string;
  }

  // Define minimal Stats interface needed for the mock
  export interface Stats {
    isFile(): boolean;
    isDirectory(): boolean;
    isBlockDevice(): boolean;
    isCharacterDevice(): boolean;
    isSymbolicLink(): boolean;
    isFIFO(): boolean;
    isSocket(): boolean;
    dev: number;
    ino: number;
    mode: number;
    nlink: number;
    uid: number;
    gid: number;
    rdev: number;
    size: number;
    blksize: number;
    blocks: number;
    atimeMs: number;
    mtimeMs: number;
    ctimeMs: number;
    birthtimeMs: number;
    atime: Date;
    mtime: Date;
    ctime: Date;
    birthtime: Date;
  }

  // Define minimal WriteStream interface needed for the mock
  export interface WriteStream extends NodeJS.WritableStream {
    path: string;
    bytesWritten: number;
    close(): void;
    open(): void;
  }
}
