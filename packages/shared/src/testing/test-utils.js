"use strict";
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
exports.userEvent = exports.act = exports.waitFor = exports.fireEvent = exports.screen = exports.render = exports.createStableSnapshot = exports.checkA11y = exports.measureReRenderTime = exports.measureRenderTime = exports.TestErrorBoundary = exports.simulateVisibilityChange = exports.simulateNetworkChange = exports.simulateResize = exports.runAllTimers = exports.advanceTimersByTime = void 0;
exports.renderWithProviders = renderWithProviders;
exports.renderHookWithProviders = renderHookWithProviders;
exports.waitForCondition = waitForCondition;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * Common Test Utilities
 *
 * Provides utilities for testing React components and hooks
 */
const react_1 = __importDefault(require("react"));
const react_2 = require("@testing-library/react");
const vitest_1 = require("vitest");
const components_1 = require("./mocks/components");
// Custom render function with providers
function renderWithProviders(ui, options) {
    return (0, react_2.render)(ui, { wrapper: components_1.TestWrapper, ...options });
}
// Render hook with providers
function renderHookWithProviders(hook, options) {
    const Wrapper = options?.wrapper || components_1.TestWrapper;
    let result;
    function TestComponent(props) {
        result = hook(props);
        return null;
    }
    const { rerender, unmount } = (0, react_2.render)((0, jsx_runtime_1.jsx)(Wrapper, { children: (0, jsx_runtime_1.jsx)(TestComponent, { ...(options?.initialProps || {}) }) }));
    return {
        result: () => result,
        rerender: (newProps) => rerender((0, jsx_runtime_1.jsx)(Wrapper, { children: (0, jsx_runtime_1.jsx)(TestComponent, { ...(newProps || options?.initialProps || {}) }) })),
        unmount,
    };
}
// Async utilities
async function waitForCondition(condition, timeout = 5000, interval = 50) {
    const startTime = Date.now();
    while (!condition()) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for condition');
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
}
// Mock timers utilities
const advanceTimersByTime = async (ms) => {
    await vitest_1.vi.advanceTimersByTimeAsync(ms);
};
exports.advanceTimersByTime = advanceTimersByTime;
const runAllTimers = async () => {
    await vitest_1.vi.runAllTimersAsync();
};
exports.runAllTimers = runAllTimers;
// Event simulation utilities
const simulateResize = (width, height) => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { writable: true, value: height });
    window.dispatchEvent(new Event('resize'));
};
exports.simulateResize = simulateResize;
const simulateNetworkChange = (online) => {
    Object.defineProperty(navigator, 'onLine', { writable: true, value: online });
    window.dispatchEvent(new Event(online ? 'online' : 'offline'));
};
exports.simulateNetworkChange = simulateNetworkChange;
const simulateVisibilityChange = (hidden) => {
    Object.defineProperty(document, 'hidden', { writable: true, value: hidden });
    document.dispatchEvent(new Event('visibilitychange'));
};
exports.simulateVisibilityChange = simulateVisibilityChange;
// Error boundary for tests
class TestErrorBoundary extends react_1.default.Component {
    constructor() {
        super(...arguments);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        this.props.onError?.(error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return ((0, jsx_runtime_1.jsxs)("div", { "data-testid": "error-boundary-fallback", children: [(0, jsx_runtime_1.jsx)("h1", { children: "Test Error" }), (0, jsx_runtime_1.jsx)("p", { children: this.state.error?.message })] }));
        }
        return this.props.children;
    }
}
exports.TestErrorBoundary = TestErrorBoundary;
// Performance testing utilities
const measureRenderTime = async (component) => {
    const startTime = performance.now();
    const { unmount } = (0, react_2.render)(component);
    const endTime = performance.now();
    unmount();
    return endTime - startTime;
};
exports.measureRenderTime = measureRenderTime;
const measureReRenderTime = async (component, updatedProps) => {
    const startTime = performance.now();
    const { rerender, unmount } = (0, react_2.render)(component);
    const initialTime = performance.now() - startTime;
    const updateStartTime = performance.now();
    rerender(react_1.default.cloneElement(component, updatedProps));
    const updateTime = performance.now() - updateStartTime;
    unmount();
    return { initial: initialTime, update: updateTime };
};
exports.measureReRenderTime = measureReRenderTime;
// Accessibility testing utilities
const checkA11y = async (component) => {
    const { container } = (0, react_2.render)(component);
    const violations = [];
    // Check for basic accessibility issues
    // In real implementation, you would use axe-core here
    // Check for alt text on images
    const images = container.querySelectorAll('img');
    images.forEach(img => {
        if (!img.getAttribute('alt')) {
            violations.push(`Image missing alt text: ${img.outerHTML}`);
        }
    });
    // Check for labels on form inputs
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        const id = input.getAttribute('id');
        if (id) {
            const label = container.querySelector(`label[for="${id}"]`);
            if (!label) {
                violations.push(`Input missing label: ${input.outerHTML}`);
            }
        }
    });
    // Check for button text
    const buttons = container.querySelectorAll('button');
    buttons.forEach(button => {
        if (!button.textContent?.trim() && !button.getAttribute('aria-label')) {
            violations.push(`Button missing text or aria-label: ${button.outerHTML}`);
        }
    });
    return violations;
};
exports.checkA11y = checkA11y;
// Snapshot testing utilities
const createStableSnapshot = (component) => {
    // Mock dates and random values for stable snapshots
    const originalDate = Date;
    const originalMath = Math.random;
    global.Date = class MockDate extends Date {
        constructor() {
            super('2024-01-01T00:00:00.000Z');
        }
        static now() {
            return 1704067200000; // 2024-01-01
        }
    };
    Math.random = () => 0.5;
    const { container } = (0, react_2.render)(component);
    const snapshot = container.innerHTML;
    // Restore originals
    global.Date = originalDate;
    Math.random = originalMath;
    return snapshot;
};
exports.createStableSnapshot = createStableSnapshot;
// Export everything
__exportStar(require("./setup"), exports);
__exportStar(require("./mocks/api"), exports);
__exportStar(require("./mocks/components"), exports);
__exportStar(require("./mocks/files"), exports);
var react_3 = require("@testing-library/react");
Object.defineProperty(exports, "render", { enumerable: true, get: function () { return react_3.render; } });
Object.defineProperty(exports, "screen", { enumerable: true, get: function () { return react_3.screen; } });
Object.defineProperty(exports, "fireEvent", { enumerable: true, get: function () { return react_3.fireEvent; } });
Object.defineProperty(exports, "waitFor", { enumerable: true, get: function () { return react_3.waitFor; } });
Object.defineProperty(exports, "act", { enumerable: true, get: function () { return react_3.act; } });
var user_event_1 = require("@testing-library/user-event");
Object.defineProperty(exports, "userEvent", { enumerable: true, get: function () { return __importDefault(user_event_1).default; } });
//# sourceMappingURL=test-utils.js.map