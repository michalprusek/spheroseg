import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ApiResponse } from './apiResponse';

interface RouteParams {
  filename: string;
}

export function createRouteHandler<
  ResBody = {},
  ReqBody = {},
  ReqQuery = {}
>(
  handler: (
    req: Request<RouteParams, ApiResponse<ResBody>, ReqBody, ReqQuery>,
    res: Response<ApiResponse<ResBody>>,
    next: NextFunction
  ) => Promise<void> | void
): RequestHandler<RouteParams, ApiResponse<ResBody>, ReqBody, ReqQuery> {
  return (req, res, next) => {
    try {
      const result = handler(req, res, next);
      if (result instanceof Promise) {
        result.catch(next);
      }
    } catch (err) {
      next(err);
    }
  };
}