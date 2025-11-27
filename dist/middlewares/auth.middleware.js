import jwt from "jsonwebtoken";
import { AppError } from "../utils/AppError.js";
import { User } from "../models/user.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
export const auth = asyncHandler(async (req, res, next) => {
    try {
        // Strict cookie-based auth: read JWT only from httpOnly cookie
        const token = req?.cookies?.accessToken;
        console.log("Token from cookie:", token);
        if (!token) {
            throw new AppError("ACCESS_DENIED", { reason: "No token found" });
        }
        const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
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
        });
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
        req.context ?? (req.context = {});
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
    }
    catch (error) {
        // Provide more specific error messages for debugging
        if (error.name === "TokenExpiredError") {
            throw new AppError("ACCESS_DENIED", { message: "Token expired" });
        }
        if (error.name === "JsonWebTokenError") {
            throw new AppError("ACCESS_DENIED", { message: "Invalid token" });
        }
        throw new AppError("ACCESS_DENIED", { message: error.message || "Authentication failed" });
    }
});
