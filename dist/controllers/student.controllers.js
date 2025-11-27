import { User } from "../models/user.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
import { Types } from "mongoose";
import { ResponseHelper } from "../utils/response.helper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { logger } from "../utils/logger.js";
import { Class } from "../models/class.model.js";
import { AcademicSession } from "../models/academicSession.model.js";
import { Enrollment } from "../models/enrollment.model.js";
export const registerStudent = asyncHandler(async (req, res) => {
    const schoolId = req.context?.user?.schoolId;
    if (!schoolId) {
        throw new AppError("ACCESS_DENIED", {
            reason: "Missing schoolId in context",
        });
    }
    const academicSessionId = req.query.academicSessionId;
    const { firstName, lastName, classId, gender, dob, address, profileImage, username, email, phone, password, admissionNo, rollNo, guardianName, guardianNumber, dateOfAdmission, dateOfLeaving, notes, } = req.body;
    // ⚡ Check for existing user
    const usernameClean = username.trim().toLowerCase();
    const existing = await User.findOne({ schoolId, username: usernameClean });
    if (existing) {
        logger.warn("User with this username already exists", {
            username: usernameClean,
            schoolId,
        });
        throw new AppError("USER_ALREADY_EXISTS", { reason: "Username already taken" });
    }
    if (![classId, academicSessionId].every(Types.ObjectId.isValid)) {
        throw new AppError("VALIDATION_ERROR", {
            reason: "Invalid classId or academicSessionId",
        });
    }
    const cls = await Class.findOne({
        _id: classId,
        schoolId,
        deletedAt: null,
    });
    if (!cls) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Class not found in this school",
        });
    }
    const session = await AcademicSession.findOne({
        _id: academicSessionId,
        schoolId,
        deletedAt: null,
    });
    if (!session) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Academic session not found in this school",
        });
    }
    const sessionTx = await User.startSession();
    sessionTx.startTransaction();
    try {
        const user = await User.create([
            {
                schoolId,
                firstName,
                lastName,
                gender,
                dob,
                address,
                profileImage,
                username,
                email,
                phone,
                password,
                role: "student",
            },
        ], { session: sessionTx });
        const studentProfile = await StudentProfile.create([
            {
                schoolId,
                userId: user[0]._id,
                classId,
                admissionNo,
                rollNo,
                guardianName,
                guardianNumber,
                dateOfAdmission,
                dateOfLeaving,
                status: "active",
            },
        ], { session: sessionTx });
        // Check for existing enrollment in this session for the student
        const exists = await Enrollment.findOne({
            studentProfileId: studentProfile[0]._id,
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
        const enrollment = await Enrollment.create([
            {
                schoolId,
                studentProfileId: studentProfile[0]._id,
                classId: cls._id,
                academicSessionId: session._id,
                enrollmentDate: new Date(),
                status: "active",
                notes,
            },
        ], { session: sessionTx });
        await sessionTx.commitTransaction();
        sessionTx.endSession();
        const populated = await Enrollment.findById(enrollment[0]._id)
            .populate("studentProfileId", "admissionNo rollNo guardianName")
            .populate("classId", "name section")
            .populate("academicSessionId", "name startDate endDate")
            .lean();
        logger.info("Student created", {
            schoolId,
            userId: user[0]._id,
            studentProfileId: studentProfile[0]._id,
        });
        return ResponseHelper.success(res, {
            student: populated,
        }, SUCCESS_CODES.STUDENT_CREATED);
    }
    catch (err) {
        await sessionTx.abortTransaction();
        sessionTx.endSession();
        throw err;
    }
});
// List all students for a specific class (admin or that class's class teacher)
export const listStudentsByClass = asyncHandler(async (req, res) => {
    const schoolId = req.context?.user?.schoolId;
    if (!schoolId) {
        throw new AppError("ACCESS_DENIED", {
            reason: "Missing schoolId in context",
        });
    }
    // classId is required; guard ensures validity, but we also assert here
    const classId = req.params?.classId || req.query?.classId;
    if (!classId) {
        throw new AppError("VALIDATION_ERROR", { reason: "classId is required" });
    }
    // Pagination and optional search (by student user's name/email/phone)
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
    const limit = Math.min(limitRaw, 100);
    const skip = (page - 1) * limit;
    const q = req.query.q?.trim();
    const sort = req.query.sort?.trim() || "-createdAt";
    const profileFilter = {
        schoolId,
        classId,
        deletedAt: null,
    };
    // Build user search filter
    let userFilter = {};
    if (q) {
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        userFilter = {
            $or: [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
                { phone: regex },
            ],
        };
    }
    const [items, total] = await Promise.all([
        StudentProfile.find(profileFilter)
            .populate({
            path: "userId",
            match: userFilter,
            select: "firstName lastName email phone profileImage dob gender address role username isActive",
        })
            .select("admissionNo rollNo classId guardianName guardianNumber dateOfAdmission dateOfLeaving status createdAt updatedAt")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        StudentProfile.countDocuments(profileFilter),
    ]);
    const data = items.filter((doc) => !!doc.userId);
    return ResponseHelper.success(res, {
        data,
        meta: {
            page,
            limit,
            total,
            count: data.length,
            pages: Math.ceil(total / limit) || 1,
        },
    }, SUCCESS_CODES.DATA_FETCHED);
});
// Get a specific student within a class (admin or that class's class teacher)
// Client should provide:
//   - path param :id as student's username (preferred), OR user's ObjectId, OR StudentProfile ObjectId
//   - query param ?classId=<ObjectId> (required for guard and scoping)
export const getStudentByUsername = asyncHandler(async (req, res) => {
    const schoolId = req.context?.user?.schoolId;
    if (!schoolId)
        throw new AppError("ACCESS_DENIED", {
            reason: "Missing schoolId in context",
        });
    const classId = req.query?.classId;
    if (!classId)
        throw new AppError("VALIDATION_ERROR", { reason: "classId is required" });
    const rawUsername = req.params?.username;
    if (!rawUsername || typeof rawUsername !== "string") {
        throw new AppError("VALIDATION_ERROR", {
            reason: "student identifier is required",
        });
    }
    const username = rawUsername.trim().toLowerCase();
    // 🔍 Try to find user (by username → userId)
    // Cast as any to allow assignment from populated profileDoc.userId later
    let userDoc = await User.findOne({
        schoolId,
        role: "student",
        username,
    })
        .select("firstName lastName username email phone profileImage dob gender address role isActive createdAt updatedAt")
        .lean();
    if (!userDoc) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student not found in this class",
        });
    }
    // 🧩 Try to find profile
    let profileDoc = null;
    if (userDoc) {
        profileDoc = await StudentProfile.findOne({
            schoolId,
            classId,
            userId: userDoc._id,
            deletedAt: null,
        })
            .select("admissionNo rollNo classId guardianName guardianNumber dateOfAdmission dateOfLeaving status createdAt updatedAt")
            .lean();
    }
    if (!profileDoc) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student not found in this class",
        });
    }
    return ResponseHelper.success(res, { user: userDoc, profile: profileDoc }, SUCCESS_CODES.DATA_FETCHED);
});
// Update a specific student's details within a class (admin or that class's class teacher)
// Client should provide:
//   - path param :id as student's username (preferred) OR user's ObjectId OR StudentProfile ObjectId
//   - body.classId = the class where the student belongs (required for guard and scoping)
//   - optional fields to update from allowed sets (user + student profile)
export const updateStudent = asyncHandler(async (req, res) => {
    const schoolId = req.context?.user?.schoolId;
    if (!schoolId)
        throw new AppError("ACCESS_DENIED", { reason: "Missing schoolId" });
    const classId = req.query.classId;
    if (!classId)
        throw new AppError("VALIDATION_ERROR", { reason: "classId is required" });
    const rawUsername = req.params.username;
    if (!rawUsername)
        throw new AppError("VALIDATION_ERROR", {
            reason: "student identifier is required",
        });
    let username = rawUsername.toLowerCase();
    const userDoc = await User.findOne({
        schoolId,
        role: "student",
        username,
    }).lean();
    if (!userDoc)
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Student not found" });
    // Find profile
    const profileDoc = await StudentProfile.findOne({
        schoolId,
        classId,
        userId: userDoc._id,
        deletedAt: null,
    }).lean();
    if (!profileDoc) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student profile not found in this class",
        });
    }
    // Define allowed keys
    const allowedUserKeys = [
        "firstName",
        "lastName",
        "email",
        "phone",
        "profileImage",
        "dob",
        "gender",
        "address",
        "isActive",
    ];
    const allowedProfileKeys = [
        "admissionNo",
        "rollNo",
        "guardianName",
        "guardianNumber",
        "dateOfAdmission",
        "dateOfLeaving",
        "status",
    ];
    // Extract updates
    const body = req.body || {};
    const userUpdates = {};
    const profileUpdates = {};
    for (const key of allowedUserKeys) {
        if (key in body)
            userUpdates[key] = body[key];
    }
    for (const key of allowedProfileKeys) {
        if (key in body)
            profileUpdates[key] = body[key];
    }
    // Enforce unique email within school if email changes
    if (userUpdates.email && userUpdates.email !== userDoc.email) {
        const exists = await User.findOne({
            schoolId,
            email: userUpdates.email,
            _id: { $ne: userDoc._id },
        }).select("_id");
        if (exists)
            throw new AppError("USER_ALREADY_EXISTS", {
                reason: "Email already in use",
            });
    }
    // Update both
    const [updatedUser, updatedProfile] = await Promise.all([
        Object.keys(userUpdates).length
            ? User.findByIdAndUpdate(userDoc._id, { $set: userUpdates }, { new: true })
                .select("firstName lastName username email phone profileImage dob gender address isActive")
                .lean()
            : Promise.resolve(userDoc),
        Object.keys(profileUpdates).length
            ? StudentProfile.findByIdAndUpdate(profileDoc._id, { $set: profileUpdates }, { new: true })
                .select("admissionNo rollNo guardianName guardianNumber dateOfAdmission dateOfLeaving status")
                .lean()
            : Promise.resolve(profileDoc),
    ]);
    logger.info("Student updated", {
        schoolId,
        userId: updatedUser?._id,
        studentProfileId: updatedProfile?._id,
    });
    return ResponseHelper.success(res, { user: updatedUser, profile: updatedProfile }, SUCCESS_CODES.STUDENT_UPDATED);
});
// Soft delete a student's profile (admin-only), class-scoped
// Accepts :id as username | user ObjectId | studentProfile ObjectId
// Requires classId (in query or body or params) to scope the profile to a specific class
export const softDeleteStudent = asyncHandler(async (req, res) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        throw new AppError("ACCESS_DENIED", { reason: "Unauthenticated" });
    }
    if (ctx.role !== "admin") {
        throw new AppError("ACCESS_DENIED", { reason: "Admins only" });
    }
    const classId = req.query?.classId;
    if (!classId) {
        throw new AppError("VALIDATION_ERROR", { reason: "classId is required" });
    }
    const rawUsername = req.params.username;
    if (!rawUsername)
        throw new AppError("VALIDATION_ERROR", {
            reason: "student identifier is required",
        });
    let username = rawUsername.toLowerCase();
    // Resolve target student similar to getStudentById/updateStudent
    let userDoc = null;
    let profileDoc = null;
    userDoc = await User.findOne({
        schoolId: ctx.schoolId,
        role: "student",
        username,
    })
        .select("_id email isActive")
        .lean();
    if (!userDoc) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student not found",
        });
    }
    if (userDoc) {
        profileDoc = await StudentProfile.findOne({
            schoolId: ctx.schoolId,
            classId,
            userId: userDoc._id,
            deletedAt: null,
        })
            .select("_id userId classId deletedAt")
            .lean();
    }
    if (!profileDoc) {
        throw new AppError("RESOURCE_NOT_FOUND", {
            reason: "Student profile not found",
        });
    }
    const now = new Date();
    // Soft delete profile and deactivate user to prevent access
    const [updatedProfile] = await Promise.all([
        StudentProfile.findByIdAndUpdate(profileDoc._id, { $set: { deletedAt: now } }, { new: true })
            .select("_id userId classId deletedAt")
            .lean(),
        User.findByIdAndUpdate(userDoc._id, {
            $set: { isActive: false },
        }).lean(),
    ]);
    logger.info("Student profile soft-deleted", {
        schoolId: ctx.schoolId,
        userId: userDoc._id,
        studentProfileId: profileDoc._id,
    });
    return ResponseHelper.success(res, { profile: updatedProfile }, SUCCESS_CODES.STUDENT_DELETED);
});
