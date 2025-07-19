import authRouter from '../auth';
import pool from '../../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createTestApp, createTestRequest, TEST_IDS } from '../../test-utils';
// Fixtures are created inline in tests

// Mock dependencies
jest.mock('../../db'); // Mock the database pool
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');
jest.mock('../../middleware/validationMiddleware', () => ({
  // Mock validation middleware
  validate: () => (req: any, res: any, next: any) => next(),
}));

// Create test app using the utility
const app = createTestApp();
app.use('/api/auth', authRouter); // Mount the router

// Define mock implementations
const mockPoolQuery = pool.query as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;
const mockJwtSign = jwt.sign as jest.Mock;

describe('Auth Routes - /api/auth', () => {
  // Create test user fixture
  const testUser = {
    id: TEST_IDS.USER_ID,
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    is_approved: true,
  };
  const testEmail = testUser.email;
  const testPassword = 'password123';
  const testName = testUser.name || 'Test User';
  const hashedPassword = 'hashedPassword123';
  const userId = testUser.id;
  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Default successful mocks (can be overridden in specific tests)
    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 }); // Default to user not found
    mockBcryptHash.mockResolvedValue(hashedPassword);
    mockBcryptCompare.mockResolvedValue(true); // Default to password match
    mockJwtSign.mockReturnValue(mockToken);
  });

  // --- POST /api/auth/signup ---
  describe('POST /signup', () => {
    it('should register a new user successfully and return 201', async () => {
      const newUserDbResponse = {
        id: userId,
        email: testEmail,
        is_approved: false,
        role: 'user',
      };
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // User check -> Not found
        .mockResolvedValueOnce({ rows: [newUserDbResponse], rowCount: 1 }); // Insert user -> Success

      const response = await createTestRequest(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('User registered successfully. Account pending approval.');
      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.user.isApproved).toBe(false);
      expect(mockPoolQuery).toHaveBeenCalledTimes(2);
      expect(mockPoolQuery).toHaveBeenNthCalledWith(1, 'SELECT id FROM users WHERE email = $1', [
        testEmail,
      ]);
      expect(mockBcryptHash).toHaveBeenCalledWith(testPassword, 10); // 10 is SALT_ROUNDS
      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        2,
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id, email, created_at',
        [testEmail, hashedPassword, 'Test User'] // Assuming simple split logic
      );
    });

    it('should return 409 if email is already registered', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 'existing-user-id' }],
        rowCount: 1,
      }); // User check -> Found

      const response = await createTestRequest(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });

      expect(response.status).toBe(409);
      expect(response.body.message).toBe('Email already registered');
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
      expect(mockBcryptHash).not.toHaveBeenCalled();
    });

    it('should return 500 if database query fails during user check', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('DB User Check Error'));

      const response = await createTestRequest(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during registration');
    });

    it('should return 500 if password hashing fails', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // User check -> Not found
      mockBcryptHash.mockRejectedValueOnce(new Error('Hashing Error'));

      const response = await createTestRequest(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during registration');
      expect(mockPoolQuery).toHaveBeenCalledTimes(1); // Only the user check query should have run
    });

    it('should return 500 if database query fails during user insert', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({ rows: [], rowCount: 0 }) // User check -> Not found
        .mockRejectedValueOnce(new Error('DB Insert Error')); // Insert user -> Fails

      const response = await createTestRequest(app)
        .post('/api/auth/signup')
        .send({ email: testEmail, password: testPassword, name: testName });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during registration');
      expect(mockPoolQuery).toHaveBeenCalledTimes(2); // Both check and insert attempt
      expect(mockBcryptHash).toHaveBeenCalled();
    });
  });

  // --- POST /api/auth/login ---
  describe('POST /login', () => {
    const userDbRecord = {
      id: userId,
      email: testEmail,
      password_hash: hashedPassword, // Use password_hash from auth.ts
      is_approved: true,
      // other fields if needed...
    };

    it('should log in an approved user successfully and return 200 with token', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [userDbRecord],
        rowCount: 1,
      }); // User found
      mockBcryptCompare.mockResolvedValueOnce(true); // Password matches

      const response = await createTestRequest(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Login successful');
      expect(response.body.token).toBe(mockToken);
      expect(response.body.user.id).toBe(userId);
      expect(response.body.user.email).toBe(testEmail);
      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE email = $1', [
        testEmail,
      ]);
      expect(mockBcryptCompare).toHaveBeenCalledWith(testPassword, userDbRecord.password_hash);
      expect(mockJwtSign).toHaveBeenCalledWith(
        { userId: userId, email: testEmail },
        process.env["JWT_SECRET"],
        {
          expiresIn: '1h',
        }
      );
    });

    it('should return 401 if user email is not found', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 }); // User not found

      const response = await createTestRequest(app)
        .post('/api/auth/login')
        .send({ email: 'wrong@example.com', password: testPassword });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
      expect(mockBcryptCompare).not.toHaveBeenCalled();
      expect(mockJwtSign).not.toHaveBeenCalled();
    });

    it('should return 401 if password does not match', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [userDbRecord],
        rowCount: 1,
      }); // User found
      mockBcryptCompare.mockResolvedValueOnce(false); // Password mismatch

      const response = await createTestRequest(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: 'wrongPassword' });

      expect(response.status).toBe(401);
      expect(response.body.message).toBe('Invalid credentials');
      expect(mockJwtSign).not.toHaveBeenCalled();
    });

    it('should return 403 if user is not approved', async () => {
      const unapprovedUser = { ...userDbRecord, is_approved: false };
      mockPoolQuery.mockResolvedValueOnce({
        rows: [unapprovedUser],
        rowCount: 1,
      }); // User found, not approved
      mockBcryptCompare.mockResolvedValueOnce(true); // Password matches

      const response = await createTestRequest(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(403);
      expect(response.body.message).toBe('Account not approved');
      expect(mockJwtSign).not.toHaveBeenCalled();
    });

    it('should return 500 if database query fails during user lookup', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('DB Login Lookup Error'));

      const response = await createTestRequest(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during login');
    });

    it('should return 500 if password comparison fails', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [userDbRecord],
        rowCount: 1,
      }); // User found
      mockBcryptCompare.mockRejectedValueOnce(new Error('Compare Error')); // Bcrypt fails

      const response = await createTestRequest(app)
        .post('/api/auth/login')
        .send({ email: testEmail, password: testPassword });

      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Internal server error during login');
    });
  });

  // TODO: Add tests for /logout and /refresh-token if they exist
});
