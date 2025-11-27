import { registerTeacher, getAllTeachers, getOneTeacher, updateTeacher, softDeleteTeacher } from "../controllers/teacher.controllers.js";
import { validate } from "../utils/validate.js";
import { teacherRegisterSchema } from "../validators/teacherRegister.validator.js";
import { teacherUpdateSchema } from "../validators/teacherUpdate.validator.js";
import { Router } from "express";
import { roleGuard } from "../middlewares/roleGuard.middleware.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/", auth, validate(teacherRegisterSchema), roleGuard(["admin"]), registerTeacher); //only admin can register a teacher
router.get("/", auth, roleGuard(["admin"]), getAllTeachers); //get all teachers - only admin
router.get("/:username", auth, roleGuard(["admin"]), getOneTeacher); //get teacher by username - admin
router.patch("/:username", auth, roleGuard(["admin"]), validate(teacherUpdateSchema), updateTeacher); //update teacher by username - admin
router.delete("/:username", auth, roleGuard(["admin"]), softDeleteTeacher); //soft delete teacher profile by username - admin

export default router;