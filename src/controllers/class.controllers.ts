import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import {Class} from "../models/class.model.js";
import {TeacherProfile} from "../models/teacherProfile.model.js";
import { Types } from "mongoose";
import {StudentProfile} from "../models/studentProfile.model.js";

// Create/register a class (admin-only)
export const createClass = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context?.user;
  if (!ctx?.schoolId || !ctx?.role) {
    throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
  }
  if (ctx.role !== "admin") {
    throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
  }

  const { name, section, classTeacherId } = req.body as any;
  if (!name || !section) {
    throw new AppError("VALIDATION_ERROR", {
      reason: "name and section are required",
    });
  }

  // Optional: validate classTeacherId existence in same school
  if (classTeacherId) {
    if (!Types.ObjectId.isValid(classTeacherId)) {
      throw new AppError("VALIDATION_ERROR", {
        reason: "Invalid classTeacherId",
      });
    }
    const teacher = await TeacherProfile.findOne({
      _id: classTeacherId,
      schoolId: ctx.schoolId,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (!teacher) {
      throw new AppError("RESOURCE_NOT_FOUND", {
        reason: "Teacher profile not found in this school",
      });
    }
  }

  // Check duplicate class within same school + session + name + section
  const dup = await Class.findOne({
    schoolId: ctx.schoolId,
    name,
    section,
    deletedAt: null,
  })
    .select("_id")
    .lean();
  if (dup) {
    throw new AppError("DUPLICATE_ENTRY", {
      reason: "Class already exists for this session",
    });
  }

  const created = await Class.create({
    schoolId: ctx.schoolId,
    name,
    section,
    classTeacherId: classTeacherId || undefined,
  });

  // Fetch lean object to return (ensures level derived is present)
  const cls = await Class.findById(created._id)
    .select(
      "name level section classTeacherId createdAt updatedAt"
    )
    .lean();

  return ResponseHelper.success(
    res,
    { class: cls },
    SUCCESS_CODES.CLASS_CREATED
  );
});

// Get all classes for the school (admin-only)
export const getAllClasses = asyncHandler(
  async (req: Request, res: Response) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
      throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
      throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }

    // Optional filters
    const currentRaw = (req.query.current as string | undefined)?.trim();
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limitRaw = Math.max(
      parseInt(String(req.query.limit ?? "20"), 10) || 20,
      1
    );
    const limit = Math.min(limitRaw, 100);
    const skip = (page - 1) * limit;
    const sort =
      (req.query.sort as string | undefined)?.trim() || "level section"; // stable default

    const filter: any = { schoolId: ctx.schoolId, deletedAt: null };
   
    const [items, total] = await Promise.all([
      Class.find(filter)
        .select(
          "name level section classTeacherId createdAt updatedAt"
        )
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Class.countDocuments(filter),
    ]);

    return ResponseHelper.success(
      res,
      {
        data: items,
        meta: {
          page,
          limit,
          total,
          count: items.length,
          pages: Math.ceil(total / limit) || 1,
        },
      },
      SUCCESS_CODES.DATA_FETCHED
    );
  }
);

// Get a specific class by classId for the school (admin-only)
export const getClassById = asyncHandler(
  async (req: Request, res: Response) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
      throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }

    const classId = (req.params as any)?.classId;
    if (!classId || !Types.ObjectId.isValid(classId)) {
      throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
    }

    const cls = await Class.findOne({
      _id: classId,
      schoolId: ctx.schoolId,
      deletedAt: null,
    })
      .select("name level section academicSessionId classTeacherId createdAt updatedAt")
      .lean();

    if (!cls) {
      throw new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found" });
    }

    // Authorization already enforced by requireAdminOrClassTeacher middleware.
    // (Admin always allowed; teacher only if classTeacher of this class.)
    return ResponseHelper.success(res, { class: cls }, SUCCESS_CODES.DATA_FETCHED);
  }
);

// Update a specific class (admin-only)
export const updateClass = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context?.user;
  if (!ctx?.schoolId || !ctx?.role) {
    throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
  }
  if (ctx.role !== "admin") {
    throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
  }

  const classId = (req.params as any)?.classId;
  if (!classId || !Types.ObjectId.isValid(classId)) {
    throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
  }

  const { name, section, classTeacherId } = req.body as any;

  if (classTeacherId) {
    if (!Types.ObjectId.isValid(classTeacherId)) {
      throw new AppError("VALIDATION_ERROR", {
        reason: "Invalid classTeacherId",
      });
    }
    const teacher = await TeacherProfile.findOne({
      _id: classTeacherId,
      schoolId: ctx.schoolId,
      deletedAt: null,
    })
      .select("_id")
      .lean();
    if (!teacher) {
      throw new AppError("RESOURCE_NOT_FOUND", {
        reason: "Teacher profile not found in this school",
      });
    }
  }

  // Fetch the class doc within this school (exclude soft-deleted)
  const cls = await Class.findOne({
    _id: classId,
    schoolId: ctx.schoolId,
    deletedAt: null,
  });
  if (!cls) {
    throw new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found" });
  }

  // Duplicate guard if key fields change (sessionId/name/section)
  const nextName = name ?? cls.name;
  const nextSection = section ?? cls.section;
  const duplicate = await Class.findOne({
    schoolId: ctx.schoolId,
    name: nextName,
    section: nextSection,
    deletedAt: null,
    _id: { $ne: cls._id },
  })
    .select("_id")
    .lean();
  if (duplicate) {
    throw new AppError("DUPLICATE_ENTRY", {
      reason: "Another class with same session/name/section exists",
    });
  }

  // Apply updates on the doc and save() to trigger pre-save hook for level on name change
  if (name) cls.name = name;
  if (section) cls.section = section;
  if (classTeacherId) cls.classTeacherId = classTeacherId;

  const saved = await cls.save();

  const result = await Class.findById(saved._id)
    .select(
      "name level section classTeacherId createdAt updatedAt"
    )
    .lean();

  return ResponseHelper.success(
    res,
    { class: result },
    SUCCESS_CODES.CLASS_UPDATED
  );
});

// Delete (soft delete) a specific class (admin-only)
export const deleteClass = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context?.user;
  if (!ctx?.schoolId || !ctx?.role) {
    throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
  }
  if (ctx.role !== "admin") {
    throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
  }

  const classId = (req.params as any)?.classId;
  if (!classId || !Types.ObjectId.isValid(classId)) {
    throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
  }

  const cls = await Class.findOne({
    _id: classId,
    schoolId: ctx.schoolId,
    deletedAt: null,
  })
    .select("_id")
    .lean();

  if (!cls) {
    throw new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found or already deleted" });
  }

  const updated = await Class.findByIdAndUpdate(
    cls._id,
    { $set: { deletedAt: new Date() } },
    { new: true }
  )
    .select("_id name level section classTeacherId deletedAt")
    .lean();

  return ResponseHelper.success(res, { class: updated }, SUCCESS_CODES.OPERATION_SUCCESS);
});

// List all students of a specific class (admin-only)
export const getStudentsOfClass = asyncHandler(async (req: Request, res: Response) => {
  const ctx = req.context?.user;
  if (!ctx?.schoolId || !ctx?.role) {
    throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
  }
  // Authorization enforced by requireAdminOrClassTeacher middleware on the route.

  const classId = (req.params as any)?.classId;
  if (!classId || !Types.ObjectId.isValid(classId)) {
    throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
  }

  const cls = await Class.findOne({
    _id: classId,
    schoolId: ctx.schoolId,
    deletedAt: null,
  })
    .select("_id name section")
    .lean();
  if (!cls) {
    throw new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found" });
  }

  // Pagination and optional search
  const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
  const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
  const limit = Math.min(limitRaw, 100);
  const skip = (page - 1) * limit;
  const q = (req.query.q as string | undefined)?.trim();
  const sort = (req.query.sort as string | undefined)?.trim() || "-createdAt";

  const profileFilter: any = {
    schoolId: ctx.schoolId,
    classId: classId,
    deletedAt: null,
  };

  // Build user search filter
  let userFilter: any = {};
  if (q) {
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    userFilter = {
      $or: [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
        { username: regex },
      ],
    };
  }

  const [items, total] = await Promise.all([
    StudentProfile.find(profileFilter)
      .populate({
        path: "userId",
        match: userFilter,
        select:
          "firstName lastName username email phone profileImage dob gender address role isActive",
      })
      .select(
        "admissionNo rollNo classId guardianName guardianNumber dateOfAdmission dateOfLeaving status createdAt updatedAt"
      )
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean(),
    StudentProfile.countDocuments(profileFilter),
  ]);

  const data = items.filter((doc: any) => !!doc.userId);

  return ResponseHelper.success(
    res,
    {
      data,
      meta: {
        page,
        limit,
        total,
        count: data.length,
        pages: Math.ceil(total / limit) || 1,
      },
      class: cls,
    },
    SUCCESS_CODES.DATA_FETCHED
  );
});
