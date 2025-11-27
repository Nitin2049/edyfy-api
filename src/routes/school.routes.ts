import express from "express";
import { validate } from "../utils/validate.js";
import { schoolCreateSchema } from "../validators/schoolCreate.validator.js";
import { createSchool, getSchool, updateSchool } from "../controllers/school.controllers.js";
import { auth } from "../middlewares/auth.middleware.js";
import { roleGuard } from "../middlewares/roleGuard.middleware.js";
import { schoolUpdateSchema } from "../validators/schoolUpdate.validator.js";

const router = express.Router();

// Public endpoint to register a new school
router.post("/", validate(schoolCreateSchema), createSchool);

// Public endpoint to fetch a school by id
router.get("/:id", auth, getSchool);

// Admin-only update
router.patch("/:id", auth, roleGuard(["admin"]), validate(schoolUpdateSchema), updateSchool);

export default router;

