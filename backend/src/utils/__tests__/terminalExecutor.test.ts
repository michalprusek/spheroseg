import { runCommandWithTimeout } from '../terminalExecutor';
import { exec } from 'child_process';

// Mock the child_process module
jest.mock('child_process', () => {
  return {
    exec: jest.fn()
  };
});

// The exec function is mocked via jest.mock above

describe('runCommandWithTimeout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return success result when command executes successfully', async () => {
    // Mock the exec function to simulate successful execution
    (exec as unknown as jest.Mock).mockImplementation((_cmd, _options, callback) => {
      callback(null, 'hello', '');
      return { killed: false, kill: jest.fn() };
    });

    const result = await runCommandWithTimeout('echo hello', 1000);

    expect(result.success).toBe(true);
    expect(result.output).toBe('hello');
    expect(result.timeout).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('should return timeout result when command times out', async () => {
    // Mock the exec function to simulate a timeout
    (exec as unknown as jest.Mock).mockImplementation((_cmd, _options, callback) => {
      const error = new Error('Command timed out') as any;
      error.signal = 'SIGTERM';
      callback(error, '', '');
      return { killed: false, kill: jest.fn() };
    });

    const result = await runCommandWithTimeout('sleep 5', 1000);

    expect(result.success).toBe(false);
    expect(result.timeout).toBe(true);
    expect(result.error).toMatch(/timed out/i);
    expect(result.output).toBeUndefined();
  });

  it('should return error result when command fails', async () => {
    // Mock the exec function to simulate a command failure
    (exec as unknown as jest.Mock).mockImplementation((_cmd, _options, callback) => {
      callback(new Error('some error'), '', '');
      return { killed: false, kill: jest.fn() };
    });

    const result = await runCommandWithTimeout('invalid_command', 1000);

    expect(result.success).toBe(false);
    expect(result.error).toBe('some error');
    expect(result.timeout).toBeUndefined();
    expect(result.output).toBeUndefined();
  });

  it('should handle working directory', async () => {
    // Mock the exec function to check the command includes the working directory
    (exec as unknown as jest.Mock).mockImplementation((cmd, _options, callback) => {
      expect(cmd).toContain('cd /test/dir && echo hello');
      callback(null, 'hello from dir', '');
      return { killed: false, kill: jest.fn() };
    });

    const result = await runCommandWithTimeout('echo hello', 1000, '/test/dir');

    expect(result.success).toBe(true);
    expect(result.output).toBe('hello from dir');
  });
});

describe('runCommandWithTimeout with fake timers', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should timeout if command takes too long (safety timeout)', async () => {
    // Mock the exec function to simulate a command that doesn't respond to the timeout
    (exec as unknown as jest.Mock).mockImplementation((_cmd, _options, _callback) => {
      // Don't call the callback to simulate a hanging process
      return { killed: false, kill: jest.fn() };
    });

    const promise = runCommandWithTimeout('sleep 10', 1000);

    // Fast-forward past the timeout plus buffer
    jest.advanceTimersByTime(2000);

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.timeout).toBe(true);
    expect(result.error).toMatch(/safety timeout/i);
  });
});
