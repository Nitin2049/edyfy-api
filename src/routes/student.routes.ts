import express, { Request, Response, NextFunction } from "express";
import {
  registerStudent,
  listStudentsByClass,
  getStudentByUsername,
  updateStudent,
  softDeleteStudent
} from "../controllers/student.controllers.js";
import { auth } from "../middlewares/auth.middleware.js";
import { requireAdminOrClassTeacher } from "../middlewares/roleGuard.middleware.js";
import { allow } from "../middlewares/roleGuard.middleware.js";
import { validate } from "../utils/validate.js";
import { createStudentSchema } from "../validators/studentRegister.validator.js";
import { updateStudentSchema } from "../validators/studentUpdate.validator.js";

const router = express.Router();

// Normalize classId from query into params for guard compatibility on GET /
const attachClassIdFromQuery = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { classId } = req.query;

  if (typeof classId === "string" && !req.params.classId) {
    req.params.classId = classId;
  }

  next();
};

// Normalize classId from body into params for guard compatibility on PATCH /
// const attachClassIdFromBody = (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ): void => {
//   const { classId } = req.body as any;
//   if (typeof classId === "string" && !req.params.classId) {
//     req.params.classId = classId;
//   }
//   next();
// };

// Read all students of a class (admin or that class's class teacher)
// Client must provide ?classId=<ObjectId> in the query string
router.get(
  "/",
  auth,
  attachClassIdFromQuery,
  requireAdminOrClassTeacher,
  listStudentsByClass
);

// Create a student (admin or that class's class teacher)
router.post(
  "/",
  auth,
  validate(createStudentSchema),
  requireAdminOrClassTeacher,
  registerStudent
)

// Get specific student in a class (admin or that class's class teacher)
// Client must provide  :username and ?classId=<ObjectId>
router.get(
  "/:username",
  auth,
  attachClassIdFromQuery,
  requireAdminOrClassTeacher,
  getStudentByUsername
);

// Update specific student in a class (admin or that class's class teacher)
// Client must provide  :username and body.classId=<ObjectId>
router.patch(
  "/:username",
  auth,
  validate(updateStudentSchema),
  attachClassIdFromQuery,
  requireAdminOrClassTeacher,
  updateStudent
);

// Delete (soft delete) specific student's profile in a class (admin-only)
// Client must provide  :username and ?classId=<ObjectId> and
router.delete(
  "/:username",
  auth,
  attachClassIdFromQuery,
  allow("admin"),
  softDeleteStudent
);

export default router;