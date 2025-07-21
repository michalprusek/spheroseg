/**
 * Shared Mock Utilities
 * Reusable mock patterns and utilities across all services
 */

export interface MockConfig {
  autoReset?: boolean;
  trackCalls?: boolean;
  enableLogging?: boolean;
}

// Detect test environment (Jest vs Vitest)
const getTestFramework = () => {
  if (typeof jest !== 'undefined') {
    return { fn: jest.fn, isMockFunction: jest.isMockFunction };
  }
  if (typeof vi !== 'undefined') {
    return { fn: vi.fn, isMockFunction: vi.isMockFunction };
  }
  throw new Error('No test framework detected. Please use either Jest or Vitest.');
};

const testFramework = getTestFramework();

/**
 * Enhanced mock factory with advanced features
 */
export class MockFactory {
  private static mocks = new Map<string, any>();
  private static config: MockConfig = {
    autoReset: true,
    trackCalls: true,
    enableLogging: false,
  };

  /**
   * Configure global mock behavior
   */
  static configure(config: Partial<MockConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Create a tracked mock function
   */
  static createMockFunction<T extends (...args: any[]) => any>(
    name: string,
    implementation?: T
  ): any {
    const mock = testFramework.fn(implementation) as any;

    mock.callHistory = [];
    mock.resetHistory = () => {
      mock.callHistory.length = 0;
    };

    // Track calls if enabled
    if (this.config.trackCalls) {
      const originalImplementation = mock.getMockImplementation();
      mock.mockImplementation((...args: any[]) => {
        mock.callHistory.push({
          args,
          timestamp: Date.now(),
          callCount: mock.mock.calls.length + 1,
        });

        if (this.config.enableLogging) {
          console.log(`[MockFactory] ${name} called with:`, args);
        }

        return originalImplementation ? originalImplementation(...args) : undefined;
      });
    }

    this.mocks.set(name, mock);
    return mock;
  }

  /**
   * Create API client mock with common patterns
   */
  static createApiClientMock(baseUrl: string = '/api') {
    return {
      get: this.createMockFunction('apiClient.get', testFramework.fn().mockResolvedValue({ data: {} })),
      post: this.createMockFunction('apiClient.post', testFramework.fn().mockResolvedValue({ data: {} })),
      put: this.createMockFunction('apiClient.put', testFramework.fn().mockResolvedValue({ data: {} })),
      delete: this.createMockFunction('apiClient.delete', testFramework.fn().mockResolvedValue({ data: {} })),
      patch: this.createMockFunction('apiClient.patch', testFramework.fn().mockResolvedValue({ data: {} })),
      baseURL: baseUrl,
      interceptors: {
        request: { use: testFramework.fn(), eject: testFramework.fn() },
        response: { use: testFramework.fn(), eject: testFramework.fn() },
      },
    };
  }

  /**
   * Create React Context mock with provider
   */
  static createContextMock<T>(
    contextName: string,
    defaultValue: T,
    options: { renderProvider?: boolean } = {}
  ) {
    const contextValue = { ...defaultValue };
    
    const useContextHook = this.createMockFunction(
      `use${contextName}`,
      testFramework.fn(() => contextValue)
    );

    const Provider = options.renderProvider
      ? ({ children }: { children: React.ReactNode }) =>
          React.createElement('div', { 'data-testid': `${contextName.toLowerCase()}-provider` }, children)
      : ({ children }: { children: React.ReactNode }) =>
          React.createElement(React.Fragment, {}, children);

    return {
      useContext: useContextHook,
      Provider,
      contextValue,
      updateContextValue: (updates: Partial<T>) => {
        Object.assign(contextValue, updates);
      },
    };
  }

  /**
   * Create localStorage mock
   */
  static createLocalStorageMock(): Storage {
    const store: Record<string, string> = {};

    return {
      getItem: this.createMockFunction('localStorage.getItem', (key: string) => store[key] || null),
      setItem: this.createMockFunction('localStorage.setItem', (key: string, value: string) => {
        store[key] = value;
      }),
      removeItem: this.createMockFunction('localStorage.removeItem', (key: string) => {
        delete store[key];
      }),
      clear: this.createMockFunction('localStorage.clear', () => {
        Object.keys(store).forEach(key => delete store[key]);
      }),
      key: this.createMockFunction('localStorage.key', (index: number) => {
        const keys = Object.keys(store);
        return keys[index] || null;
      }),
      get length() {
        return Object.keys(store).length;
      },
    };
  }

  /**
   * Create internationalization (i18n) mock
   */
  static createI18nMock(translations: Record<string, Record<string, string>>) {
    let currentLanguage = 'en';

    const t = this.createMockFunction('i18n.t', testFramework.fn((key: string, options?: any, fallback?: string) => {
      const translation = translations[currentLanguage]?.[key];
      if (translation) {
        // Handle parameter substitution
        if (options && typeof translation === 'string') {
          return translation.replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return options[param] || match;
          });
        }
        return translation;
      }
      return fallback || key;
    }));

    const changeLanguage = this.createMockFunction('i18n.changeLanguage', testFramework.fn((lang: string) => {
      currentLanguage = lang;
      return Promise.resolve();
    }));

    return {
      t,
      changeLanguage,
      get language() {
        return currentLanguage;
      },
      languages: Object.keys(translations),
      isInitialized: true,
      on: this.createMockFunction('i18n.on', testFramework.fn()),
      off: this.createMockFunction('i18n.off', testFramework.fn()),
      options: {
        resources: translations,
      },
    };
  }

  /**
   * Reset all mocks
   */
  static resetAllMocks(): void {
    this.mocks.forEach(mock => {
      if (testFramework.isMockFunction(mock)) {
        mock.mockReset();
      }
      if (mock.resetHistory) {
        mock.resetHistory();
      }
    });

    if (this.config.enableLogging) {
      console.log(`[MockFactory] Reset ${this.mocks.size} mocks`);
    }
  }

  /**
   * Get mock by name
   */
  static getMock(name: string): any {
    return this.mocks.get(name);
  }

  /**
   * Get all mocks
   */
  static getAllMocks(): Map<string, any> {
    return new Map(this.mocks);
  }

  /**
   * Generate mock call report
   */
  static generateCallReport(): string {
    let report = '# Mock Call Report\n\n';

    this.mocks.forEach((mock, name) => {
      if (mock.callHistory && mock.callHistory.length > 0) {
        report += `## ${name}\n\n`;
        report += `- **Total Calls**: ${mock.callHistory.length}\n`;
        report += `- **Call History**:\n`;
        
        mock.callHistory.forEach((call: any, index: number) => {
          report += `  ${index + 1}. Args: ${JSON.stringify(call.args)} (${new Date(call.timestamp).toISOString()})\n`;
        });
        report += '\n';
      }
    });

    return report;
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  /**
   * Generate mock user data
   */
  static createMockUser(overrides: Partial<any> = {}): any {
    return {
      id: 'test-user-' + Math.random().toString(36).substr(2, 9),
      email: 'test@example.com',
      username: 'testuser',
      full_name: 'Test User',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate mock image data
   */
  static createMockImage(overrides: Partial<any> = {}): any {
    return {
      id: 'img-' + Math.random().toString(36).substr(2, 9),
      filename: 'test-image.jpg',
      size: 1024 * 1024, // 1MB
      width: 1920,
      height: 1080,
      segmentation_status: 'without_segmentation',
      created_at: new Date().toISOString(),
      ...overrides,
    };
  }

  /**
   * Generate mock project data
   */
  static createMockProject(overrides: Partial<any> = {}): any {
    return {
      id: 'proj-' + Math.random().toString(36).substr(2, 9),
      name: 'Test Project',
      description: 'A test project for testing purposes',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      image_count: 0,
      ...overrides,
    };
  }

  /**
   * Generate array of mock data
   */
  static createMockArray<T>(
    generator: (index: number) => T,
    count: number = 5
  ): T[] {
    return Array.from({ length: count }, (_, index) => generator(index));
  }
}

/**
 * Test environment utilities
 */
export class TestEnvironment {
  private static originalEnv: Record<string, string | undefined> = {};

  /**
   * Set environment variables for testing
   */
  static setEnvVars(vars: Record<string, string>): void {
    Object.entries(vars).forEach(([key, value]) => {
      if (!(key in this.originalEnv)) {
        this.originalEnv[key] = process.env[key];
      }
      process.env[key] = value;
    });
  }

  /**
   * Restore original environment variables
   */
  static restoreEnvVars(): void {
    Object.entries(this.originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
    this.originalEnv = {};
  }

  /**
   * Create isolated test environment
   */
  static createIsolatedEnv<T>(
    envVars: Record<string, string>,
    testFn: () => T | Promise<T>
  ): Promise<T> {
    return new Promise(async (resolve, reject) => {
      try {
        this.setEnvVars(envVars);
        const result = await testFn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        this.restoreEnvVars();
      }
    });
  }
}

// Export default configuration
export const defaultMockConfig: MockConfig = {
  autoReset: true,
  trackCalls: true,
  enableLogging: false,
};