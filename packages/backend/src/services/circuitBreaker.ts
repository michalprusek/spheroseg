import CircuitBreaker from 'opossum';
import axios, { AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

interface SegmentationResponse {
  success: boolean;
  results?: {
    polygons: any[];
    features: any;
  };
  error?: string;
}

interface FeatureExtractionResponse {
  success: boolean;
  features?: any;
  error?: string;
}

interface HealthResponse {
  status: string;
  model_loaded: boolean;
  [key: string]: any;
}

interface CircuitBreakerOptions {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  rollingCountTimeout?: number;
  rollingCountBuckets?: number;
}

export class MLServiceCircuitBreaker {
  private breaker: CircuitBreaker;
  private mlServiceUrl: string;
  private socketService: any;

  constructor(
    mlServiceUrl: string,
    socketService: any,
    options: CircuitBreakerOptions = {}
  ) {
    this.mlServiceUrl = mlServiceUrl;
    this.socketService = socketService;

    // Create circuit breaker with default options
    const breakerOptions = {
      timeout: options.timeout || 300000, // 5 minutes default for ML processing
      errorThresholdPercentage: options.errorThresholdPercentage || 50,
      resetTimeout: options.resetTimeout || 60000, // 1 minute
      rollingCountTimeout: options.rollingCountTimeout || 60000,
      rollingCountBuckets: options.rollingCountBuckets || 10,
      name: 'ml-service',
    };

    this.breaker = new CircuitBreaker(this.makeMLRequest.bind(this), breakerOptions);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.breaker.on('open', () => {
      logger.error('Circuit breaker opened for ML service');
      this.socketService.emit('ml-service-status', {
        status: 'unavailable',
        circuitOpen: true,
      });
    });

    this.breaker.on('close', () => {
      logger.info('Circuit breaker closed for ML service');
      this.socketService.emit('ml-service-status', {
        status: 'available',
        circuitOpen: false,
      });
    });

    this.breaker.on('halfOpen', () => {
      logger.info('Circuit breaker is half-open, testing ML service');
    });

    this.breaker.on('timeout', (data: any) => {
      logger.warn('ML service request timed out', data);
    });

    this.breaker.on('reject', (data: any) => {
      logger.warn('ML service request rejected by circuit breaker', data);
    });

    this.breaker.on('fallback', (data: any) => {
      logger.info('Circuit breaker fallback triggered', data);
    });

    this.breaker.on('failure', (error: Error) => {
      logger.error('ML service request failed', error);
    });

    this.breaker.on('success', (result: any) => {
      logger.debug('ML service request succeeded');
    });
  }

  private async makeMLRequest(params: {
    method: 'GET' | 'POST';
    path: string;
    data?: any;
    timeout?: number;
  }): Promise<any> {
    const { method, path, data, timeout } = params;
    const url = `${this.mlServiceUrl}${path}`;

    try {
      let response: AxiosResponse;

      if (method === 'GET') {
        response = await axios.get(url, { timeout: timeout || 5000 });
      } else {
        response = await axios.post(url, data, {
          timeout: timeout || this.breaker.options.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        });
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('ML service is unavailable');
        }
        if (error.response) {
          throw new Error(`ML service error: ${error.response.data.error || error.message}`);
        }
      }
      throw error;
    }
  }

  async segmentImage(imagePath: string, taskId: string): Promise<any> {
    try {
      const response: SegmentationResponse = await this.breaker.fire({
        method: 'POST',
        path: '/segment',
        data: { image_path: imagePath },
        timeout: 300000, // 5 minutes for segmentation
      });

      if (!response.success) {
        throw new Error(`ML processing failed: ${response.error}`);
      }

      return response.results;
    } catch (error) {
      logger.error(`Segmentation failed for task ${taskId}:`, error);
      throw error;
    }
  }

  async extractFeatures(polygons: any[], taskId: string): Promise<any> {
    try {
      const response: FeatureExtractionResponse = await this.breaker.fire({
        method: 'POST',
        path: '/extract_features',
        data: { polygons },
        timeout: 60000, // 1 minute for feature extraction
      });

      if (!response.success) {
        throw new Error(`Feature extraction failed: ${response.error}`);
      }

      return response.features;
    } catch (error) {
      logger.error(`Feature extraction failed for task ${taskId}:`, error);
      throw error;
    }
  }

  async checkHealth(): Promise<HealthResponse> {
    // Health checks bypass the circuit breaker
    try {
      const response = await axios.get(`${this.mlServiceUrl}/health`, {
        timeout: 5000,
      });
      return response.data;
    } catch (error) {
      logger.error('ML service health check failed:', error);
      throw error;
    }
  }

  getStats() {
    return {
      state: this.breaker.opened ? 'OPEN' : this.breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED',
      enabled: this.breaker.enabled,
      stats: {
        fires: this.breaker.stats.fires,
        failures: this.breaker.stats.failures,
        successes: this.breaker.stats.successes,
        timeouts: this.breaker.stats.timeouts,
        fallbacks: this.breaker.stats.fallbacks,
        rejects: this.breaker.stats.rejects,
        latencyMean: this.breaker.stats.latencyMean,
        percentiles: this.breaker.stats.percentiles,
      },
    };
  }

  shutdown(): void {
    this.breaker.shutdown();
    logger.info('ML service circuit breaker shut down');
  }
}