/**
 * Examples of using the Unified Upload Service
 */
declare function uploadSingleFile(file: File): Promise<void>;
declare function uploadBatch(files: File[]): Promise<void>;
declare function uploadAvatar(croppedImageData: string): Promise<any>;
declare function resumeInterruptedUploads(): Promise<void>;
declare function cancelUpload(fileId: string): void;
declare function monitorUploads(): void;
import { BaseUploadStrategy } from './strategies';
declare class CustomUploadStrategy extends BaseUploadStrategy {
    name: string;
    canHandle(file: File): boolean;
    upload(file: File, options: any): Promise<any>;
}
declare function validateAndUpload(files: File[]): Promise<void>;
declare function uploadWithProgressUI(file: File, progressElement: HTMLElement): Promise<import("./types").UploadFile>;
declare function uploadWithRetry(file: File, maxRetries?: number): Promise<any>;
export { uploadSingleFile, uploadBatch, uploadAvatar, resumeInterruptedUploads, cancelUpload, monitorUploads, CustomUploadStrategy, validateAndUpload, uploadWithProgressUI, uploadWithRetry, };
//# sourceMappingURL=examples.d.ts.map