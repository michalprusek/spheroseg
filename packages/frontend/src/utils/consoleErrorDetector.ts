/**
 * Console Error Detector
 * 
 * Monitors console errors and warnings for debugging and reporting
 */

import { getLogger } from '@/utils/logging/unifiedLogger';

const logger = getLogger('consoleErrorDetector');

interface ConsoleMessage {
  type: 'error' | 'warn' | 'log';
  message: string;
  timestamp: Date;
  stack?: string;
  source?: string;
}

class ConsoleErrorDetector {
  private messages: ConsoleMessage[] = [];
  private originalConsole = {
    error: console.error,
    warn: console.warn,
    log: console.log,
  };
  
  constructor() {
    this.interceptConsole();
  }
  
  private interceptConsole() {
    // Intercept console.error
    console.error = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      const error = new Error();
      const stack = error.stack;
      
      this.messages.push({
        type: 'error',
        message,
        timestamp: new Date(),
        stack,
      });
      
      // Log to our logger
      logger.error('Console error detected:', { message, stack });
      
      // Call original console.error
      this.originalConsole.error.apply(console, args);
    };
    
    // Intercept console.warn
    console.warn = (...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      
      this.messages.push({
        type: 'warn',
        message,
        timestamp: new Date(),
      });
      
      // Log to our logger
      logger.warn('Console warning detected:', { message });
      
      // Call original console.warn
      this.originalConsole.warn.apply(console, args);
    };
  }
  
  public getMessages(type?: 'error' | 'warn' | 'log'): ConsoleMessage[] {
    if (type) {
      return this.messages.filter(msg => msg.type === type);
    }
    return [...this.messages];
  }
  
  public getErrors(): ConsoleMessage[] {
    return this.getMessages('error');
  }
  
  public getWarnings(): ConsoleMessage[] {
    return this.getMessages('warn');
  }
  
  public clear() {
    this.messages = [];
  }
  
  public restore() {
    console.error = this.originalConsole.error;
    console.warn = this.originalConsole.warn;
    console.log = this.originalConsole.log;
  }
  
  public getSummary() {
    const errors = this.getErrors();
    const warnings = this.getWarnings();
    
    return {
      errorCount: errors.length,
      warningCount: warnings.length,
      errors: errors.slice(-10), // Last 10 errors
      warnings: warnings.slice(-10), // Last 10 warnings
    };
  }
}

// Create singleton instance
export const consoleErrorDetector = new ConsoleErrorDetector();

// Export for debugging
if (import.meta.env.DEV) {
  (window as any).consoleErrorDetector = consoleErrorDetector;
}

export default consoleErrorDetector;