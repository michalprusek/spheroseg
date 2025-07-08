/**
 * Response compression middleware
 * Compresses responses to reduce bandwidth usage
 */

import compression from 'compression';
import { Request, Response } from 'express';

// Configure compression with optimal settings
export const compressionMiddleware = compression({
  // Compression level (0-9, where 9 is best compression but slowest)
  level: 6,
  
  // Threshold for compression (don't compress small responses)
  threshold: 1024, // 1KB
  
  // Filter function to determine if response should be compressed
  filter: (req: Request, res: Response) => {
    // Don't compress if client doesn't accept encoding
    if (!req.headers['accept-encoding']) {
      return false;
    }
    
    // Use compression filter default
    return compression.filter(req, res);
  },
  
  // Memory level (1-9, where 9 uses most memory but best compression)
  memLevel: 8,
  
  // Strategy
  strategy: 0, // Z_DEFAULT_STRATEGY
});