import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../utils/validate.js";
import { attendanceCreateSchema } from "../validators/attendanceCreate.validator.js";
import { createAttendance, listAttendance, updateAttendance, deleteAttendance, } from "../controllers/attendance.controllers.js";
import { allowRead, requireAdminOrClassTeacher } from "../middlewares/roleGuard.middleware.js";
import { attendanceUpdateSchema } from "../validators/attendanceUpdate.validator.js";
const router = express.Router();
// Helper: attach classId from query to params for guard compatibility on GET
const attachClassIdFromQuery = (req, _res, next) => {
    const { classId } = req.query;
    if (typeof classId === "string" && !req.params.classId) {
        req.params.classId = classId;
    }
    next();
};
// GET /api/v1/attendance - List attendance (admin can filter broadly; teachers must provide ?classId=)
router.get("/", auth, attachClassIdFromQuery, allowRead(), listAttendance);
// POST /api/v1/attendance - Mark attendance for a class on a specific date and session
router.post("/", auth, validate(attendanceCreateSchema), requireAdminOrClassTeacher, createAttendance);
// Helper: attach classId from attendance to params so class-teacher guard can validate writes
const attachClassIdFromAttendance = async (req, _res, next) => {
    try {
        const ctx = req.context?.user;
        const id = req.params?.id;
        if (!id || typeof id !== "string")
            return next();
        if (!id || id.length !== 24)
            return next();
        const { Types } = await import("mongoose");
        if (!Types.ObjectId.isValid(id))
            return next();
        const { Attendance } = await import("../models/attendance.model.js");
        const attn = await Attendance.findOne({
            _id: id,
            schoolId: ctx?.schoolId,
            deletedAt: null,
        })
            .select("classId")
            .lean();
        if (attn && !req.params.classId) {
            req.params.classId = String(attn.classId);
        }
        next();
    }
    catch (err) {
        next(err);
    }
};
// PATCH /api/v1/attendance/:id - Update attendance (admin or class teacher)
router.patch("/:id", auth, attachClassIdFromAttendance, validate(attendanceUpdateSchema), requireAdminOrClassTeacher, updateAttendance);
// DELETE /api/v1/attendance/:id - soft delete
router.delete("/:id", auth, attachClassIdFromAttendance, requireAdminOrClassTeacher, deleteAttendance);
export default router;
