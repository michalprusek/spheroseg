/**
 * Common Test Utilities
 *
 * Provides utilities for testing React components and hooks
 */
import React from 'react';
import { RenderOptions, RenderResult } from '@testing-library/react';
export declare function renderWithProviders(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>): RenderResult;
export declare function renderHookWithProviders<TProps, TResult>(hook: (props: TProps) => TResult, options?: {
    initialProps?: TProps;
    wrapper?: React.ComponentType<{
        children: React.ReactNode;
    }>;
}): {
    result: () => NonNullable<TResult>;
    rerender: (newProps?: TProps) => void;
    unmount: () => void;
};
export declare function waitForCondition(condition: () => boolean, timeout?: number, interval?: number): Promise<void>;
export declare const advanceTimersByTime: (ms: number) => Promise<void>;
export declare const runAllTimers: () => Promise<void>;
export declare const simulateResize: (width: number, height: number) => void;
export declare const simulateNetworkChange: (online: boolean) => void;
export declare const simulateVisibilityChange: (hidden: boolean) => void;
export declare class TestErrorBoundary extends React.Component<{
    children: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}, {
    hasError: boolean;
    error: Error | null;
}> {
    state: {
        hasError: boolean;
        error: Error | null;
    };
    static getDerivedStateFromError(error: Error): {
        hasError: boolean;
        error: Error;
    };
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void;
    render(): string | number | boolean | Iterable<React.ReactNode> | import("react/jsx-runtime").JSX.Element | null | undefined;
}
export declare const measureRenderTime: (component: React.ReactElement) => Promise<number>;
export declare const measureReRenderTime: (component: React.ReactElement, updatedProps: any) => Promise<{
    initial: number;
    update: number;
}>;
export declare const checkA11y: (component: React.ReactElement) => Promise<string[]>;
export declare const createStableSnapshot: (component: React.ReactElement) => any;
export * from './setup';
export * from './mocks/api';
export * from './mocks/components';
export * from './mocks/files';
export { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
//# sourceMappingURL=test-utils.d.ts.map