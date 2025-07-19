/**
 * Production-safe logger for A/B Testing
 * Only logs in development, sends to monitoring in production
 */

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, error?: unknown) => void;
}

export class ProductionLogger implements Logger {
  private isDevelopment = import.meta.env.DEV;
  private prefix = '[AB Testing]';

  debug(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.debug(`${this.prefix} ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.info(`${this.prefix} ${message}`, ...args);
    }
  }

  warn(message: string, ...args: unknown[]): void {
    if (this.isDevelopment) {
      console.warn(`${this.prefix} ${message}`, ...args);
    } else {
      // In production, send warnings to monitoring
      this.sendToMonitoring('warning', message, args);
    }
  }

  error(message: string, error?: unknown): void {
    // Always log errors, but in production send to monitoring service
    if (this.isDevelopment) {
      console.error(`${this.prefix} ${message}`, error);
    } else {
      // Send to error monitoring service (e.g., Sentry)
      this.sendToMonitoring('error', message, error);
    }
  }

  private sendToMonitoring(level: 'warning' | 'error', message: string, data?: unknown): void {
    // Integration with monitoring service
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'exception', {
        description: `${level}: ${message}`,
        fatal: level === 'error',
        error_data: JSON.stringify(data),
      });
    }

    // You can also integrate with Sentry or other monitoring services here
    // Example:
    // if (window.Sentry) {
    //   if (level === 'error') {
    //     window.Sentry.captureException(new Error(message), {
    //       extra: { data },
    //     });
    //   } else {
    //     window.Sentry.captureMessage(message, 'warning');
    //   }
    // }
  }
}

// Export singleton instance
export const logger = new ProductionLogger();
