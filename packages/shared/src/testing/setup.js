"use strict";
/**
 * Shared Testing Setup and Configuration
 *
 * Provides common setup for all test environments
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.act = exports.renderHook = exports.userEvent = exports.flushPromises = exports.waitForAsync = void 0;
const vitest_1 = require("vitest");
const react_1 = require("@testing-library/react");
require("@testing-library/jest-dom");
// Setup fetch mock
require("whatwg-fetch");
// Setup global test environment
(0, vitest_1.beforeAll)(() => {
    // Mock console methods to reduce noise in tests
    global.console = {
        ...console,
        log: vitest_1.vi.fn(),
        debug: vitest_1.vi.fn(),
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    };
    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vitest_1.vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vitest_1.vi.fn(),
            removeListener: vitest_1.vi.fn(),
            addEventListener: vitest_1.vi.fn(),
            removeEventListener: vitest_1.vi.fn(),
            dispatchEvent: vitest_1.vi.fn(),
        })),
    });
    // Mock IntersectionObserver
    global.IntersectionObserver = vitest_1.vi.fn().mockImplementation(() => ({
        observe: vitest_1.vi.fn(),
        unobserve: vitest_1.vi.fn(),
        disconnect: vitest_1.vi.fn(),
    }));
    // Mock ResizeObserver
    global.ResizeObserver = vitest_1.vi.fn().mockImplementation(() => ({
        observe: vitest_1.vi.fn(),
        unobserve: vitest_1.vi.fn(),
        disconnect: vitest_1.vi.fn(),
    }));
    // Mock crypto.subtle for upload service
    if (!global.crypto) {
        global.crypto = {};
    }
    Object.defineProperty(global.crypto, 'subtle', {
        writable: true,
        value: {
            digest: vitest_1.vi.fn().mockResolvedValue(new ArrayBuffer(32)),
        }
    });
    // Mock URL.createObjectURL
    global.URL.createObjectURL = vitest_1.vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vitest_1.vi.fn();
    // Mock localStorage
    const localStorageMock = {
        getItem: vitest_1.vi.fn(),
        setItem: vitest_1.vi.fn(),
        removeItem: vitest_1.vi.fn(),
        clear: vitest_1.vi.fn(),
        length: 0,
        key: vitest_1.vi.fn(),
    };
    global.localStorage = localStorageMock;
    // Mock sessionStorage
    global.sessionStorage = localStorageMock;
});
// Cleanup after each test
(0, vitest_1.afterEach)(() => {
    (0, react_1.cleanup)();
    vitest_1.vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
});
// Cleanup after all tests
(0, vitest_1.afterAll)(() => {
    vitest_1.vi.restoreAllMocks();
});
// Global test utilities
const waitForAsync = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));
exports.waitForAsync = waitForAsync;
const flushPromises = () => new Promise(resolve => setImmediate(resolve));
exports.flushPromises = flushPromises;
// Custom matchers
expect.extend({
    toBeWithinRange(received, floor, ceiling) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true,
            };
        }
        else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false,
            };
        }
    },
});
// Export test utilities
__exportStar(require("@testing-library/react"), exports);
var user_event_1 = require("@testing-library/user-event");
Object.defineProperty(exports, "userEvent", { enumerable: true, get: function () { return __importDefault(user_event_1).default; } });
var react_hooks_1 = require("@testing-library/react-hooks");
Object.defineProperty(exports, "renderHook", { enumerable: true, get: function () { return react_hooks_1.renderHook; } });
Object.defineProperty(exports, "act", { enumerable: true, get: function () { return react_hooks_1.act; } });
//# sourceMappingURL=setup.js.map