import { Request, Response, NextFunction } from "express";
import { ResponseHelper } from "../utils/response.helper.js";
import { ERROR_CODES } from "../constants/errorCodes.js";
import { AppError } from "../utils/AppError.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("🔥 Error caught by middleware:", err);

  // If it's our custom AppError
  if (err instanceof AppError) {
    return ResponseHelper.error(res, ERROR_CODES[err.code as keyof typeof ERROR_CODES], err.details);
  }

  // If some other custom thrown error with statusCode
  if (err.statusCode && err.message) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code || "CUSTOM_ERROR",
      message: err.message,
      errors: err.details || null,
    });
  }

  // Fallback for unknown errors
  return ResponseHelper.error(res, ERROR_CODES.INTERNAL_SERVER_ERROR, {
    message: err.message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
};

// Example usage in a route (not part of the middleware file):
//throw new AppError("USER_NOT_FOUND", { id: req.params.id });
//return ResponseHelper.success(res, user, SUCCESS_CODES.DATA_FETCHED);