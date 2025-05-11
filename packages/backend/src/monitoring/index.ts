/**
 * Centralizovaný monitoring a logování
 *
 * Tento modul poskytuje nástroje pro monitoring a logování:
 * - Strukturované logování s různými úrovněmi
 * - Metriky pro sledování výkonu
 * - Sledování chyb a výjimek
 * - Sledování požadavků a odpovědí
 * - Sledování stavu služeb
 */

import { Request as ExpressRequest, Response, NextFunction } from 'express';
import { Counter, Gauge, Histogram, register } from 'prom-client';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';

// Rozšíření typu Request o vlastnosti requestId a startTime
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

// Alias pro Request
type Request = ExpressRequest;

// Konfigurace
const LOG_LEVEL = config.logging.level || 'info';
const METRICS_ENABLED = config.monitoring.metricsEnabled !== false;
const METRICS_PREFIX = config.monitoring.metricsPrefix || 'spheroseg_';
const REQUEST_TIMEOUT_MS = config.monitoring.requestTimeoutMs || 30000;

// Inicializace Winston loggeru
const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'spheroseg-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, ...rest }) => {
          const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
          return `${timestamp} [${level}]: ${message} ${meta}`;
        }),
      ),
    }),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Metriky Prometheus
let httpRequestDurationMicroseconds: Histogram<string>;
let httpRequestCounter: Counter<string>;
let httpErrorCounter: Counter<string>;
let databaseQueryDurationMicroseconds: Histogram<string>;
let databaseErrorCounter: Counter<string>;
let mlServiceRequestDurationMicroseconds: Histogram<string>;
let mlServiceErrorCounter: Counter<string>;
let activeRequestsGauge: Gauge<string>;
let segmentationQueueSizeGauge: Gauge<string>;

// Inicializace metrik
if (METRICS_ENABLED) {
  // Registrace defaultního kolektoru
  register.setDefaultLabels({
    app: 'spheroseg-backend',
  });

  // HTTP metriky
  httpRequestDurationMicroseconds = new Histogram({
    name: `${METRICS_PREFIX}http_request_duration_seconds`,
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  });

  httpRequestCounter = new Counter({
    name: `${METRICS_PREFIX}http_requests_total`,
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });

  httpErrorCounter = new Counter({
    name: `${METRICS_PREFIX}http_errors_total`,
    help: 'Total number of HTTP errors',
    labelNames: ['method', 'route', 'status_code', 'error_type'],
  });

  // Databázové metriky
  databaseQueryDurationMicroseconds = new Histogram({
    name: `${METRICS_PREFIX}database_query_duration_seconds`,
    help: 'Duration of database queries in seconds',
    labelNames: ['query_type'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  });

  databaseErrorCounter = new Counter({
    name: `${METRICS_PREFIX}database_errors_total`,
    help: 'Total number of database errors',
    labelNames: ['query_type', 'error_type'],
  });

  // ML service metriky
  mlServiceRequestDurationMicroseconds = new Histogram({
    name: `${METRICS_PREFIX}ml_service_request_duration_seconds`,
    help: 'Duration of ML service requests in seconds',
    labelNames: ['endpoint'],
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
  });

  mlServiceErrorCounter = new Counter({
    name: `${METRICS_PREFIX}ml_service_errors_total`,
    help: 'Total number of ML service errors',
    labelNames: ['endpoint', 'error_type'],
  });

  // Další metriky
  activeRequestsGauge = new Gauge({
    name: `${METRICS_PREFIX}active_requests`,
    help: 'Number of active requests',
  });

  segmentationQueueSizeGauge = new Gauge({
    name: `${METRICS_PREFIX}segmentation_queue_size`,
    help: 'Size of the segmentation queue',
    labelNames: ['status'],
  });
}

/**
 * Middleware pro logování požadavků
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  // Přidání ID požadavku
  const requestId = uuidv4();
  req.requestId = requestId;

  // Přidání časového razítka
  const startTime = Date.now();
  req.startTime = startTime;

  // Logování požadavku
  logger.info(`HTTP ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Inkrementace počtu aktivních požadavků
  if (METRICS_ENABLED) {
    activeRequestsGauge.inc();
  }

  // Timeout pro dlouho trvající požadavky
  const timeoutId = setTimeout(() => {
    logger.warn(`Request timeout: HTTP ${req.method} ${req.path}`, {
      requestId,
      method: req.method,
      path: req.path,
      elapsedMs: Date.now() - startTime,
    });
  }, REQUEST_TIMEOUT_MS);

  // Zachycení ukončení požadavku
  res.on('finish', () => {
    // Zrušení timeoutu
    clearTimeout(timeoutId);

    // Výpočet doby trvání
    const duration = (Date.now() - startTime) / 1000;

    // Logování odpovědi
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    logger[logLevel](`HTTP ${req.method} ${req.path} ${res.statusCode}`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationSeconds: duration,
    });

    // Aktualizace metrik
    if (METRICS_ENABLED) {
      const route = req.route?.path || 'unknown';

      httpRequestDurationMicroseconds.labels(req.method, route, res.statusCode.toString()).observe(duration);

      httpRequestCounter.labels(req.method, route, res.statusCode.toString()).inc();

      if (res.statusCode >= 400) {
        httpErrorCounter
          .labels(req.method, route, res.statusCode.toString(), res.statusCode >= 500 ? 'server_error' : 'client_error')
          .inc();
      }

      // Dekrementace počtu aktivních požadavků
      activeRequestsGauge.dec();
    }
  });

  next();
}

/**
 * Middleware pro zachycení chyb
 */
export function errorHandlerMiddleware(err: any, req: Request, res: Response, next: NextFunction) {
  // Získání informací o požadavku
  const requestId = req.requestId || uuidv4();
  const startTime = req.startTime || Date.now();
  const duration = (Date.now() - startTime) / 1000;

  // Logování chyby
  logger.error(`Error in HTTP ${req.method} ${req.path}`, {
    requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    durationSeconds: duration,
  });

  // Aktualizace metrik
  if (METRICS_ENABLED) {
    const route = req.route?.path || 'unknown';
    const statusCode = err.statusCode || 500;

    httpRequestDurationMicroseconds.labels(req.method, route, statusCode.toString()).observe(duration);

    httpRequestCounter.labels(req.method, route, statusCode.toString()).inc();

    httpErrorCounter.labels(req.method, route, statusCode.toString(), err.name || 'InternalServerError').inc();

    // Dekrementace počtu aktivních požadavků
    activeRequestsGauge.dec();
  }

  // Formátování odpovědi
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.details || null;

  res.status(statusCode).json({
    error: {
      message,
      details,
      requestId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Měření doby trvání databázového dotazu
 */
export function measureDatabaseQuery<T>(queryType: string, queryFn: () => Promise<T>): Promise<T> {
  const startTime = Date.now();

  return queryFn()
    .then((result) => {
      // Měření doby trvání
      const duration = (Date.now() - startTime) / 1000;

      // Aktualizace metrik
      if (METRICS_ENABLED) {
        databaseQueryDurationMicroseconds.labels(queryType).observe(duration);
      }

      return result;
    })
    .catch((error) => {
      // Měření doby trvání
      const duration = (Date.now() - startTime) / 1000;

      // Logování chyby
      logger.error(`Database query error: ${queryType}`, {
        queryType,
        error: error.message,
        stack: error.stack,
        durationSeconds: duration,
      });

      // Aktualizace metrik
      if (METRICS_ENABLED) {
        databaseQueryDurationMicroseconds.labels(queryType).observe(duration);

        databaseErrorCounter.labels(queryType, error.name || 'DatabaseError').inc();
      }

      throw error;
    });
}

/**
 * Měření doby trvání požadavku na ML službu
 */
export function measureMlServiceRequest<T>(endpoint: string, requestFn: () => Promise<T>): Promise<T> {
  const startTime = Date.now();

  return requestFn()
    .then((result) => {
      // Měření doby trvání
      const duration = (Date.now() - startTime) / 1000;

      // Aktualizace metrik
      if (METRICS_ENABLED) {
        mlServiceRequestDurationMicroseconds.labels(endpoint).observe(duration);
      }

      return result;
    })
    .catch((error) => {
      // Měření doby trvání
      const duration = (Date.now() - startTime) / 1000;

      // Logování chyby
      logger.error(`ML service request error: ${endpoint}`, {
        endpoint,
        error: error.message,
        stack: error.stack,
        durationSeconds: duration,
      });

      // Aktualizace metrik
      if (METRICS_ENABLED) {
        mlServiceRequestDurationMicroseconds.labels(endpoint).observe(duration);

        mlServiceErrorCounter.labels(endpoint, error.name || 'MlServiceError').inc();
      }

      throw error;
    });
}

/**
 * Aktualizace velikosti fronty segmentace
 */
export function updateSegmentationQueueSize(
  pendingCount: number,
  processingCount: number,
  completedCount: number,
  failedCount: number,
) {
  if (METRICS_ENABLED) {
    segmentationQueueSizeGauge.labels('pending').set(pendingCount);
    segmentationQueueSizeGauge.labels('processing').set(processingCount);
    segmentationQueueSizeGauge.labels('completed').set(completedCount);
    segmentationQueueSizeGauge.labels('failed').set(failedCount);
  }
}

/**
 * Získání metrik ve formátu Prometheus
 */
export function getMetrics(): Promise<string> {
  if (!METRICS_ENABLED) {
    return Promise.resolve('# Metrics are disabled');
  }

  return register.metrics();
}

export default {
  logger,
  requestLoggerMiddleware,
  errorHandlerMiddleware,
  measureDatabaseQuery,
  measureMlServiceRequest,
  updateSegmentationQueueSize,
  getMetrics,
};
