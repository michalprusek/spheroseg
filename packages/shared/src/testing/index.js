"use strict";
/**
 * Shared Testing Utilities
 *
 * Main export file for all testing utilities
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
exports.takeScreenshot = exports.logTestInfo = exports.expectToHaveBeenCalledWithPartial = exports.expectToBeWithinRange = exports.generateImage = exports.generateProject = exports.generateUser = exports.generateId = exports.benchmark = exports.isDebug = exports.isCI = exports.itIf = exports.describeIf = exports.afterEach = exports.beforeEach = exports.afterAll = exports.beforeAll = exports.it = exports.describe = exports.expect = exports.vi = exports.userEvent = exports.prettyDOM = exports.within = exports.cleanup = exports.act = exports.waitFor = exports.fireEvent = exports.screen = exports.render = void 0;
// Setup and configuration
__exportStar(require("./setup"), exports);
// Test utilities
__exportStar(require("./test-utils"), exports);
// Mocks
__exportStar(require("./mocks/api"), exports);
__exportStar(require("./mocks/components"), exports);
__exportStar(require("./mocks/files"), exports);
// Re-export commonly used testing library functions
var react_1 = require("@testing-library/react");
Object.defineProperty(exports, "render", { enumerable: true, get: function () { return react_1.render; } });
Object.defineProperty(exports, "screen", { enumerable: true, get: function () { return react_1.screen; } });
Object.defineProperty(exports, "fireEvent", { enumerable: true, get: function () { return react_1.fireEvent; } });
Object.defineProperty(exports, "waitFor", { enumerable: true, get: function () { return react_1.waitFor; } });
Object.defineProperty(exports, "act", { enumerable: true, get: function () { return react_1.act; } });
Object.defineProperty(exports, "cleanup", { enumerable: true, get: function () { return react_1.cleanup; } });
Object.defineProperty(exports, "within", { enumerable: true, get: function () { return react_1.within; } });
Object.defineProperty(exports, "prettyDOM", { enumerable: true, get: function () { return react_1.prettyDOM; } });
var user_event_1 = require("@testing-library/user-event");
Object.defineProperty(exports, "userEvent", { enumerable: true, get: function () { return __importDefault(user_event_1).default; } });
// Vitest utilities
var vitest_1 = require("vitest");
Object.defineProperty(exports, "vi", { enumerable: true, get: function () { return vitest_1.vi; } });
Object.defineProperty(exports, "expect", { enumerable: true, get: function () { return vitest_1.expect; } });
Object.defineProperty(exports, "describe", { enumerable: true, get: function () { return vitest_1.describe; } });
Object.defineProperty(exports, "it", { enumerable: true, get: function () { return vitest_1.it; } });
Object.defineProperty(exports, "beforeAll", { enumerable: true, get: function () { return vitest_1.beforeAll; } });
Object.defineProperty(exports, "afterAll", { enumerable: true, get: function () { return vitest_1.afterAll; } });
Object.defineProperty(exports, "beforeEach", { enumerable: true, get: function () { return vitest_1.beforeEach; } });
Object.defineProperty(exports, "afterEach", { enumerable: true, get: function () { return vitest_1.afterEach; } });
// Custom test suites
const describeIf = (condition) => condition ? describe : describe.skip;
exports.describeIf = describeIf;
const itIf = (condition) => condition ? it : it.skip;
exports.itIf = itIf;
// Environment checks
exports.isCI = process.env['CI'] === 'true';
exports.isDebug = process.env['DEBUG'] === 'true';
// Performance benchmarks
const benchmark = async (_name, fn, iterations = 100) => {
    const times = [];
    for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        await fn();
        const end = performance.now();
        times.push(end - start);
    }
    times.sort((a, b) => a - b);
    return {
        mean: times.reduce((a, b) => a + b, 0) / times.length,
        min: times[0] || 0,
        max: times[times.length - 1] || 0,
        median: times[Math.floor(times.length / 2)] || 0,
    };
};
exports.benchmark = benchmark;
// Test data generators
const generateId = () => `test_${Math.random().toString(36).substr(2, 9)}`;
exports.generateId = generateId;
const generateUser = (overrides = {}) => ({
    id: (0, exports.generateId)(),
    email: 'test@example.com',
    name: 'Test User',
    avatar: null,
    createdAt: new Date().toISOString(),
    ...overrides,
});
exports.generateUser = generateUser;
const generateProject = (overrides = {}) => ({
    id: (0, exports.generateId)(),
    name: 'Test Project',
    description: 'Test project description',
    userId: (0, exports.generateId)(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
});
exports.generateProject = generateProject;
const generateImage = (overrides = {}) => ({
    id: (0, exports.generateId)(),
    projectId: (0, exports.generateId)(),
    name: 'test-image.jpg',
    url: 'https://example.com/image.jpg',
    thumbnailUrl: 'https://example.com/thumb.jpg',
    size: 1024000,
    width: 1920,
    height: 1080,
    segmentationStatus: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
});
exports.generateImage = generateImage;
// Assertion helpers
const expectToBeWithinRange = (value, min, max) => {
    expect(value).toBeGreaterThanOrEqual(min);
    expect(value).toBeLessThanOrEqual(max);
};
exports.expectToBeWithinRange = expectToBeWithinRange;
const expectToHaveBeenCalledWithPartial = (mock, partial) => {
    expect(mock).toHaveBeenCalled();
    const lastCall = mock.mock.calls[mock.mock.calls.length - 1];
    expect(lastCall[0]).toMatchObject(partial);
};
exports.expectToHaveBeenCalledWithPartial = expectToHaveBeenCalledWithPartial;
// Debug helpers
const logTestInfo = (info) => {
    if (exports.isDebug) {
        console.log('[TEST DEBUG]:', info);
    }
};
exports.logTestInfo = logTestInfo;
const takeScreenshot = async (element, filename) => {
    if (exports.isDebug) {
        // In a real implementation, this would use a screenshot library
        console.log(`[SCREENSHOT]: ${filename}`, element.innerHTML);
    }
};
exports.takeScreenshot = takeScreenshot;
//# sourceMappingURL=index.js.map