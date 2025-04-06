import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ApiResponse } from './apiResponse';

export function createHandler<
  ResBody = {},
  ReqBody = {},
  ReqQuery = {}
>(
  handler: (
    req: Request<{ filename: string }, ApiResponse<ResBody>, ReqBody, ReqQuery>,
    res: Response<ApiResponse<ResBody>>,
    next: NextFunction
  ) => Promise<void> | void
): RequestHandler<{ filename: string }, ApiResponse<ResBody>, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

export function wrapMiddleware(
  middleware: RequestHandler
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(middleware(req, res, next)).catch(next);
  };
}