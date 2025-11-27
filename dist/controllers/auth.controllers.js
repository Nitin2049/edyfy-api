import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { User } from "../models/user.model.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { AdminProfile } from "../models/adminProfile.model.js";
import { TeacherProfile } from "../models/teacherProfile.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
async function resolveActiveProfile(userId, role) {
    if (role === "admin") {
        const p = await AdminProfile.findOne({ userId, deletedAt: null })
            .select("_id schoolId status")
            .lean();
        if (!p)
            throw new AppError("RESOURCE_NOT_FOUND", {
                reason: "Admin profile not found",
            });
        return { profile: Object(p), schoolId: String(p.schoolId) };
    }
    if (role === "teacher") {
        const p = await TeacherProfile.findOne({ userId, deletedAt: null })
            .select("_id schoolId address qualification status joinDate exitDate")
            .lean();
        if (!p)
            throw new AppError("RESOURCE_NOT_FOUND", {
                reason: "Teacher profile not found",
            });
        return { profile: Object(p), schoolId: String(p.schoolId) };
    }
    const p = await StudentProfile.findOne({ userId, deletedAt: null })
        .select("_id schoolId admissionNo rollNo classId guardianName guardianNumber dateOfAdmission dateOfLeaving academicReports status")
        .lean();
    if (!p)
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student profile not found",
        });
    return { profile: Object(p), schoolId: String(p.schoolId) };
}
const getEnv = (key) => {
    const val = process.env[key];
    if (!val)
        throw new AppError("INTERNAL_SERVER_ERROR");
    return val;
};
const signToken = (claims, opts) => {
    const secret = (opts.type === "access"
        ? getEnv("JWT_ACCESS_SECRET")
        : getEnv("JWT_REFRESH_SECRET"));
    const issuer = process.env.JWT_ISSUER;
    const audience = process.env.JWT_AUDIENCE;
    const options = {
        algorithm: "HS256",
        expiresIn: opts.expiresIn,
        issuer,
        audience,
    };
    return jwt.sign(claims, secret, options);
};
export const login = asyncHandler(async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password)
            throw new AppError("VALIDATION_ERROR", {
                reason: "Username and password required",
            });
        const user = await User.findOne({ username }).exec();
        if (!user)
            return next(new AppError("INVALID_CREDENTIALS"));
        // Check lock
        if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
            return next(new AppError("ACCESS_DENIED", {
                reason: "Account temporarily locked. Try later.",
            }));
        }
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            // Increment login attempts and possibly lock
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= 5) {
                user.lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min
                user.loginAttempts = 0; // reset after locking
            }
            await user.save();
            return next(new AppError("INVALID_CREDENTIALS"));
        }
        // Reset attempts
        user.loginAttempts = 0;
        user.lockUntil = null;
        user.lastLogin = new Date();
        await user.save();
        const userId = String(user._id); //_id from user model
        const resUser = {
            _id: user._id,
            schoolId: user.schoolId,
            firstName: user.firstName,
            lastName: user.lastName,
            username: user.username,
            email: user.email,
            phone: user.phone,
            role: user.role,
            profileImage: user.profileImage,
            lastLogin: user.lastLogin,
        };
        const { profile, schoolId } = await resolveActiveProfile(userId, user.role);
        const claims = {
            sub: userId,
            profileId: String(profile._id),
            schoolId,
            role: user.role,
            tokenVersion: user.tokenVersion,
        };
        const accessTtl = process.env.JWT_ACCESS_TTL || "15m";
        // const refreshTtl = process.env.JWT_REFRESH_TTL || "7d";
        const accessToken = signToken(claims, {
            type: "access",
            expiresIn: accessTtl,
        });
        // const refreshToken = signToken(claims, {
        //   type: "refresh",
        //   expiresIn: refreshTtl,
        // });
        // Debug: log environment and cookie settings
        const isProduction = process.env.NODE_ENV === "production";
        logger.info("Setting cookie", {
            isProduction,
            NODE_ENV: process.env.NODE_ENV,
            CLIENT_URL: process.env.CLIENT_URL
        });
        res.cookie("accessToken", accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? "none" : "lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });
        logger.info("User logged in", { userId, schoolId });
        return ResponseHelper.success(res, {
            user: resUser,
        }, SUCCESS_CODES.USER_LOGGED_IN);
    }
    catch (err) {
        next(err);
    }
});
// export const refresh = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const { refreshToken } = req.body as { refreshToken: string };
//     if (!refreshToken)
//       return next(
//         new AppError("ACCESS_DENIED", { reason: "Missing credentials" })
//       );
//     const secret = getEnv("JWT_REFRESH_SECRET");
//     const decodedRaw = jwt.verify(refreshToken, secret, {
//       algorithms: ["HS256"],
//       issuer: process.env.JWT_ISSUER,
//       audience: process.env.JWT_AUDIENCE,
//     });
//     if (typeof decodedRaw !== "object" || decodedRaw === null || !decodedRaw.sub || !decodedRaw.role) {
//       return next(new AppError("ACCESS_DENIED"));
//     }
//     const decoded = decodedRaw as any;
//     const sub = typeof decoded.sub === "string" ? decoded.sub : String(decoded.sub);
//     let profileId = decoded.profileId as string | undefined;
//     let schoolId = decoded.schoolId as string | undefined;
//     const role = decoded.role as string | undefined;
//     // Optional: re-check user status
//     const user = await User.findById(sub).exec();
//     if (!user) return next(new AppError("USER_NOT_FOUND"));
//     if (!profileId || !schoolId) {
//       const resolved = await resolveActiveProfile(
//         String(user._id),
//         user.role as "admin" | "teacher" | "student"
//       );
//       profileId = resolved.profileId;
//       schoolId = resolved.schoolId;
//     }
//     const claims: JwtCustomClaims = {
//       sub: String(user._id),
//       profileId,
//       schoolId,
//       role: user.role,
//     };
//     const accessTtl = process.env.JWT_ACCESS_TTL || "15m";
//     const accessToken = signToken(claims, {
//       type: "access",
//       expiresIn: accessTtl,
//     });
//     return ResponseHelper.success(
//       res,
//       { accessToken, tokenType: "Bearer", expiresIn: accessTtl },
//       SUCCESS_CODES.OPERATION_SUCCESS
//     );
//   } catch (err: any) {
//     return next(new AppError("ACCESS_DENIED", { reason: err.message }));
//   }
// };
export const logout = asyncHandler(async (req, res, next) => {
    // Stateless JWT: client should discard tokens. Server can implement allowlist/denylist if needed.
    const userId = req.context?.user?.sub;
    if (!userId) {
        return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }
    await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
    res.clearCookie("accessToken", {
        path: "/",
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return ResponseHelper.success(res, { message: "Logged out", discardTokens: true }, SUCCESS_CODES.OPERATION_SUCCESS);
});
