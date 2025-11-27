import { User } from "../models/user.model.js";
import { TeacherProfile } from "../models/teacherProfile.model.js";
import { Class } from "../models/class.model.js";
import { ResponseHelper } from "../utils/response.helper.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { AppError } from "../utils/AppError.js";
import { SUCCESS_CODES } from "../constants/successCodes.js";
import { logger } from "../utils/logger.js";
import { Types } from "mongoose";
// Registers a teacher user and creates the corresponding teacher profile
export const registerTeacher = asyncHandler(async (req, res, next) => {
    const schoolId = req.context?.user?.schoolId;
    if (!schoolId) {
        return next(new AppError("ACCESS_DENIED", {
            reason: "Missing schoolId in context",
        }));
    }
    const { firstName, lastName, gender, dob, profileImage, address, username, email, phone, password, 
    // Teacher profile fields
    qualification, joinDate, exitDate, classId, } = req.body;
    let validatedClassId;
    if (classId) {
        if (!Types.ObjectId.isValid(classId)) {
            return next(new AppError("VALIDATION_ERROR", { reason: "Invalid classId" }));
        }
        const cls = await Class.findOne({
            _id: classId,
            schoolId,
            deletedAt: null,
        })
            .select("_id classTeacherId")
            .lean();
        if (!cls) {
            return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found" }));
        }
        if (cls.classTeacherId) {
            return next(new AppError("DUPLICATE_ENTRY", { reason: "Class already assigned" }));
        }
        validatedClassId = new Types.ObjectId(classId);
    }
    // Check for existing user by username within the same school
    const existing = await User.findOne({ schoolId, username });
    if (existing) {
        logger.warn("Attempt to create teacher with existing username", {
            username,
            schoolId,
        });
        return next(new AppError("USER_ALREADY_EXISTS"));
    }
    // Create the User (password hashing handled by pre-save hook)
    const user = await User.create({
        schoolId,
        firstName,
        lastName,
        gender,
        dob,
        profileImage,
        address,
        username,
        email,
        phone,
        password,
        role: "teacher",
    });
    // Create the TeacherProfile
    const teacherProfile = await TeacherProfile.create({
        schoolId,
        userId: user._id,
        qualification,
        joinDate,
        exitDate,
        status: "active",
        classId: validatedClassId,
    });
    if (validatedClassId) {
        await Class.findByIdAndUpdate(validatedClassId, {
            $set: { classTeacherId: teacherProfile._id },
        });
    }
    logger.info("Teacher created", {
        userId: user._id,
        schoolId,
        profileId: teacherProfile._id,
        role: "teacher",
    });
    return ResponseHelper.success(res, { userId: user._id, teacherProfileId: teacherProfile._id }, SUCCESS_CODES.TEACHER_CREATED);
});
// List all teachers for the current school (admin-only)
export const getAllTeachers = asyncHandler(async (req, res, next) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }
    // Hard guard: admin only (routes should also enforce allow("admin"))
    if (ctx.role !== "admin") {
        return next(new AppError("ACCESS_DENIED", { reason: "Admins only" }));
    }
    // Query params: pagination, search, status, sort
    const page = Math.max(parseInt(String(req.query.page ?? "1"), 10) || 1, 1);
    const limitRaw = Math.max(parseInt(String(req.query.limit ?? "20"), 10) || 20, 1);
    const limit = Math.min(limitRaw, 100); // cap to avoid abuse
    const skip = (page - 1) * limit;
    const status = req.query.status?.trim(); // "active" | "resigned"
    const q = req.query.q?.trim(); // search term for name/username/email/phone
    const sort = req.query.sort?.trim() || "-createdAt"; // "name", "-createdAt", etc.
    // Build profile filter
    const profileFilter = { schoolId: ctx.schoolId, deletedAt: null };
    if (status)
        profileFilter.status = status;
    // Build user filter for search
    let userFilter = {};
    if (q) {
        const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        userFilter = {
            $or: [
                { firstName: regex },
                { lastName: regex },
                { username: regex },
                { email: regex },
                { phone: regex },
            ],
        };
    }
    // Query with population and pagination
    const [items, total] = await Promise.all([
        TeacherProfile.find(profileFilter)
            .populate({
            path: "userId",
            match: userFilter,
            select: "firstName lastName username email address phone profileImage dob gender isActive role",
        })
            .select("qualification joinDate exitDate status createdAt updatedAt classId")
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        TeacherProfile.countDocuments(profileFilter),
    ]);
    // If a populate match filtered out a doc (userId becomes null), drop it
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
// Get a specific teacher by username (admin-only)
export const getOneTeacher = asyncHandler(async (req, res, next) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }
    // Enforce admin-only access here; route should also guard with roleGuard/allow("admin")
    if (ctx.role !== "admin") {
        return next(new AppError("ACCESS_DENIED", { reason: "Admins only" }));
    }
    // Accept username or teacherUserId from params or query
    const raw = req.params.username ||
        req.query.username ||
        req.params.teacherUserId ||
        req.query.teacherUserId;
    const username = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (!username) {
        return next(new AppError("VALIDATION_ERROR", { reason: "username is required" }));
    }
    // Try finding by username first
    let user = await User.findOne({
        schoolId: ctx.schoolId,
        role: "teacher",
        username,
    })
        .select("firstName lastName username email phone profileImage dob gender isActive role address createdAt updatedAt")
        .lean();
    // If not found, try finding by ID
    if (!user && Types.ObjectId.isValid(username)) {
        user = await User.findOne({
            schoolId: ctx.schoolId,
            role: "teacher",
            _id: username, // assuming username param might actually be the ObjectId
        })
            .select("firstName lastName username email phone profileImage dob gender isActive role address createdAt updatedAt")
            .lean();
    }
    // Still not found
    if (!user) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Teacher not found" });
    }
    // Fetch teacher profile
    const profile = await TeacherProfile.findOne({
        schoolId: ctx.schoolId,
        userId: user._id,
        deletedAt: null,
    })
        .select("qualification joinDate exitDate status createdAt updatedAt classId")
        .lean();
    if (!profile) {
        throw new AppError("RESOURCE_NOT_FOUND", { reason: "Teacher not found" });
    }
    return ResponseHelper.success(res, { user, profile }, SUCCESS_CODES.DATA_FETCHED);
});
// Update a specific teacher (by username): updates User and TeacherProfile; admin-only
export const updateTeacher = asyncHandler(async (req, res, next) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }
    if (ctx.role !== "admin") {
        return next(new AppError("ACCESS_DENIED", { reason: "Admins only" }));
    }
    const username = req.params.username?.trim().toLowerCase() || "";
    if (!username) {
        return next(new AppError("VALIDATION_ERROR", { reason: "username is required" }));
    }
    // Find the teacher user in this school
    const user = await User.findOne({
        schoolId: ctx.schoolId,
        role: "teacher",
        username,
    });
    if (!user) {
        return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Teacher not found" }));
    }
    // Split payload into user vs profile fields
    const { firstName, lastName, gender, dob, profileImage, address, email, phone, qualification, joinDate, exitDate, status, classId, } = req.body;
    // Optional: enforce unique email/phone if changed
    if (email && email !== user.email) {
        const emailTaken = await User.findOne({
            email,
            _id: { $ne: user._id },
        }).lean();
        if (emailTaken)
            return next(new AppError("USER_ALREADY_EXISTS", {
                reason: "Email already in use",
            }));
    }
    // Update User
    const userSet = {};
    if (firstName !== undefined)
        userSet.firstName = firstName;
    if (lastName !== undefined)
        userSet.lastName = lastName;
    if (gender !== undefined)
        userSet.gender = gender;
    if (dob !== undefined)
        userSet.dob = dob;
    if (profileImage !== undefined)
        userSet.profileImage = profileImage;
    if (address !== undefined)
        userSet.address = address;
    if (email !== undefined)
        userSet.email = email;
    if (phone !== undefined)
        userSet.phone = phone;
    const updatedUser = Object.keys(userSet).length
        ? await User.findByIdAndUpdate(user._id, { $set: userSet }, { new: true }).select("firstName lastName username email phone profileImage dob gender isActive role address createdAt updatedAt")
        : await User.findById(user._id).select("firstName lastName username email phone profileImage dob gender isActive role address createdAt updatedAt");
    // Update TeacherProfile
    const profileSet = {};
    if (qualification !== undefined)
        profileSet.qualification = qualification;
    if (joinDate !== undefined)
        profileSet.joinDate = joinDate;
    if (exitDate !== undefined)
        profileSet.exitDate = exitDate;
    if (status !== undefined)
        profileSet.status = status;
    // Handle class reassignment if classId provided
    let updatedProfile;
    if (classId !== undefined) {
        // Load existing profile for comparison
        const existingProfile = await TeacherProfile.findOne({
            schoolId: ctx.schoolId,
            userId: user._id,
            deletedAt: null,
        })
            .select("_id classId")
            .lean();
        if (!existingProfile) {
            return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Teacher profile not found" }));
        }
        if (classId && !Types.ObjectId.isValid(classId)) {
            return next(new AppError("VALIDATION_ERROR", { reason: "Invalid classId" }));
        }
        // Only proceed if changing
        const incomingClassId = classId ? new Types.ObjectId(classId) : undefined;
        const oldClassId = existingProfile.classId;
        if (incomingClassId && (!oldClassId || !incomingClassId.equals(oldClassId))) {
            const cls = await Class.findOne({
                _id: incomingClassId,
                schoolId: ctx.schoolId,
                deletedAt: null,
            })
                .select("_id classTeacherId")
                .lean();
            if (!cls) {
                return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Class not found" }));
            }
            if (cls.classTeacherId && String(cls.classTeacherId) !== String(existingProfile._id)) {
                return next(new AppError("DUPLICATE_ENTRY", { reason: "Class already assigned" }));
            }
            // Clear old class teacher reference if set
            if (oldClassId) {
                await Class.findOneAndUpdate({ _id: oldClassId, classTeacherId: existingProfile._id }, { $unset: { classTeacherId: "" } });
            }
            profileSet.classId = incomingClassId;
        }
        // If incomingClassId is undefined and oldClassId exists, keep as-is (no removal logic yet)
    }
    updatedProfile = await TeacherProfile.findOneAndUpdate({ schoolId: ctx.schoolId, userId: user._id, deletedAt: null }, Object.keys(profileSet).length ? { $set: profileSet } : {}, { new: true })
        .select("qualification joinDate exitDate status createdAt updatedAt classId")
        .lean();
    // If we set a new classId ensure Class.classTeacherId is updated
    if (profileSet.classId) {
        await Class.findByIdAndUpdate(profileSet.classId, {
            $set: { classTeacherId: updatedProfile?._id },
        });
    }
    return ResponseHelper.success(res, { user: updatedUser, profile: updatedProfile }, SUCCESS_CODES.OPERATION_SUCCESS);
});
// Soft delete a teacher's profile (admin-only)
export const softDeleteTeacher = asyncHandler(async (req, res, next) => {
    const ctx = req.context?.user;
    if (!ctx?.schoolId || !ctx?.role) {
        return next(new AppError("ACCESS_DENIED", { reason: "Unauthenticated" }));
    }
    if (ctx.role !== "admin") {
        return next(new AppError("ACCESS_DENIED", { reason: "Admins only" }));
    }
    const username = req.params.username?.trim().toLowerCase() || "";
    if (!username) {
        return next(new AppError("VALIDATION_ERROR", { reason: "username is required" }));
    }
    const user = await User.findOne({
        schoolId: ctx.schoolId,
        role: "teacher",
        username,
    })
        .select("_id")
        .lean();
    if (!user) {
        return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Teacher not found" }));
    }
    const profile = await TeacherProfile.findOne({
        schoolId: ctx.schoolId,
        userId: user._id,
        deletedAt: null,
    })
        .select("_id classId")
        .lean();
    if (!profile) {
        return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Active teacher profile not found" }));
    }
    // Clear class reference if assigned
    if (profile.classId) {
        await Class.findOneAndUpdate({ _id: profile.classId, classTeacherId: profile._id }, { $unset: { classTeacherId: "" } });
    }
    const updated = await TeacherProfile.findOneAndUpdate({ schoolId: ctx.schoolId, userId: user._id, deletedAt: null }, { $set: { deletedAt: new Date() } }, { new: true }).lean();
    if (!updated) {
        return next(new AppError("RESOURCE_NOT_FOUND", {
            reason: "Active teacher profile not found",
        }));
    }
    return ResponseHelper.success(res, { profile: updated }, SUCCESS_CODES.TEACHER_DELETED);
});
