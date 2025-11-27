import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { Types } from "mongoose";
import { Class } from "../models/class.model.js";
import { AcademicSession } from "../models/academicSession.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Attendance } from "../models/attendance.model.js";
import { TeacherProfile } from "../models/teacherProfile.model.js";
// Normalize date to midnight (local) to avoid duplicates on time portions
const normalizeDate = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
// Parse incoming date input to local date (midnight) reliably
const parseLocalDay = (input) => {
    if (typeof input === "string") {
        const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(input.trim());
        if (m) {
            const y = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1;
            const d = parseInt(m[3], 10);
            return new Date(y, mo, d);
        }
        // Fallback: let Date parse it (e.g., ISO string), then normalize local
        const dt = new Date(input);
        return normalizeDate(dt);
    }
    if (input instanceof Date)
        return normalizeDate(input);
    // As a last resort, use today
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
// Format a Date as local YYYY-MM-DD (no timezone ambiguity for clients)
const formatLocalYYYYMMDD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};
// GET /api/v1/attendance - list attendance records with optional filters
export const listAttendance = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const classIdRaw = req.query.classId?.trim();
    const sessionIdRaw = req.query.sessionId?.trim();
    const dateRaw = req.query.date?.trim();
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
    const limit = Math.min(limitRaw, 100);
    const skip = (page - 1) * limit;
    const sort = req.query.sort?.trim() || "-date";
    const filter = { schoolId: ctx.schoolId, deletedAt: null };
    if (classIdRaw) {
        if (!Types.ObjectId.isValid(classIdRaw)) {
            throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
        }
        filter.classId = new Types.ObjectId(classIdRaw);
    }
    if (sessionIdRaw) {
        if (!Types.ObjectId.isValid(sessionIdRaw)) {
            throw new AppError("VALIDATION_ERROR", { reason: "Invalid sessionId" });
        }
        filter.academicSessionId = new Types.ObjectId(sessionIdRaw);
    }
    if (dateRaw) {
        // Expect YYYY-MM-DD and match against dateLocal (stored string)
        const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(dateRaw);
        if (!m) {
            throw new AppError("VALIDATION_ERROR", { reason: "Invalid date format" });
        }
        filter.dateLocal = dateRaw;
    }
    // For teachers, enforce class restriction via param injected by route helper
    if (ctx.role === "teacher") {
        const paramClassId = req.params?.classId;
        if (!paramClassId || !Types.ObjectId.isValid(paramClassId)) {
            throw new AppError("VALIDATION_ERROR", {
                reason: "Provide a valid classId",
            });
        }
        filter.classId = new Types.ObjectId(paramClassId);
    }
    const [items, total] = await Promise.all([
        Attendance.find(filter)
            .select("academicSessionId dateLocal date classId entries notes isHoliday markedBy createdAt updatedAt")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Attendance.countDocuments(filter),
    ]);
    const projected = items.map((it) => {
        // Ensure dateLocal exists (fallback for legacy records)
        if (!it.dateLocal && it.date) {
            it.dateLocal = formatLocalYYYYMMDD(new Date(it.date));
        }
        return it;
    });
    return ResponseHelper.success(res, {
        data: projected,
        meta: {
            page,
            limit,
            total,
            count: items.length,
            pages: Math.ceil(total / limit) || 1,
        },
    }, SUCCESS_CODES.DATA_FETCHED);
});
// POST /api/v1/attendance - mark attendance
export const createAttendance = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const { classId, sessionId, date, isHoliday, notes } = req.body;
    const rawEntries = req.body.entries || [];
    if (!Types.ObjectId.isValid(classId) ||
        !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Invalid identifiers provided",
        });
    }
    const [cls, session] = await Promise.all([
        Class.findOne({ _id: classId, schoolId: ctx.schoolId, deletedAt: null })
            .select("_id academicSessionId name section")
            .lean(),
        AcademicSession.findOne({
            _id: sessionId,
            schoolId: ctx.schoolId,
            deletedAt: null,
        })
            .select("_id year")
            .lean(),
    ]);
    if (!cls) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Class not found in this school",
        });
    }
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Academic session not found in this school",
        });
    }
    if (String(cls.academicSessionId) !== String(session._id)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Class does not belong to the provided academic session",
        });
    }
    // date is a YYYY-MM-DD string (validated). Store both forms.
    const day = parseLocalDay(date);
    const dateLocal = String(date);
    // Enforce uniqueness by (schoolId, sessionId, date, classId)
    const exists = await Attendance.findOne({
        schoolId: ctx.schoolId,
        academicSessionId: session._id,
        classId: cls._id,
        dateLocal: dateLocal,
        deletedAt: null,
    })
        .select("_id")
        .lean();
    if (exists) {
        throw new AppError("DUPLICATE_ENTRY", {
            reason: "Attendance already marked for this class and date",
        });
    }
    // Validate entries belong to the class (skip if holiday)
    let entries = [];
    // If it's a holiday, ensure no accidental entries are recorded
    if (isHoliday) {
        entries = [];
    }
    if (!isHoliday) {
        const students = await StudentProfile.find({
            schoolId: ctx.schoolId,
            classId: cls._id,
            deletedAt: null,
        })
            .select("_id")
            .lean();
        const allowed = new Set(students.map((s) => String(s._id)));
        for (const e of rawEntries) {
            if (!Types.ObjectId.isValid(e.studentId) ||
                !allowed.has(String(e.studentId))) {
                throw new AppError("VALIDATION_ERROR", {
                    reason: "entries contain a studentId not in this class",
                });
            }
            entries.push({
                studentId: new Types.ObjectId(e.studentId),
                status: e.status,
            });
        }
    }
    // Determine marker if teacher
    let markedBy = undefined;
    if (ctx.role === "teacher") {
        const teacher = await TeacherProfile.findOne({
            schoolId: ctx.schoolId,
            userId: ctx.sub,
        })
            .select("_id")
            .lean();
        if (!teacher) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Teacher profile not found",
            });
        }
        markedBy = teacher._id;
    }
    const created = await Attendance.create({
        schoolId: ctx.schoolId,
        academicSessionId: session._id,
        dateLocal,
        date: day,
        classId: cls._id,
        entries,
        notes: notes || undefined,
        isHoliday: !!isHoliday,
        markedBy: markedBy || undefined,
    });
    const attn = await Attendance.findById(created._id)
        .select("academicSessionId dateLocal date classId entries notes isHoliday markedBy createdAt updatedAt")
        .lean();
    const responseAttendance = attn ? attn : attn;
    return ResponseHelper.success(res, { attendance: responseAttendance }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// PATCH /api/v1/attendance/:id - update attendance
export const updateAttendance = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const id = req.params?.id;
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid attendance id" });
    }
    const body = req.body;
    const attn = await Attendance.findOne({
        _id: new Types.ObjectId(id),
        schoolId: ctx.schoolId,
        deletedAt: null,
    });
    if (!attn) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Attendance not found" });
    }
    // Resolve potential new class and/or session
    let targetClassId = attn.classId;
    let targetSessionId = attn.academicSessionId;
    let targetDate = attn.date;
    let targetDateLocal = attn.dateLocal || formatLocalYYYYMMDD(attn.date);
    if (body.classId) {
        if (!Types.ObjectId.isValid(body.classId)) {
            throw new AppError("VALIDATION_ERROR", { reason: "Invalid classId" });
        }
        const cls = await Class.findOne({ _id: body.classId, schoolId: ctx.schoolId, deletedAt: null })
            .select("_id academicSessionId")
            .lean();
        if (!cls) {
            throw new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found in this school" });
        }
        targetClassId = new Types.ObjectId(String(cls._id));
        // If sessionId not provided, adopt the class's session
        targetSessionId = new Types.ObjectId(String(cls.academicSessionId));
    }
    if (body.sessionId) {
        if (!Types.ObjectId.isValid(body.sessionId)) {
            throw new AppError("VALIDATION_ERROR", { reason: "Invalid sessionId" });
        }
        const session = await AcademicSession.findOne({ _id: body.sessionId, schoolId: ctx.schoolId, deletedAt: null })
            .select("_id")
            .lean();
        if (!session) {
            throw new AppError("RESOURCE_NOT_FOUND", { reason: "Academic session not found in this school" });
        }
        targetSessionId = new Types.ObjectId(String(session._id));
    }
    // Ensure class belongs to session when either changed
    if (body.classId || body.sessionId) {
        const cls = await Class.findOne({ _id: targetClassId, schoolId: ctx.schoolId, deletedAt: null })
            .select("_id academicSessionId")
            .lean();
        if (!cls) {
            throw new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found in this school" });
        }
        if (String(cls.academicSessionId) !== String(targetSessionId)) {
            throw new AppError("VALIDATION_ERROR", { reason: "Class does not belong to the provided academic session" });
        }
    }
    if (body.date) {
        targetDateLocal = String(body.date);
        targetDate = parseLocalDay(body.date);
    }
    // Enforce uniqueness for the new combination if any of the unique keys changed
    const uniqueChanged = String(targetClassId) !== String(attn.classId) ||
        String(targetSessionId) !== String(attn.academicSessionId) ||
        targetDateLocal !== attn.dateLocal || +new Date(targetDate) !== +new Date(attn.date);
    if (uniqueChanged) {
        const exists = await Attendance.findOne({
            _id: { $ne: attn._id },
            schoolId: ctx.schoolId,
            academicSessionId: targetSessionId,
            classId: targetClassId,
            dateLocal: targetDateLocal,
            deletedAt: null,
        })
            .select("_id")
            .lean();
        if (exists) {
            throw new AppError("DUPLICATE_ENTRY", { reason: "Attendance already exists for this class and date" });
        }
    }
    // Apply scalar updates
    attn.academicSessionId = targetSessionId;
    attn.classId = targetClassId;
    attn.dateLocal = targetDateLocal;
    attn.date = targetDate;
    if (typeof body.isHoliday === "boolean") {
        attn.isHoliday = body.isHoliday;
    }
    if (typeof body.notes === "string") {
        attn.notes = body.notes;
    }
    // Entries handling
    if (attn.isHoliday) {
        attn.entries = [];
    }
    else {
        // Replace entries if provided
        if (body.entries) {
            // Validate students belong to the target class
            const students = await StudentProfile.find({ schoolId: ctx.schoolId, classId: targetClassId, deletedAt: null })
                .select("_id")
                .lean();
            const allowed = new Set(students.map((s) => String(s._id)));
            const nextEntries = body.entries.map((e) => {
                if (!allowed.has(String(e.studentId))) {
                    throw new AppError("VALIDATION_ERROR", { reason: "entries contain a studentId not in this class" });
                }
                return { studentId: new Types.ObjectId(e.studentId), status: e.status };
            });
            attn.entries = nextEntries;
        }
        // Single student update upsert
        if (body.studentId && body.status) {
            const inClass = await StudentProfile.exists({
                _id: new Types.ObjectId(body.studentId),
                schoolId: ctx.schoolId,
                classId: targetClassId,
                deletedAt: null,
            });
            if (!inClass) {
                throw new AppError("VALIDATION_ERROR", { reason: "studentId is not in this class" });
            }
            const entries = (attn.entries || []);
            const idx = entries.findIndex((e) => String(e.studentId) === String(body.studentId));
            if (idx >= 0) {
                entries[idx].status = body.status;
            }
            else {
                entries.push({ studentId: new Types.ObjectId(body.studentId), status: body.status });
            }
            attn.entries = entries;
        }
    }
    const saved = await attn.save();
    const result = await Attendance.findById(saved._id)
        .select("academicSessionId dateLocal date classId entries notes isHoliday markedBy createdAt updatedAt")
        .lean();
    const responseAttendance = result ? result : result;
    return ResponseHelper.success(res, { attendance: responseAttendance }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// DELETE /api/v1/attendance/:id - soft delete attendance
export const deleteAttendance = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const id = req.params?.id;
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid attendance id" });
    }
    const attn = await Attendance.findOne({ _id: id, schoolId: ctx.schoolId, deletedAt: null });
    if (!attn) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Attendance not found" });
    }
    // If teacher, ensure they are class teacher by leveraging existing guard injection of classId
    // (attachClassIdFromAttendance already ran prior to requireAdminOrClassTeacher in route)
    attn.deletedAt = new Date();
    await attn.save();
    return ResponseHelper.success(res, { attendance: { _id: attn._id, deleted: true } }, SUCCESS_CODES.OPERATION_SUCCESS);
});
