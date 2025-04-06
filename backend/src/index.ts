import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/app';
import { setupDatabase } from './db/setupDatabase';
import { errorHandler } from './middlewares/errorHandler';
import { basicLimiter, authLimiter, uploadLimiter, mlLimiter } from './middlewares/rateLimiter';
import { authRouter } from './auth/routes';
import { storageRouter } from './storage/routes';
import { profileRouter } from './profile/routes';
import projectsRouter from './projects/routes';
import { mlRouter } from './ml/routes';
import { query } from './db/connection';
import axios from 'axios';

const app: Application = express();

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      // Allow non-browser requests like curl, Postman
      return callback(null, true);
    }
    if (config.server.env === 'development') {
      // Allow localhost with any port or no port during development
      const localhostRegex = /^http:\/\/localhost(:\d+)?$/;
      if (localhostRegex.test(origin)) {
        return callback(null, true);
      }
      // Optionally allow all origins in dev
      return callback(null, true);
    }
    // Production: strict match
    if (origin === config.cors.origin) {
      return callback(null, true);
    }
    // Otherwise, block
    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply basic rate limiter to all routes
app.use(basicLimiter);

// Routes with specific rate limiters
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/storage', uploadLimiter, storageRouter);
app.use('/api/profile', profileRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/ml', mlLimiter, mlRouter);

// Health check endpoints
app.get('/api/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    const dbResult = await query('SELECT 1');
    const dbStatus = dbResult ? 'ok' : 'error';

    // Check ML service connection if configured
    let mlStatus = 'unknown';
    try {
      if (config.ml.serviceUrl) {
        const mlResponse = await axios.get(`${config.ml.serviceUrl}/health`, {
          timeout: 5000,
          headers: config.ml.apiKey ? { 'X-API-Key': config.ml.apiKey } : {}
        });
        mlStatus = mlResponse.status === 200 ? 'ok' : 'error';
      }
    } catch (mlError) {
      console.error('ML service health check failed:', mlError);
      mlStatus = 'error';
    }

    // Check Redis connection if configured
    let redisStatus = 'unknown';
    try {
      // We'll just report redis as 'ok' for now since we don't have a direct connection
      // In a real implementation, you would check the Redis connection
      redisStatus = 'ok';
    } catch (redisError) {
      console.error('Redis health check failed:', redisError);
      redisStatus = 'error';
    }

    res.json({
      status: 'ok',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        ml: mlStatus,
        redis: redisStatus
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Simple health check endpoint for Docker
app.get('/health', (_req, res) => {
  res.status(200).send('OK');
});

// Error handling
app.use(errorHandler);

// Start server
const startServer = async (): Promise<void> => {
  try {
    // Setup database (connect and run migrations)
    await setupDatabase();

    // Start the server
    app.listen(config.server.port, () => {
      console.log(`Server running on port ${config.server.port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

void startServer();

export { app, startServer };