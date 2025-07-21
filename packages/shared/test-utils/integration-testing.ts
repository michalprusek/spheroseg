/**
 * Integration Testing Utilities
 * Cross-service testing patterns and coordination utilities
 */

export interface ServiceEndpoint {
  name: string;
  url: string;
  healthEndpoint?: string;
  timeout?: number;
}

export interface IntegrationTestConfig {
  services: ServiceEndpoint[];
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
  parallel: boolean;
}

export interface ServiceHealthStatus {
  service: string;
  healthy: boolean;
  responseTime: number;
  error?: string;
  details?: any;
}

export interface IntegrationTestResult {
  testName: string;
  services: ServiceHealthStatus[];
  duration: number;
  success: boolean;
  errors: string[];
}

/**
 * Service health checker
 */
export class ServiceHealthChecker {
  private config: IntegrationTestConfig;

  constructor(config: Partial<IntegrationTestConfig> = {}) {
    this.config = {
      services: [],
      timeout: 5000,
      retryAttempts: 3,
      retryDelay: 1000,
      parallel: true,
      ...config,
    };
  }

  /**
   * Add service to monitor
   */
  addService(service: ServiceEndpoint): void {
    this.config.services.push(service);
  }

  /**
   * Check health of a single service
   */
  async checkServiceHealth(service: ServiceEndpoint): Promise<ServiceHealthStatus> {
    const healthUrl = service.healthEndpoint || `${service.url}/health`;
    const timeout = service.timeout || this.config.timeout;
    const startTime = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(healthUrl, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      clearTimeout(timeoutId);
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        let details: any = {};
        try {
          details = await response.json();
        } catch {
          // Ignore JSON parsing errors for non-JSON responses
        }

        return {
          service: service.name,
          healthy: true,
          responseTime,
          details,
        };
      } else {
        return {
          service: service.name,
          healthy: false,
          responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        service: service.name,
        healthy: false,
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check health of all configured services
   */
  async checkAllServices(): Promise<ServiceHealthStatus[]> {
    if (this.config.parallel) {
      return Promise.all(
        this.config.services.map(service => this.checkServiceHealth(service))
      );
    } else {
      const results: ServiceHealthStatus[] = [];
      for (const service of this.config.services) {
        results.push(await this.checkServiceHealth(service));
      }
      return results;
    }
  }

  /**
   * Wait for all services to become healthy
   */
  async waitForServices(): Promise<ServiceHealthStatus[]> {
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      const results = await this.checkAllServices();
      const unhealthyServices = results.filter(r => !r.healthy);

      if (unhealthyServices.length === 0) {
        return results;
      }

      if (attempt < this.config.retryAttempts) {
        console.log(`Attempt ${attempt}: ${unhealthyServices.length} services not ready. Retrying in ${this.config.retryDelay}ms...`);
        await this.delay(this.config.retryDelay);
      } else {
        throw new Error(`Services failed to become healthy after ${this.config.retryAttempts} attempts: ${unhealthyServices.map(s => s.service).join(', ')}`);
      }
    }

    return [];
  }

  /**
   * Generate health report
   */
  generateHealthReport(results: ServiceHealthStatus[]): string {
    let report = '# Service Health Report\n\n';
    
    const healthy = results.filter(r => r.healthy).length;
    const total = results.length;
    
    report += `**Overall Status**: ${healthy}/${total} services healthy\n\n`;
    
    results.forEach(result => {
      const status = result.healthy ? '✅' : '❌';
      report += `## ${status} ${result.service}\n\n`;
      report += `- **Status**: ${result.healthy ? 'Healthy' : 'Unhealthy'}\n`;
      report += `- **Response Time**: ${result.responseTime}ms\n`;
      
      if (result.error) {
        report += `- **Error**: ${result.error}\n`;
      }
      
      if (result.details) {
        report += `- **Details**: \`${JSON.stringify(result.details)}\`\n`;
      }
      
      report += '\n';
    });

    return report;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Cross-service integration test runner
 */
export class IntegrationTestRunner {
  private healthChecker: ServiceHealthChecker;
  private testResults: IntegrationTestResult[] = [];

  constructor(config: Partial<IntegrationTestConfig> = {}) {
    this.healthChecker = new ServiceHealthChecker(config);
  }

  /**
   * Run integration test
   */
  async runIntegrationTest(
    testName: string,
    testFunction: () => Promise<void> | void
  ): Promise<IntegrationTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let success = false;

    try {
      // Wait for services to be ready
      console.log(`[${testName}] Waiting for services to be ready...`);
      await this.healthChecker.waitForServices();

      // Run the actual test
      console.log(`[${testName}] Running integration test...`);
      await testFunction();
      success = true;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    // Check service health after test
    const serviceResults = await this.healthChecker.checkAllServices();
    const duration = Date.now() - startTime;

    const result: IntegrationTestResult = {
      testName,
      services: serviceResults,
      duration,
      success,
      errors,
    };

    this.testResults.push(result);
    return result;
  }

  /**
   * Run multiple integration tests
   */
  async runIntegrationTests(
    tests: Array<{ name: string; test: () => Promise<void> | void }>
  ): Promise<IntegrationTestResult[]> {
    const results: IntegrationTestResult[] = [];

    for (const { name, test } of tests) {
      const result = await this.runIntegrationTest(name, test);
      results.push(result);

      if (!result.success) {
        console.error(`[${name}] Integration test failed:`, result.errors);
      }
    }

    return results;
  }

  /**
   * Generate integration test report
   */
  generateIntegrationReport(): string {
    const successful = this.testResults.filter(r => r.success).length;
    const total = this.testResults.length;

    let report = '# Integration Test Report\n\n';
    report += `**Summary**: ${successful}/${total} tests passed\n\n`;

    this.testResults.forEach(result => {
      const status = result.success ? '✅' : '❌';
      report += `## ${status} ${result.testName}\n\n`;
      report += `- **Duration**: ${result.duration}ms\n`;
      report += `- **Services Checked**: ${result.services.length}\n`;
      
      const healthyServices = result.services.filter(s => s.healthy).length;
      report += `- **Service Health**: ${healthyServices}/${result.services.length} healthy\n`;

      if (result.errors.length > 0) {
        report += `- **Errors**:\n`;
        result.errors.forEach(error => {
          report += `  - ${error}\n`;
        });
      }

      report += '\n';
    });

    return report;
  }

  /**
   * Clear test results
   */
  clearResults(): void {
    this.testResults = [];
  }
}

/**
 * Database integration test utilities
 */
export class DatabaseTestUtils {
  /**
   * Create test database connection
   */
  static async createTestConnection(config: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }): Promise<any> {
    // This would be implemented based on the specific database client being used
    // For now, return a mock connection
    return {
      async query(sql: string, params?: any[]) {
        console.log('[DatabaseTestUtils] Mock query:', sql, params);
        return { rows: [], rowCount: 0 };
      },
      async close() {
        console.log('[DatabaseTestUtils] Mock connection closed');
      },
    };
  }

  /**
   * Setup test data
   */
  static async setupTestData(connection: any, testData: any[]): Promise<void> {
    for (const data of testData) {
      await connection.query(data.sql, data.params);
    }
  }

  /**
   * Cleanup test data
   */
  static async cleanupTestData(connection: any, tables: string[]): Promise<void> {
    for (const table of tables) {
      await connection.query(`DELETE FROM ${table} WHERE test_data = true`);
    }
  }
}

/**
 * API integration test utilities
 */
export class APITestUtils {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(baseUrl: string, defaultHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...defaultHeaders,
    };
  }

  /**
   * Make authenticated API request
   */
  async request<T>(
    method: string,
    endpoint: string,
    options: {
      body?: any;
      headers?: Record<string, string>;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const { body, headers = {}, timeout = 5000 } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...this.defaultHeaders,
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return (await response.text()) as unknown as T;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Test API endpoint health
   */
  async testEndpointHealth(endpoint: string): Promise<{
    healthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      await this.request('GET', endpoint);
      return {
        healthy: true,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        healthy: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Test CRUD operations
   */
  async testCRUDOperations<T>(
    resourcePath: string,
    testData: any,
    idField: string = 'id'
  ): Promise<{
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    let createdId: any;

    // Test CREATE
    let createSuccess = false;
    try {
      const created = await this.request<any>('POST', resourcePath, { body: testData });
      createdId = created[idField];
      createSuccess = true;
    } catch (error) {
      errors.push(`CREATE failed: ${error}`);
    }

    // Test READ
    let readSuccess = false;
    if (createdId) {
      try {
        await this.request<T>('GET', `${resourcePath}/${createdId}`);
        readSuccess = true;
      } catch (error) {
        errors.push(`READ failed: ${error}`);
      }
    }

    // Test UPDATE
    let updateSuccess = false;
    if (createdId) {
      try {
        const updateData = { ...testData, updated: true };
        await this.request<T>('PUT', `${resourcePath}/${createdId}`, { body: updateData });
        updateSuccess = true;
      } catch (error) {
        errors.push(`UPDATE failed: ${error}`);
      }
    }

    // Test DELETE
    let deleteSuccess = false;
    if (createdId) {
      try {
        await this.request<void>('DELETE', `${resourcePath}/${createdId}`);
        deleteSuccess = true;
      } catch (error) {
        errors.push(`DELETE failed: ${error}`);
      }
    }

    return {
      create: createSuccess,
      read: readSuccess,
      update: updateSuccess,
      delete: deleteSuccess,
      errors,
    };
  }
}

/**
 * Default integration test configuration for SpherosegV4
 */
export const defaultSpherosegIntegrationConfig: IntegrationTestConfig = {
  services: [
    {
      name: 'frontend',
      url: 'http://localhost:3000',
      healthEndpoint: 'http://localhost:3000/', // Frontend doesn't have a dedicated health endpoint
    },
    {
      name: 'backend',
      url: 'http://localhost:5001',
      healthEndpoint: 'http://localhost:5001/api/health',
    },
    {
      name: 'ml',
      url: 'http://localhost:5002',
      healthEndpoint: 'http://localhost:5002/health',
    },
  ],
  timeout: 5000,
  retryAttempts: 3,
  retryDelay: 2000,
  parallel: true,
};