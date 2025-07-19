/**
 * File and Upload Mocks for Testing
 *
 * Provides mock file objects and upload utilities
 */
export declare function createMockFile(name: string, size: number, type: string, lastModified?: number): File;
export declare const testFiles: {
    smallJpeg: () => File;
    largeJpeg: () => File;
    png: () => File;
    tiff: () => File;
    bmp: () => File;
    pdf: () => File;
    invalidType: () => File;
    oversized: () => File;
};
export declare function createMockFileList(files: File[]): FileList;
export declare function createMockDragEvent(type: string, files: File[], options?: Partial<DragEvent>): DragEvent;
export declare function createProgressEvent(loaded: number, total: number): ProgressEvent;
export declare class MockFileReader implements FileReader {
    DONE: any;
    EMPTY: any;
    LOADING: any;
    error: DOMException | null;
    readyState: 0 | 1 | 2;
    result: string | ArrayBuffer | null;
    onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    abort(): void;
    readAsArrayBuffer(file: File): void;
    readAsBinaryString(file: File): void;
    readAsDataURL(file: File): void;
    readAsText(file: File, _encoding?: string): void;
    private _read;
    addEventListener(): void;
    removeEventListener(): void;
    dispatchEvent(): boolean;
}
export declare function mockImageLoad(success?: boolean, width?: number, height?: number): () => void;
export declare function createMockCanvasContext(): CanvasRenderingContext2D;
export declare const uploadTestHelpers: {
    simulateFileSelect: (input: HTMLInputElement, files: File[]) => void;
    simulateDrop: (element: Element, files: File[]) => void;
    simulateDragOver: (element: Element) => void;
    simulateDragLeave: (element: Element) => void;
};
//# sourceMappingURL=files.d.ts.map