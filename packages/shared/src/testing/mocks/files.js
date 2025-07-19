"use strict";
/**
 * File and Upload Mocks for Testing
 *
 * Provides mock file objects and upload utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadTestHelpers = exports.MockFileReader = exports.testFiles = void 0;
exports.createMockFile = createMockFile;
exports.createMockFileList = createMockFileList;
exports.createMockDragEvent = createMockDragEvent;
exports.createProgressEvent = createProgressEvent;
exports.mockImageLoad = mockImageLoad;
exports.createMockCanvasContext = createMockCanvasContext;
const vitest_1 = require("vitest");
// Create mock File object
function createMockFile(name, size, type, lastModified = Date.now()) {
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
exports.testFiles = {
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
function createMockFileList(files) {
    const fileList = {
        length: files.length,
        item: (index) => files[index] || null,
        [Symbol.iterator]: function* () {
            for (let i = 0; i < files.length; i++) {
                yield files[i];
            }
        },
    };
    // Add numeric indices
    files.forEach((file, index) => {
        fileList[index] = file;
    });
    return fileList;
}
// Create drag event mock
function createMockDragEvent(type, files, options = {}) {
    const dataTransfer = {
        files: createMockFileList(files),
        items: files.map(file => ({
            kind: 'file',
            type: file.type,
            getAsFile: () => file,
        })),
        types: ['Files'],
        dropEffect: 'copy',
        effectAllowed: 'all',
        clearData: vitest_1.vi.fn(),
        getData: vitest_1.vi.fn(),
        setData: vitest_1.vi.fn(),
        setDragImage: vitest_1.vi.fn(),
    };
    const event = new Event(type, { bubbles: true, cancelable: true });
    event.dataTransfer = dataTransfer;
    return Object.assign(event, options);
}
// Create upload progress event
function createProgressEvent(loaded, total) {
    return new ProgressEvent('progress', {
        lengthComputable: true,
        loaded,
        total,
    });
}
// Mock FileReader
class MockFileReader {
    constructor() {
        this.DONE = FileReader.DONE;
        this.EMPTY = FileReader.EMPTY;
        this.LOADING = FileReader.LOADING;
        this.error = null;
        this.readyState = FileReader.EMPTY;
        this.result = null;
        this.onabort = null;
        this.onerror = null;
        this.onload = null;
        this.onloadend = null;
        this.onloadstart = null;
        this.onprogress = null;
    }
    abort() {
        this.readyState = FileReader.DONE;
        this.onabort?.(new ProgressEvent('abort'));
    }
    readAsArrayBuffer(file) {
        this._read(file, 'arraybuffer');
    }
    readAsBinaryString(file) {
        this._read(file, 'binarystring');
    }
    readAsDataURL(file) {
        this._read(file, 'dataurl');
    }
    readAsText(file, _encoding) {
        this._read(file, 'text');
    }
    _read(file, type) {
        this.readyState = FileReader.LOADING;
        this.onloadstart?.(new ProgressEvent('loadstart'));
        setTimeout(() => {
            if (type === 'dataurl') {
                this.result = `data:${file.type};base64,${btoa('mock-file-content')}`;
            }
            else if (type === 'arraybuffer') {
                this.result = new ArrayBuffer(file.size);
            }
            else {
                this.result = 'mock-file-content';
            }
            this.readyState = FileReader.DONE;
            this.onload?.(new ProgressEvent('load'));
            this.onloadend?.(new ProgressEvent('loadend'));
        }, 0);
    }
    addEventListener() { }
    removeEventListener() { }
    dispatchEvent() { return true; }
}
exports.MockFileReader = MockFileReader;
// Mock image loading
function mockImageLoad(success = true, width = 800, height = 600) {
    const originalImage = global.Image;
    global.Image = class MockImage {
        constructor() {
            this.width = width;
            this.height = height;
            this.src = '';
            this.onload = null;
            this.onerror = null;
            setTimeout(() => {
                if (success && this.onload) {
                    this.onload();
                }
                else if (!success && this.onerror) {
                    this.onerror();
                }
            }, 0);
        }
    };
    return () => {
        global.Image = originalImage;
    };
}
// Mock canvas context
function createMockCanvasContext() {
    return {
        fillStyle: '',
        fillRect: vitest_1.vi.fn(),
        drawImage: vitest_1.vi.fn(),
        getImageData: vitest_1.vi.fn(() => ({
            data: new Uint8ClampedArray(4),
            width: 1,
            height: 1,
        })),
        putImageData: vitest_1.vi.fn(),
        createImageData: vitest_1.vi.fn(),
        canvas: {
            toBlob: vitest_1.vi.fn((callback) => {
                callback(new Blob(['mock'], { type: 'image/png' }));
            }),
            toDataURL: vitest_1.vi.fn(() => 'data:image/png;base64,mock'),
        },
    };
}
// Upload test helpers
exports.uploadTestHelpers = {
    simulateFileSelect: (input, files) => {
        Object.defineProperty(input, 'files', {
            value: createMockFileList(files),
            writable: false,
        });
        const event = new Event('change', { bubbles: true });
        input.dispatchEvent(event);
    },
    simulateDrop: (element, files) => {
        const dropEvent = createMockDragEvent('drop', files);
        element.dispatchEvent(dropEvent);
    },
    simulateDragOver: (element) => {
        const dragOverEvent = createMockDragEvent('dragover', []);
        element.dispatchEvent(dragOverEvent);
    },
    simulateDragLeave: (element) => {
        const dragLeaveEvent = createMockDragEvent('dragleave', []);
        element.dispatchEvent(dragLeaveEvent);
    },
};
//# sourceMappingURL=files.js.map