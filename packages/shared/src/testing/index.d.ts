/**
 * Shared Testing Utilities
 *
 * Main export file for all testing utilities
 */
export * from './setup';
export * from './test-utils';
export * from './mocks/api';
export * from './mocks/components';
export * from './mocks/files';
export { render, screen, fireEvent, waitFor, act, cleanup, within, prettyDOM, } from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { vi, expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
export declare const describeIf: (condition: boolean) => jest.Describe;
export declare const itIf: (condition: boolean) => jest.It;
export declare const isCI: boolean;
export declare const isDebug: boolean;
export declare const benchmark: (_name: string, fn: () => void | Promise<void>, iterations?: number) => Promise<{
    mean: number;
    min: number;
    max: number;
    median: number;
}>;
export declare const generateId: () => string;
export declare const generateUser: (overrides?: {}) => {
    id: string;
    email: string;
    name: string;
    avatar: null;
    createdAt: string;
};
export declare const generateProject: (overrides?: {}) => {
    id: string;
    name: string;
    description: string;
    userId: string;
    createdAt: string;
    updatedAt: string;
};
export declare const generateImage: (overrides?: {}) => {
    id: string;
    projectId: string;
    name: string;
    url: string;
    thumbnailUrl: string;
    size: number;
    width: number;
    height: number;
    segmentationStatus: string;
    createdAt: string;
};
export declare const expectToBeWithinRange: (value: number, min: number, max: number) => void;
export declare const expectToHaveBeenCalledWithPartial: (mock: any, partial: Record<string, any>) => void;
export declare const logTestInfo: (info: any) => void;
export declare const takeScreenshot: (element: Element, filename: string) => Promise<void>;
//# sourceMappingURL=index.d.ts.map