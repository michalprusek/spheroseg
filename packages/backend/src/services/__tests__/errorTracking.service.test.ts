/**
 * Error Tracking Service Test Suite
 * 
 * Comprehensive tests for the enhanced error tracking and alerting service including
 * error collection, pattern detection, alert generation, and monitoring capabilities.
 */

import { EventEmitter } from 'events';
import ErrorTrackingService from '../errorTracking.service';
import { ApiError } from '../../utils/ApiError.enhanced';

// Mock dependencies
jest.mock('../../db');
jest.mock('../../utils/logger');
jest.mock('../../monitoring/unified');
jest.mock('node-cache');
jest.mock('prom-client');

// Mock logger
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../utils/logger', () => {
  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    http: jest.fn(),
    silly: jest.fn(),
  };

  return {
    __esModule: true,
    default: mockLogger,
    createLogger: jest.fn().mockReturnValue(mockLogger),
  };
});

// Mock database pool
const mockPool = {
  query: jest.fn(),
};

jest.mock('../../db', () => ({
  __esModule: true,
  default: mockPool,
}));

// Mock Redis
const mockRedis = {
  setex: jest.fn(),
  hincrby: jest.fn(),
  hset: jest.fn(),
  expire: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
};

// Mock NodeCache
const mockNodeCache = {
  get: jest.fn(),
  set: jest.fn(),
  has: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  ttl: jest.fn(),
};

const MockNodeCache = jest.fn().mockImplementation(() => mockNodeCache);
jest.mock('node-cache', () => MockNodeCache);

// Mock Prometheus metrics
const mockCounter = {
  inc: jest.fn(),
};

const mockGauge = {
  set: jest.fn(),
};

const mockHistogram = {
  observe: jest.fn(),
};

const mockUnifiedRegistry = {};

jest.mock('prom-client', () => ({
  Counter: jest.fn().mockImplementation(() => mockCounter),
  Gauge: jest.fn().mockImplementation(() => mockGauge),
  Histogram: jest.fn().mockImplementation(() => mockHistogram),
}));

jest.mock('../../monitoring/unified', () => ({
  unifiedRegistry: mockUnifiedRegistry,
}));

// Mock ApiError
jest.mock('../../utils/ApiError.enhanced', () => ({
  ApiError: jest.fn().mockImplementation((message, code, statusCode) => {
    const error = new Error(message);
    (error as any).code = code;
    (error as any).statusCode = statusCode;
    Object.setPrototypeOf(error, ApiError.prototype);
    return error;
  }),
}));

describe('Error Tracking Service', () => {
  let errorTrackingService: ErrorTrackingService;
  let mockTimers: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock timers for periodic processing
    mockTimers = jest.spyOn(global, 'setInterval').mockImplementation(() => ({} as any));
    
    // Create service instance
    errorTrackingService = new ErrorTrackingService(mockRedis as any, {
      enableRealTimeAlerts: true,
      enableErrorAggregation: true,
      enablePatternDetection: true,
      alertThresholds: {
        errorRatePerMinute: 5,
        criticalErrorsPerHour: 3,
        uniqueErrorsPerHour: 10,
        errorSpike: {
          threshold: 100,
          timeWindow: 10,
        },
      },
    });
  });

  afterEach(() => {
    mockTimers.mockRestore();
  });

  describe('Service Initialization', () => {
    it('should initialize with default configuration', () => {
      const service = new ErrorTrackingService(mockRedis as any);
      expect(service).toBeInstanceOf(ErrorTrackingService);
      expect(service).toBeInstanceOf(EventEmitter);
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        alertThresholds: {
          errorRatePerMinute: 20,
          criticalErrorsPerHour: 10,
          uniqueErrorsPerHour: 50,
          errorSpike: {
            threshold: 300,
            timeWindow: 30,
          },
        },
      };

      const service = new ErrorTrackingService(mockRedis as any, customConfig);
      expect(service).toBeInstanceOf(ErrorTrackingService);
    });

    it('should initialize Prometheus metrics', () => {
      expect(require('prom-client').Counter).toHaveBeenCalledTimes(2);
      expect(require('prom-client').Gauge).toHaveBeenCalledTimes(3);
      expect(require('prom-client').Histogram).toHaveBeenCalledTimes(1);
    });

    it('should setup periodic processing timers', () => {
      expect(mockTimers).toHaveBeenCalledTimes(2);
    });
  });

  describe('trackError', () => {
    const mockError = new Error('Test error message');
    const mockApiError = new (ApiError as any)('API error message', 'TEST_ERROR', 400);
    const mockContext = {
      userId: 'user-123',
      requestId: 'req-456',
      action: 'test-action',
      resource: 'test-resource',
      metadata: {
        userAgent: 'Test Agent',
        ip: '127.0.0.1',
      },
    };

    beforeEach(() => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.hincrby.mockResolvedValue(1);
      mockRedis.hset.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);
    });

    it('should successfully track a basic error', async () => {
      const errorId = await errorTrackingService.trackError(mockError);

      expect(errorId).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'Error', // code
          'Test error message', // message
          500, // statusCode
          'system', // category
          'high', // severity
          null, // context
          null, // details
          expect.any(String), // fingerprint
          expect.any(Date), // timestamp
          undefined, // userId
          undefined, // requestId
          undefined, // userAgent
          undefined, // ip
          expect.any(String), // stack
          undefined, // originalError
          false, // resolved
        ])
      );
    });

    it('should successfully track an API error with context', async () => {
      const errorId = await errorTrackingService.trackError(mockApiError, mockContext);

      expect(errorId).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_logs'),
        expect.arrayContaining([
          expect.any(String), // id
          'TEST_ERROR', // code
          'API error message', // message
          400, // statusCode
          'validation', // category (inferred from TEST_ERROR code)
          'medium', // severity
          JSON.stringify(mockContext), // context
          null, // details
          expect.any(String), // fingerprint
          expect.any(Date), // timestamp
          'user-123', // userId
          'req-456', // requestId
          'Test Agent', // userAgent
          '127.0.0.1', // ip
          expect.any(String), // stack
          undefined, // originalError
          false, // resolved
        ])
      );
    });

    it('should track error with additional data', async () => {
      const additionalData = { customField: 'customValue', debugInfo: { step: 1 } };
      
      const errorId = await errorTrackingService.trackError(mockError, mockContext, additionalData);

      expect(errorId).toBeTruthy();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_logs'),
        expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(Number),
          expect.any(String),
          expect.any(String),
          JSON.stringify(mockContext),
          JSON.stringify(additionalData),
          expect.any(String),
          expect.any(Date),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(Boolean),
        ])
      );
    });

    it('should store error in Redis cache', async () => {
      await errorTrackingService.trackError(mockError);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^error_entry:/),
        86400,
        expect.any(String)
      );
    });

    it('should update error pattern in Redis', async () => {
      await errorTrackingService.trackError(mockError);

      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        expect.stringMatching(/^error_pattern:/),
        'count',
        1
      );
      expect(mockRedis.hset).toHaveBeenCalledWith(
        expect.stringMatching(/^error_pattern:/),
        'last_seen',
        expect.any(String)
      );
    });

    it('should update Prometheus metrics', async () => {
      await errorTrackingService.trackError(mockError);

      expect(mockCounter.inc).toHaveBeenCalledWith({
        category: 'system',
        severity: 'high',
        code: 'Error',
      });
      expect(mockGauge.set).toHaveBeenCalledWith(75); // severity score for 'high'
    });

    it('should emit errorTracked event', async () => {
      const eventSpy = jest.spyOn(errorTrackingService, 'emit');
      
      await errorTrackingService.trackError(mockError);

      expect(eventSpy).toHaveBeenCalledWith('errorTracked', expect.objectContaining({
        code: 'Error',
        message: 'Test error message',
        category: 'system',
        severity: 'high',
      }));
    });

    it('should handle tracking errors gracefully', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Database error'));

      const errorId = await errorTrackingService.trackError(mockError);

      expect(errorId).toBe('');
      expect(mockLogger.error).toHaveBeenCalledWith('Error tracking failed', expect.any(Object));
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedis.setex.mockRejectedValueOnce(new Error('Redis error'));

      const errorId = await errorTrackingService.trackError(mockError);

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to store error entry', expect.any(Object));
    });
  });

  describe('Error Categorization', () => {
    it('should categorize authentication errors correctly', async () => {
      const authError = new (ApiError as any)('Unauthorized', 'AUTH_INVALID_TOKEN', 401);
      
      await errorTrackingService.trackError(authError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'AUTH_INVALID_TOKEN',
          expect.any(String),
          401,
          'authentication',
          'high',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should categorize validation errors correctly', async () => {
      const validationError = new (ApiError as any)('Invalid input', 'VALIDATION_FAILED', 422);
      
      await errorTrackingService.trackError(validationError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'VALIDATION_FAILED',
          expect.any(String),
          422,
          'validation',
          'medium',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should categorize permission errors correctly', async () => {
      const permissionError = new (ApiError as any)('Forbidden', 'PERMISSION_DENIED', 403);
      
      await errorTrackingService.trackError(permissionError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'PERMISSION_DENIED',
          expect.any(String),
          403,
          'permission',
          'high',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should categorize business errors correctly', async () => {
      const businessError = new (ApiError as any)('Invalid operation', 'BUSINESS_RULE_VIOLATION', 409);
      
      await errorTrackingService.trackError(businessError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'BUSINESS_RULE_VIOLATION',
          expect.any(String),
          409,
          'business',
          'medium',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should categorize external service errors correctly', async () => {
      const externalError = new (ApiError as any)('Service unavailable', 'EXTERNAL_SERVICE_ERROR', 503);
      
      await errorTrackingService.trackError(externalError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'EXTERNAL_SERVICE_ERROR',
          expect.any(String),
          503,
          'external',
          'critical',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should categorize system errors correctly', async () => {
      const systemError = new (ApiError as any)('Internal server error', 'SYSTEM_ERROR', 500);
      
      await errorTrackingService.trackError(systemError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'SYSTEM_ERROR',
          expect.any(String),
          500,
          'system',
          'critical',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });

    it('should fallback to message-based categorization for non-API errors', async () => {
      const notFoundError = new Error('Resource not found');
      
      await errorTrackingService.trackError(notFoundError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining([
          expect.any(String),
          'Error',
          'Resource not found',
          500,
          'business', // inferred from 'not found' in message
          'high',
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.anything(),
        ])
      );
    });
  });

  describe('Error Pattern Detection', () => {
    beforeEach(() => {
      mockNodeCache.get.mockReturnValue(null);
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
    });

    it('should create new error pattern for first occurrence', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [] }) // SELECT error_patterns (not found)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT error_patterns

      await errorTrackingService.trackError(new Error('New error'));

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM error_patterns WHERE fingerprint'),
        expect.any(Array)
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_patterns'),
        expect.any(Array)
      );
    });

    it('should update existing error pattern', async () => {
      const existingPattern = {
        id: 'pattern-123',
        fingerprint: 'test-fingerprint',
        category: 'system',
        severity: 'high',
        occurrences: 1,
        affected_users: 0,
        first_seen: new Date(),
        last_seen: new Date(),
        trend: 'stable',
        trend_percent: 0,
        related_patterns: '[]',
        suggested_actions: '[]',
        resolved: false,
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [existingPattern] }) // SELECT error_patterns (found)
        .mockResolvedValueOnce({ rows: [] }) // UPDATE pattern trend query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE error_patterns

      await errorTrackingService.trackError(new Error('Existing error'));

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_patterns'),
        expect.arrayContaining([
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          expect.stringContaining('System Error: Error'),
          expect.any(String),
          2, // incremented occurrences
          expect.any(Number),
          expect.any(Date),
          expect.any(Date),
          expect.any(String),
          expect.any(Number),
          expect.any(String),
          expect.any(String),
          false,
        ])
      );
    });

    it('should cache error patterns for performance', async () => {
      const cachedPattern = {
        id: 'pattern-cached',
        fingerprint: 'cached-fingerprint',
        category: 'system',
        severity: 'medium',
        title: 'Cached Pattern',
        description: 'A cached error pattern',
        occurrences: 5,
        affectedUsers: 2,
        firstSeen: new Date(),
        lastSeen: new Date(),
        trend: 'stable',
        trendPercent: 5,
        relatedPatterns: [],
        suggestedActions: ['Check logs'],
        resolved: false,
      };

      mockNodeCache.get.mockReturnValue(cachedPattern);
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [] }) // UPDATE pattern trend query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // UPDATE error_patterns

      await errorTrackingService.trackError(new Error('Cached error'));

      // Should not query database for pattern if found in cache
      expect(mockPool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM error_patterns WHERE fingerprint'),
        expect.any(Array)
      );
    });

    it('should handle pattern detection errors gracefully', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockRejectedValueOnce(new Error('Pattern query failed'));

      await errorTrackingService.trackError(new Error('Pattern error'));

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to detect error patterns', expect.any(Object));
    });
  });

  describe('Alert Generation', () => {
    beforeEach(() => {
      mockNodeCache.has.mockReturnValue(false); // No throttling
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 });
    });

    it('should generate alert for high error rate', async () => {
      // Mock error rate calculation
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Error rate query

      await errorTrackingService.trackError(new Error('Rate test error'));

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_alerts'),
        expect.arrayContaining([
          expect.any(String), // id
          'error_rate', // type
          'warning', // severity
          'High Error Rate Detected', // title
          expect.stringContaining('Error rate has exceeded threshold'), // description
          expect.any(String), // details JSON
          expect.any(Date), // timestamp
          false, // acknowledged
          false, // resolved
          expect.any(String), // channels JSON
          0, // retry_count
        ])
      );
    });

    it('should generate alert for critical errors', async () => {
      const criticalError = new (ApiError as any)('Critical system failure', 'SYSTEM_CRITICAL', 500);
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Error rate query (below threshold)
        .mockResolvedValueOnce({ rows: [{ count: '5' }] }); // Critical errors query

      await errorTrackingService.trackError(criticalError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_alerts'),
        expect.arrayContaining([
          expect.any(String),
          'critical_error',
          'critical',
          'Multiple Critical Errors Detected',
          expect.stringContaining('5 critical errors in the last hour'),
          expect.any(String),
          expect.any(Date),
          false,
          false,
          expect.any(String),
          0,
        ])
      );
    });

    it('should generate alert for error spikes', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Error rate query (below threshold)
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // Critical errors query (below threshold)
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Current error count
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }); // Previous error count

      await errorTrackingService.trackError(new Error('Spike test error'));

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_alerts'),
        expect.arrayContaining([
          expect.any(String),
          'error_spike',
          'critical',
          'Error Spike Detected',
          expect.stringContaining('Error count increased by'),
          expect.any(String),
          expect.any(Date),
          false,
          false,
          expect.any(String),
          0,
        ])
      );
    });

    it('should generate alert for new critical patterns', async () => {
      const criticalError = new (ApiError as any)('New critical issue', 'SYSTEM_NEW_CRITICAL', 500);
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [] }) // SELECT error_patterns (not found)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_patterns
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT error_alerts

      await errorTrackingService.trackError(criticalError);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_alerts'),
        expect.arrayContaining([
          expect.any(String),
          'new_pattern',
          'critical',
          'New Critical Error Pattern Detected',
          expect.stringContaining('A new critical error pattern has been detected'),
          expect.any(String),
          expect.any(Date),
          false,
          false,
          expect.any(String),
          0,
        ])
      );
    });

    it('should respect alert throttling', async () => {
      mockNodeCache.has.mockReturnValue(true); // Alert is throttled
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Error rate query (above threshold)

      await errorTrackingService.trackError(new Error('Throttled error'));

      // Should not insert alert due to throttling
      expect(mockPool.query).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_alerts'),
        expect.any(Array)
      );
    });

    it('should emit alertGenerated event', async () => {
      const eventSpy = jest.spyOn(errorTrackingService, 'emit');
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Error rate query

      await errorTrackingService.trackError(new Error('Alert event test'));

      expect(eventSpy).toHaveBeenCalledWith('alertGenerated', expect.objectContaining({
        type: 'error_rate',
        severity: 'warning',
        title: 'High Error Rate Detected',
      }));
    });

    it('should update alert metrics', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }); // Error rate query

      await errorTrackingService.trackError(new Error('Metrics test error'));

      expect(mockCounter.inc).toHaveBeenCalledWith({
        type: 'error_rate',
        severity: 'warning',
      });
    });

    it('should handle alert generation errors gracefully', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // Error rate query
        .mockRejectedValueOnce(new Error('Alert storage failed')); // INSERT error_alerts fails

      await errorTrackingService.trackError(new Error('Alert error test'));

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate alert', expect.any(Object));
    });
  });

  describe('getErrorSummary', () => {
    beforeEach(() => {
      const mockQueryResults = [
        { rows: [{ total: '100' }] }, // Total errors
        { rows: [{ critical: '10' }] }, // Critical errors
        { rows: [{ patterns: '15' }] }, // Unique patterns
        { rows: [{ users: '25' }] }, // Affected users
        { rows: [
          { category: 'system', count: '50' },
          { category: 'validation', count: '30' },
          { category: 'authentication', count: '20' },
        ]}, // Top categories
        { rows: [
          {
            id: 'pattern-1',
            fingerprint: 'fp-1',
            category: 'system',
            severity: 'high',
            title: 'System Error Pattern',
            description: 'Common system error',
            occurrences: 25,
            affected_users: 5,
            first_seen: new Date(),
            last_seen: new Date(),
            trend: 'increasing',
            trend_percent: 15,
            related_patterns: '[]',
            suggested_actions: '["Check logs"]',
            resolved: false,
          },
        ]}, // Top patterns
        { rows: [{ count: '5' }] }, // last15Minutes
        { rows: [{ count: '20' }] }, // last1Hour
        { rows: [{ count: '100' }] }, // last24Hours
        { rows: [{ count: '15' }] }, // prevHour for trend
      ];

      mockPool.query
        .mockResolvedValueOnce(mockQueryResults[0])
        .mockResolvedValueOnce(mockQueryResults[1])
        .mockResolvedValueOnce(mockQueryResults[2])
        .mockResolvedValueOnce(mockQueryResults[3])
        .mockResolvedValueOnce(mockQueryResults[4])
        .mockResolvedValueOnce(mockQueryResults[5])
        .mockResolvedValueOnce(mockQueryResults[6])
        .mockResolvedValueOnce(mockQueryResults[7])
        .mockResolvedValueOnce(mockQueryResults[8])
        .mockResolvedValueOnce(mockQueryResults[9]);
    });

    it('should return comprehensive error summary', async () => {
      const summary = await errorTrackingService.getErrorSummary(3600);

      expect(summary).toEqual({
        totalErrors: 100,
        errorRate: expect.any(Number),
        criticalErrors: 10,
        uniquePatterns: 15,
        affectedUsers: 25,
        topCategories: [
          { category: 'system', count: 50, percentage: 50 },
          { category: 'validation', count: 30, percentage: 30 },
          { category: 'authentication', count: 20, percentage: 20 },
        ],
        topPatterns: expect.arrayContaining([
          expect.objectContaining({
            id: 'pattern-1',
            title: 'System Error Pattern',
            occurrences: 25,
          }),
        ]),
        recentTrends: {
          last15Minutes: 5,
          last1Hour: 20,
          last24Hours: 100,
          trend: 'degrading', // 20 vs 15 is > 20% increase
        },
        serviceHealth: expect.any(String),
      });
    });

    it('should calculate error rate correctly', async () => {
      const summary = await errorTrackingService.getErrorSummary(3600);
      
      expect(summary.errorRate).toBeCloseTo(100 / 60, 2); // 100 errors / 60 minutes
    });

    it('should determine service health correctly', async () => {
      const summary = await errorTrackingService.getErrorSummary(3600);
      
      // With 100 errors, 10 critical, and high error rate, health should be poor/critical
      expect(['poor', 'critical']).toContain(summary.serviceHealth);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const summary = await errorTrackingService.getErrorSummary(3600);

      expect(summary).toEqual({
        totalErrors: 0,
        errorRate: 0,
        criticalErrors: 0,
        uniquePatterns: 0,
        affectedUsers: 0,
        topCategories: [],
        topPatterns: [],
        recentTrends: {
          last15Minutes: 0,
          last1Hour: 0,
          last24Hours: 0,
          trend: 'stable',
        },
        serviceHealth: 'fair',
      });

      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get error summary', expect.any(Object));
    });

    it('should use custom time range', async () => {
      await errorTrackingService.getErrorSummary(7200); // 2 hours

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE timestamp >'),
        [expect.any(Date)]
      );
    });
  });

  describe('Alert Management', () => {
    it('should acknowledge alert successfully', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await errorTrackingService.acknowledgeAlert('alert-123', 'user-456');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE error_alerts SET acknowledged = true'),
        ['alert-123', 'user-456']
      );
    });

    it('should return false when alert not found for acknowledgment', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await errorTrackingService.acknowledgeAlert('nonexistent-alert', 'user-456');

      expect(result).toBe(false);
    });

    it('should resolve alert successfully', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 1 });

      const result = await errorTrackingService.resolveAlert('alert-123', 'user-456');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE error_alerts SET resolved = true'),
        ['alert-123', 'user-456']
      );
    });

    it('should return false when alert not found for resolution', async () => {
      mockPool.query.mockResolvedValue({ rowCount: 0 });

      const result = await errorTrackingService.resolveAlert('nonexistent-alert', 'user-456');

      expect(result).toBe(false);
    });

    it('should handle alert management errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const result = await errorTrackingService.acknowledgeAlert('alert-123', 'user-456');

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to acknowledge alert', expect.any(Object));
    });
  });

  describe('getActiveAlerts', () => {
    it('should return active alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          type: 'error_rate',
          severity: 'warning',
          title: 'High Error Rate',
          description: 'Error rate exceeded threshold',
          details: '{"errorRate": 15}',
          timestamp: new Date(),
          acknowledged: false,
          acknowledged_at: null,
          acknowledged_by: null,
          resolved: false,
          resolved_at: null,
          resolved_by: null,
          channels: '["email"]',
          retry_count: 0,
          last_retry: null,
        },
      ];

      mockPool.query.mockResolvedValue({ rows: mockAlerts });

      const alerts = await errorTrackingService.getActiveAlerts();

      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toEqual({
        id: 'alert-1',
        type: 'error_rate',
        severity: 'warning',
        title: 'High Error Rate',
        description: 'Error rate exceeded threshold',
        details: { errorRate: 15 },
        timestamp: expect.any(Date),
        acknowledged: false,
        acknowledgedAt: null,
        acknowledgedBy: null,
        resolved: false,
        resolvedAt: null,
        resolvedBy: null,
        channels: ['email'],
        retryCount: 0,
        lastRetry: null,
      });
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const alerts = await errorTrackingService.getActiveAlerts();

      expect(alerts).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get active alerts', expect.any(Object));
    });
  });

  describe('Service Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      const removeListenersSpy = jest.spyOn(errorTrackingService, 'removeAllListeners');
      
      await errorTrackingService.shutdown();

      expect(removeListenersSpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Shutting down error tracking service');
    });
  });

  describe('Error Fingerprinting', () => {
    it('should generate consistent fingerprints for similar errors', async () => {
      const error1 = new Error('Database connection failed');
      const error2 = new Error('Database connection failed');
      const context = { action: 'connect', resource: 'database' };

      await errorTrackingService.trackError(error1, context);
      await errorTrackingService.trackError(error2, context);

      // Both calls should use the same fingerprint (based on INSERT queries)
      const calls = mockPool.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO error_logs')
      );
      
      expect(calls).toHaveLength(2);
      expect(calls[0][1][8]).toBe(calls[1][1][8]); // fingerprint should be same
    });

    it('should generate different fingerprints for different errors', async () => {
      const error1 = new Error('Database connection failed');
      const error2 = new Error('File not found');

      await errorTrackingService.trackError(error1);
      await errorTrackingService.trackError(error2);

      const calls = mockPool.query.mock.calls.filter(call => 
        call[0].includes('INSERT INTO error_logs')
      );
      
      expect(calls).toHaveLength(2);
      expect(calls[0][1][8]).not.toBe(calls[1][1][8]); // fingerprints should be different
    });
  });

  describe('Suggested Actions Generation', () => {
    it('should generate appropriate actions for authentication errors', async () => {
      const authError = new (ApiError as any)('Token expired', 'AUTH_TOKEN_EXPIRED', 401);
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [] }) // SELECT error_patterns (not found)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT error_patterns

      await errorTrackingService.trackError(authError);

      const insertPatternsCall = mockPool.query.mock.calls.find(call => 
        call[0].includes('INSERT INTO error_patterns')
      );
      
      expect(insertPatternsCall).toBeTruthy();
      const suggestedActions = JSON.parse(insertPatternsCall[1][13]);
      expect(suggestedActions).toContain('Check authentication flow and token validation');
      expect(suggestedActions).toContain('Review session management configuration');
    });

    it('should prioritize critical error actions', async () => {
      const criticalError = new (ApiError as any)('System failure', 'SYSTEM_CRITICAL_FAILURE', 500);
      
      mockPool.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // INSERT error_logs
        .mockResolvedValueOnce({ rows: [] }) // SELECT error_patterns (not found)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // INSERT error_patterns

      await errorTrackingService.trackError(criticalError);

      const insertPatternsCall = mockPool.query.mock.calls.find(call => 
        call[0].includes('INSERT INTO error_patterns')
      );
      
      const suggestedActions = JSON.parse(insertPatternsCall[1][13]);
      expect(suggestedActions[0]).toBe('Immediate investigation required');
    });
  });
});