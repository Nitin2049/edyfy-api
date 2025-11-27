import { Router } from "express";
import { validate } from "../utils/validate.js";
import { adminRegisterSchema } from "../validators/adminRegister.validator.js";
import { registerAdmin } from "../controllers/admin.controllers.js";
const router = Router();
// Endpoints available under /api/v1/admin:
router.post("/", validate(adminRegisterSchema), registerAdmin);
export default router;
