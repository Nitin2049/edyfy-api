import { AppError } from "../utils/AppError.js";
import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { TeacherProfile } from "../models/teacherProfile.model.js";
import { logger } from "../utils/logger.js";
// import { logger } from "../utils/logger.js";

export const roleGuard = (allowed: string[] | Readonly<string[]>) => {
  if (allowed.length === 0) {
    throw new Error("roleGuard: at least one role must be provided");
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const ctxUser = (req as any).context?.user;
    if (!ctxUser) {
      return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }
    if (!allowed.includes(ctxUser.role)) {
      logger?.warn("role.denied", {
        userId: ctxUser.sub,
        role: ctxUser.role,
        allowed,
      });
      return next(
        new AppError("ACCESS_DENIED", { reason: "Insufficient role" })
      );
    }
    next();
  };
};

// Convenience overload: roleGuard("teacher","admin")
export const allow = (...roles: string[]) => roleGuard(roles);

// Read-only access for admin, teacher, student
export const allowRead = () => allow("admin", "teacher", "student");

// Requires explicit classId in body or params and allows only admin or the class's assigned class teacher
export const requireAdminOrClassTeacher = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const ctxUser = (req as any).context?.user as
      | { sub: string; schoolId: string; role: string }
      | undefined;

    if (!ctxUser) {
      return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }

    // Admins are allowed without further checks
    if (ctxUser.role === "admin") return next();

    // Only teachers may pass this guard beyond this point
    if (ctxUser.role !== "teacher") {
      return next(
        new AppError("ACCESS_DENIED", {
          reason: "Only admin or class teacher can perform this action",
        })
      );
    }

    // Extract and validate classId from body or params
    const classId: string | undefined =
      (req.body as any)?.classId || (req.params as any)?.classId;
    if (!classId || !Types.ObjectId.isValid(classId)) {
      return next(
        new AppError("VALIDATION_ERROR", {
          reason: "Provide a valid classId for this action",
        })
      );
    }

    // Find the teacher profile for this user within the same school
    const teacher = await TeacherProfile.findOne({
      schoolId: ctxUser.schoolId,
      userId: ctxUser.sub,
    });

    if (!teacher) {
      return next(
        new AppError("ACCESS_DENIED", { reason: "Teacher profile not found" })
      );
    }

    // Check if this teacher is the assigned class teacher for the classId
    const isOwner =
      (await teacher.isClassTeacher?.(new Types.ObjectId(classId))) ?? false;

    if (!isOwner) {
      return next(
        new AppError("ACCESS_DENIED", {
          reason:
            "Only the assigned class teacher can perform this action for this class",
        })
      );
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

// Auto-apply read vs write access based on HTTP method
export const accessByMethod = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const method = req.method.toUpperCase();
    const isRead =
      method === "GET" || method === "HEAD" || method === "OPTIONS";
    if (isRead) {
      return allowRead()(req, res, next);
    }
    return requireAdminOrClassTeacher(req, res, next);
  };
};

// Read
// router.get("/", auth, allowRead(), listStudents);

// Write (classId must be present in body or params)
// router.post("/", auth, validate(createStudentSchema), requireAdminOrClassTeacher(), createStudent);
