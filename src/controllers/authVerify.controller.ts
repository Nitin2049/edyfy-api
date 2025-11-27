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

    // Using httpOnly cookie set on login
    const cookieToken = (req as any)?.cookies?.accessToken as
      | string
      | undefined;

    console.log("Cookies:", req.cookies); // debug

    if (!cookieToken)
      return next(new AppError("ACCESS_DENIED", { reason: "No token found" }));

    // Verify JWT
    const decoded = jwt.verify(cookieToken, ACCESS_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as any;

    // Fetch user
    const user = await User.findById(decoded.sub)
      .select("_id username role schoolId email")
      .lean();
    if (!user)
      return next(
        new AppError("RESOURCE_NOT_FOUND", { reason: "User not found" })
      );

    return ResponseHelper.success(
      res,
      { user },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new AppError("ACCESS_DENIED", { reason: "Token expired" });
    }
    throw new AppError("ACCESS_DENIED", { reason: err.message });
  }
});