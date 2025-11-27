import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { Types } from "mongoose";
import { Attendance } from "../models/attendance.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Class } from "../models/class.model.js";
import { SMSNotification } from "../models/absentNotification.model.js";
import type { AbsentNotificationCreateInput } from "../validators/absentNotificationCreate.validator.js";

// Helpers: normalize and parse a local YYYY-MM-DD day
const normalizeDate = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const parseLocalDay = (input: string): Date => {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(input.trim());
  if (m) {
    const y = parseInt(m[1], 10);
    const mo = parseInt(m[2], 10) - 1;
    const d = parseInt(m[3], 10);
    return new Date(y, mo, d);
  }
  return normalizeDate(new Date(input));
};

// POST /api/v1/notifications/absent - Create absent notifications from attendance
export const createAbsentNotifications = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context?.user;
  if (!ctx?.schoolId || !ctx?.role) {
    throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
  }

  const body = req.body as AbsentNotificationCreateInput;
  const { classId, sessionId, date, message } = body; // date is YYYY-MM-DD string (local day)

  if (!Types.ObjectId.isValid(classId) || !Types.ObjectId.isValid(sessionId)) {
    throw new AppError("VALIDATION_ERROR", { reason: "Invalid identifiers provided" });
  }

  const dateLocal = String(date);
  const day = parseLocalDay(dateLocal); // UTC midnight version for sorting

  // Find attendance for this class/date/session in this school
  const attendance = await Attendance.findOne({
    schoolId: ctx.schoolId,
    classId: new Types.ObjectId(classId),
    academicSessionId: new Types.ObjectId(sessionId),
    dateLocal: dateLocal,
    deletedAt: null,
  })
    .select("entries isHoliday dateLocal")
    .lean();

  if (!attendance) {
    throw new AppError("RESOURCE_NOT_FOUND", { reason: "Attendance not found for the provided date/class/session" });
  }

  if (attendance.isHoliday) {
    return ResponseHelper.success(
      res,
      { created: 0, skipped: [], reason: "Holiday" },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }

  const absentStudentIds = (attendance.entries || [])
    .filter((e) => (e as any).status === "absent")
    .map((e) => new Types.ObjectId(String((e as any).studentId)));

  if (absentStudentIds.length === 0) {
    return ResponseHelper.success(res, { created: 0, skipped: [], reason: "No absentees" }, SUCCESS_CODES.OPERATION_SUCCESS);
  }

  // Fetch students' guardian phones
  const students = await StudentProfile.find({
    _id: { $in: absentStudentIds },
    schoolId: ctx.schoolId,
    deletedAt: null,
  })
    .select("_id guardianNumber guardianName userId")
    .populate({ path: "userId", select: "firstName lastName", model: "User" })
    .lean();

  const phoneById = new Map<string, { phone?: string; name?: string; fullName?: string }>(
    students.map((s) => {
      const u: any = (s as any).userId || {};
      const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
      return [
        String(s._id),
        { phone: (s as any).guardianNumber, name: (s as any).guardianName, fullName },
      ];
    })
  );

  // Filter out those missing phone
  const candidates = absentStudentIds.filter((id) => {
    const info = phoneById.get(String(id));
    return !!info?.phone;
  });

  if (candidates.length === 0) {
    return ResponseHelper.success(
      res,
      { created: 0, skipped: absentStudentIds.map(String), reason: "No guardian phone numbers" },
      SUCCESS_CODES.OPERATION_SUCCESS
    );
  }

  // Avoid duplicates for same day
  const existing = await SMSNotification.find({
    schoolId: ctx.schoolId,
    studentId: { $in: candidates },
    dateLocal: dateLocal,
  })
    .select("studentId")
    .lean();
  const existingSet = new Set(existing.map((n) => String(n.studentId)));

  const docs = candidates
    .filter((id) => !existingSet.has(String(id)))
    .map((id) => {
      const info = phoneById.get(String(id));
      const studentName = info?.fullName || "";
      const defaultMsg = studentName
        ? `Your ward ${studentName} was absent on ${dateLocal}.`
        : `Your ward was absent on ${dateLocal}.`;
      const msg = (() => {
        const custom = message?.trim();
        if (!custom) return defaultMsg;
        return studentName ? `${studentName}: ${custom}` : custom;
      })();
      return {
        schoolId: new Types.ObjectId(ctx.schoolId),
        studentId: id,
        guardianPhone: String(info?.phone),
        dateLocal,
        date: day,
        message: msg,
        status: "pending" as const,
      };
    });

  let created = 0;
  if (docs.length > 0) {
    await SMSNotification.insertMany(docs, { ordered: false });
    created = docs.length;
  }

  const skipped = absentStudentIds
    .filter((id) => existingSet.has(String(id)) || !phoneById.get(String(id))?.phone)
    .map(String);

  return ResponseHelper.success(res, { created, skipped, dateLocal }, SUCCESS_CODES.OPERATION_SUCCESS);
});

// GET /api/v1/notifications/absent - List absent notifications with optional filters
export const listAbsentNotifications = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context?.user;
  if (!ctx?.schoolId || !ctx?.role) {
    throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
  }

  const classIdRaw = (req.query.classId as string | undefined)?.trim();
  const sessionIdRaw = (req.query.sessionId as string | undefined)?.trim();
  const dateLocalRaw = (req.query.dateLocal as string | undefined)?.trim() || (req.query.date as string | undefined)?.trim();

  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
  const limit = Math.min(limitRaw, 100);
  const skip = (page - 1) * limit;
  const sort = (req.query.sort as string | undefined)?.trim() || "-createdAt";

  // Base filter on notifications
  const notifFilter: any = { schoolId: ctx.schoolId };
  if (dateLocalRaw) {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateLocalRaw);
    if (!m) {
      throw new AppError("VALIDATION_ERROR", { reason: "Invalid dateLocal format" });
    }
    notifFilter.dateLocal = dateLocalRaw;
  }

  // Build student scope if class/session filters are present or role is teacher
  const needStudentScope = !!classIdRaw || !!sessionIdRaw || ctx.role === "teacher";
  let studentIds: Types.ObjectId[] | undefined = undefined;

  if (needStudentScope) {
    const studentQuery: any = { schoolId: ctx.schoolId, deletedAt: null };

    // Teacher restriction: override with param classId attached by route helper
    if (ctx.role === "teacher") {
      const paramClassId = (req.params as any)?.classId as string | undefined;
      if (!paramClassId || !Types.ObjectId.isValid(paramClassId)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Provide a valid classId" });
      }
      studentQuery.classId = new Types.ObjectId(paramClassId);
    } else if (classIdRaw) {
      if (!Types.ObjectId.isValid(classIdRaw)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
      }
      studentQuery.classId = new Types.ObjectId(classIdRaw);
    }

    // Session filter via class's academicSessionId
    if (sessionIdRaw) {
      if (!Types.ObjectId.isValid(sessionIdRaw)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid sessionId" });
      }
      const classFilter: any = { schoolId: ctx.schoolId, deletedAt: null, academicSessionId: new Types.ObjectId(sessionIdRaw) };
      // If also restricted by a particular classId, ensure it exists; otherwise, scope to classes in session
      if (studentQuery.classId) {
        classFilter._id = studentQuery.classId;
      }
      const classes = await Class.find(classFilter).select("_id").lean();
      const classIds = classes.map((c) => c._id as Types.ObjectId);
      if (classIds.length === 0) {
        return ResponseHelper.success(
          res,
          { data: [], meta: { page, limit, total: 0, count: 0, pages: 1 } },
          SUCCESS_CODES.DATA_FETCHED
        );
      }
      studentQuery.classId = { $in: classIds };
    }

    const students = await StudentProfile.find(studentQuery).select("_id").lean();
    studentIds = students.map((s) => s._id as Types.ObjectId);
    if (studentIds.length === 0) {
      return ResponseHelper.success(
        res,
        { data: [], meta: { page, limit, total: 0, count: 0, pages: 1 } },
        SUCCESS_CODES.DATA_FETCHED
      );
    }
    notifFilter.studentId = { $in: studentIds };
  }

  const [items, total] = await Promise.all([
    SMSNotification.find(notifFilter)
      .select("studentId guardianPhone dateLocal date message status error sentAt createdAt updatedAt")
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    SMSNotification.countDocuments(notifFilter),
  ]);

  return ResponseHelper.success(
    res,
    { data: items, meta: { page, limit, total, count: items.length, pages: Math.ceil(total / limit) || 1 } },
    SUCCESS_CODES.DATA_FETCHED
  );
});
