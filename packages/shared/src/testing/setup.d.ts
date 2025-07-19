/**
 * Shared Testing Setup and Configuration
 *
 * Provides common setup for all test environments
 */
import '@testing-library/jest-dom';
import 'whatwg-fetch';
export declare const waitForAsync: (ms?: number) => Promise<void>;
export declare const flushPromises: () => Promise<void>;
export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { renderHook, act } from '@testing-library/react-hooks';
//# sourceMappingURL=setup.d.ts.map