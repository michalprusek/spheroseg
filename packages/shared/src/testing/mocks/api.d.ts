/**
 * API Mocks for Testing
 *
 * Provides mock implementations for API calls
 */
import type { MockedFunction } from 'vitest';
export declare const createSuccessResponse: <T>(data: T, metadata?: any) => Response;
export declare const createErrorResponse: (status: number, message: string) => Response;
export declare const mockFetch: MockedFunction<typeof fetch>;
export declare const mockUploadEndpoints: () => MockedFunction<typeof fetch>;
export declare const mockAuthEndpoints: () => MockedFunction<typeof fetch>;
export declare const mockProjectEndpoints: () => MockedFunction<typeof fetch>;
export declare class MockWebSocket {
    url: string;
    readyState: number;
    onopen: ((event: Event) => void) | null;
    onclose: ((event: CloseEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onmessage: ((event: MessageEvent) => void) | null;
    constructor(url: string);
    send(_data: string | ArrayBuffer | Blob): void;
    close(): void;
    simulateMessage(data: any): void;
    simulateError(): void;
}
export declare const setupAPIMocks: () => void;
export declare const resetAPIMocks: () => void;
//# sourceMappingURL=api.d.ts.map