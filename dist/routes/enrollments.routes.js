import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../utils/validate.js";
import { enrollmentCreateSchema } from "../validators/enrollmentCreate.validator.js";
import { enrollmentUpdateSchema } from "../validators/enrollmentUpdate.validator.js";
import { createEnrollment, listEnrollments, getEnrollmentById, updateEnrollment } from "../controllers/enrollments.controllers.js";
import { requireAdminOrClassTeacher, allow } from "../middlewares/roleGuard.middleware.js";
import { Enrollment } from "../models/enrollment.model.js";
import { AppError } from "../utils/AppError.js";
import { Types } from "mongoose";
const router = express.Router();
// POST /api/v1/enrollments - Enroll a student to a class for a session (admin or class teacher)
router.post("/", auth, validate(enrollmentCreateSchema), requireAdminOrClassTeacher, createEnrollment);
// Helper: attach classId from query to params for guard compatibility on GET
const attachClassIdFromQuery = (req, _res, next) => {
    const { classId } = req.query;
    if (typeof classId === "string" && !req.params.classId) {
        req.params.classId = classId;
    }
    next();
};
// GET /api/v1/enrollments - List class enrollments for a session (requires ?classId=&sessionId=)
// Returns enriched student user + profile + enrollment info. Teachers restricted to their class.
router.get("/", auth, attachClassIdFromQuery, requireAdminOrClassTeacher, listEnrollments);
// GET /api/v1/enrollments/:id - Get specific enrollment (admin or class teacher of that class)
router.get("/:id", auth, allow("admin", "teacher"), getEnrollmentById);
// Helper: attach classId from enrollment to params so class-teacher guard can validate writes
const attachClassIdFromEnrollment = async (req, _res, next) => {
    try {
        const ctx = req.context?.user;
        const id = req.params?.id;
        if (!id || !Types.ObjectId.isValid(id)) {
            return next(new AppError("VALIDATION_ERROR", { reason: "Invalid enrollment id" }));
        }
        const enr = await Enrollment.findOne({ _id: id, schoolId: ctx?.schoolId, deletedAt: null })
            .select("classId")
            .lean();
        if (!enr) {
            return next(new AppError("RESOURCE_NOT_FOUND", { reason: "Enrollment not found" }));
        }
        if (!req.params.classId) {
            req.params.classId = String(enr.classId);
        }
        next();
    }
    catch (err) {
        next(err);
    }
};
// PATCH /api/v1/enrollments/:id - Update enrollment (admin or class teacher)
router.patch("/:id", auth, attachClassIdFromEnrollment, validate(enrollmentUpdateSchema), requireAdminOrClassTeacher, updateEnrollment);
export default router;
