"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mocks = exports.TestWrapper = exports.MockRouterProvider = exports.mockRouter = exports.mockToast = exports.useMockAuth = exports.useMockProfile = exports.useMockLanguage = exports.MockAuthProvider = exports.MockProfileProvider = exports.MockLanguageProvider = exports.MockDialog = exports.MockInput = exports.MockButton = void 0;
const jsx_runtime_1 = require("react/jsx-runtime");
const vitest_1 = require("vitest");
// Mock UI components
const MockButton = ({ children, onClick, ...props }) => ((0, jsx_runtime_1.jsx)("button", { onClick: onClick, ...props, children: children }));
exports.MockButton = MockButton;
const MockInput = ({ value, onChange, ...props }) => ((0, jsx_runtime_1.jsx)("input", { value: value, onChange: e => onChange?.(e.target.value), ...props }));
exports.MockInput = MockInput;
const MockDialog = ({ open, children }) => open ? (0, jsx_runtime_1.jsx)("div", { role: "dialog", children: children }) : null;
exports.MockDialog = MockDialog;
// Mock context providers
const MockLanguageProvider = ({ children }) => {
    const mockT = (key, _params, defaultValue) => defaultValue || key;
    const value = {
        t: mockT,
        language: 'en',
        setLanguage: vitest_1.vi.fn(),
    };
    return ((0, jsx_runtime_1.jsx)("div", { "data-testid": "mock-language-provider", "data-context": JSON.stringify(value), children: children }));
};
exports.MockLanguageProvider = MockLanguageProvider;
const MockProfileProvider = ({ children, profile = {} }) => {
    const defaultProfile = {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: null,
        ...profile,
    };
    const value = {
        profile: defaultProfile,
        updateProfile: vitest_1.vi.fn(),
        updateAvatar: vitest_1.vi.fn(),
        removeAvatar: vitest_1.vi.fn(),
        loading: false,
    };
    return ((0, jsx_runtime_1.jsx)("div", { "data-testid": "mock-profile-provider", "data-context": JSON.stringify(value), children: children }));
};
exports.MockProfileProvider = MockProfileProvider;
const MockAuthProvider = ({ children, isAuthenticated = true }) => {
    const value = {
        isAuthenticated,
        user: isAuthenticated ? { id: 'user_123', email: 'test@example.com' } : null,
        login: vitest_1.vi.fn(),
        logout: vitest_1.vi.fn(),
        loading: false,
    };
    return ((0, jsx_runtime_1.jsx)("div", { "data-testid": "mock-auth-provider", "data-context": JSON.stringify(value), children: children }));
};
exports.MockAuthProvider = MockAuthProvider;
// Mock hooks
const useMockLanguage = () => ({
    t: (key, _params, defaultValue) => defaultValue || key,
    language: 'en',
    setLanguage: vitest_1.vi.fn(),
});
exports.useMockLanguage = useMockLanguage;
const useMockProfile = () => ({
    profile: {
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: null,
    },
    updateProfile: vitest_1.vi.fn(),
    updateAvatar: vitest_1.vi.fn(),
    removeAvatar: vitest_1.vi.fn(),
    loading: false,
});
exports.useMockProfile = useMockProfile;
const useMockAuth = () => ({
    isAuthenticated: true,
    user: { id: 'user_123', email: 'test@example.com' },
    login: vitest_1.vi.fn(),
    logout: vitest_1.vi.fn(),
    loading: false,
});
exports.useMockAuth = useMockAuth;
// Mock toast notifications
exports.mockToast = {
    success: vitest_1.vi.fn(),
    error: vitest_1.vi.fn(),
    info: vitest_1.vi.fn(),
    warning: vitest_1.vi.fn(),
    loading: vitest_1.vi.fn(),
    dismiss: vitest_1.vi.fn(),
};
// Mock router
exports.mockRouter = {
    push: vitest_1.vi.fn(),
    replace: vitest_1.vi.fn(),
    back: vitest_1.vi.fn(),
    forward: vitest_1.vi.fn(),
    pathname: '/',
    query: {},
    params: {},
};
const MockRouterProvider = ({ children }) => ((0, jsx_runtime_1.jsx)("div", { "data-testid": "mock-router-provider", "data-router": JSON.stringify(exports.mockRouter), children: children }));
exports.MockRouterProvider = MockRouterProvider;
// Utility to wrap component with all common providers
const TestWrapper = ({ children }) => ((0, jsx_runtime_1.jsx)(exports.MockAuthProvider, { children: (0, jsx_runtime_1.jsx)(exports.MockLanguageProvider, { children: (0, jsx_runtime_1.jsx)(exports.MockProfileProvider, { children: (0, jsx_runtime_1.jsx)(exports.MockRouterProvider, { children: children }) }) }) }));
exports.TestWrapper = TestWrapper;
// Export mock implementations
exports.mocks = {
    Button: exports.MockButton,
    Input: exports.MockInput,
    Dialog: exports.MockDialog,
    toast: exports.mockToast,
    router: exports.mockRouter,
    useLanguage: exports.useMockLanguage,
    useProfile: exports.useMockProfile,
    useAuth: exports.useMockAuth,
};
//# sourceMappingURL=components.js.map