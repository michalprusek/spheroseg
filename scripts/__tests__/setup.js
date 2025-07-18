/**
 * Jest setup for validation scripts tests
 * Configure test environment and global mocks
 */

// Mock performance API for Node.js environments
if (!global.performance) {
  global.performance = {
    now: () => Date.now(),
  };
}

// Setup global test timeout
jest.setTimeout(30000);

// Mock console methods for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

// Restore console after each test
afterEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  // Helper to restore console for specific tests
  restoreConsole: () => {
    global.console = originalConsole;
  },
  
  // Helper to create mock file content
  createMockFileContent: (imports = []) => {
    return imports.map(imp => `import ${imp.name} from '${imp.path}';`).join('\n');
  },
  
  // Helper to create temporary test data
  createTestData: (overrides = {}) => ({
    package: 'test-package',
    file: 'test-file.ts',
    line: 1,
    message: 'Test message',
    ...overrides,
  }),
};