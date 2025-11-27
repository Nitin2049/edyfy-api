import express from "express";
import { Types } from "mongoose";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../utils/validate.js";
import { requireAdminOrClassTeacher, allow, } from "../middlewares/roleGuard.middleware.js";
import { academicReportCreateSchema } from "../validators/academicReportCreate.validator.js";
import { academicReportUpdateSchema } from "../validators/academicReportUpdate.validator.js";
import { createAcademicReport, listAcademicReports, getAcademicReportById, updateAcademicReport, deleteAcademicReport, } from "../controllers/academicReport.controllers.js";
import { AcademicReport } from "../models/academicReport.model.js";
import { StudentProfile } from "../models/studentProfile.model.js";
const router = express.Router();
// Helper: attach classId from query to params for guard compatibility on GET
const attachClassIdFromQuery = (req, _res, next) => {
    const { classId } = req.query;
    if (typeof classId === "string" && !req.params.classId) {
        req.params.classId = classId;
    }
    next();
};
// GET /api/v1/reports - List academic reports for a student and session
router.get("/", auth, attachClassIdFromQuery, allow("admin", "teacher", "student"), listAcademicReports);
// GET /api/v1/reports/:id - Get a specific report (admin or class teacher)
router.get("/:id", auth, attachClassIdFromQuery, allow("admin", "teacher", "student"), getAcademicReportById);
// POST /api/v1/reports - Create an academic report (admin or class teacher)
router.post("/", auth, validate(academicReportCreateSchema), requireAdminOrClassTeacher, createAcademicReport);
// Helper: attach classId from report to params so class-teacher guard can validate writes
const attachClassIdFromReport = async (req, _res, next) => {
    try {
        const ctx = req.context?.user;
        const { id } = req.params;
        if (!Types.ObjectId.isValid(id))
            return next();
        const report = await AcademicReport.findOne({
            _id: id,
            schoolId: ctx?.schoolId,
        })
            .select("studentId")
            .lean();
        if (!report)
            return next();
        const student = await StudentProfile.findOne({
            _id: report.studentId,
            schoolId: ctx?.schoolId,
        })
            .select("classId")
            .lean();
        if (student?.classId)
            req.params.classId = String(student.classId);
        next();
    }
    catch (err) {
        next(err);
    }
};
// PATCH /api/v1/reports/:id - Update a report (admin or class teacher)
router.patch("/:id", auth, attachClassIdFromReport, validate(academicReportUpdateSchema), requireAdminOrClassTeacher, updateAcademicReport);
// DELETE /api/v1/reports/:id - Delete a report (admin-only)
router.delete("/:id", auth, allow("admin"), deleteAcademicReport);
export default router;
