// src/middleware/auth.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const auth = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Strict cookie-based auth: read JWT only from httpOnly cookie
      const token = (req as any)?.cookies?.accessToken as string | undefined;
      console.log("Token from cookie:", token); 

      if (!token) {
        throw new AppError("ACCESS_DENIED", { reason: "No token found" });
      }

      const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string | undefined;
      const JWT_ISSUER = process.env.JWT_ISSUER;
      const JWT_AUDIENCE = process.env.JWT_AUDIENCE;
      
      if (!ACCESS_SECRET) {
        throw new AppError("INTERNAL_SERVER_ERROR", {
          reason: "JWT secret not configured",
        });
      }

      const decoded = jwt.verify(token, ACCESS_SECRET, {
        algorithms: ["HS256"],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as jwt.JwtPayload & {
        sub?: string;
        profileId?: string;
        schoolId?: string;
        role?: string;
        tokenVersion?: number;
      };

      if (typeof decoded !== "object" || !decoded || !decoded.sub || !decoded.role || !decoded.schoolId) {
        throw new AppError("INVALID_CREDENTIALS", { reason: "Invalid token" });
      }

      // If tokenVersion is embedded, verify it against DB to support invalidation
      if (typeof decoded.tokenVersion === "number") {
        const user = await User.findById(decoded.sub)
          .select("tokenVersion")
          .lean()
          .exec();
        if (!user || user.tokenVersion !== decoded.tokenVersion) {
          throw new AppError("INVALID_CREDENTIALS", {
            reason: "Invalid or expired token",
          });
        }
      }

      // Initialize or reuse context
      req.context ??= {};
      if (!req.context.user) {
        req.context.user = Object({
          sub: decoded.sub,
          profileId: decoded.profileId ?? null,
          schoolId: decoded.schoolId ?? null,
          role: decoded.role ?? null,
          tokenVersion: decoded.tokenVersion,
        });
      }

      return next();
    } catch (error: any) {
      throw new AppError("INVALID_CREDENTIALS", { reason: error.message });
    }
  }
);
