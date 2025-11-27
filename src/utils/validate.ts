import { z } from "zod";
import type { ZodType } from "zod";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError.js";

export const validate = <T extends ZodType<any>>(schema: T) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const flat = result.error.flatten();
      const fieldMsgs = Object.values(flat.fieldErrors || {}).flat();
      const messages = [
        ...((flat.formErrors as string[]) || []),
        ...((fieldMsgs as string[]) || []),
      ].filter(Boolean);
      return next(
        new AppError("VALIDATION_ERROR", {
          details: flat,
          messages,
        })
      );
    }
    // sanitized + validated body
    req.body = result.data as z.infer<T>;
    next();
  };