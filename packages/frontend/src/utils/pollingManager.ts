/**
 * Centralized polling manager to prevent excessive API calls
 * Coordinates polling across multiple components to avoid 429 errors
 */

interface PollTask {
  id: string;
  endpoint: string;
  callback: (data: unknown) => void;
  interval: number;
  lastPoll: number;
  retryCount: number;
  maxRetries: number;
}

class PollingManager {
  private tasks: Map<string, PollTask> = new Map();
  private pollingTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private rateLimitBackoff = 0;
  private readonly MIN_INTERVAL = 10000; // Minimum 10 seconds between polls
  private readonly MAX_BACKOFF = 300000; // Maximum 5 minutes backoff
  private readonly RATE_LIMIT_COOLDOWN = 60000; // 1 minute cooldown after 429

  /**
   * Register a polling task
   */
  register(
    id: string,
    endpoint: string,
    callback: (data: unknown) => void,
    interval: number = 30000,
    maxRetries: number = 30,
  ): void {
    // Enforce minimum interval
    const safeInterval = Math.max(interval, this.MIN_INTERVAL);

    this.tasks.set(id, {
      id,
      endpoint,
      callback,
      interval: safeInterval,
      lastPoll: 0,
      retryCount: 0,
      maxRetries,
    });

    // Start polling if not already running
    if (!this.isPolling) {
      this.startPolling();
    }
  }

  /**
   * Unregister a polling task
   */
  unregister(id: string): void {
    this.tasks.delete(id);

    // Stop polling if no tasks remain
    if (this.tasks.size === 0 && this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.isPolling = false;
    }
  }

  /**
   * Start the polling loop
   */
  private startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;

    // Check tasks every 5 seconds
    this.pollingTimer = setInterval(() => {
      this.processTasks();
    }, 5000);

    // Process immediately
    this.processTasks();
  }

  /**
   * Process all registered tasks
   */
  private async processTasks(): Promise<void> {
    const now = Date.now();

    // Apply rate limit backoff if needed
    if (this.rateLimitBackoff > 0 && now < this.rateLimitBackoff) {
      return;
    }

    // Process tasks that are due
    for (const task of this.tasks.values()) {
      const timeSinceLastPoll = now - task.lastPoll;

      if (timeSinceLastPoll >= task.interval) {
        // Don't await to allow parallel processing
        this.executePoll(task);
      }
    }
  }

  /**
   * Execute a single poll
   */
  private async executePoll(task: PollTask): Promise<void> {
    // Check if we've exceeded max retries
    if (task.retryCount >= task.maxRetries) {
      console.debug(`Polling stopped for ${task.id} after ${task.retryCount} attempts`);
      this.unregister(task.id);
      return;
    }

    task.lastPoll = Date.now();
    task.retryCount++;

    try {
      // Dynamic import to avoid circular dependencies
      const { default: apiClient } = await import('@/lib/apiClient');
      const response = await apiClient.get(task.endpoint);

      if (response.data) {
        task.callback(response.data);

        // Reset retry count on success
        task.retryCount = 0;

        // Increase interval exponentially to reduce load
        task.interval = Math.min(task.interval * 1.2, 60000); // Max 1 minute
      }
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      
      if (axiosError.response?.status === 429) {
        // Rate limited - apply global backoff
        console.warn('Rate limit hit, applying global backoff');
        this.rateLimitBackoff = Date.now() + this.RATE_LIMIT_COOLDOWN;

        // Double all task intervals
        for (const t of this.tasks.values()) {
          t.interval = Math.min(t.interval * 2, this.MAX_BACKOFF);
        }
      } else if (axiosError.response?.status === 401) {
        // Authentication error - stop all polling
        console.error('Authentication error, stopping all polling');
        this.stopAll();
      } else if (axiosError.response?.status === 404) {
        // Not found - might be normal for new images
        // Continue polling but with increased interval
        task.interval = Math.min(task.interval * 1.5, 120000); // Max 2 minutes
      }
    }
  }

  /**
   * Stop all polling tasks
   */
  stopAll(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
    }
    this.tasks.clear();
    this.isPolling = false;
    this.rateLimitBackoff = 0;
  }

  /**
   * Get current status
   */
  getStatus(): {
    taskCount: number;
    isPolling: boolean;
    rateLimited: boolean;
  } {
    return {
      taskCount: this.tasks.size,
      isPolling: this.isPolling,
      rateLimited: Date.now() < this.rateLimitBackoff,
    };
  }
}

// Export singleton instance
export const pollingManager = new PollingManager();
