/**
 * Mock Components for Testing
 *
 * Provides mock implementations of common components
 */
import React from 'react';
export declare const MockButton: ({ children, onClick, ...props }: any) => import("react/jsx-runtime").JSX.Element;
export declare const MockInput: ({ value, onChange, ...props }: any) => import("react/jsx-runtime").JSX.Element;
export declare const MockDialog: ({ open, children }: any) => import("react/jsx-runtime").JSX.Element | null;
export declare const MockLanguageProvider: ({ children }: {
    children: React.ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
export declare const MockProfileProvider: ({ children, profile }: any) => import("react/jsx-runtime").JSX.Element;
export declare const MockAuthProvider: ({ children, isAuthenticated }: any) => import("react/jsx-runtime").JSX.Element;
export declare const useMockLanguage: () => {
    t: (key: string, _params?: any, defaultValue?: string) => string;
    language: string;
    setLanguage: import("vitest").Mock<any, any>;
};
export declare const useMockProfile: () => {
    profile: {
        id: string;
        email: string;
        name: string;
        avatar: null;
    };
    updateProfile: import("vitest").Mock<any, any>;
    updateAvatar: import("vitest").Mock<any, any>;
    removeAvatar: import("vitest").Mock<any, any>;
    loading: boolean;
};
export declare const useMockAuth: () => {
    isAuthenticated: boolean;
    user: {
        id: string;
        email: string;
    };
    login: import("vitest").Mock<any, any>;
    logout: import("vitest").Mock<any, any>;
    loading: boolean;
};
export declare const mockToast: {
    success: import("vitest").Mock<any, any>;
    error: import("vitest").Mock<any, any>;
    info: import("vitest").Mock<any, any>;
    warning: import("vitest").Mock<any, any>;
    loading: import("vitest").Mock<any, any>;
    dismiss: import("vitest").Mock<any, any>;
};
export declare const mockRouter: {
    push: import("vitest").Mock<any, any>;
    replace: import("vitest").Mock<any, any>;
    back: import("vitest").Mock<any, any>;
    forward: import("vitest").Mock<any, any>;
    pathname: string;
    query: {};
    params: {};
};
export declare const MockRouterProvider: ({ children }: {
    children: React.ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
export declare const TestWrapper: ({ children }: {
    children: React.ReactNode;
}) => import("react/jsx-runtime").JSX.Element;
export declare const mocks: {
    Button: ({ children, onClick, ...props }: any) => import("react/jsx-runtime").JSX.Element;
    Input: ({ value, onChange, ...props }: any) => import("react/jsx-runtime").JSX.Element;
    Dialog: ({ open, children }: any) => import("react/jsx-runtime").JSX.Element | null;
    toast: {
        success: import("vitest").Mock<any, any>;
        error: import("vitest").Mock<any, any>;
        info: import("vitest").Mock<any, any>;
        warning: import("vitest").Mock<any, any>;
        loading: import("vitest").Mock<any, any>;
        dismiss: import("vitest").Mock<any, any>;
    };
    router: {
        push: import("vitest").Mock<any, any>;
        replace: import("vitest").Mock<any, any>;
        back: import("vitest").Mock<any, any>;
        forward: import("vitest").Mock<any, any>;
        pathname: string;
        query: {};
        params: {};
    };
    useLanguage: () => {
        t: (key: string, _params?: any, defaultValue?: string) => string;
        language: string;
        setLanguage: import("vitest").Mock<any, any>;
    };
    useProfile: () => {
        profile: {
            id: string;
            email: string;
            name: string;
            avatar: null;
        };
        updateProfile: import("vitest").Mock<any, any>;
        updateAvatar: import("vitest").Mock<any, any>;
        removeAvatar: import("vitest").Mock<any, any>;
        loading: boolean;
    };
    useAuth: () => {
        isAuthenticated: boolean;
        user: {
            id: string;
            email: string;
        };
        login: import("vitest").Mock<any, any>;
        logout: import("vitest").Mock<any, any>;
        loading: boolean;
    };
};
//# sourceMappingURL=components.d.ts.map