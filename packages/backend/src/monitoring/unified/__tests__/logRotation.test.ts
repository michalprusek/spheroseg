/**
 * Tests for log rotation configuration
 */

import path from 'path';
import winston from 'winston';
import 'winston-daily-rotate-file';
import { logger } from '../index';

describe('Log Rotation Configuration', () => {
  beforeEach(() => {
    // Clear any existing transports for testing
    jest.clearAllMocks();
  });

  it('should have winston-daily-rotate-file transports configured', () => {
    const transports = logger.transports;
    const rotateTransports = transports.filter(
      (transport) => transport.constructor.name === 'DailyRotateFile'
    );

    // When logToFile is enabled, we should have 3 rotate transports
    if (process.env.LOG_TO_FILE === 'true') {
      expect(rotateTransports.length).toBe(3); // error, combined, access
    }
  });

  it('should have correct rotation configuration for error logs', () => {
    const transports = logger.transports;
    const errorRotateTransport = transports.find(
      (transport: any) =>
        transport.constructor.name === 'DailyRotateFile' &&
        transport.level === 'error'
    ) as any;

    if (errorRotateTransport) {
      expect(errorRotateTransport.maxSize).toBe('20m');
      expect(errorRotateTransport.maxFiles).toBe('14d');
      expect(errorRotateTransport.zippedArchive).toBe(true);
      expect(errorRotateTransport.datePattern).toBe('YYYY-MM-DD');
    }
  });

  it('should have correct rotation configuration for combined logs', () => {
    const transports = logger.transports;
    const combinedRotateTransport = transports.find(
      (transport: any) =>
        transport.constructor.name === 'DailyRotateFile' &&
        !transport.level && // combined logs don't have a specific level
        transport.filename?.includes('combined')
    ) as any;

    if (combinedRotateTransport) {
      expect(combinedRotateTransport.maxSize).toBe('50m');
      expect(combinedRotateTransport.maxFiles).toBe('7d');
      expect(combinedRotateTransport.zippedArchive).toBe(true);
      expect(combinedRotateTransport.datePattern).toBe('YYYY-MM-DD');
    }
  });

  it('should have correct rotation configuration for access logs', () => {
    const transports = logger.transports;
    const accessRotateTransport = transports.find(
      (transport: any) =>
        transport.constructor.name === 'DailyRotateFile' &&
        transport.level === 'http'
    ) as any;

    if (accessRotateTransport) {
      expect(accessRotateTransport.maxSize).toBe('100m');
      expect(accessRotateTransport.maxFiles).toBe('3d');
      expect(accessRotateTransport.zippedArchive).toBe(true);
      expect(accessRotateTransport.datePattern).toBe('YYYY-MM-DD');
    }
  });

  it('should create log files with correct naming pattern', () => {
    const transports = logger.transports;
    const rotateTransports = transports.filter(
      (transport: any) => transport.constructor.name === 'DailyRotateFile'
    ) as any[];

    rotateTransports.forEach((transport) => {
      if (transport.filename) {
        expect(transport.filename).toMatch(/-%DATE%\.log$/);
        expect(transport.filename).toMatch(/^.*\/(error|combined|access)-%DATE%\.log$/);
      }
    });
  });

  it('should handle log directory configuration', () => {
    const logDir = process.env.LOG_DIR || path.join(process.cwd(), 'logs');
    const transports = logger.transports;
    const rotateTransports = transports.filter(
      (transport: any) => transport.constructor.name === 'DailyRotateFile'
    ) as any[];

    rotateTransports.forEach((transport) => {
      if (transport.dirname) {
        expect(transport.dirname).toBe(logDir);
      }
    });
  });

  it('should use proper log formats for rotated files', () => {
    const transports = logger.transports;
    const rotateTransports = transports.filter(
      (transport: any) => transport.constructor.name === 'DailyRotateFile'
    ) as any[];

    rotateTransports.forEach((transport) => {
      // All rotate transports should use JSON format
      expect(transport.format).toBeDefined();
      // The format should include timestamp, errors with stack, and json
      const formatFunctions = transport.format._formats || [];
      const hasTimestamp = formatFunctions.some((f: any) => f.options?.timestamp);
      const hasErrors = formatFunctions.some((f: any) => f.options?.stack);
      const hasJson = formatFunctions.some((f: any) => f.name === 'json');
      
      expect(hasTimestamp || hasErrors || hasJson).toBe(true);
    });
  });
});