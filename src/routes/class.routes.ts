import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { allow, allowRead, requireAdminOrClassTeacher } from "../middlewares/roleGuard.middleware.js";
import { validate } from "../utils/validate.js";
import { classCreateSchema } from "../validators/classCreate.validator.js";
import { classUpdateSchema } from "../validators/classUpdate.validator.js";
import { createClass, getAllClasses, getClassById, updateClass, deleteClass, getStudentsOfClass } from "../controllers/class.controllers.js";

const router = express.Router();

// POST /api/v1/classes - Create a class (admin-only)
router.post("/", auth, allow("admin"), validate(classCreateSchema), createClass);

// GET /api/v1/classes - List classes (admin-only)
router.get("/", auth, allow("admin"), getAllClasses);

// GET /api/v1/classes/:classId - Get a specific class (admin or class teacher)
router.get("/:classId", auth, allowRead(), getClassById);

// PATCH /api/v1/classes/:classId - Update a class (admin-only)
router.patch(
	"/:classId",
	auth,
	allow("admin"),
	validate(classUpdateSchema),
	updateClass
);

// DELETE /api/v1/classes/:classId - Delete (soft delete) a class (admin-only)
router.delete(
	"/:classId",
	auth,
	allow("admin"),
	deleteClass
);

// GET /api/v1/classes/:classId/students - List students of a class (admin or class teacher)
router.get(
	"/:classId/students",
	auth,
	requireAdminOrClassTeacher,
	getStudentsOfClass
);

export default router;




