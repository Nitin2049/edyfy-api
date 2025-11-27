import express from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { allow, allowRead } from "../middlewares/roleGuard.middleware.js";
import { validate } from "../utils/validate.js";
import { academicSessionCreateSchema } from "../validators/academicSessionCreate.validator.js";
import { academicSessionUpdateSchema } from "../validators/academicSessionUpdate.validator.js";
import { createAcademicSession, getAcademicSessions, getAcademicSessionById, updateAcademicSession, deleteAcademicSession, setCurrentAcademicSession, getCurrentAcademicSession } from "../controllers/academicSession.controllers.js";

const router = express.Router();

// GET /api/v1/sessions/current - Get current academic session (admin-only)
router.get("/current", auth, allowRead(), getCurrentAcademicSession);

// POST /api/v1/sessions/:id/set-current - Set current academic session (admin-only)
router.post("/:id/set-current", auth, allow("admin"), setCurrentAcademicSession);

// POST /api/v1/sessions - Create academic session (admin-only)
router.post("/", auth, allow("admin"), validate(academicSessionCreateSchema), createAcademicSession);

// GET /api/v1/sessions - List academic sessions (admin-only)
router.get("/", auth, allow("admin"), getAcademicSessions);

// GET /api/v1/sessions/:id - Get one academic session (admin-only)
router.get("/:id", auth, allow("admin"), getAcademicSessionById);

// PATCH /api/v1/sessions/:id - Update academic session (admin-only)
router.patch("/:id", auth, allow("admin"), validate(academicSessionUpdateSchema), updateAcademicSession);

// DELETE /api/v1/sessions/:id - Soft delete academic session (admin-only)
router.delete("/:id", auth, allow("admin"), deleteAcademicSession);


export default router;
