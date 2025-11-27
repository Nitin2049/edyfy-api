import { Request, Response, NextFunction } from "express";

/**
 * Wraps async route handlers and passes errors to next() automatically
 * So you don’t need try/catch in every controller 🚀
 */

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
