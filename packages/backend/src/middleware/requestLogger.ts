import { Request, Response, NextFunction } from 'express';
import { Express } from 'express';

/**
 * Middleware to log incoming requests.
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url, ip } = req;

  // Log start of the request
  console.log(`--> ${ip} ${method} ${url}`);

  // Log completion of the response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`<-- ${ip} ${method} ${url} ${statusCode} ${duration}ms`);
  });

  next();
};

/**
 * Setup request logger middleware for Express application
 * @param app Express application instance
 */
export const setupRequestLogger = (app: Express) => {
  app.use(requestLogger);
};
