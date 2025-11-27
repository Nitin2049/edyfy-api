import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ------------------ VERIFY ------------------
export const verifyToken = asyncHandler(async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET as string | undefined;
    const JWT_ISSUER = process.env.JWT_ISSUER;
    const JWT_AUDIENCE = process.env.JWT_AUDIENCE;
    if (!ACCESS_SECRET) throw new AppError("INTERNAL_SERVER_ERROR");

    // Try to get token from Authorization header first, then fall back to cookie
    let token: string | undefined;
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7); // Remove "Bearer " prefix
    } else {
      // Fall back to cookie
      token = (req as any)?.cookies?.accessToken as string | undefined;
    }

    console.log("Verify - Token source:", authHeader ? "Authorization header" : "Cookie");
    console.log("Verify - Token present:", !!token);

    // No token = user not logged in (not an error, just not authenticated)
    if (!token) {
      return ResponseHelper.success(
        res,
        { user: null },
        SUCCESS_CODES.OPERATION_SUCCESS
      );
    }

    // Verify JWT
    const decoded = jwt.verify(token, ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as any;

    // Fetch user
    const user = await User.findById(decoded.sub)
      .select("_id username role schoolId email")
      .lean();
    if (!user) {
      // User not found - return null
      return ResponseHelper.success(
        res,
        { user: null },
        SUCCESS_CODES.OPERATION_SUCCESS
      );
    }

    return ResponseHelper.success(
      res,
      { user },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  } catch (err: any) {
    // Token expired or invalid - return null user instead of error
    // This is expected for logged-out users or expired sessions
    return ResponseHelper.success(
      res,
      { user: null },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }
});