import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { AcademicSession } from "../models/academicSession.model.js";
import { Types } from "mongoose";
import { SUCCESS_CODES } from "../constants/successCodes.js";
// Create an academic session (admin-only)
export const createAcademicSession = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    const { year, startDate, endDate } = req.body;
    // Duplicate check by (schoolId, year), ignoring soft-deleted
    const exists = await AcademicSession.findOne({
        schoolId: ctx.schoolId,
        year,
        deletedAt: null,
    })
        .select("_id")
        .lean();
    if (exists) {
        throw new AppError("DUPLICATE_ENTRY", {
            reason: "Academic session with this year already exists",
        });
    }
    const created = await AcademicSession.create({
        schoolId: ctx.schoolId,
        year,
        startDate,
        endDate,
        isActive: false, // set current via dedicated endpoint
    });
    const doc = await AcademicSession.findById(created._id)
        .select("year startDate endDate isActive createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { session: doc }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// List academic sessions for the school (admin-only)
export const getAcademicSessions = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    // Pagination and filters
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
    const limit = Math.min(limitRaw, 100);
    const skip = (page - 1) * limit;
    const sort = req.query.sort?.trim() || "-startDate";
    const q = req.query.q?.trim(); // search by year
    const isActiveRaw = req.query.isActive?.trim();
    let isActiveFilter;
    if (typeof isActiveRaw === "string") {
        if (["true", "false"].includes(isActiveRaw.toLowerCase())) {
            isActiveFilter = isActiveRaw.toLowerCase() === "true";
        }
        else {
            throw new AppError("VALIDATION_ERROR", {
                reason: "isActive must be true or false",
            });
        }
    }
    const filter = {
        schoolId: new Types.ObjectId(ctx.schoolId),
        deletedAt: null,
    };
    if (typeof isActiveFilter === "boolean") {
        filter.isActive = isActiveFilter;
    }
    if (q) {
        const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        filter.year = { $regex: new RegExp(safe, "i") };
    }
    const [items, total] = await Promise.all([
        AcademicSession.find(filter)
            .select("year startDate endDate isActive createdAt updatedAt")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        AcademicSession.countDocuments(filter),
    ]);
    return ResponseHelper.success(res, {
        data: items,
        meta: {
            page,
            limit,
            total,
            count: items.length,
            pages: Math.ceil(total / limit) || 1,
        },
    }, SUCCESS_CODES.DATA_FETCHED);
});
// Get a specific academic session by id (admin-only)
export const getAcademicSessionById = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    const sessionId = req.params?.id;
    if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid session id" });
    }
    const session = await AcademicSession.findOne({
        _id: new Types.ObjectId(sessionId),
        schoolId: new Types.ObjectId(ctx.schoolId),
        deletedAt: null,
    })
        .select("year startDate endDate isActive createdAt updatedAt")
        .lean();
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Academic session not found",
        });
    }
    return ResponseHelper.success(res, { session }, SUCCESS_CODES.DATA_FETCHED);
});
// Update an academic session (admin-only)
export const updateAcademicSession = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    const sessionId = req.params?.id;
    if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid session id" });
    }
    const { year, startDate, endDate } = req.body;
    const session = await AcademicSession.findOne({
        _id: new Types.ObjectId(sessionId),
        schoolId: new Types.ObjectId(ctx.schoolId),
        deletedAt: null,
    });
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Academic session not found",
        });
    }
    // Validate combined date ordering if either field changes
    const nextStart = startDate ?? session.startDate;
    const nextEnd = endDate ?? session.endDate;
    if (nextEnd <= nextStart) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "endDate must be after startDate",
        });
    }
    // Duplicate year check if changed
    if (typeof year === "string" && year !== session.year) {
        const dup = await AcademicSession.findOne({
            schoolId: session.schoolId,
            year,
            deletedAt: null,
            _id: { $ne: session._id },
        })
            .select("_id")
            .lean();
        if (dup) {
            throw new AppError("DUPLICATE_ENTRY", {
                reason: "Academic session with this year already exists",
            });
        }
        session.year = year;
    }
    if (startDate)
        session.startDate = startDate;
    if (endDate)
        session.endDate = endDate;
    const saved = await session.save();
    const result = await AcademicSession.findById(saved._id)
        .select("year startDate endDate isActive createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { session: result }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// Set current academic session (admin-only)
export const setCurrentAcademicSession = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    const sessionId = req.params?.id;
    if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid session id" });
    }
    const session = await AcademicSession.findOne({
        _id: sessionId,
        schoolId: ctx.schoolId,
        deletedAt: null,
    })
        .select("_id year")
        .lean();
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Academic session not found" });
    }
    // Unset previous active sessions in this school (exclude soft-deleted)
    await AcademicSession.updateMany({ schoolId: ctx.schoolId, deletedAt: null, isActive: true }, { $set: { isActive: false } });
    // Set requested session as active
    const updated = await AcademicSession.findByIdAndUpdate(session._id, { $set: { isActive: true } }, { new: true })
        .select("year startDate endDate isActive createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { session: updated }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// Get the current active academic session (admin-only)
export const getCurrentAcademicSession = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const session = await AcademicSession.findOne({
        schoolId: ctx.schoolId,
        isActive: true,
        deletedAt: null,
    })
        .select("year startDate endDate isActive createdAt updatedAt")
        .lean();
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "No active academic session set" });
    }
    return ResponseHelper.success(res, { session }, SUCCESS_CODES.DATA_FETCHED);
});
// Delete (soft delete) an academic session (admin-only)
export const deleteAcademicSession = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    const sessionId = req.params?.id;
    if (!sessionId || !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid session id" });
    }
    const session = await AcademicSession.findOne({
        _id: sessionId,
        schoolId: ctx.schoolId,
        deletedAt: null,
    })
        .select("_id year startDate endDate isActive")
        .lean();
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Academic session not found or already deleted",
        });
    }
    // Prevent deleting the active session to avoid undefined current state
    if (session.isActive === true) {
        throw new AppError("VALIDATION_ERROR", {
            message: "Cannot delete the active session. Set another session as current first.",
        });
    }
    const updated = await AcademicSession.findByIdAndUpdate(session._id, { $set: { deletedAt: new Date() } }, { new: true })
        .select("year startDate endDate isActive deletedAt")
        .lean();
    return ResponseHelper.success(res, { session: updated }, SUCCESS_CODES.OPERATION_SUCCESS);
});
