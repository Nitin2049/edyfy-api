import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { Types } from "mongoose";
import { AcademicReport } from "../models/academicReport.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Class } from "../models/class.model.js";
import { AcademicSession } from "../models/academicSession.model.js";
import { TeacherProfile } from "../models/teacherProfile.model.js";
export const createAcademicReport = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const body = req.body;
    const { classId, studentId, sessionId, examName, subjects, coScholastic, remarks, } = body;
    if (!Types.ObjectId.isValid(classId) ||
        !Types.ObjectId.isValid(studentId) ||
        !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Invalid identifiers provided",
        });
    }
    // Fetch and validate core entities
    const [student, cls, session] = await Promise.all([
        StudentProfile.findOne({
            _id: studentId,
            schoolId: ctx.schoolId,
            deletedAt: null,
        })
            .select("_id classId")
            .lean(),
        Class.findOne({ _id: classId, schoolId: ctx.schoolId, deletedAt: null })
            .select("_id academicSessionId")
            .lean(),
        AcademicSession.findOne({
            _id: sessionId,
            schoolId: ctx.schoolId,
            deletedAt: null,
        })
            .select("_id")
            .lean(),
    ]);
    if (!student) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student not found in this school",
        });
    }
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
    // Ensure the student belongs to the provided class
    if (String(student.classId || "") !== String(cls._id)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Student does not belong to the provided class",
        });
    }
    // Ensure class belongs to the provided session
    if (String(cls.academicSessionId) !== String(session._id)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Class does not belong to the provided academic session",
        });
    }
    // Uniqueness check (also enforced by index)
    const exists = await AcademicReport.findOne({
        schoolId: ctx.schoolId,
        studentId: new Types.ObjectId(studentId),
        academicSessionId: new Types.ObjectId(sessionId),
        examName,
    })
        .select("_id")
        .lean();
    if (exists) {
        throw new AppError("DUPLICATE_ENTRY", {
            reason: "Report already exists for this exam and session",
        });
    }
    // Determine markedBy if teacher
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
    const created = await AcademicReport.create({
        schoolId: ctx.schoolId,
        studentId: new Types.ObjectId(studentId),
        academicSessionId: new Types.ObjectId(sessionId),
        examName,
        subjects,
        coScholastic: coScholastic || undefined,
        remarks: remarks || undefined,
        markedBy: markedBy || undefined,
    });
    const report = await AcademicReport.findById(created._id)
        .select("studentId academicSessionId examName subjects coScholastic remarks markedBy createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { report }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// GET /api/v1/reports - List academic reports for a student in a session
export const listAcademicReports = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const studentIdRaw = req.query.studentId?.trim();
    const sessionIdRaw = req.query.sessionId?.trim();
    const examName = req.query.examName?.trim();
    if (!studentIdRaw || !sessionIdRaw) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "studentId and sessionId are required",
        });
    }
    if (!Types.ObjectId.isValid(studentIdRaw)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid studentId" });
    }
    if (!Types.ObjectId.isValid(sessionIdRaw)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid sessionId" });
    }
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
    const limit = Math.min(limitRaw, 100);
    const skip = (page - 1) * limit;
    const sort = req.query.sort?.trim() || "-createdAt";
    const filter = {
        schoolId: ctx.schoolId,
        studentId: new Types.ObjectId(studentIdRaw),
        academicSessionId: new Types.ObjectId(sessionIdRaw),
        deletedAt: null,
    };
    if (examName)
        filter.examName = examName;
    // If teacher, ensure they are class teacher for the class provided via params and that the student belongs to that class
    if (ctx.role === "teacher") {
        const paramClassId = req.params?.classId;
        if (!paramClassId || !Types.ObjectId.isValid(paramClassId)) {
            throw new AppError("VALIDATION_ERROR", {
                reason: "Provide a valid classId",
            });
        }
        const studentInClass = await StudentProfile.findOne({
            _id: new Types.ObjectId(studentIdRaw),
            schoolId: ctx.schoolId,
            classId: new Types.ObjectId(paramClassId),
            deletedAt: null,
        })
            .select("_id")
            .lean();
        if (!studentInClass) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Student does not belong to this class",
            });
        }
    }
    // If student, ensure they are viewing their own reports
    if (ctx.role === "student") {
        const studentProfile = await StudentProfile.findOne({
            schoolId: ctx.schoolId,
            userId: ctx.sub,
        })
            .select("_id")
            .lean();
        if (!studentProfile) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Student profile not found",
            });
        }
        if (String(studentProfile._id) !== studentIdRaw) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Cannot view reports of other students",
            });
        }
    }
    const [items, total] = await Promise.all([
        AcademicReport.find(filter)
            .select("studentId academicSessionId examName subjects coScholastic remarks markedBy createdAt updatedAt")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        AcademicReport.countDocuments(filter),
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
// GET /api/v1/reports/:id - Get a specific academic report
export const getAcademicReportById = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const id = req.params?.id;
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid report id" });
    }
    const report = await AcademicReport.findOne({
        _id: new Types.ObjectId(id),
        schoolId: ctx.schoolId,
        deletedAt: null,
    })
        .select("studentId academicSessionId examName subjects coScholastic remarks markedBy createdAt updatedAt")
        .lean();
    if (!report) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Report not found" });
    }
    // Authorization for teacher: ensure they are class teacher for the student's class
    if (ctx.role === "teacher") {
        const student = await StudentProfile.findOne({
            _id: report.studentId,
            schoolId: ctx.schoolId,
        })
            .select("classId")
            .lean();
        if (!student?.classId) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Student/class not accessible",
            });
        }
        const teacherDoc = await TeacherProfile.findOne({
            schoolId: ctx.schoolId,
            userId: ctx.sub,
        });
        const isOwner = (await teacherDoc?.isClassTeacher?.(new Types.ObjectId(String(student.classId)))) ?? false;
        if (!isOwner) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Only the assigned class teacher can access this report",
            });
        }
    }
    // Authorization for student: ensure they are viewing their own report
    if (ctx.role === "student") {
        const studentProfile = await StudentProfile.findOne({
            schoolId: ctx.schoolId,
            userId: ctx.sub,
        })
            .select("_id")
            .lean();
        if (!studentProfile) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Student profile not found",
            });
        }
        if (String(report.studentId) !== String(studentProfile._id)) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Cannot view reports of other students",
            });
        }
    }
    return ResponseHelper.success(res, { report }, SUCCESS_CODES.DATA_FETCHED);
});
// PATCH /api/v1/reports/:id - Update an academic report (examName, subjects, coScholastic, remarks)
export const updateAcademicReport = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const id = req.params?.id;
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid report id" });
    }
    const body = req.body;
    const report = await AcademicReport.findOne({
        _id: new Types.ObjectId(id),
        schoolId: ctx.schoolId,
    });
    if (!report) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Report not found" });
    }
    // If examName changes, ensure uniqueness for (schoolId, studentId, sessionId, examName)
    if (body.examName &&
        body.examName.trim() &&
        body.examName.trim() !== report.examName) {
        const exists = await AcademicReport.findOne({
            _id: { $ne: report._id },
            schoolId: ctx.schoolId,
            studentId: report.studentId,
            academicSessionId: report.academicSessionId,
            examName: body.examName.trim(),
        })
            .select("_id")
            .lean();
        if (exists) {
            throw new AppError("DUPLICATE_ENTRY", {
                reason: "Report already exists for this exam and session",
            });
        }
        report.examName = body.examName.trim();
    }
    if (body.subjects) {
        report.subjects = body.subjects;
    }
    if (body.coScholastic) {
        report.coScholastic = body.coScholastic;
    }
    if (typeof body.remarks === "string") {
        report.remarks = body.remarks;
    }
    const saved = await report.save();
    const result = await AcademicReport.findById(saved._id)
        .select("studentId academicSessionId examName subjects coScholastic remarks markedBy createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { report: result }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// DELETE /api/v1/reports/:id - Delete an academic report (admin-only)
export const deleteAcademicReport = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const id = req.params?.id;
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new AppError("VALIDATION_ERROR", { reason: "Invalid report id" });
    }
    const report = await AcademicReport.findOneAndUpdate({
        _id: new Types.ObjectId(id),
        schoolId: ctx.schoolId,
    }, { $set: { deletedAt: new Date() } })
        .select("_id")
        .lean();
    if (!report) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Report not found" });
    }
    return ResponseHelper.success(res, { deleted: true }, SUCCESS_CODES.OPERATION_SUCCESS);
});
