/**
 * Jest configuration for root-level validation scripts
 * Simplified configuration for ES modules
 */

export default {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/scripts/__tests__/**/*.test.js',
    '<rootDir>/scripts/__tests__/**/*.spec.js',
  ],
  collectCoverageFrom: [
    'scripts/*.js',
    '!scripts/__tests__/**',
    '!scripts/test-*.js',
  ],
  coverageDirectory: 'scripts/coverage',
  coverageReporters: ['text', 'html', 'lcov'],
  verbose: true,
  moduleFileExtensions: ['js', 'json'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/scripts/__tests__/setup.js'],
  // Handle ES modules in Node.js
  transform: {},
};