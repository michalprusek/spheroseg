/**
 * Middleware Composition Utility
 * 
 * Provides utilities for composing and organizing middleware in a clear pipeline
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';

export type Middleware = RequestHandler | RequestHandler[];

/**
 * Compose multiple middleware into a single middleware function
 * Middleware are executed in order
 */
export function compose(...middleware: Middleware[]): RequestHandler {
  const flattened = middleware.flat();
  
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;
    
    function dispatch(err?: any): void {
      if (err) {
        return next(err);
      }
      
      if (index >= flattened.length) {
        return next();
      }
      
      const fn = flattened[index++];
      
      try {
        fn(req, res, dispatch);
      } catch (error) {
        next(error);
      }
    }
    
    dispatch();
  };
}

/**
 * Conditionally apply middleware based on a predicate
 */
export function conditional(
  predicate: (req: Request) => boolean,
  middleware: Middleware
): RequestHandler {
  const handler = Array.isArray(middleware) ? compose(...middleware) : middleware;
  
  return (req: Request, res: Response, next: NextFunction) => {
    if (predicate(req)) {
      handler(req, res, next);
    } else {
      next();
    }
  };
}

/**
 * Apply middleware only to specific HTTP methods
 */
export function methods(
  allowedMethods: string[],
  middleware: Middleware
): RequestHandler {
  return conditional(
    (req) => allowedMethods.includes(req.method.toUpperCase()),
    middleware
  );
}

/**
 * Apply middleware only to paths matching a pattern
 */
export function pathMatch(
  pattern: string | RegExp,
  middleware: Middleware
): RequestHandler {
  return conditional(
    (req) => {
      if (typeof pattern === 'string') {
        return req.path.startsWith(pattern);
      }
      return pattern.test(req.path);
    },
    middleware
  );
}

/**
 * Skip middleware for certain paths
 */
export function skipPaths(
  paths: (string | RegExp)[],
  middleware: Middleware
): RequestHandler {
  return conditional(
    (req) => {
      return !paths.some(path => {
        if (typeof path === 'string') {
          return req.path.startsWith(path);
        }
        return path.test(req.path);
      });
    },
    middleware
  );
}

/**
 * Create a middleware pipeline with named stages
 */
export class MiddlewarePipeline {
  private stages: Map<string, RequestHandler[]> = new Map();
  private order: string[] = [];
  
  /**
   * Add a middleware stage
   */
  stage(name: string, ...middleware: Middleware[]): this {
    if (!this.stages.has(name)) {
      this.order.push(name);
    }
    this.stages.set(name, middleware.flat());
    return this;
  }
  
  /**
   * Insert middleware before a specific stage
   */
  before(stageName: string, newStageName: string, ...middleware: Middleware[]): this {
    const index = this.order.indexOf(stageName);
    if (index === -1) {
      throw new Error(`Stage "${stageName}" not found`);
    }
    
    this.order.splice(index, 0, newStageName);
    this.stages.set(newStageName, middleware.flat());
    return this;
  }
  
  /**
   * Insert middleware after a specific stage
   */
  after(stageName: string, newStageName: string, ...middleware: Middleware[]): this {
    const index = this.order.indexOf(stageName);
    if (index === -1) {
      throw new Error(`Stage "${stageName}" not found`);
    }
    
    this.order.splice(index + 1, 0, newStageName);
    this.stages.set(newStageName, middleware.flat());
    return this;
  }
  
  /**
   * Replace a stage with new middleware
   */
  replace(stageName: string, ...middleware: Middleware[]): this {
    if (!this.stages.has(stageName)) {
      throw new Error(`Stage "${stageName}" not found`);
    }
    
    this.stages.set(stageName, middleware.flat());
    return this;
  }
  
  /**
   * Remove a stage
   */
  remove(stageName: string): this {
    const index = this.order.indexOf(stageName);
    if (index !== -1) {
      this.order.splice(index, 1);
      this.stages.delete(stageName);
    }
    return this;
  }
  
  /**
   * Build the final middleware function
   */
  build(): RequestHandler {
    const allMiddleware: RequestHandler[] = [];
    
    for (const stageName of this.order) {
      const stageMiddleware = this.stages.get(stageName);
      if (stageMiddleware) {
        allMiddleware.push(...stageMiddleware);
      }
    }
    
    return compose(...allMiddleware);
  }
  
  /**
   * Get a list of all stages in order
   */
  getStages(): string[] {
    return [...this.order];
  }
}

/**
 * Wrap async middleware to handle errors
 */
export function asyncWrapper(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Create a middleware that adds properties to the request
 */
export function extend<T extends Record<string, any>>(
  properties: T | ((req: Request) => T)
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const props = typeof properties === 'function' ? properties(req) : properties;
    Object.assign(req, props);
    next();
  };
}

/**
 * Create a middleware that logs timing information
 */
export function timing(name: string, logger?: (message: string) => void): RequestHandler {
  const log = logger || console.log;
  
  return (req: Request, res: Response, next: NextFunction) => {
    const start = process.hrtime.bigint();
    
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6; // Convert to milliseconds
      log(`[${name}] ${req.method} ${req.path} - ${duration.toFixed(2)}ms`);
    });
    
    next();
  };
}