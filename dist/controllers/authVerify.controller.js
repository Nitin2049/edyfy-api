import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { asyncHandler } from "../utils/asyncHandler.js";
// ------------------ VERIFY ------------------
export const verifyToken = asyncHandler(async (req, res, next) => {
    try {
        const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
        const JWT_ISSUER = process.env.JWT_ISSUER;
        const JWT_AUDIENCE = process.env.JWT_AUDIENCE;
        if (!ACCESS_SECRET)
            throw new AppError("INTERNAL_SERVER_ERROR");
        // Using httpOnly cookie set on login
        const cookieToken = req?.cookies?.accessToken;
        console.log("Cookies:", req.cookies); // debug
        // No token = user not logged in (not an error, just not authenticated)
        if (!cookieToken) {
            return ResponseHelper.success(res, { user: null }, SUCCESS_CODES.OPERATION_SUCCESS);
        }
        // Verify JWT
        const decoded = jwt.verify(cookieToken, ACCESS_SECRET, {
            algorithms: ["HS256"],
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        });
        // Fetch user
        const user = await User.findById(decoded.sub)
            .select("_id username role schoolId email")
            .lean();
        if (!user) {
            // User not found - clear invalid cookie and return null
            return ResponseHelper.success(res, { user: null }, SUCCESS_CODES.OPERATION_SUCCESS);
        }
        return ResponseHelper.success(res, { user }, SUCCESS_CODES.OPERATION_SUCCESS);
    }
    catch (err) {
        // Token expired or invalid - return null user instead of error
        // This is expected for logged-out users or expired sessions
        return ResponseHelper.success(res, { user: null }, SUCCESS_CODES.OPERATION_SUCCESS);
    }
});
