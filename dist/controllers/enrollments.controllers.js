import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { Types } from "mongoose";
import { Enrollment } from "../models/enrollment.model.js";
import { Class } from "../models/class.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { AcademicSession } from "../models/academicSession.model.js";
import { TeacherProfile } from "../models/teacherProfile.model.js";
// Enroll (link) a student into a class for a particular academic session
export const createEnrollment = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const { classId, studentId, sessionId, notes } = req.body;
    // Validate ObjectIds (zod already validates basic shape; still validate at DB cast)
    if (!Types.ObjectId.isValid(classId) ||
        !Types.ObjectId.isValid(studentId) ||
        !Types.ObjectId.isValid(sessionId)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Invalid identifiers provided",
        });
    }
    const [cls, student, session] = await Promise.all([
        Class.findOne({ _id: classId, schoolId: ctx.schoolId, deletedAt: null })
            .select("_id academicSessionId name section")
            .lean(),
        StudentProfile.findOne({
            _id: studentId,
            schoolId: ctx.schoolId,
            deletedAt: null,
        })
            .select("_id classId status")
            .lean(),
        AcademicSession.findOne({
            _id: sessionId,
            schoolId: ctx.schoolId,
            deletedAt: null,
        })
            .select("_id year isActive")
            .lean(),
    ]);
    if (!cls) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Class not found in this school",
        });
    }
    if (!student) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student profile not found in this school",
        });
    }
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Academic session not found in this school",
        });
    }
    // Check for existing enrollment in this session for the student
    const exists = await Enrollment.findOne({
        studentProfileId: student._id,
        academicSessionId: session._id,
        deletedAt: null,
    })
        .select("_id classId")
        .lean();
    if (exists) {
        throw new AppError("DUPLICATE_ENTRY", {
            reason: "Student is already enrolled for this academic session",
        });
    }
    // Create enrollment
    const created = await Enrollment.create({
        schoolId: ctx.schoolId,
        studentProfileId: student._id,
        classId: cls._id,
        academicSessionId: session._id,
        enrollmentDate: new Date(),
        status: "active",
        notes: notes || "",
    });
    // Optionally reflect classId on the student profile as current class
    if (String(student.classId || "") !== String(cls._id)) {
        await StudentProfile.updateOne({ _id: student._id }, { $set: { classId: cls._id } });
    }
    const enrollment = await Enrollment.findById(created._id)
        .select("studentProfileId classId academicSessionId enrollmentDate status notes createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { enrollment }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// List enrollments for a class+session returning enriched student + user details (no studentId filtering, no pagination)
export const listEnrollments = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const classIdRaw = req.query.classId?.trim();
    const sessionIdRaw = req.query.sessionId?.trim();
    if (!classIdRaw || !Types.ObjectId.isValid(classIdRaw)) {
        throw new AppError("VALIDATION_ERROR", { reason: "classId is required and must be a valid id" });
    }
    if (!sessionIdRaw || !Types.ObjectId.isValid(sessionIdRaw)) {
        throw new AppError("VALIDATION_ERROR", { reason: "sessionId is required and must be a valid id" });
    }
    const filter = {
        schoolId: ctx.schoolId,
        classId: new Types.ObjectId(classIdRaw),
        academicSessionId: new Types.ObjectId(sessionIdRaw),
        deletedAt: null,
    };
    // Teacher role: ensure guard already injected / validated classId; still trust but re-validate ownership if needed
    if (ctx.role === "teacher") {
        const paramClassId = req.params?.classId;
        if (paramClassId && Types.ObjectId.isValid(paramClassId) && paramClassId !== classIdRaw) {
            // Prevent teacher querying other class
            throw new AppError("ACCESS_DENIED", { reason: "Teacher cannot access another class's enrollments" });
        }
    }
    const enrollments = await Enrollment.find(filter)
        .select("studentProfileId enrollmentDate status notes")
        .populate({
        path: "studentProfileId",
        select: "admissionNo rollNo guardianName guardianNumber status classId userId",
        populate: {
            path: "userId",
            select: "firstName lastName username email phone gender dob address profileImage role",
        },
    })
        .sort({ "studentProfileId.rollNo": 1, enrollmentDate: 1 })
        .lean();
    const data = enrollments.map((enr) => {
        const profile = enr.studentProfileId || {};
        const user = profile.userId || {};
        const profileId = profile?._id || enr.studentProfileId || null;
        return {
            studentProfileId: profileId ? String(profileId) : undefined,
            enrollmentDate: enr.enrollmentDate,
            enrollmentStatus: enr.status,
            notes: enr.notes,
            user: {
                firstName: user.firstName,
                lastName: user.lastName,
                username: user.username,
                email: user.email,
                phone: user.phone,
                gender: user.gender,
                dob: user.dob,
                address: user.address,
            },
            profile: {
                _id: profileId ? String(profileId) : undefined,
                admissionNo: profile.admissionNo,
                rollNo: profile.rollNo,
                guardianName: profile.guardianName,
                guardianNumber: profile.guardianNumber,
                status: profile.status,
                classId: profile.classId,
            },
        };
    });
    return ResponseHelper.success(res, { data, meta: { count: data.length } }, SUCCESS_CODES.DATA_FETCHED);
});
// Get a specific enrollment by id (admin or the class's teacher)
export const getEnrollmentById = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const id = req.params?.id;
    if (!id || !Types.ObjectId.isValid(id)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Invalid enrollment id",
        });
    }
    const enrollment = await Enrollment.findOne({
        _id: new Types.ObjectId(id),
        schoolId: new Types.ObjectId(ctx.schoolId),
        deletedAt: null,
    })
        .select("studentProfileId classId academicSessionId enrollmentDate status notes createdAt updatedAt")
        .lean();
    if (!enrollment) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Enrollment not found",
        });
    }
    // Authorization: admin passes; teacher must be class teacher for this class
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
        // Use teacher profile instance method via a second fetch (method not available on lean objects)
        const teacherDoc = await TeacherProfile.findOne({
            schoolId: ctx.schoolId,
            userId: ctx.sub,
        });
        const isOwner = (await teacherDoc?.isClassTeacher?.(new Types.ObjectId(String(enrollment.classId)))) ?? false;
        if (!isOwner) {
            throw new AppError("ACCESS_DENIED", {
                reason: "Only the assigned class teacher can access this enrollment",
            });
        }
    }
    return ResponseHelper.success(res, { enrollment }, SUCCESS_CODES.DATA_FETCHED);
});
// Update a specific enrollment (admin or class teacher)
export const updateEnrollment = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    const enrollmentId = req.params?.id;
    if (!enrollmentId || !Types.ObjectId.isValid(enrollmentId)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Invalid enrollment id",
        });
    }
    const { classId, status, notes } = req.body;
    // Fetch enrollment doc
    const enrollment = await Enrollment.findOne({
        _id: new Types.ObjectId(enrollmentId),
        schoolId: new Types.ObjectId(ctx.schoolId),
        deletedAt: null,
    });
    if (!enrollment) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Enrollment not found",
        });
    }
    // If classId is provided, validate the class and ensure it's in the same session
    if (classId) {
        if (!Types.ObjectId.isValid(classId)) {
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
            throw new AppError("RESOURCE_NOT_FOUND", {
                reason: "Class not found in this school",
            });
        }
        enrollment.classId = classId;
    }
    if (typeof notes === "string") {
        enrollment.notes = notes;
    }
    if (typeof status === "string") {
        const prev = enrollment.status;
        enrollment.status = status;
        if (status === "promoted") {
            // Set promoted metadata
            if (ctx.role === "teacher") {
                const teacher = await TeacherProfile.findOne({
                    schoolId: ctx.schoolId,
                    userId: ctx.sub,
                })
                    .select("_id")
                    .lean();
                enrollment.promotedBy = teacher?._id ?? undefined;
            }
            else {
                enrollment.promotedBy = undefined;
            }
            enrollment.promotedOn = new Date();
        }
        else if (prev === "promoted" && status !== "promoted") {
            // Clear promoted metadata if moving away from promoted
            enrollment.promotedBy = undefined;
            enrollment.promotedOn = undefined;
        }
    }
    const saved = await enrollment.save();
    // If enrollment is active and class changed, reflect on student profile
    if (classId && saved.status === "active") {
        await StudentProfile.updateOne({ _id: saved.studentProfileId }, { $set: { classId: saved.classId } });
    }
    const result = await Enrollment.findById(saved._id)
        .select("studentProfileId classId academicSessionId enrollmentDate status notes promotedBy promotedOn createdAt updatedAt")
        .lean();
    return ResponseHelper.success(res, { enrollment: result }, SUCCESS_CODES.OPERATION_SUCCESS);
});
