/**
 * Vylepšená služba pro frontu segmentace
 *
 * Tato služba poskytuje robustní implementaci fronty pro segmentační úlohy:
 * - Perzistentní ukládání úloh do databáze
 * - Prioritní zpracování úloh
 * - Automatické opakování neúspěšných úloh
 * - Monitorování stavu ML služby
 * - Škálovatelné zpracování úloh
 * - Detailní logování a metriky
 */

import { Pool, PoolClient } from 'pg';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import pool from '../db';
import logger from '../utils/logger';
import config from '../config';
import { ApiError } from '../utils/errors';
import { getIO } from '../socket';

// Konfigurace
const ML_SERVICE_URL = config.ml.serviceUrl || 'http://localhost:5002';
const MAX_RETRIES = config.ml.maxRetries || 3;
const RETRY_DELAY = config.ml.retryDelay || 5000; // ms
const MAX_CONCURRENT_TASKS = config.ml.maxConcurrentTasks || 2;
const HEALTH_CHECK_INTERVAL = config.ml.healthCheckInterval || 60000; // ms
const QUEUE_UPDATE_INTERVAL = config.ml.queueUpdateInterval || 5000; // ms

// Typy a rozhraní
export enum TaskStatus {
  PENDING = 'pending',
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
    this.initializeService();
  }

  /**
   * Inicializuje službu
   */
  private async initializeService(): Promise<void> {
    try {
      // Ověření existence tabulky
      await this.ensureTaskTableExists();

      // Spuštění pravidelných kontrol
      this.startHealthCheck();
      this.startQueueProcessor();
      this.startQueueStatusUpdater();

      logger.info('Služba fronty segmentace byla inicializována');
    } catch (error) {
      logger.error('Chyba při inicializaci služby fronty segmentace:', {
        error,
      });
    }
  }

  /**
   * Zajistí existenci tabulky pro úlohy
   */
  private async ensureTaskTableExists(): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Kontrola existence typu task_status
      const typeCheck = await client.query(`
        SELECT typname FROM pg_type WHERE typname = 'task_status';
      `);

      if (typeCheck.rows.length === 0) {
        await client.query(`
          CREATE TYPE task_status AS ENUM (
            'pending', 'processing', 'completed', 'failed', 'cancelled'
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
          status task_status DEFAULT 'pending',
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
   * Spustí pravidelnou kontrolu stavu ML služby
   */
  private startHealthCheck(): void {
    setInterval(async () => {
      try {
        const response = await fetch(`${ML_SERVICE_URL}/health`, {
          timeout: 5000,
        });

        this.mlServiceAvailable = response.ok;
        this.queueStatus.mlServiceStatus = response.ok ? 'online' : 'offline';

        if (response.ok) {
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
      const client = await pool.connect();
      try {
        // Získání počtu úloh podle stavu
        const pendingResult = await client.query(`
          SELECT id FROM segmentation_tasks 
          WHERE status = 'pending'
          ORDER BY priority DESC, created_at ASC
        `);

        const runningResult = await client.query(`
          SELECT id FROM segmentation_tasks 
          WHERE status = 'processing'
        `);

        // Aktualizace stavu fronty
        this.queueStatus = {
          pendingTasks: pendingResult.rows.map((row) => row.id),
          runningTasks: runningResult.rows.map((row) => row.id),
          queueLength: pendingResult.rows.length,
          activeTasksCount: runningResult.rows.length,
          mlServiceStatus: this.mlServiceAvailable ? 'online' : 'offline',
          lastUpdated: new Date(),
        };

        // Emitování události aktualizace fronty
        this.emit('queue:updated', this.queueStatus);

        // Odeslání aktualizace přes WebSocket
        try {
          const io = getIO();
          io.emit('segmentation_queue_update', {
            ...this.queueStatus,
            timestamp: new Date().toISOString(),
          });
        } catch (socketError) {
          logger.error('Chyba při odesílání aktualizace fronty přes WebSocket:', { error: socketError });
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
      const client = await pool.connect();
      try {
        // Získání úloh ke zpracování
        const result = await client.query(
          `
          SELECT id, image_id, image_path, parameters, priority, retries
          FROM segmentation_tasks
          WHERE status = 'pending'
          ORDER BY priority DESC, created_at ASC
          LIMIT $1
        `,
          [MAX_CONCURRENT_TASKS],
        );

        if (result.rows.length === 0) {
          this.isProcessing = false;
          return;
        }

        // Zpracování úloh paralelně
        const processingPromises = result.rows.map((task) =>
          this.processTask(task.id, task.image_id, task.image_path, task.parameters, task.retries),
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
    retries: number,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Označení úlohy jako zpracovávané
      await client.query(
        `
        UPDATE segmentation_tasks
        SET status = 'processing', started_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
        [taskId],
      );

      // Aktualizace stavu segmentace v databázi
      await this.updateSegmentationStatus(client, imageId, 'processing');

      // Odeslání požadavku na ML službu
      try {
        const response = await fetch(`${ML_SERVICE_URL}/segment`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_path: imagePath,
            parameters,
          }),
          timeout: 300000, // 5 minut
        });

        if (!response.ok) {
          throw new Error(`ML služba vrátila chybu: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();

        // Uložení výsledku
        await client.query(
          `
          UPDATE segmentation_tasks
          SET status = 'completed', result = $1, completed_at = NOW(), updated_at = NOW()
          WHERE id = $2
        `,
          [result, taskId],
        );

        // Aktualizace výsledku segmentace v databázi
        await this.updateSegmentationResult(client, imageId, result);

        // Aktualizace stavu segmentace
        await this.updateSegmentationStatus(client, imageId, 'completed');

        logger.info('Úloha segmentace byla úspěšně dokončena:', {
          taskId,
          imageId,
        });
      } catch (error) {
        // Zpracování chyby
        logger.error('Chyba při zpracování úlohy segmentace:', {
          error,
          taskId,
          imageId,
        });

        if (retries < MAX_RETRIES) {
          // Opakování úlohy
          await client.query(
            `
            UPDATE segmentation_tasks
            SET status = 'pending', retries = retries + 1, error = $1, updated_at = NOW()
            WHERE id = $2
          `,
            [error.message, taskId],
          );

          logger.info('Úloha segmentace bude opakována:', {
            taskId,
            imageId,
            retries: retries + 1,
          });
        } else {
          // Označení úlohy jako neúspěšné
          await client.query(
            `
            UPDATE segmentation_tasks
            SET status = 'failed', error = $1, completed_at = NOW(), updated_at = NOW()
            WHERE id = $2
          `,
            [error.message, taskId],
          );

          // Aktualizace stavu segmentace
          await this.updateSegmentationStatus(client, imageId, 'failed', error.message);

          logger.error('Úloha segmentace selhala po maximálním počtu pokusů:', {
            taskId,
            imageId,
            maxRetries: MAX_RETRIES,
          });
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Aktualizuje stav segmentace v databázi
   */
  private async updateSegmentationStatus(
    client: PoolClient,
    imageId: string,
    status: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      // Kontrola existence záznamu
      const checkResult = await client.query(
        `
        SELECT 1 FROM segmentation_results WHERE image_id = $1
      `,
        [imageId],
      );

      if (checkResult.rows.length === 0) {
        // Vytvoření nového záznamu
        await client.query(
          `
          INSERT INTO segmentation_results (image_id, status, error)
          VALUES ($1, $2, $3)
        `,
          [imageId, status, errorMessage || null],
        );
      } else {
        // Aktualizace existujícího záznamu
        await client.query(
          `
          UPDATE segmentation_results
          SET status = $1, error = $2, updated_at = NOW()
          WHERE image_id = $3
        `,
          [status, errorMessage || null, imageId],
        );
      }

      // Aktualizace stavu obrázku
      await client.query(
        `
        UPDATE images
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [status, imageId],
      );

      // Odeslání notifikace přes WebSocket
      try {
        // Získání ID uživatele pro obrázek
        const userQuery = await client.query(
          `
          SELECT user_id FROM images WHERE id = $1
        `,
          [imageId],
        );

        if (userQuery.rows.length > 0) {
          const userId = userQuery.rows[0].user_id;

          const io = getIO();
          io.to(userId).emit('segmentation_update', {
            imageId,
            status,
            error: errorMessage,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (socketError) {
        logger.error('Chyba při odesílání notifikace o stavu segmentace:', {
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
  private async updateSegmentationResult(client: PoolClient, imageId: string, result: any): Promise<void> {
    try {
      // Extrakce polygonů z výsledku
      const polygons = result.polygons || [];

      // Uložení výsledku do databáze
      await client.query(
        `
        UPDATE segmentation_results
        SET result_data = $1, updated_at = NOW()
        WHERE image_id = $2
      `,
        [{ polygons }, imageId],
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
    priority: TaskPriority = TaskPriority.NORMAL,
  ): Promise<string> {
    const client = await pool.connect();
    try {
      // Kontrola existence úlohy
      const checkResult = await client.query(
        `
        SELECT id, status FROM segmentation_tasks
        WHERE image_id = $1 AND status IN ('pending', 'processing')
      `,
        [imageId],
      );

      if (checkResult.rows.length > 0) {
        const existingTask = checkResult.rows[0];

        // Pokud je úloha již ve frontě nebo se zpracovává, aktualizujeme prioritu
        if (existingTask.status === 'pending') {
          await client.query(
            `
            UPDATE segmentation_tasks
            SET priority = $1, parameters = $2, updated_at = NOW()
            WHERE id = $3
          `,
            [priority, parameters, existingTask.id],
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
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW(), NOW())
      `,
        [taskId, imageId, imagePath, parameters, priority],
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
      throw new ApiError(`Nelze přidat úlohu segmentace do fronty: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }

  /**
   * Zruší úlohu segmentace
   */
  public async cancelTask(imageId: string): Promise<boolean> {
    const client = await pool.connect();
    try {
      // Aktualizace stavu úlohy
      const result = await client.query(
        `
        UPDATE segmentation_tasks
        SET status = 'cancelled', updated_at = NOW()
        WHERE image_id = $1 AND status IN ('pending', 'processing')
        RETURNING id
      `,
        [imageId],
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
      throw new ApiError(`Nelze zrušit úlohu segmentace: ${error.message}`, 500);
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
   * Získá stav úlohy
   */
  public async getTaskStatus(taskId: string): Promise<SegmentationTask | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT * FROM segmentation_tasks WHERE id = $1
      `,
        [taskId],
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as SegmentationTask;
    } catch (error) {
      logger.error('Chyba při získávání stavu úlohy:', { error, taskId });
      throw new ApiError(`Nelze získat stav úlohy: ${error.message}`, 500);
    } finally {
      client.release();
    }
  }
}

// Vytvoření instance služby
const segmentationQueueService = new SegmentationQueueService();

export default segmentationQueueService;
