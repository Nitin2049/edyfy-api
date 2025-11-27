import { Router } from "express";
import { login, logout } from "../controllers/auth.controllers.js";
import { validate } from "../utils/validate.js";
import { loginSchema } from "../validators/login.validator.js";
import { auth } from "../middlewares/auth.middleware.js";
import { allowRead } from "../middlewares/roleGuard.middleware.js";
import { verifyToken } from "../controllers/authVerify.controller.js";

const router = Router();

router.post("/login", validate(loginSchema), login);
// router.post("/refresh", validate(refreshSchema), refresh);
router.get("/verify", verifyToken);
router.post("/logout", auth, logout);

export default router;

