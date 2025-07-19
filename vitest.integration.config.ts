/**
 * Vitest configuration for integration tests
 * 
 * Run with: npm run test:integration
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Integration test specific settings
    name: 'integration',
    include: [
      'packages/**/*.integration.test.{ts,tsx}',
      'packages/**/__tests__/*.integration.test.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    
    // Environment
    environment: 'node',
    
    // Timeouts
    testTimeout: 30000, // 30 seconds for integration tests
    hookTimeout: 60000, // 60 seconds for setup/teardown
    
    // Threading
    pool: 'forks', // Use separate processes for better isolation
    poolOptions: {
      forks: {
        singleFork: true, // Run tests sequentially to avoid database conflicts
      },
    },
    
    // Reporter
    reporters: ['default', 'html'],
    outputFile: {
      html: './test-results/integration/index.html',
    },
    
    // Coverage
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage/integration',
      include: [
        'packages/**/src/**/*.{ts,tsx}',
      ],
      exclude: [
        'packages/**/src/**/*.test.{ts,tsx}',
        'packages/**/src/**/*.spec.{ts,tsx}',
        'packages/**/src/testing/**',
        'packages/**/src/mocks/**',
        'packages/**/src/types/**',
      ],
    },
    
    // Setup files
    setupFiles: [
      './packages/shared/src/testing/integration-test-setup.ts',
    ],
    
    // Global variables
    globals: true,
    
    // Mock clearing
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    
    // Retry failed tests
    retry: 1,
    
    // Fail on console errors
    onConsoleLog(log, type) {
      if (type === 'error' && !log.includes('expected')) {
        return false; // Fail the test
      }
    },
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/frontend/src'),
      '@spheroseg/shared': path.resolve(__dirname, './packages/shared/src'),
      '@spheroseg/types': path.resolve(__dirname, './packages/types/src'),
    },
  },
  
  // Environment variables for tests
  define: {
    'process.env.NODE_ENV': '"test"',
    'process.env.VITE_API_URL': '"http://localhost:5001"',
    'process.env.VITE_WS_URL': '"ws://localhost:5001"',
  },
});