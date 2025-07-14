import { Job } from 'bull';
import axios from 'axios';
import * as fs from 'fs/promises';
import { BullQueueService, SegmentationTaskData } from '../services/bullQueueService';
import { logger } from '../utils/logger';

export class SegmentationWorker {
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    private queueService: BullQueueService,
    private db: any,
    private socketService: any,
    private mlServiceUrl: string
  ) {}

  start(concurrency = 1): void {
    logger.info(`Starting segmentation worker with concurrency: ${concurrency}`);
    
    // Process segmentation jobs
    this.queueService.processSegmentationJobs(
      this.processSegmentationJob.bind(this),
      concurrency
    );

    // Clean up old jobs every hour
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldJobs();
    }, 60 * 60 * 1000);
  }

  private async processSegmentationJob(job: Job<SegmentationTaskData>): Promise<any> {
    const { taskId, imageId, imagePath, userId } = job.data;
    
    logger.info(`Processing segmentation job ${job.id} for task ${taskId}`);
    await job.progress(10);

    try {
      // Update task status to processing
      await this.updateTaskStatus(taskId, 'processing');
      
      // Check if file exists
      await this.validateImageFile(imagePath);
      await job.progress(20);

      // Call ML service
      const mlResult = await this.callMLService(imagePath, job);
      await job.progress(90);

      // Save results to database
      await this.saveSegmentationResults(taskId, imageId, mlResult);
      
      // Update task status to completed
      await this.updateTaskStatus(taskId, 'completed');
      await job.progress(100);

      // Notify user via WebSocket
      this.socketService.emitToUser(userId, 'segmentation-completed', {
        taskId,
        imageId,
        success: true,
      });

      logger.info(`Segmentation job ${job.id} completed successfully`);
      
      return {
        success: true,
        taskId,
        imageId,
      };
    } catch (error) {
      logger.error(`Segmentation job ${job.id} failed:`, error);
      
      // Update task status to failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.updateTaskStatus(taskId, 'failed', errorMessage);
      
      // Notify user of failure
      this.socketService.emitToUser(userId, 'segmentation-failed', {
        taskId,
        imageId,
        error: errorMessage,
      });

      throw error;
    }
  }

  private async validateImageFile(imagePath: string): Promise<void> {
    try {
      await fs.access(imagePath);
    } catch (error) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
  }

  private async callMLService(imagePath: string, job: Job): Promise<any> {
    try {
      // Update progress during ML processing
      const progressInterval = setInterval(() => {
        const currentProgress = job.progress();
        if (currentProgress < 80) {
          job.progress(currentProgress + 10);
        }
      }, 2000);

      const response = await axios.post(
        `${this.mlServiceUrl}/segment`,
        { image_path: imagePath },
        {
          timeout: 5 * 60 * 1000, // 5 minute timeout
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      clearInterval(progressInterval);
      await job.progress(80);

      if (!response.data.success) {
        throw new Error(`ML service processing failed: ${response.data.error}`);
      }

      return response.data.results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNREFUSED') {
          throw new Error('ML service is unavailable');
        }
        if (error.response) {
          throw new Error(`ML service error: ${error.response.data.error || error.message}`);
        }
      }
      throw error;
    }
  }

  private async saveSegmentationResults(taskId: string, imageId: number, results: any): Promise<void> {
    const { polygons, features } = results;
    
    try {
      await this.db.query('BEGIN');

      // Save segmentation results
      const resultQuery = `
        INSERT INTO segmentation_results (image_id, task_id, polygons, features, created_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (image_id) DO UPDATE
        SET polygons = $3, features = $4, updated_at = NOW()
      `;
      
      await this.db.query(resultQuery, [
        imageId,
        taskId,
        JSON.stringify(polygons),
        JSON.stringify(features),
      ]);

      // Update image segmentation status
      await this.db.query(
        'UPDATE images SET segmentation_status = $1 WHERE id = $2',
        ['completed', imageId]
      );

      await this.db.query('COMMIT');
    } catch (error) {
      await this.db.query('ROLLBACK');
      throw new Error(`Failed to save segmentation results: ${error}`);
    }
  }

  private async updateTaskStatus(taskId: string, status: string, errorMessage?: string): Promise<void> {
    const query = `
      UPDATE segmentation_tasks 
      SET task_status = $1, 
          error_message = $2,
          updated_at = NOW()
      WHERE task_id = $3
    `;
    
    await this.db.query(query, [status, errorMessage || null, taskId]);
  }

  private async cleanupOldJobs(): Promise<void> {
    try {
      await this.queueService.cleanOldJobs();
      logger.info('Cleaned up old segmentation jobs');
    } catch (error) {
      logger.error('Failed to clean up old jobs:', error);
    }
  }

  async stop(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    await this.queueService.close();
    logger.info('Segmentation worker stopped');
  }
}