/**
 * Integration test utilities for comprehensive end-to-end testing
 */

// import { jest } from '@jest/globals'; // Unused import
import request from 'supertest';
import { Express } from 'express';

// Integration test environment setup
export class IntegrationTestEnvironment {
  private static app: Express;
  private static testDatabase: any;
  private static testServer: any;
  private static initialized = false;

  static async setup(app: Express, database?: any): Promise<void> {
    if (this.initialized) return;

    this.app = app;
    this.testDatabase = database;
    
    // Setup test database if provided
    if (database) {
      await this.setupTestDatabase();
    }

    // Start test server
    this.testServer = this.app.listen(0); // Random port
    this.initialized = true;
  }

  static async teardown(): Promise<void> {
    if (!this.initialized) return;

    // Close test server
    if (this.testServer) {
      await new Promise<void>((resolve) => {
        this.testServer.close(() => resolve());
      });
    }

    // Cleanup test database
    if (this.testDatabase) {
      await this.cleanupTestDatabase();
    }

    this.initialized = false;
  }

  static getApp(): Express {
    if (!this.initialized) {
      throw new Error('Integration test environment not initialized');
    }
    return this.app;
  }

  private static async setupTestDatabase(): Promise<void> {
    // Create test tables and seed data
    const seedQueries = [
      `CREATE TABLE IF NOT EXISTS test_users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS test_projects (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        user_id INTEGER REFERENCES test_users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      `CREATE TABLE IF NOT EXISTS test_images (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        project_id INTEGER REFERENCES test_projects(id) ON DELETE CASCADE,
        segmentation_status VARCHAR(50) DEFAULT 'without_segmentation',
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    ];

    for (const query of seedQueries) {
      if (this.testDatabase.query) {
        await this.testDatabase.query(query);
      }
    }
  }

  private static async cleanupTestDatabase(): Promise<void> {
    const cleanupQueries = [
      'DROP TABLE IF EXISTS test_images CASCADE',
      'DROP TABLE IF EXISTS test_projects CASCADE',
      'DROP TABLE IF EXISTS test_users CASCADE',
    ];

    for (const query of cleanupQueries) {
      if (this.testDatabase.query) {
        await this.testDatabase.query(query);
      }
    }
  }
}

// API workflow testing utilities
export class ApiWorkflowTester {
  private app: Express;
  private authToken?: string;
  private testData: Map<string, any> = new Map();

  constructor(app: Express) {
    this.app = app;
  }

  // User authentication workflow
  async authenticateUser(credentials = { email: 'test@example.com', password: 'testpass123' }): Promise<string> {
    // Register user first
    await request(this.app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: credentials.email,
        password: credentials.password,
        full_name: 'Test User',
      })
      .expect((res) => {
        expect([200, 201, 409]).toContain(res.status); // 409 if user already exists
      });

    // Login user
    const loginResponse = await request(this.app)
      .post('/api/auth/login')
      .send(credentials)
      .expect(200);

    this.authToken = loginResponse.body.token;
    this.testData.set('userId', loginResponse.body.user.id);
    if (!this.authToken) {
      throw new Error('No auth token available');
    }
    return this.authToken;
  }

  // Project creation workflow
  async createProject(projectData = { name: 'Test Project', description: 'Test Description' }): Promise<string> {
    if (!this.authToken) {
      throw new Error('User must be authenticated first');
    }

    const response = await request(this.app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${this.authToken}`)
      .send(projectData)
      .expect(201);

    const projectId = response.body.project.id;
    this.testData.set('projectId', projectId);
    return projectId;
  }

  // Image upload workflow
  async uploadImage(imagePath = 'test-image.jpg', projectId?: string): Promise<string> {
    if (!this.authToken) {
      throw new Error('User must be authenticated first');
    }

    const targetProjectId = projectId || this.testData.get('projectId');
    if (!targetProjectId) {
      throw new Error('Project must be created first');
    }

    // Mock file upload
    const response = await request(this.app)
      .post(`/api/projects/${targetProjectId}/images`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .attach('image', Buffer.from('fake-image-data'), imagePath)
      .expect(201);

    const imageId = response.body.image.id;
    this.testData.set('imageId', imageId);
    return imageId;
  }

  // Segmentation workflow
  async processSegmentation(imageId?: string): Promise<void> {
    if (!this.authToken) {
      throw new Error('User must be authenticated first');
    }

    const targetImageId = imageId || this.testData.get('imageId');
    if (!targetImageId) {
      throw new Error('Image must be uploaded first');
    }

    // Start segmentation
    await request(this.app)
      .post(`/api/images/${targetImageId}/segment`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .expect(200);

    // Poll for completion (in real tests, this would be mocked)
    await this.waitForSegmentationCompletion(targetImageId);
  }

  // Export workflow
  async exportData(format = 'COCO', options = {}): Promise<Buffer> {
    if (!this.authToken) {
      throw new Error('User must be authenticated first');
    }

    const projectId = this.testData.get('projectId');
    if (!projectId) {
      throw new Error('Project must exist for export');
    }

    const response = await request(this.app)
      .post(`/api/projects/${projectId}/export`)
      .set('Authorization', `Bearer ${this.authToken}`)
      .send({ format, options })
      .expect(200);

    return response.body;
  }

  // Complete user journey test
  async testCompleteUserJourney(): Promise<{
    userId: string;
    projectId: string;
    imageId: string;
    exportData: any;
  }> {
    // 1. User registration and login
    const token = await this.authenticateUser();
    expect(token).toBeDefined();

    // 2. Project creation
    const projectId = await this.createProject();
    expect(projectId).toBeDefined();

    // 3. Image upload
    const imageId = await this.uploadImage();
    expect(imageId).toBeDefined();

    // 4. Image processing
    await this.processSegmentation();

    // 5. Data export
    const exportData = await this.exportData();
    expect(exportData).toBeDefined();

    return {
      userId: this.testData.get('userId'),
      projectId,
      imageId,
      exportData,
    };
  }

  private async waitForSegmentationCompletion(imageId: string, maxAttempts = 10): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      const response = await request(this.app)
        .get(`/api/images/${imageId}`)
        .set('Authorization', `Bearer ${this.authToken}`)
        .expect(200);

      if (response.body.image.segmentation_status === 'completed') {
        return;
      }

      if (response.body.image.segmentation_status === 'failed') {
        throw new Error('Segmentation failed');
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('Segmentation did not complete within expected time');
  }

  getTestData(): Map<string, any> {
    return this.testData;
  }

  clearTestData(): void {
    this.testData.clear();
    this.authToken = undefined as any; // Type assertion for cleanup
  }
}

// Database integration testing utilities
export class DatabaseIntegrationTester {
  private database: any;

  constructor(database: any) {
    this.database = database;
  }

  // Test database operations
  async testCRUDOperations(tableName: string, sampleData: Record<string, any>): Promise<void> {
    // Create
    const insertQuery = `INSERT INTO ${tableName} (${Object.keys(sampleData).join(', ')}) VALUES (${Object.keys(sampleData).map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`;
    const insertResult = await this.database.query(insertQuery, Object.values(sampleData));
    const createdRecord = insertResult.rows[0];
    expect(createdRecord).toBeDefined();
    expect(createdRecord.id).toBeDefined();

    // Read
    const selectQuery = `SELECT * FROM ${tableName} WHERE id = $1`;
    const selectResult = await this.database.query(selectQuery, [createdRecord.id]);
    expect(selectResult.rows).toHaveLength(1);
    expect(selectResult.rows[0]).toMatchObject(sampleData);

    // Update
    const updateData = { ...sampleData, updated_field: 'updated_value' };
    const updateQuery = `UPDATE ${tableName} SET ${Object.keys(updateData).map((key, i) => `${key} = $${i + 1}`).join(', ')} WHERE id = $${Object.keys(updateData).length + 1} RETURNING *`;
    const updateResult = await this.database.query(updateQuery, [...Object.values(updateData), createdRecord.id]);
    expect(updateResult.rows).toHaveLength(1);

    // Delete
    const deleteQuery = `DELETE FROM ${tableName} WHERE id = $1 RETURNING *`;
    const deleteResult = await this.database.query(deleteQuery, [createdRecord.id]);
    expect(deleteResult.rows).toHaveLength(1);

    // Verify deletion
    const verifyQuery = `SELECT * FROM ${tableName} WHERE id = $1`;
    const verifyResult = await this.database.query(verifyQuery, [createdRecord.id]);
    expect(verifyResult.rows).toHaveLength(0);
  }

  // Test transaction integrity
  async testTransactionIntegrity(): Promise<void> {
    await this.database.query('BEGIN');

    try {
      // Insert test data
      await this.database.query('INSERT INTO test_users (username, email, password_hash) VALUES ($1, $2, $3)', ['tx_test_user', 'tx_test@example.com', 'hash123']);

      // Simulate error
      await this.database.query('INSERT INTO test_users (username, email, password_hash) VALUES ($1, $2, $3)', ['tx_test_user', 'tx_test@example.com', 'hash123']); // Should fail due to unique constraint

      await this.database.query('COMMIT');
    } catch (error) {
      await this.database.query('ROLLBACK');
      
      // Verify rollback - user should not exist
      const result = await this.database.query('SELECT * FROM test_users WHERE username = $1', ['tx_test_user']);
      expect(result.rows).toHaveLength(0);
    }
  }

  // Test foreign key constraints
  async testForeignKeyConstraints(): Promise<void> {
    // Create user first
    const userResult = await this.database.query(
      'INSERT INTO test_users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      ['fk_test_user', 'fk_test@example.com', 'hash123']
    );
    const userId = userResult.rows[0].id;

    // Create project with valid user_id
    const projectResult = await this.database.query(
      'INSERT INTO test_projects (name, description, user_id) VALUES ($1, $2, $3) RETURNING id',
      ['FK Test Project', 'Test Description', userId]
    );
    expect(projectResult.rows).toHaveLength(1);

    // Try to create project with invalid user_id - should fail
    try {
      await this.database.query(
        'INSERT INTO test_projects (name, description, user_id) VALUES ($1, $2, $3)',
        ['Invalid Project', 'Test Description', 99999]
      );
      throw new Error('Expected foreign key constraint violation');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      expect(errorMessage).toContain('foreign key constraint');
    }

    // Cleanup
    await this.database.query('DELETE FROM test_projects WHERE user_id = $1', [userId]);
    await this.database.query('DELETE FROM test_users WHERE id = $1', [userId]);
  }
}

// Performance integration testing
export class PerformanceIntegrationTester {
  private app: Express;
  private metrics: Map<string, number[]> = new Map();

  constructor(app: Express) {
    this.app = app;
  }

  async testEndpointPerformance(
    endpoint: string,
    method: 'get' | 'post' | 'put' | 'delete' = 'get',
    data?: any,
    iterations = 10
  ): Promise<{ average: number; min: number; max: number; p95: number }> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();

      let response;
      switch (method) {
        case 'get':
          response = await request(this.app).get(endpoint);
          break;
        case 'post':
          response = await request(this.app).post(endpoint).send(data);
          break;
        case 'put':
          response = await request(this.app).put(endpoint).send(data);
          break;
        case 'delete':
          response = await request(this.app).delete(endpoint);
          break;
      }

      const end = performance.now();
      const duration = end - start;
      times.push(duration);

      // Ensure response is successful
      expect(response.status).toBeLessThan(400);
    }

    this.metrics.set(endpoint, times);

    const sortedTimes = [...times].sort((a, b) => a - b);
    const average = times.reduce((sum, time) => sum + time, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const p95Index = Math.floor(times.length * 0.95);
    const p95 = sortedTimes[p95Index];

    return { average, min, max, p95 };
  }

  async testConcurrentRequests(
    endpoint: string,
    concurrency = 5,
    totalRequests = 25
  ): Promise<{ successRate: number; averageTime: number; errors: any[] }> {
    const promises: Promise<any>[] = [];
    const results: { success: boolean; time: number; error?: any }[] = [];

    for (let i = 0; i < totalRequests; i++) {
      const promise = (async () => {
        const start = performance.now();
        try {
          const response = await request(this.app).get(endpoint);
          const end = performance.now();
          return {
            success: response.status < 400,
            time: end - start,
          };
        } catch (error) {
          const end = performance.now();
          return {
            success: false,
            time: end - start,
            error: error.message,
          };
        }
      })();

      promises.push(promise);

      // Control concurrency
      if (promises.length >= concurrency || i === totalRequests - 1) {
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        promises.length = 0;
      }
    }

    const successCount = results.filter(r => r.success).length;
    const successRate = successCount / totalRequests;
    const averageTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
    const errors = results.filter(r => !r.success).map(r => r.error);

    return { successRate, averageTime, errors };
  }

  getPerformanceReport(): Record<string, any> {
    const report: Record<string, any> = {};

    this.metrics.forEach((times, endpoint) => {
      const sortedTimes = [...times].sort((a, b) => a - b);
      report[endpoint] = {
        average: times.reduce((sum, time) => sum + time, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
        p50: sortedTimes[Math.floor(times.length * 0.5)],
        p95: sortedTimes[Math.floor(times.length * 0.95)],
        p99: sortedTimes[Math.floor(times.length * 0.99)],
        samples: times.length,
      };
    });

    return report;
  }
}

export default {
  IntegrationTestEnvironment,
  ApiWorkflowTester,
  DatabaseIntegrationTester,
  PerformanceIntegrationTester,
};