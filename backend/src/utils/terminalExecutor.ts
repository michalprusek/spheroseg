import { exec } from 'child_process';

/**
 * Result of running a terminal command with timeout handling.
 */
export interface TerminalExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  timeout?: boolean;
}

/**
 * Runs a shell command with a timeout.
 * Handles timeouts and execution errors.
 *
 * @param command The shell command to execute
 * @param timeoutMs Timeout in milliseconds
 * @param workingDirectory Optional working directory
 * @returns Result object with success, output/error, and timeout flag
 */
export async function runCommandWithTimeout(
  command: string,
  timeoutMs: number,
  workingDirectory?: string
): Promise<TerminalExecutionResult> {
  return new Promise((resolve) => {
    const fullCommand = workingDirectory ? `cd ${workingDirectory} && ${command}` : command;

    const childProcess = exec(fullCommand, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error) {
        if (error.signal === 'SIGTERM' || error.message.includes('timed out')) {
          console.warn(`Command timed out after ${timeoutMs}ms: ${command}`);
          resolve({
            success: false,
            timeout: true,
            error: 'Command execution timed out',
          });
        } else {
          console.error(`Command execution failed: ${error.message}`);
          resolve({
            success: false,
            error: error.message,
          });
        }
      } else {
        resolve({
          success: true,
          output: stdout,
        });
      }
    });

    // Additional timeout safety
    setTimeout(() => {
      if (childProcess.killed === false) {
        childProcess.kill();
        resolve({
          success: false,
          timeout: true,
          error: 'Command execution timed out (safety timeout)',
        });
      }
    }, timeoutMs + 1000); // Add 1 second buffer
  });
}