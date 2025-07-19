/**
 * Error Monitoring Service
 * 
 * Collects and reports errors to a monitoring endpoint for tracking and analysis
 */

import { ErrorInfo } from '@/utils/error/unifiedErrorHandler';
import { apiClient } from '@/services/api/client';
import logger from '@/utils/logger';

interface ErrorReport {
  timestamp: string;
  error: ErrorInfo;
  userAgent: string;
  url: string;
  userId?: string;
  sessionId: string;
  environment: string;
  release?: string;
  browserInfo: {
    name: string;
    version: string;
    os: string;
  };
}

interface ErrorBatch {
  errors: ErrorReport[];
  lastSent: number;
}

class ErrorMonitoringService {
  private errorBatch: ErrorBatch = {
    errors: [],
    lastSent: Date.now(),
  };
  
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_INTERVAL = 30000; // 30 seconds
  private readonly MAX_QUEUE_SIZE = 50;
  private batchTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private isEnabled: boolean;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.isEnabled = this.shouldEnableMonitoring();
    
    if (this.isEnabled) {
      this.startBatchTimer();
      
      // Send any queued errors when the page is about to unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  /**
   * Report an error to the monitoring service
   */
  public reportError(errorInfo: ErrorInfo): void {
    if (!this.isEnabled) {
      return;
    }

    const errorReport: ErrorReport = {
      timestamp: errorInfo.timestamp,
      error: errorInfo,
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
      sessionId: this.sessionId,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_APP_VERSION,
      browserInfo: this.getBrowserInfo(),
    };

    // Add to batch
    this.errorBatch.errors.push(errorReport);

    // Trim queue if it gets too large
    if (this.errorBatch.errors.length > this.MAX_QUEUE_SIZE) {
      this.errorBatch.errors = this.errorBatch.errors.slice(-this.MAX_QUEUE_SIZE);
    }

    // Send immediately if batch is full
    if (this.errorBatch.errors.length >= this.BATCH_SIZE) {
      this.sendBatch();
    }
  }

  /**
   * Send the current batch of errors
   */
  private async sendBatch(): Promise<void> {
    if (this.errorBatch.errors.length === 0) {
      return;
    }

    const errorsToSend = [...this.errorBatch.errors];
    this.errorBatch.errors = [];
    this.errorBatch.lastSent = Date.now();

    try {
      await apiClient.post('/monitoring/errors', {
        errors: errorsToSend,
      }, {
        skipAuth: false, // Include auth if available
        showErrorToast: false, // Don't show errors for monitoring calls
      });
      
      logger.debug(`Sent ${errorsToSend.length} error reports to monitoring service`);
    } catch (error) {
      // Don't report errors about error reporting to avoid infinite loops
      logger.warn('Failed to send error reports to monitoring service', { error });
      
      // Put the errors back in the queue if there's room
      const remainingSpace = this.MAX_QUEUE_SIZE - this.errorBatch.errors.length;
      if (remainingSpace > 0) {
        this.errorBatch.errors = [
          ...errorsToSend.slice(0, remainingSpace),
          ...this.errorBatch.errors,
        ];
      }
    }
  }

  /**
   * Flush any pending errors immediately
   */
  public flush(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
    }
    this.sendBatch();
  }

  /**
   * Start the batch timer
   */
  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      if (this.errorBatch.errors.length > 0) {
        this.sendBatch();
      }
    }, this.BATCH_INTERVAL);
  }

  /**
   * Determine if error monitoring should be enabled
   */
  private shouldEnableMonitoring(): boolean {
    // Enable in production and staging, disable in development unless explicitly enabled
    const env = import.meta.env.MODE;
    const explicitlyEnabled = import.meta.env.VITE_ENABLE_ERROR_MONITORING === 'true';
    
    return env === 'production' || env === 'staging' || explicitlyEnabled;
  }

  /**
   * Generate a unique session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get the current user ID if available
   */
  private getUserId(): string | undefined {
    // Try to get user ID from auth service or local storage
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user.id;
    } catch {
      return undefined;
    }
  }

  /**
   * Get browser information
   */
  private getBrowserInfo(): { name: string; version: string; os: string } {
    const ua = navigator.userAgent;
    let browserName = 'Unknown';
    let browserVersion = 'Unknown';
    let osName = 'Unknown';

    // Detect browser
    if (ua.includes('Chrome')) {
      browserName = 'Chrome';
      browserVersion = ua.match(/Chrome\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Firefox')) {
      browserName = 'Firefox';
      browserVersion = ua.match(/Firefox\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Safari')) {
      browserName = 'Safari';
      browserVersion = ua.match(/Version\/(\d+)/)?.[1] || 'Unknown';
    } else if (ua.includes('Edge')) {
      browserName = 'Edge';
      browserVersion = ua.match(/Edge\/(\d+)/)?.[1] || 'Unknown';
    }

    // Detect OS
    if (ua.includes('Windows')) {
      osName = 'Windows';
    } else if (ua.includes('Mac')) {
      osName = 'macOS';
    } else if (ua.includes('Linux')) {
      osName = 'Linux';
    } else if (ua.includes('Android')) {
      osName = 'Android';
    } else if (ua.includes('iOS')) {
      osName = 'iOS';
    }

    return {
      name: browserName,
      version: browserVersion,
      os: osName,
    };
  }

  /**
   * Get error statistics
   */
  public getStats(): { 
    queuedErrors: number; 
    sessionId: string; 
    isEnabled: boolean;
    lastSent: Date;
  } {
    return {
      queuedErrors: this.errorBatch.errors.length,
      sessionId: this.sessionId,
      isEnabled: this.isEnabled,
      lastSent: new Date(this.errorBatch.lastSent),
    };
  }
}

// Create and export singleton instance
export const errorMonitoringService = new ErrorMonitoringService();

// Export for testing
export { ErrorMonitoringService };