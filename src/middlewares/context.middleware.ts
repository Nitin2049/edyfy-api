import { Request, Response, NextFunction } from "express";

export interface RequestContext {
  [key: string]: any;
}

declare module "express-serve-static-core" {
  interface Request {
    context?: RequestContext;
  }
}

export const contextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const user = (req as any).user || {};
  req.context = req.context || {};
  req.context.userId = user.id || user._id || req.context.userId;
  req.context.schoolId = user.schoolId || req.context.schoolId;
  req.context.ip = req.ip;
  next();
};
