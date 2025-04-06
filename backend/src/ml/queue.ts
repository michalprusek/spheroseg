import Bull from 'bull';
import { config } from '../config/app';
import { validateRedisUrl } from '../utils/env';
import { safeParseJobData } from './jobValidation';
// Validate Redis URL scheme before initializing the queue
validateRedisUrl(config.queue.redisUrl);

interface JobOptions {
  attempts?: number;
  backoff?: {
    type: string;
    delay: number;
  };
}

export interface SegmentationJobData {
  jobId?: string; // Make it optional for backward compatibility
  fileId: string;
  signedUrl?: string; // Make it optional for backward compatibility
  filePath?: string; // Make it optional to maintain backward compatibility
  userId?: string; // Make it optional to maintain backward compatibility
  projectId?: string; // Make it optional to maintain backward compatibility
  params: Record<string, any>;
}

import { URL } from 'url';

const redisUrl = new URL(config.queue.redisUrl);
const redisOptions: Record<string, any> = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port) || 6379,
};

if (redisUrl.password) {
  redisOptions.password = redisUrl.password;
}

if (redisUrl.searchParams.has('connectTimeout')) {
  const timeout = Number(redisUrl.searchParams.get('connectTimeout'));
  if (!isNaN(timeout)) {
    redisOptions.connectTimeout = timeout;
  }
}

export const segmentationQueue = new Bull(config.queue.name, {
  redis: redisOptions
});

export async function initializeSegmentationQueue(): Promise<void> {
  try {
    await segmentationQueue.clean(0, 'completed');
    await segmentationQueue.clean(0, 'failed');
    console.log('Cleaned old completed and failed jobs from segmentation queue');
  } catch (err) {
    console.error('Error cleaning segmentation queue:', err);
  }
}

export async function addSegmentationJob(data: SegmentationJobData, options?: JobOptions) {
  try {
    // Validate job data before enqueueing
    const validatedData = safeParseJobData(data);

    const defaultOptions = {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 }
    };

    const job = await segmentationQueue.add(validatedData, options || defaultOptions);
    return job;
  } catch (error) {
    console.error('Failed to add segmentation job:', error);
    throw error;
  }
}

export async function getJobStatus(jobId: string): Promise<string | null> {
  try {
    const job = await segmentationQueue.getJob(jobId);
    if (!job) return null;
    return await job.getState();
  } catch (error) {
    console.error('Failed to get job status:', error);
    return null;
  }
}