import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ParamsDictionary, Query } from 'express-serve-static-core';

export function asyncRouteHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query
>(
  handler: (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction
  ) => Promise<void>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}