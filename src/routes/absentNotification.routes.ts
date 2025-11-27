import express, { Request, Response, NextFunction } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { validate } from "../utils/validate.js";
import { requireAdminOrClassTeacher } from "../middlewares/roleGuard.middleware.js";
import { absentNotificationCreateSchema } from "../validators/absentNotificationCreate.validator.js";
import { createAbsentNotifications, listAbsentNotifications } from "../controllers/absentNotification.controllers.js";

const router = express.Router();

// Helper: attach classId from query to params for guard compatibility on GET
const attachClassIdFromQuery = (req: Request, _res: Response, next: NextFunction) => {
	const { classId } = req.query as any;
	if (typeof classId === "string" && !(req.params as any).classId) {
		(req.params as any).classId = classId;
	}
	next();
};

// GET /api/v1/notifications/absent - List absent notifications (admin or class teacher)
router.get("/", auth, attachClassIdFromQuery, requireAdminOrClassTeacher, listAbsentNotifications);

// POST /api/v1/notifications/absent - Generate absent notifications from attendance
router.post("/", auth, validate(absentNotificationCreateSchema), requireAdminOrClassTeacher, createAbsentNotifications);

export default router;
