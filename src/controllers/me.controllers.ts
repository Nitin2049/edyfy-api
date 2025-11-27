import { Request, Response, NextFunction } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { User } from "../models/user.model.js";
import { AdminProfile } from "../models/adminProfile.model.js";
import { TeacherProfile } from "../models/teacherProfile.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import bcrypt from "bcrypt";
import type { Model } from "mongoose";

type UserRole = "admin" | "teacher" | "student";
const modelByRole: Record<UserRole, Model<any>> = {
  admin: AdminProfile,
  teacher: TeacherProfile,
  student: StudentProfile,
} as const;

const userUpdatableFields = [
  "firstName",
  "lastName",
  "phone",
  "profileImage",
  "address",
] as const;

const pick = <T extends object, K extends keyof T>(
  src: T,
  keys: readonly K[]
): Partial<T> =>
  keys.reduce((acc, k) => {
    if (src[k] !== undefined) (acc as any)[k] = src[k];
    return acc;
  }, {} as Partial<T>);

export const getMe = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.context?.user;
    if (!ctx?.sub || !ctx.profileId || !ctx.role || !ctx.schoolId) {
      return next(new AppError("ACCESS_DENIED"));
    }

    const user = await User.findById(ctx.sub)
      .select("-password -twoFactorAuthSecret -resetPasswordToken")
      .lean();
    if (!user) return next(new AppError("USER_NOT_FOUND"));

    const ProfileModel =
      modelByRole[ctx.role as "admin" | "teacher" | "student"];
    const profile = await ProfileModel.findOne({
      _id: ctx.profileId,
      userId: ctx.sub,
      schoolId: ctx.schoolId,
      deletedAt: null,
    }).lean();

    return ResponseHelper.success(
      res,
      { user, profile },
      SUCCESS_CODES.DATA_FETCHED
    );
  }
);

export const updateMe = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.context?.user;
    if (!ctx?.sub) return next(new AppError("ACCESS_DENIED"));

    // Only allow safe fields on User
    const allowed = pick(req.body, userUpdatableFields);
    const updated = await User.findByIdAndUpdate(
      ctx.sub,
      { $set: allowed },
      { new: true }
    )
      .select("-password -twoFactorAuthSecret -resetPasswordToken")
      .lean();

    if (!updated) return next(new AppError("USER_NOT_FOUND"));
    return ResponseHelper.success(
      res,
      { user: updated },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }
);

export const updateMyProfile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.context?.user;
    if (!ctx?.sub || !ctx.profileId || !ctx.role || !ctx.schoolId) {
      return next(new AppError("ACCESS_DENIED"));
    }

    // Allowed profile fields per role (aligns with mongoose profile schemas)
    const teacherKeys = [
      "qualification",
      "joinDate",
      "exitDate",
      "status",
    ] as const;
    const studentKeys = [
      "admissionNo",
      "rollNo",
      "classId",
      "guardianName",
      "guardianNumber",
      "dateOfAdmission",
      "dateOfLeaving",
      "status",
    ] as const;

    let keys: readonly string[] = [];
    if (ctx.role === "teacher") keys = teacherKeys;
    else if (ctx.role === "student") keys = studentKeys;
    else if (ctx.role === "admin") {
      return next(
        new AppError("ACCESS_DENIED", {
          reason: "No updatable profile fields for admin",
        })
      );
    }

    const payload = pick(req.body as any, keys as any);

    const ProfileModel =
      modelByRole[ctx.role as "admin" | "teacher" | "student"];
    const updated = await ProfileModel.findOneAndUpdate(
      {
        _id: ctx.profileId,
        userId: ctx.sub,
        schoolId: ctx.schoolId,
        deletedAt: null,
      },
      { $set: payload },
      { new: true }
    ).lean();

    if (!updated)
      return next(
        new AppError("RESOURCE_NOT_FOUND", { reason: "Profile not found" })
      );
    return ResponseHelper.success(
      res,
      { profile: updated },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }
);

export const deleteMyProfile = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.context?.user;
    if (!ctx?.sub || !ctx.profileId || !ctx.role || !ctx.schoolId) {
      return next(new AppError("ACCESS_DENIED"));
    }

    // Only student/teacher can self soft-delete profile (leaving school)
    if (ctx.role === "admin") {
      return next(
        new AppError("ACCESS_DENIED", {
          reason: "Admins cannot delete their profile",
        })
      );
    }

    const ProfileModel = modelByRole[ctx.role as "teacher" | "student"];
    const updated = await ProfileModel.findOneAndUpdate(
      {
        _id: ctx.profileId,
        userId: ctx.sub,
        schoolId: ctx.schoolId,
        deletedAt: null,
      },
      { $set: { deletedAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated)
      return next(
        new AppError("RESOURCE_NOT_FOUND", { reason: "Profile not found" })
      );
    return ResponseHelper.success(
      res,
      { profile: updated },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }
);

export const changeMyPassword = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const ctx = req.context?.user;
    if (!ctx?.sub) return next(new AppError("ACCESS_DENIED"));

    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    const user = await User.findById(ctx.sub);
    if (!user) return next(new AppError("USER_NOT_FOUND"));

    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok)
      return next(
        new AppError("ACCESS_DENIED", { message: "Invalid current password" })
      );

    user.password = newPassword; // pre-save hook hashes it
    user.passwordChangedAt = new Date();
    // Optional: bump tokenVersion so existing tokens become invalid
    (user as any).tokenVersion = ((user as any).tokenVersion || 0) + 1;
    await user.save();

    return ResponseHelper.success(
      res,
      { message: "Password updated" },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }
);
