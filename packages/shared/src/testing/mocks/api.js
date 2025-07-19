"use strict";
/**
 * API Mocks for Testing
 *
 * Provides mock implementations for API calls
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetAPIMocks = exports.setupAPIMocks = exports.MockWebSocket = exports.mockProjectEndpoints = exports.mockAuthEndpoints = exports.mockUploadEndpoints = exports.mockFetch = exports.createErrorResponse = exports.createSuccessResponse = void 0;
const vitest_1 = require("vitest");
// Mock response builders
const createSuccessResponse = (data, metadata) => {
    const body = JSON.stringify({ success: true, data, metadata });
    return new Response(body, {
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' }
    });
};
exports.createSuccessResponse = createSuccessResponse;
const createErrorResponse = (status, message) => {
    const body = JSON.stringify({ success: false, error: message });
    return new Response(body, {
        status,
        statusText: message,
        headers: { 'content-type': 'application/json' }
    });
};
exports.createErrorResponse = createErrorResponse;
// Mock fetch implementation
exports.mockFetch = vitest_1.vi.fn();
// Common API mocks
const mockUploadEndpoints = () => {
    exports.mockFetch.mockImplementation(async (input, _init) => {
        const url = typeof input === 'string' ? input : input.toString();
        // Standard upload
        if (url.includes('/api/upload')) {
            return (0, exports.createSuccessResponse)({
                id: 'upload_123',
                url: 'https://example.com/image.jpg',
                thumbnailUrl: 'https://example.com/thumb.jpg',
            });
        }
        // Chunked upload init
        if (url.includes('/api/upload/chunked/init')) {
            return (0, exports.createSuccessResponse)({
                uploadId: 'chunked_123',
                expiresAt: new Date(Date.now() + 3600000).toISOString(),
            });
        }
        // Chunked upload chunk
        if (url.includes('/api/upload/chunked/chunk')) {
            return (0, exports.createSuccessResponse)({ success: true });
        }
        // Chunked upload complete
        if (url.includes('/api/upload/chunked/complete')) {
            return (0, exports.createSuccessResponse)({
                id: 'upload_456',
                url: 'https://example.com/large-image.jpg',
                thumbnailUrl: 'https://example.com/large-thumb.jpg',
            });
        }
        // Default 404
        return (0, exports.createErrorResponse)(404, 'Not Found');
    });
    return exports.mockFetch;
};
exports.mockUploadEndpoints = mockUploadEndpoints;
const mockAuthEndpoints = () => {
    exports.mockFetch.mockImplementation(async (input, _init) => {
        const url = typeof input === 'string' ? input : input.toString();
        // Login
        if (url.includes('/api/auth/login')) {
            return (0, exports.createSuccessResponse)({
                user: {
                    id: 'user_123',
                    email: 'test@example.com',
                    name: 'Test User',
                },
                token: 'mock_jwt_token',
            });
        }
        // Logout
        if (url.includes('/api/auth/logout')) {
            return (0, exports.createSuccessResponse)({ success: true });
        }
        // Current user
        if (url.includes('/api/auth/me')) {
            return (0, exports.createSuccessResponse)({
                id: 'user_123',
                email: 'test@example.com',
                name: 'Test User',
            });
        }
        return (0, exports.createErrorResponse)(404, 'Not Found');
    });
    return exports.mockFetch;
};
exports.mockAuthEndpoints = mockAuthEndpoints;
const mockProjectEndpoints = () => {
    exports.mockFetch.mockImplementation(async (input, _init) => {
        const url = typeof input === 'string' ? input : input.toString();
        // Get projects
        if (url.includes('/api/projects')) {
            return (0, exports.createSuccessResponse)([
                {
                    id: 'project_1',
                    name: 'Test Project 1',
                    description: 'Test description',
                    createdAt: new Date().toISOString(),
                },
                {
                    id: 'project_2',
                    name: 'Test Project 2',
                    description: 'Another test',
                    createdAt: new Date().toISOString(),
                },
            ]);
        }
        // Create project
        if (url.includes('/api/projects') && _init?.method === 'POST') {
            const body = JSON.parse(_init.body);
            return (0, exports.createSuccessResponse)({
                id: 'project_new',
                ...body,
                createdAt: new Date().toISOString(),
            });
        }
        return (0, exports.createErrorResponse)(404, 'Not Found');
    });
    return exports.mockFetch;
};
exports.mockProjectEndpoints = mockProjectEndpoints;
// WebSocket mock
class MockWebSocket {
    constructor(url) {
        this.readyState = 0;
        this.onopen = null;
        this.onclose = null;
        this.onerror = null;
        this.onmessage = null;
        this.url = url;
        setTimeout(() => {
            this.readyState = 1;
            this.onopen?.(new Event('open'));
        }, 0);
    }
    send(_data) {
        // Mock send implementation
    }
    close() {
        this.readyState = 3;
        this.onclose?.(new CloseEvent('close'));
    }
    simulateMessage(data) {
        this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
    simulateError() {
        this.onerror?.(new Event('error'));
    }
}
exports.MockWebSocket = MockWebSocket;
// Export global mock setup
const setupAPIMocks = () => {
    global.fetch = exports.mockFetch;
    global.WebSocket = MockWebSocket;
};
exports.setupAPIMocks = setupAPIMocks;
const resetAPIMocks = () => {
    exports.mockFetch.mockReset();
};
exports.resetAPIMocks = resetAPIMocks;
//# sourceMappingURL=api.js.map