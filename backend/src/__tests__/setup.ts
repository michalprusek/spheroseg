// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-chars';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'test_db';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.ML_SERVICE_URL = 'http://localhost:8000';
process.env.UPLOAD_DIR = './uploads';
process.env.INTERNAL_API_KEY = 'test-internal-key-needs-to-be-32-chars-long'; // Added for ML internal routes

// Add a dummy test to avoid Jest error
describe('Setup', () => {
  it('should set up environment variables', () => {
    expect(process.env.JWT_SECRET).toBe('test-jwt-secret-with-at-least-32-chars');
  });
});

// Global test setup
beforeAll(() => {
  // Setup code that runs before all tests
  console.log('Starting test suite');
});

afterAll(() => {
  // Cleanup code that runs after all tests
  console.log('Finished test suite');
});

// Reset mocks after each test
afterEach(() => {
  jest.resetAllMocks();
});
import pool from '../db/connection';
afterAll(async () => {
  // Cleanup code that runs after all tests
  console.log('Finished test suite');
  try {
    await pool.end();
    console.log('Database pool has been closed');
  } catch (err) {
    console.error('Error closing database pool', err);
  }
});
afterAll(() => {
  // Cleanup code that runs after all tests
  console.log('Finished test suite');
});

// Reset mocks after each test
afterEach(() => {
  jest.resetAllMocks();
});
