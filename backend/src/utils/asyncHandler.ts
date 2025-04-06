import { RequestHandler } from 'express';

export function asyncHandler(fn: (...args: any[]) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}