import Bull, { Job, JobOptions, Queue } from 'bull';
import { logger } from '../utils/logger';

export interface SegmentationTaskData {
  taskId: string;
  imageId: number;
  imagePath: string;
  userId: number;
  priority?: number;
}

export interface JobStatus {
  id: string | number;
  progress: number;
  isCompleted: boolean;
  isFailed: boolean;
  failedReason: string | null;
  data: any;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  isPaused: boolean;
}

export class BullQueueService {
  private queue: Queue<SegmentationTaskData>;

  constructor(redisUrl: string) {
    this.queue = new Bull<SegmentationTaskData>('segmentation', redisUrl, {
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // Initial delay of 2 seconds
        },
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.queue.on('completed', (job: Job<SegmentationTaskData>, result: any) => {
      logger.info(`Job ${job.id} completed:`, result);
    });

    this.queue.on('failed', (job: Job<SegmentationTaskData>, err: Error) => {
      logger.error(`Job ${job.id} failed:`, err);
    });

    this.queue.on('error', (error: Error) => {
      logger.error('Queue error:', error);
    });

    this.queue.on('waiting', (jobId: string) => {
      logger.debug(`Job ${jobId} is waiting`);
    });

    this.queue.on('active', (job: Job<SegmentationTaskData>) => {
      logger.info(`Job ${job.id} started processing`);
    });

    this.queue.on('stalled', (job: Job<SegmentationTaskData>) => {
      logger.warn(`Job ${job.id} stalled and will be retried`);
    });
  }

  async addSegmentationJob(data: SegmentationTaskData): Promise<Job<SegmentationTaskData>> {
    try {
      const jobOptions: JobOptions = {
        priority: data.priority || 1,
        delay: 0,
      };

      const job = await this.queue.add('segmentation', data, jobOptions);
      logger.info(`Added segmentation job ${job.id} for task ${data.taskId}`);
      return job;
    } catch (error) {
      logger.error('Failed to add segmentation job:', error);
      throw error;
    }
  }

  processSegmentationJobs(
    processor: (job: Job<SegmentationTaskData>) => Promise<any>,
    concurrency = 1
  ): void {
    this.queue.process('segmentation', concurrency, processor);
  }

  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const job = await this.queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      progress: job.progress(),
      isCompleted: await job.isCompleted(),
      isFailed: await job.isFailed(),
      failedReason: job.failedReason,
      data: job.data,
    };
  }

  async getQueueMetrics(): Promise<QueueMetrics> {
    const counts = await this.queue.getJobCounts();
    const isPaused = await this.queue.isPaused();

    return {
      ...counts,
      isPaused,
    };
  }

  async cleanOldJobs(): Promise<void> {
    try {
      // Clean completed jobs older than 24 hours
      await this.queue.clean(24 * 3600 * 1000, 'completed');
      
      // Clean failed jobs older than 7 days
      await this.queue.clean(7 * 24 * 3600 * 1000, 'failed');
      
      logger.info('Cleaned old jobs from queue');
    } catch (error) {
      logger.error('Failed to clean old jobs:', error);
    }
  }

  async pauseQueue(): Promise<void> {
    await this.queue.pause();
    logger.info('Queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.queue.resume();
    logger.info('Queue resumed');
  }

  async close(): Promise<void> {
    this.queue.removeAllListeners();
    await this.queue.close();
    logger.info('Queue connection closed');
  }
}