// Mock fs module BEFORE any imports that might use it
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
}));

// Mock winston to prevent file transport from creating directories
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    log: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn(),
    printf: jest.fn(),
    colorize: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
}));

// Test environment setup
import 'dotenv/config';
import path from 'path';

// Import shared test utilities
import { 
  globalTestReporter
} from '../../../shared/test-utils/test-reporter';
import { MockFactory, TestEnvironment } from '../../../shared/test-utils/mock-utilities';
import { PerformanceTester, globalPerformanceMonitor } from '../../../shared/test-utils/performance-testing';

// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-at-least-32-characters-long';
process.env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/spheroseg_test';
process.env['PORT'] = '5001';
process.env['ML_SERVICE_URL'] = 'http://localhost:5002';
process.env['ALLOWED_ORIGINS'] = 'http://localhost:3000,http://localhost';

// Set test-specific paths
process.env['UPLOAD_DIR'] = path.join(__dirname, '../../test-uploads');
process.env['LOG_DIR'] = path.join(__dirname, '../../test-logs');

// Already mocked at the top of the file

// Increase test timeout for slower operations
jest.setTimeout(10000);

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Configure shared test utilities
MockFactory.configure({
  autoReset: true,
  trackCalls: true,
  enableLogging: false, // Keep quiet in tests
});

// Global test hooks for shared utilities
beforeEach(() => {
  // Start performance monitoring for each test
  globalPerformanceMonitor.clear();
  globalPerformanceMonitor.recordMemoryUsage('test_start');
});

afterEach(() => {
  // Reset all mocks after each test if auto-reset is enabled
  if (MockFactory.getAllMocks().size > 0) {
    MockFactory.resetAllMocks();
  }
  
  // Record end memory usage
  globalPerformanceMonitor.recordMemoryUsage('test_end');
});

// Clean up after all tests
afterAll(async () => {
  // Generate and log final test report if any tests were recorded
  const stats = globalTestReporter.getStats();
  if (stats.total > 0) {
    console.log('\n--- Backend Test Suite Report ---');
    console.log(`Total: ${stats.total}, Passed: ${stats.passed}, Failed: ${stats.failed}, Skipped: ${stats.skipped}`);
    
    // Export full report for CI/CD integration
    const report = globalTestReporter.generateJSONReport();
    // Note: In real CI/CD, this would be written to a file
    // require('fs').writeFileSync('./test-results/backend-report.json', report);
  }
  
  // Close any open handles
  await new Promise((resolve) => setTimeout(resolve, 100));
});
