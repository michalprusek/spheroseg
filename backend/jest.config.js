/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1',
    '^@db/(.*)$': '<rootDir>/src/db/$1',
    '^@middlewares/(.*)$': '<rootDir>/src/middlewares/$1',
    '^@auth/(.*)$': '<rootDir>/src/auth/$1',
    '^@storage/(.*)$': '<rootDir>/src/storage/$1',
    '^@profile/(.*)$': '<rootDir>/src/profile/$1',
    '^@projects/(.*)$': '<rootDir>/src/projects/$1',
    '^@ml/(.*)$': '<rootDir>/src/ml/$1',
  },
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Disable coverage thresholds for now
  // coverageThreshold: {
  //   global: {
  //     branches: 20,
  //     functions: 30,
  //     lines: 40,
  //     statements: 40,
  //   },
  // },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
