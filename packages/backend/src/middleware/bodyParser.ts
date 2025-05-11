import express, { Express } from 'express';
import config from '../config';

/**
 * Configure and apply Express body parser middleware
 * @param app Express application
 */
export function setupBodyParser(app: Express): void {
  // Parse JSON bodies with size limit from config
  app.use(
    express.json({
      limit: config.server.maxRequestSize || '100mb',
    }),
  );

  // Parse URL-encoded bodies (as sent by HTML forms)
  app.use(
    express.urlencoded({
      extended: true,
      limit: config.server.maxRequestSize || '100mb',
    }),
  );
}

export default setupBodyParser;
