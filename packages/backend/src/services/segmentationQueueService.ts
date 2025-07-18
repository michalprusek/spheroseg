/**
 * Enhanced segmentation queue service
 *
 * This service provides a robust queue implementation for segmentation tasks:
 * - Persistent task storage in database
 * - Priority task processing
 * - Automatic retry for failed tasks
 * - ML service status monitoring
 * - Scalable task processing
 * - Detailed logging and metrics
 */

import amqp from 'amqplib';
import { PoolClient } from 'pg';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import path from 'path';
import pool from '../db';
import logger from '../utils/logger';
import config from '../config';
import { ApiError } from '../utils/errors';
import { getIO } from '../socket';

// RabbitMQ Configuration
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://rabbitmq:rabbitmq@rabbitmq:5672';
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE || 'segmentation_tasks';

// Konfigurace
const ML_SERVICE_URL = config.ml.serviceUrl || 'http://ml:5002';
// const MAX_RETRIES = config.ml.maxRetries || 3; // TODO: Implement retry logic
// const RETRY_DELAY = config.ml.retryDelay || 5000; // ms // TODO: Implement retry logic
const MAX_CONCURRENT_TASKS = config.ml.maxConcurrentTasks || 2;
const HEALTH_CHECK_INTERVAL = config.ml.healthCheckInterval || 60000; // ms
const QUEUE_UPDATE_INTERVAL = config.ml.queueUpdateInterval || 5000; // ms

// Typy a rozhraní
export enum TaskStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum TaskPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
}

export interface SegmentationTask {
  id: string;
  imageId: string;
  imagePath: string;
  parameters: any;
  priority: TaskPriority;
  status: TaskStatus;
  retries: number;
  error?: string;
  result?: any;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface QueueStatus {
  pendingTasks: string[];
  runningTasks: string[];
  queueLength: number;
  activeTasksCount: number;
  mlServiceStatus: 'online' | 'offline' | 'degraded';
  lastUpdated: Date;
}

/**
 * Třída pro správu fronty segmentace
 */
class SegmentationQueueService extends EventEmitter {
  private isProcessing: boolean = false;
  private mlServiceAvailable: boolean = false;
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private queueStatus: QueueStatus = {
    pendingTasks: [],
    runningTasks: [],
    queueLength: 0,
    activeTasksCount: 0,
    mlServiceStatus: 'offline',
    lastUpdated: new Date(),
  };

  constructor() {
    super();
  }

  /**
   * Inicializuje službu
   */
  public async init(): Promise<void> {
    try {
      // Ověření existence tabulky
      await this.ensureTaskTableExists();

      // Connect to RabbitMQ
      await this.connectRabbitMQ();

      // Start periodic checks
      this.startHealthCheck();
      this.startQueueProcessor();
      this.startQueueStatusUpdater();

      logger.info('Segmentation queue service initialized');
    } catch (error) {
      logger.error('Error initializing segmentation queue service:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Ensure task table exists
   */
  private async ensureTaskTableExists(): Promise<void> {
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    try {
      await client.query('BEGIN');

      // Kontrola existence typu task_status
      const typeCheck = await client.query(`
        SELECT typname FROM pg_type WHERE typname = 'task_status';
      `);

      if (typeCheck.rows.length === 0) {
        await client.query(`
          CREATE TYPE task_status AS ENUM (
            'queued', 'processing', 'completed', 'failed', 'cancelled'
          );
        `);
      }

      // Vytvoření tabulky pro úlohy
      await client.query(`
        CREATE TABLE IF NOT EXISTS segmentation_tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          image_id UUID NOT NULL,
          image_path TEXT NOT NULL,
          parameters JSONB DEFAULT '{}',
          priority INTEGER DEFAULT 5,
          status task_status DEFAULT 'queued',
          retries INTEGER DEFAULT 0,
          error TEXT,
          result JSONB,
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ
        );
        
        CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_status ON segmentation_tasks(status);
        CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_image_id ON segmentation_tasks(image_id);
        CREATE INDEX IF NOT EXISTS idx_segmentation_tasks_priority ON segmentation_tasks(priority);
      `);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Chyba při vytváření tabulky pro úlohy:', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Připojí se k RabbitMQ
   */
  private async connectRabbitMQ(): Promise<void> {
    try {
      this.connection = await amqp.connect(RABBITMQ_URL);
      this.channel = await this.connection.createChannel();

      // Vytvoření fronty, pokud neexistuje
      await this.channel.assertQueue(RABBITMQ_QUEUE, {
        durable: true,
      });

      logger.info('Connected to RabbitMQ');

      // Nastavení handlerů pro události
      this.connection.on('error', (err: any) => {
        logger.error('RabbitMQ connection error:', err);
        this.reconnectRabbitMQ();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed, attempting to reconnect...');
        this.reconnectRabbitMQ();
      });
    } catch (error) {
      logger.error('Nepodařilo se připojit k RabbitMQ:', error);
      // Pokusit se znovu za chvíli
      setTimeout(() => this.reconnectRabbitMQ(), 5000);
    }
  }

  /**
   * Znovu se připojí k RabbitMQ
   */
  private async reconnectRabbitMQ(): Promise<void> {
    try {
      if (this.connection) {
        await this.connection.close();
      }
      await this.connectRabbitMQ();
    } catch (error) {
      logger.error('Chyba při znovupřipojení k RabbitMQ:', error);
      setTimeout(() => this.reconnectRabbitMQ(), 5000);
    }
  }

  /**
   * Spustí pravidelnou kontrolu stavu ML služby
   */
  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        const response = await axios.get(`${ML_SERVICE_URL}/health`, {
          timeout: 5000,
        });

        this.mlServiceAvailable = response.status === 200;
        this.queueStatus.mlServiceStatus = response.status === 200 ? 'online' : 'offline';

        if (response.status === 200) {
          logger.debug('ML služba je dostupná');

          // Pokud byla služba nedostupná a nyní je dostupná, spustíme zpracování fronty
          if (!this.isProcessing) {
            this.processQueue();
          }
        } else {
          logger.warn('ML služba není dostupná:', {
            status: response.status,
            statusText: response.statusText,
          });
        }
      } catch (error) {
        this.mlServiceAvailable = false;
        this.queueStatus.mlServiceStatus = 'offline';
        logger.error('Chyba při kontrole stavu ML služby:', { error });
      }
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * Spustí pravidelné zpracování fronty
   */
  private startQueueProcessor(): void {
    setInterval(() => {
      if (this.mlServiceAvailable && !this.isProcessing) {
        this.processQueue();
      }
    }, 1000);
  }

  /**
   * Spustí pravidelnou aktualizaci stavu fronty
   */
  private startQueueStatusUpdater(): void {
    setInterval(async () => {
      await this.updateQueueStatus();
    }, QUEUE_UPDATE_INTERVAL);
  }

  /**
   * Aktualizuje stav fronty
   */
  private async updateQueueStatus(): Promise<void> {
    try {
      const dbPool = pool.getPool();
      const client = await dbPool.connect();
      try {
        // Get all active tasks in a single query
        const tasksResult = await client.query(`
          SELECT 
            st.id, 
            st.image_id, 
            st.status,
            i.project_id,
            st.priority,
            st.created_at
          FROM segmentation_tasks st
          JOIN images i ON st.image_id = i.id
          WHERE st.status IN ('queued', 'processing')
          ORDER BY 
            st.status DESC, -- processing tasks first
            st.priority DESC, 
            st.created_at ASC
        `);

        // Group tasks by project and status
        const tasksByProject = new Map<string, { pending: string[]; running: string[] }>();
        const pendingTasks: string[] = [];
        const runningTasks: string[] = [];

        // Process all tasks in a single pass
        tasksResult.rows.forEach((row) => {
          // Initialize project entry if needed
          if (!tasksByProject.has(row.project_id)) {
            tasksByProject.set(row.project_id, { pending: [], running: [] });
          }

          // Add task to appropriate list
          const projectTasks = tasksByProject.get(row.project_id)!;
          if (row.status === 'queued') {
            projectTasks.pending.push(row.id);
            pendingTasks.push(row.id);
          } else if (row.status === 'processing') {
            projectTasks.running.push(row.id);
            runningTasks.push(row.id);
          }
        });

        // Aktualizace globálního stavu fronty
        this.queueStatus = {
          pendingTasks: pendingTasks,
          runningTasks: runningTasks,
          queueLength: pendingTasks.length,
          activeTasksCount: runningTasks.length,
          mlServiceStatus: this.mlServiceAvailable ? 'online' : 'offline',
          lastUpdated: new Date(),
        };

        // Emitování události aktualizace fronty
        this.emit('queue:updated', this.queueStatus);

        // Odeslání aktualizace přes WebSocket - do project-specific rooms
        try {
          const io = getIO();

          // Odeslat update do každého projektu
          tasksByProject.forEach((tasks, projectId) => {
            io.to(`project-${projectId}`).emit('segmentation_queue_update', {
              projectId,
              pendingTasks: tasks.pending,
              runningTasks: tasks.running,
              queueLength: tasks.pending.length,
              activeTasksCount: tasks.running.length,
              mlServiceStatus: this.mlServiceAvailable ? 'online' : 'offline',
              timestamp: new Date().toISOString(),
            });
          });
        } catch (socketError) {
          logger.error('Chyba při odesílání aktualizace fronty přes WebSocket:', {
            error: socketError,
          });
        }
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Chyba při aktualizaci stavu fronty:', { error });
    }
  }

  /**
   * Zpracuje frontu úloh
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || !this.mlServiceAvailable) {
      return;
    }

    this.isProcessing = true;

    try {
      const dbPool = pool.getPool();
      const client = await dbPool.connect();
      try {
        // Získání úloh ke zpracování
        const result = await client.query(
          `
          SELECT id, image_id, image_path, parameters, priority, retries
          FROM segmentation_tasks
          WHERE status = 'queued'
          ORDER BY priority DESC, created_at ASC
          LIMIT $1
        `,
          [MAX_CONCURRENT_TASKS]
        );

        if (result.rows.length === 0) {
          this.isProcessing = false;
          return;
        }

        // Process tasks in parallel
        const processingPromises = result.rows.map((task) =>
          this.processTask(task.id, task.image_id, task.image_path, task.parameters, task.retries)
        );

        await Promise.all(processingPromises);
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Chyba při zpracování fronty:', { error });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Zpracuje jednu úlohu
   */
  private async processTask(
    taskId: string,
    imageId: string,
    imagePath: string,
    parameters: any,
    retries: number
  ): Promise<void> {
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    try {
      // Označení úlohy jako zpracovávané
      await client.query(
        `
        UPDATE segmentation_tasks
        SET status = 'processing', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
        [taskId]
      );

      // Aktualizace stavu segmentace v databázi
      await this.updateSegmentationStatus(client, imageId, 'processing');

      // Publikování úlohy do RabbitMQ
      await this.publishTaskToQueue(taskId, imageId, imagePath, parameters, retries);

      logger.info('Úloha segmentace byla odeslána do RabbitMQ:', {
        taskId,
        imageId,
      });
    } catch (error) {
      logger.error('Chyba při odesílání úlohy do RabbitMQ:', {
        error,
        taskId,
        imageId,
      });

      // Označení úlohy jako neúspěšné, pokud se nepodařilo odeslat do RabbitMQ
      const errorMessage = error instanceof Error ? error.message : String(error);
      await client.query(
        `
        UPDATE segmentation_tasks
        SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `,
        [errorMessage, taskId]
      );

      // Aktualizace stavu segmentace
      await this.updateSegmentationStatus(client, imageId, 'failed', errorMessage);
    } finally {
      client.release();
    }
  }

  /**
   * Publikuje úlohu do fronty RabbitMQ
   */
  private async publishTaskToQueue(
    taskId: string,
    imageId: string,
    imagePath: string,
    parameters: any,
    retries: number
  ): Promise<void> {
    if (!this.channel) {
      throw new Error('RabbitMQ channel is not available.');
    }

    // Use internal Docker service name for ML service callback
    const internalBackendUrl =
      process.env.NODE_ENV === 'production' ? 'http://backend:5001' : config.appUrl;

    // Validate and normalize the image path to prevent path traversal
    const normalizedPath = path.normalize(imagePath);

    // Ensure the path starts with /uploads/ and doesn't contain any traversal attempts
    if (!normalizedPath.startsWith('/uploads/') || normalizedPath.includes('..')) {
      logger.error('Invalid image path detected', { imagePath, normalizedPath });
      throw new Error('Invalid image path');
    }

    // Convert the image path for ML service
    // Backend uses /uploads/ but ML service has volumes mounted at /ML/uploads/
    const mlImagePath = normalizedPath.replace(/^\/uploads\//, '/ML/uploads/');
    logger.debug('Converting image path for ML service', {
      originalPath: imagePath,
      normalizedPath,
      mlPath: mlImagePath,
    });

    const taskPayload = {
      taskId,
      imageId,
      imagePath: mlImagePath,
      parameters,
      retries,
      callbackUrl: `${internalBackendUrl}/api/images/${imageId}/segmentation`, // Callback URL for ML service
    };

    try {
      this.channel.sendToQueue(RABBITMQ_QUEUE, Buffer.from(JSON.stringify(taskPayload)), {
        persistent: true,
      });
      logger.info('Zpráva o úloze segmentace byla odeslána do RabbitMQ:', { taskId });
    } catch (error) {
      logger.error('Chyba při odesílání zprávy do RabbitMQ:', { error, taskId });
      throw error;
    }
  }

  /**
   * Aktualizuje stav segmentace v databázi
   */
  private async updateSegmentationStatus(
    client: PoolClient,
    imageId: string,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      // Kontrola existence záznamu
      const checkResult = await client.query(
        `
        SELECT 1 FROM segmentation_results WHERE image_id = $1
      `,
        [imageId]
      );

      if (checkResult.rows.length === 0) {
        // Vytvoření nového záznamu
        await client.query(
          `
          INSERT INTO segmentation_results (image_id, status, error)
          VALUES ($1, $2, $3)
        `,
          [imageId, status, errorMessage || null]
        );
      } else {
        // Aktualizace existujícího záznamu
        await client.query(
          `
          UPDATE segmentation_results
          SET status = $1, error = $2, updated_at = NOW()
          WHERE image_id = $3
        `,
          [status, errorMessage || null, imageId]
        );
      }

      // Aktualizace stavu obrázku
      await client.query(
        `
        UPDATE images
        SET segmentation_status = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [status, imageId]
      );

      // Odeslání notifikace přes WebSocket
      try {
        // Získání project ID pro obrázek
        const projectQuery = await client.query(
          `
          SELECT project_id FROM images WHERE id = $1
        `,
          [imageId]
        );

        if (projectQuery.rows.length > 0) {
          const projectId = projectQuery.rows[0].project_id;

          const io = getIO();
          // Emit to project room instead of user room
          io.to(`project-${projectId}`).emit('segmentation_update', {
            imageId,
            status,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          });

          // Also emit to the specific image room
          io.to(`image-${imageId}`).emit('segmentation_update', {
            imageId,
            status,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          });

          logger.debug('Emitted segmentation update', {
            projectId,
            imageId,
            status,
            rooms: [`project-${projectId}`, `image-${imageId}`],
          });
        }
      } catch (socketError) {
        logger.error('Error sending segmentation status notification:', {
          error: socketError,
          imageId,
        });
      }
    } catch (error) {
      logger.error('Chyba při aktualizaci stavu segmentace:', {
        error,
        imageId,
      });
    }
  }

  /**
   * Aktualizuje výsledek segmentace v databázi
   */
  private async updateSegmentationResult(
    client: PoolClient,
    imageId: string,
    resultData: any
  ): Promise<void> {
    try {
      // Uložení celého objektu resultData do databáze
      await client.query(
        `
        UPDATE segmentation_results
        SET result_data = $1, updated_at = NOW()
        WHERE image_id = $2
      `,
        [resultData, imageId]
      );
    } catch (error) {
      logger.error('Chyba při aktualizaci výsledku segmentace:', {
        error,
        imageId,
      });
    }
  }

  /**
   * Přidá úlohu segmentace do fronty
   */
  public async addTask(
    imageId: string,
    imagePath: string,
    parameters: any = {},
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<string> {
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    try {
      // Kontrola existence úlohy
      const checkResult = await client.query(
        `
        SELECT id, status FROM segmentation_tasks
        WHERE image_id = $1 AND status IN ('queued', 'processing')
      `,
        [imageId]
      );

      if (checkResult.rows.length > 0) {
        const existingTask = checkResult.rows[0];

        // Pokud je úloha již ve frontě nebo se zpracovává, aktualizujeme prioritu
        if (existingTask.status === 'queued') {
          await client.query(
            `
            UPDATE segmentation_tasks
            SET priority = $1, parameters = $2, updated_at = NOW()
            WHERE id = $3
          `,
            [priority, parameters, existingTask.id]
          );

          logger.info('Existující úloha segmentace byla aktualizována:', {
            taskId: existingTask.id,
            imageId,
          });
          return existingTask.id;
        }

        // Pokud se úloha již zpracovává, vrátíme její ID
        if (existingTask.status === 'processing') {
          logger.info('Úloha segmentace se již zpracovává:', {
            taskId: existingTask.id,
            imageId,
          });
          return existingTask.id;
        }
      }

      // Vytvoření nové úlohy
      const taskId = uuidv4();
      await client.query(
        `
        INSERT INTO segmentation_tasks (
          id, image_id, image_path, parameters, priority, status, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, 'queued', NOW(), NOW())
      `,
        [taskId, imageId, imagePath, parameters, priority]
      );

      logger.info('Nová úloha segmentace byla přidána do fronty:', {
        taskId,
        imageId,
        priority,
      });

      // Aktualizace stavu fronty
      await this.updateQueueStatus();

      // Pokud je ML služba dostupná a fronta se nezpracovává, spustíme zpracování
      if (this.mlServiceAvailable && !this.isProcessing) {
        setTimeout(() => this.processQueue(), 100);
      }

      return taskId;
    } catch (error) {
      logger.error('Chyba při přidávání úlohy segmentace do fronty:', {
        error,
        imageId,
      });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ApiError(`Nelze přidat úlohu segmentace do fronty: ${errorMessage}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Zruší úlohu segmentace
   */
  public async cancelTask(imageId: string): Promise<boolean> {
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    try {
      // Aktualizace stavu úlohy
      const result = await client.query(
        `
        UPDATE segmentation_tasks
        SET status = 'cancelled', updated_at = NOW()
        WHERE image_id = $1 AND status IN ('queued', 'processing')
        RETURNING id
      `,
        [imageId]
      );

      if (result.rows.length === 0) {
        logger.info('Žádná aktivní úloha segmentace nebyla nalezena pro zrušení:', { imageId });
        return false;
      }

      const taskId = result.rows[0].id;
      logger.info('Úloha segmentace byla zrušena:', { taskId, imageId });

      // Aktualizace stavu segmentace
      await this.updateSegmentationStatus(client, imageId, 'cancelled');

      // Aktualizace stavu fronty
      await this.updateQueueStatus();

      return true;
    } catch (error) {
      logger.error('Chyba při rušení úlohy segmentace:', { error, imageId });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ApiError(`Nelze zrušit úlohu segmentace: ${errorMessage}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Získá stav fronty
   */
  public getQueueStatus(): QueueStatus {
    return this.queueStatus;
  }

  /**
   * Manually trigger a queue status update
   */
  public async forceQueueUpdate(): Promise<void> {
    await this.updateQueueStatus();
  }

  /**
   * Získá stav úlohy
   */
  public async getTaskStatus(taskId: string): Promise<SegmentationTask | null> {
    const dbPool = pool.getPool();
    const client = await dbPool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          id, 
          image_id, 
          status, 
          priority, 
          created_at, 
          updated_at,
          error,
          parameters,
          result
        FROM segmentation_tasks 
        WHERE id = $1
      `,
        [taskId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as SegmentationTask;
    } catch (error) {
      logger.error('Chyba při získávání stavu úlohy:', { error, taskId });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new ApiError(`Nelze získat stav úlohy: ${errorMessage}`, 500);
    } finally {
      client.release();
    }
  }
}

// Vytvoření instance služby
const segmentationQueueService = new SegmentationQueueService();

// Export the instance as default
export default segmentationQueueService;

// Also export the individual methods for backward compatibility
export const queueSegmentationJob = async (imageId: string, options: any) => {
  return segmentationQueueService.addTask(
    imageId,
    options.imagePath || '',
    options.parameters || {},
    options.priority || 1
  );
};

export const getJobStatus = async (jobId: string) => {
  return segmentationQueueService.getTaskStatus(jobId);
};

export const cancelJob = async (jobId: string) => {
  // Try to find the task by ID first
  const task = await segmentationQueueService.getTaskStatus(jobId);
  if (task) {
    return segmentationQueueService.cancelTask(task.imageId);
  }
  return false;
};
