import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { rateLimit } from 'express-rate-limit';
import 'express-async-errors';
import config from './config/config';
import { errorHandler } from './middleware/errorHandler';
import { setupRoutes } from './routes';
import { createUploadDirsIfNotExist } from './utils/fileStorage';
import { PrismaClient } from '@prisma/client';

// Initialize Prisma client
export const prisma = new PrismaClient();

// Create Express app
const app = express();

// Apply basic middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));
app.use(express.json()); // Parse JSON request body
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded request body
app.use(morgan(config.env === 'production' ? 'combined' : 'dev')); // Request logging

// Apply rate limiting
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Create upload directories if they don't exist
createUploadDirsIfNotExist();

// Setup routes
setupRoutes(app);

// Apply error handler middleware (must be after routes)
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port} in ${config.env} mode`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Close server & exit process with failure
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Close server & exit process with failure
  server.close(() => process.exit(1));
});

// Handle SIGTERM signal
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    prisma.$disconnect(); // Disconnect Prisma client
  });
});

export { app }; 