import { MLServiceCircuitBreaker } from '../circuitBreaker';
import CircuitBreaker from 'opossum';
import axios from 'axios';
import { logger } from '../../utils/logger';

// Mock dependencies
jest.mock('axios');
jest.mock('../../utils/logger');

describe('MLServiceCircuitBreaker', () => {
  let circuitBreaker: MLServiceCircuitBreaker;
  let mockSocketService: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSocketService = {
      emit: jest.fn(),
    };

    circuitBreaker = new MLServiceCircuitBreaker('http://ml:5002', mockSocketService);
  });

  afterEach(() => {
    circuitBreaker.shutdown();
  });

  describe('segmentImage', () => {
    it('should successfully segment image when ML service is healthy', async () => {
      const mockResponse = {
        data: {
          success: true,
          results: {
            polygons: [{ points: [[0, 0], [10, 0], [10, 10], [0, 10]] }],
            features: { area: 100, perimeter: 40 },
          },
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await circuitBreaker.segmentImage('/path/to/image.jpg', 'task-123');

      expect(axios.post).toHaveBeenCalledWith(
        'http://ml:5002/segment',
        { image_path: '/path/to/image.jpg' },
        { timeout: 300000, headers: { 'Content-Type': 'application/json' } }
      );
      expect(result).toEqual(mockResponse.data.results);
    });

    it('should throw error when ML service returns failure', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid image format',
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      await expect(circuitBreaker.segmentImage('/path/to/image.jpg', 'task-123'))
        .rejects.toThrow('ML processing failed: Invalid image format');
    });

    it('should open circuit after consecutive failures', async () => {
      const error = new Error('Connection refused');
      (axios.post as jest.Mock).mockRejectedValue(error);

      // Trigger failures to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.segmentImage('/path/to/image.jpg', `task-${i}`);
        } catch (e) {
          // Expected to fail
        }
      }

      // Circuit should be open now
      await expect(circuitBreaker.segmentImage('/path/to/image.jpg', 'task-final'))
        .rejects.toThrow('Breaker is OPEN');

      expect(logger.error).toHaveBeenCalledWith('Circuit breaker opened for ML service');
      expect(mockSocketService.emit).toHaveBeenCalledWith('ml-service-status', {
        status: 'unavailable',
        circuitOpen: true,
      });
    });

    it('should emit event when circuit closes', async () => {
      // Force circuit to close
      const breaker = (circuitBreaker as any).breaker as CircuitBreaker;
      breaker.emit('close');

      expect(logger.info).toHaveBeenCalledWith('Circuit breaker closed for ML service');
      expect(mockSocketService.emit).toHaveBeenCalledWith('ml-service-status', {
        status: 'available',
        circuitOpen: false,
      });
    });
  });

  describe('extractFeatures', () => {
    it('should successfully extract features', async () => {
      const mockPolygons = [{ points: [[0, 0], [10, 0], [10, 10], [0, 10]] }];
      const mockResponse = {
        data: {
          success: true,
          features: { area: 100, perimeter: 40, circularity: 0.8 },
        },
      };

      (axios.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await circuitBreaker.extractFeatures(mockPolygons, 'task-123');

      expect(axios.post).toHaveBeenCalledWith(
        'http://ml:5002/extract_features',
        { polygons: mockPolygons },
        { timeout: 60000, headers: { 'Content-Type': 'application/json' } }
      );
      expect(result).toEqual(mockResponse.data.features);
    });
  });

  describe('checkHealth', () => {
    it('should return healthy status', async () => {
      const mockResponse = {
        data: { status: 'healthy', model_loaded: true },
      };

      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await circuitBreaker.checkHealth();

      expect(axios.get).toHaveBeenCalledWith(
        'http://ml:5002/health',
        { timeout: 5000 }
      );
      expect(result).toEqual(mockResponse.data);
    });

    it('should not use circuit breaker for health checks', async () => {
      // Open the circuit by failing segmentation
      const error = new Error('Connection refused');
      (axios.post as jest.Mock).mockRejectedValue(error);

      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.segmentImage('/path/to/image.jpg', `task-${i}`);
        } catch (e) {
          // Expected to fail
        }
      }

      // Health check should still work even with open circuit
      const mockResponse = {
        data: { status: 'degraded', model_loaded: true },
      };
      (axios.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await circuitBreaker.checkHealth();
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('getStats', () => {
    it('should return circuit breaker statistics', () => {
      const stats = circuitBreaker.getStats();

      expect(stats).toMatchObject({
        state: expect.any(String),
        enabled: expect.any(Boolean),
        stats: expect.objectContaining({
          fires: expect.any(Number),
          failures: expect.any(Number),
          successes: expect.any(Number),
          timeouts: expect.any(Number),
          fallbacks: expect.any(Number),
          rejects: expect.any(Number),
        }),
      });
    });
  });

  describe('circuit breaker events', () => {
    it('should handle timeout events', async () => {
      (axios.post as jest.Mock).mockImplementation(() => {
        return new Promise((resolve) => {
          // Never resolve to simulate timeout
        });
      });

      // Create a new instance with short timeout for this test
      const shortTimeoutBreaker = new MLServiceCircuitBreaker('http://ml:5002', mockSocketService, {
        timeout: 100,
      });

      await expect(shortTimeoutBreaker.segmentImage('/path/to/image.jpg', 'task-123'))
        .rejects.toThrow();
      
      shortTimeoutBreaker.shutdown();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('ML service request timed out')
      );
    });

    it('should log fallback events', () => {
      const breaker = (circuitBreaker as any).breaker as CircuitBreaker;
      breaker.emit('fallback', { image_path: '/test.jpg' });

      expect(logger.info).toHaveBeenCalledWith(
        'Circuit breaker fallback triggered',
        { image_path: '/test.jpg' }
      );
    });

    it('should handle half-open state', () => {
      const breaker = (circuitBreaker as any).breaker as CircuitBreaker;
      breaker.emit('halfOpen');

      expect(logger.info).toHaveBeenCalledWith('Circuit breaker is half-open, testing ML service');
    });
  });

  describe('shutdown', () => {
    it('should shut down the circuit breaker', () => {
      const breaker = (circuitBreaker as any).breaker as CircuitBreaker;
      const shutdownSpy = jest.spyOn(breaker, 'shutdown');

      circuitBreaker.shutdown();

      expect(shutdownSpy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('ML service circuit breaker shut down');
    });
  });
});