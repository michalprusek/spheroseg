"use strict";
/**
 * Integration Test Setup
 *
 * Common setup for integration tests across the monorepo
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestWebSocketClient = exports.testApi = exports.testFactories = exports.testDb = exports.integrationTestConfig = void 0;
exports.getTestDbPool = getTestDbPool;
exports.setupIntegrationTests = setupIntegrationTests;
exports.waitForCondition = waitForCondition;
exports.createAuthenticatedContext = createAuthenticatedContext;
const vitest_1 = require("vitest");
const dotenv_1 = require("dotenv");
const path_1 = __importDefault(require("path"));
// Load test environment variables
(0, dotenv_1.config)({ path: path_1.default.resolve(process.cwd(), '.env.test') });
// Global test configuration
exports.integrationTestConfig = {
    // Database
    database: {
        host: process.env['TEST_DB_HOST'] || 'localhost',
        port: parseInt(process.env['TEST_DB_PORT'] || '5432'),
        database: process.env['TEST_DB_NAME'] || 'spheroseg_test',
        user: process.env['TEST_DB_USER'] || 'postgres',
        password: process.env['TEST_DB_PASSWORD'] || 'postgres',
    },
    // API endpoints
    api: {
        baseUrl: process.env['TEST_API_URL'] || 'http://localhost:5001',
        timeout: parseInt(process.env['TEST_API_TIMEOUT'] || '5000'),
    },
    // ML service
    ml: {
        baseUrl: process.env['TEST_ML_URL'] || 'http://localhost:5002',
        timeout: parseInt(process.env['TEST_ML_TIMEOUT'] || '30000'),
    },
    // WebSocket
    websocket: {
        url: process.env['TEST_WS_URL'] || 'ws://localhost:5001',
        timeout: parseInt(process.env['TEST_WS_TIMEOUT'] || '5000'),
    },
    // File uploads
    upload: {
        maxSize: parseInt(process.env['TEST_UPLOAD_MAX_SIZE'] || '10485760'), // 10MB
        chunkSize: parseInt(process.env['TEST_UPLOAD_CHUNK_SIZE'] || '5242880'), // 5MB
    },
    // Test timeouts
    timeouts: {
        unit: 5000,
        integration: 30000,
        e2e: 60000,
    },
};
// Database connection pool for tests
let testDbPool = null;
async function getTestDbPool() {
    if (!testDbPool) {
        const { Pool } = await Promise.resolve().then(() => __importStar(require('pg')));
        testDbPool = new Pool(exports.integrationTestConfig.database);
    }
    return testDbPool;
}
// Database utilities
exports.testDb = {
    async query(text, params) {
        const pool = await getTestDbPool();
        return pool.query(text, params);
    },
    async transaction(callback) {
        const pool = await getTestDbPool();
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
    async cleanup() {
        if (testDbPool) {
            await testDbPool.end();
            testDbPool = null;
        }
    },
};
// Test data factories
exports.testFactories = {
    user: (overrides = {}) => ({
        id: `test_user_${Date.now()}_${Math.random()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'TestPassword123!',
        name: 'Test User',
        ...overrides,
    }),
    project: (userId, overrides = {}) => ({
        id: `test_project_${Date.now()}_${Math.random()}`,
        userId,
        name: 'Test Project',
        description: 'Test project description',
        ...overrides,
    }),
    image: (projectId, overrides = {}) => ({
        id: `test_image_${Date.now()}_${Math.random()}`,
        projectId,
        name: 'test.jpg',
        url: 'http://test.com/test.jpg',
        thumbnailUrl: 'http://test.com/thumb.jpg',
        size: 1024000,
        width: 1920,
        height: 1080,
        segmentationStatus: 'without_segmentation',
        ...overrides,
    }),
    segmentation: (imageId, overrides = {}) => ({
        id: `test_seg_${Date.now()}_${Math.random()}`,
        imageId,
        status: 'completed',
        cellCount: 10,
        metadata: {},
        ...overrides,
    }),
};
// API client for tests
exports.testApi = {
    async post(endpoint, data, options = {}) {
        const response = await fetch(`${exports.integrationTestConfig.api.baseUrl}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            body: JSON.stringify(data),
            ...options,
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },
    async get(endpoint, options = {}) {
        const response = await fetch(`${exports.integrationTestConfig.api.baseUrl}${endpoint}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            ...options,
        });
        if (!response.ok) {
            throw new Error(`API error: ${response.statusText}`);
        }
        return response.json();
    },
};
// WebSocket client for tests
class TestWebSocketClient {
    constructor() {
        this.ws = null;
        this.handlers = new Map();
    }
    connect(token) {
        return new Promise((resolve, reject) => {
            const url = new URL(exports.integrationTestConfig.websocket.url);
            if (token) {
                url.searchParams.set('token', token);
            }
            this.ws = new WebSocket(url.toString());
            this.ws.onopen = () => resolve();
            this.ws.onerror = (error) => reject(error);
            this.ws.onmessage = (event) => {
                try {
                    const { type, data } = JSON.parse(event.data);
                    const handlers = this.handlers.get(type);
                    if (handlers) {
                        handlers.forEach(handler => handler(data));
                    }
                }
                catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };
        });
    }
    on(event, handler) {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event).add(handler);
    }
    off(event, handler) {
        if (handler) {
            this.handlers.get(event)?.delete(handler);
        }
        else {
            this.handlers.delete(event);
        }
    }
    emit(event, data) {
        if (this.ws?.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: event, data }));
        }
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.handlers.clear();
    }
}
exports.TestWebSocketClient = TestWebSocketClient;
// Global setup for integration tests
function setupIntegrationTests() {
    // Set longer timeout for integration tests
    (0, vitest_1.beforeAll)(async () => {
        // Ensure test database is ready
        try {
            await exports.testDb.query('SELECT 1');
        }
        catch (error) {
            console.error('Test database connection failed:', error);
            throw new Error('Integration tests require a running test database');
        }
    }, exports.integrationTestConfig.timeouts.integration);
    // Clean up after all tests
    (0, vitest_1.afterAll)(async () => {
        await exports.testDb.cleanup();
    });
    // Reset test data before each test
    (0, vitest_1.beforeEach)(async () => {
        // Clean up common test data patterns
        await exports.testDb.query("DELETE FROM users WHERE email LIKE '%@example.com'");
        await exports.testDb.query("DELETE FROM projects WHERE name LIKE 'Test%'");
    });
}
// Utility to wait for a condition
async function waitForCondition(condition, timeout = 5000, interval = 100) {
    const startTime = Date.now();
    while (!(await condition())) {
        if (Date.now() - startTime > timeout) {
            throw new Error('Timeout waiting for condition');
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
}
// Utility to create authenticated test context
async function createAuthenticatedContext() {
    const user = exports.testFactories.user();
    // Register user
    const { accessToken, refreshToken } = await exports.testApi.post('/auth/register', {
        email: user.email,
        password: user.password,
        name: user.name,
    });
    return {
        user,
        accessToken,
        refreshToken,
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    };
}
// Export everything
exports.default = {
    config: exports.integrationTestConfig,
    db: exports.testDb,
    factories: exports.testFactories,
    api: exports.testApi,
    WebSocketClient: TestWebSocketClient,
    setupIntegrationTests,
    waitForCondition,
    createAuthenticatedContext,
};
//# sourceMappingURL=integration-test-setup.js.map