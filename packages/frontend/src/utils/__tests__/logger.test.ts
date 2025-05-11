import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import logger, { LogLevel } from '../logger';

describe('Logger Utility', () => {
  // Spy on console methods
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

  // Spy on fetch for server logging
  const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
    } as Response),
  );

  beforeEach(() => {
    // Clear logs before each test
    logger.clearLogs();
  });

  afterEach(() => {
    // Reset all mocks after each test
    vi.clearAllMocks();
  });

  it('should log error messages', () => {
    const message = 'Test error message';
    const data = { userId: '123' };

    logger.error(message, data);

    // Check if console.error was called
    expect(consoleErrorSpy).toHaveBeenCalled();

    // Check if log was added to memory
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(LogLevel.ERROR);
    expect(logs[0].message).toBe(message);
    expect(logs[0].data).toEqual(data);
  });

  it('should log warning messages', () => {
    const message = 'Test warning message';

    logger.warn(message);

    // Check if console.warn was called
    expect(consoleWarnSpy).toHaveBeenCalled();

    // Check if log was added to memory
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(LogLevel.WARN);
    expect(logs[0].message).toBe(message);
  });

  it('should log info messages', () => {
    const message = 'Test info message';

    logger.info(message);

    // Check if console.info was called
    expect(consoleInfoSpy).toHaveBeenCalled();

    // Check if log was added to memory
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(LogLevel.INFO);
    expect(logs[0].message).toBe(message);
  });

  it('should log debug messages', () => {
    const message = 'Test debug message';

    logger.debug(message);

    // Check if console.debug was called
    expect(consoleDebugSpy).toHaveBeenCalled();

    // Check if log was added to memory
    const logs = logger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe(LogLevel.DEBUG);
    expect(logs[0].message).toBe(message);
  });

  it('should clear logs from memory', () => {
    logger.info('Test message 1');
    logger.info('Test message 2');

    // Check if logs were added to memory
    expect(logger.getLogs().length).toBe(2);

    // Clear logs
    logger.clearLogs();

    // Check if logs were cleared
    expect(logger.getLogs().length).toBe(0);
  });

  it('should return the current log level', () => {
    const logLevel = logger.getLogLevel();
    expect(typeof logLevel).toBe('number');
    expect(Object.values(LogLevel).includes(logLevel)).toBe(true);
  });

  it('should return the current log level name', () => {
    const logLevelName = logger.getLogLevelName();
    expect(typeof logLevelName).toBe('string');
    expect(['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(logLevelName)).toBe(true);
  });
});
