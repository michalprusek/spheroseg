import { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ApiResponse } from './apiResponse';
import type { FileParams } from '../types/express';

export function asyncRouteHandler<
  ResBody = {},
  ReqBody = {},
  ReqQuery = {}
>(
  handler: (
    req: Request<FileParams, ApiResponse<ResBody>, ReqBody, ReqQuery>,
    res: Response<ApiResponse<ResBody>>,
    next: NextFunction
  ) => Promise<void>
): RequestHandler<FileParams, ApiResponse<ResBody>, ReqBody, ReqQuery> {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}