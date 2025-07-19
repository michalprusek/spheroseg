/**
 * File and Upload Mocks for Testing
 * 
 * Provides mock file objects and upload utilities
 */

import { vi } from 'vitest';

// Create mock File object
export function createMockFile(
  name: string,
  size: number,
  type: string,
  lastModified = Date.now()
): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  const file = new File([blob], name, { type, lastModified });
  
  // Add custom properties for testing
  Object.defineProperty(file, 'size', {
    value: size,
    writable: false,
  });

  return file;
}

// Common test files
export const testFiles = {
  smallJpeg: () => createMockFile('test.jpg', 1024 * 500, 'image/jpeg'), // 500KB
  largeJpeg: () => createMockFile('large.jpg', 1024 * 1024 * 15, 'image/jpeg'), // 15MB
  png: () => createMockFile('test.png', 1024 * 800, 'image/png'), // 800KB
  tiff: () => createMockFile('test.tiff', 1024 * 1024 * 5, 'image/tiff'), // 5MB
  bmp: () => createMockFile('test.bmp', 1024 * 1024 * 3, 'image/bmp'), // 3MB
  pdf: () => createMockFile('document.pdf', 1024 * 1024 * 2, 'application/pdf'), // 2MB
  invalidType: () => createMockFile('test.exe', 1024 * 100, 'application/x-msdownload'), // 100KB
  oversized: () => createMockFile('huge.jpg', 1024 * 1024 * 200, 'image/jpeg'), // 200MB
};

// Create FileList mock
export function createMockFileList(files: File[]): FileList {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      for (let i = 0; i < files.length; i++) {
        yield files[i];
      }
    },
  };

  // Add numeric indices
  files.forEach((file, index) => {
    (fileList as any)[index] = file;
  });

  return fileList as FileList;
}

// Create drag event mock
export function createMockDragEvent(
  type: string,
  files: File[],
  options: Partial<DragEvent> = {}
): DragEvent {
  const dataTransfer = {
    files: createMockFileList(files),
    items: files.map(file => ({
      kind: 'file',
      type: file.type,
      getAsFile: () => file,
    })),
    types: ['Files'],
    dropEffect: 'copy' as any,
    effectAllowed: 'all' as any,
    clearData: vi.fn(),
    getData: vi.fn(),
    setData: vi.fn(),
    setDragImage: vi.fn(),
  };

  const event = new Event(type, { bubbles: true, cancelable: true }) as any;
  event.dataTransfer = dataTransfer;

  return Object.assign(event, options) as DragEvent;
}

// Create upload progress event
export function createProgressEvent(loaded: number, total: number): ProgressEvent {
  return new ProgressEvent('progress', {
    lengthComputable: true,
    loaded,
    total,
  });
}

// Mock FileReader
export class MockFileReader implements FileReader {
  DONE = FileReader.DONE;
  EMPTY = FileReader.EMPTY;
  LOADING = FileReader.LOADING;
  
  error: DOMException | null = null;
  readyState: 0 | 1 | 2 = FileReader.EMPTY as 0;
  result: string | ArrayBuffer | null = null;

  onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;
  onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null = null;

  abort(): void {
    this.readyState = FileReader.DONE;
    this.onabort?.(new ProgressEvent('abort') as ProgressEvent<FileReader>);
  }

  readAsArrayBuffer(file: File): void {
    this._read(file, 'arraybuffer');
  }

  readAsBinaryString(file: File): void {
    this._read(file, 'binarystring');
  }

  readAsDataURL(file: File): void {
    this._read(file, 'dataurl');
  }

  readAsText(file: File, _encoding?: string): void {
    this._read(file, 'text');
  }

  private _read(file: File, type: string): void {
    this.readyState = FileReader.LOADING;
    this.onloadstart?.(new ProgressEvent('loadstart') as ProgressEvent<FileReader>);

    setTimeout(() => {
      if (type === 'dataurl') {
        this.result = `data:${file.type};base64,${btoa('mock-file-content')}`;
      } else if (type === 'arraybuffer') {
        this.result = new ArrayBuffer(file.size);
      } else {
        this.result = 'mock-file-content';
      }

      this.readyState = FileReader.DONE;
      this.onload?.(new ProgressEvent('load') as ProgressEvent<FileReader>);
      this.onloadend?.(new ProgressEvent('loadend') as ProgressEvent<FileReader>);
    }, 0);
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  dispatchEvent(): boolean { return true; }
}

// Mock image loading
export function mockImageLoad(success = true, width = 800, height = 600): () => void {
  const originalImage = global.Image;
  
  global.Image = class MockImage {
    width = width;
    height = height;
    src = '';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
      setTimeout(() => {
        if (success && this.onload) {
          this.onload();
        } else if (!success && this.onerror) {
          this.onerror();
        }
      }, 0);
    }
  } as any;

  return () => {
    global.Image = originalImage;
  };
}

// Mock canvas context
export function createMockCanvasContext(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
    })),
    putImageData: vi.fn(),
    createImageData: vi.fn(),
    canvas: {
      toBlob: vi.fn((callback: any) => {
        callback(new Blob(['mock'], { type: 'image/png' }));
      }),
      toDataURL: vi.fn(() => 'data:image/png;base64,mock'),
    },
  } as any;
}

// Upload test helpers
export const uploadTestHelpers = {
  simulateFileSelect: (input: HTMLInputElement, files: File[]) => {
    Object.defineProperty(input, 'files', {
      value: createMockFileList(files),
      writable: false,
    });
    
    const event = new Event('change', { bubbles: true });
    input.dispatchEvent(event);
  },

  simulateDrop: (element: Element, files: File[]) => {
    const dropEvent = createMockDragEvent('drop', files);
    element.dispatchEvent(dropEvent);
  },

  simulateDragOver: (element: Element) => {
    const dragOverEvent = createMockDragEvent('dragover', []);
    element.dispatchEvent(dragOverEvent);
  },

  simulateDragLeave: (element: Element) => {
    const dragLeaveEvent = createMockDragEvent('dragleave', []);
    element.dispatchEvent(dragLeaveEvent);
  },
};