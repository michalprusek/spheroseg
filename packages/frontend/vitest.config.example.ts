/**
 * Example Vitest configuration with advanced test utilities
 * 
 * To use this configuration, rename this file to vitest.config.ts
 * and update your existing configuration to include the advanced utilities.
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Setup files for advanced test utilities
    setupFiles: [
      './src/test-utils/vitestSetup.ts',
    ],
    
    // Test environment
    environment: 'jsdom',
    
    // Global test configuration
    globals: true,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './test-results/coverage',
      exclude: [
        'node_modules/',
        'src/test-utils/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/dist/**',
        '**/.{eslint,mocha,prettier}rc.{js,cjs,yml}',
      ],
      // Thresholds for coverage
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        // Higher thresholds for critical files
        './src/services/': {
          branches: 85,
          functions: 85,
          lines: 85,
          statements: 85,
        },
        './src/contexts/': {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    
    // Test timeout configuration
    testTimeout: 10000, // 10 seconds for integration tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Reporter configuration
    reporter: [
      'default',
      'json',
      'html',
    ],
    
    // Output directory for test results
    outputFile: {
      json: './test-results/test-results.json',
      html: './test-results/test-results.html',
    },
    
    // Include patterns
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules/',
      'dist/',
      '.next/',
      'coverage/',
      'test-results/',
    ],
    
    // Watch mode configuration
    watch: {
      // Ignore these directories in watch mode
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/coverage/**',
        '**/test-results/**',
      ],
    },
    
    // Pool options for parallel test execution
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: 1,
        maxThreads: 4,
        singleThread: false,
      },
    },
    
    // Environment variables for testing
    env: {
      // Enable performance monitoring in tests
      ENABLE_TEST_PERFORMANCE_MONITORING: 'true',
      
      // Custom performance thresholds
      TEST_RENDER_THRESHOLD_MS: '100',
      TEST_RENDER_COMPLEX_THRESHOLD_MS: '200',
      TEST_INTERACTION_THRESHOLD_MS: '50',
      TEST_API_THRESHOLD_MS: '300',
      
      // Test-specific configuration
      NODE_ENV: 'test',
      VITE_API_URL: 'http://localhost:5001',
      VITE_API_BASE_URL: '/api',
    },
  },
  
  // Resolve configuration for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/test-utils': path.resolve(__dirname, './src/test-utils'),
    },
  },
  
  // Define configuration for build-time optimizations
  define: {
    // Enable advanced test utilities in development and test
    __ENABLE_ADVANCED_TEST_UTILITIES__: process.env.NODE_ENV !== 'production',
  },
});

/*
Usage Instructions:

1. Install required dependencies:
   npm install --save-dev @vitest/ui @vitest/coverage-v8

2. Update package.json scripts:
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:run": "vitest run",
       "test:coverage": "vitest run --coverage",
       "test:watch": "vitest --watch",
       "test:performance": "ENABLE_TEST_PERFORMANCE_MONITORING=true vitest run",
       "test:health": "vitest run && cat ./test-results/health-report.md"
     }
   }

3. Create test-results directory:
   mkdir -p test-results

4. Run tests with advanced utilities:
   npm run test:performance

5. View test health report:
   npm run test:health

6. View coverage report:
   npm run test:coverage && open ./test-results/coverage/index.html

Performance Monitoring:
- Set ENABLE_TEST_PERFORMANCE_MONITORING=true to enable benchmarking
- Customize thresholds with environment variables
- View performance reports in console output

Health Monitoring:
- Automatically generates health reports
- Saves reports to ./test-results/health-report.md in CI
- Provides actionable recommendations for test improvement

Coverage Thresholds:
- Global: 70% minimum coverage
- Services: 85% (critical business logic)
- Contexts: 80% (state management)
- Can be customized per directory or file pattern
*/