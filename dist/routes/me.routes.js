import { Router } from "express";
import { auth } from "../middlewares/auth.middleware.js";
import { getMe, updateMe, updateMyProfile, deleteMyProfile, changeMyPassword, } from "../controllers/me.controllers.js";
import { validate } from "../utils/validate.js";
import { updateUserMeSchema, updateMyProfileSchema, changeMyPasswordSchema, } from "../validators/me.validator.js";
import { allowRead, allow } from "../middlewares/roleGuard.middleware.js";
const router = Router();
// Self: fetch combined user + active profile
router.get("/", auth, allowRead(), getMe);
// Self: update user document (name, phone, avatar, address)
router.patch("/", auth, validate(updateUserMeSchema), allow("admin", "teacher", "student"), updateMe);
// Self: update active profile (controller filters allowed fields by role)
router.patch("/profile", auth, validate(updateMyProfileSchema), allow("admin", "teacher", "student"), updateMyProfile);
// Self: soft-delete profile (teacher/student only)
router.delete("/profile", auth, allow("admin"), deleteMyProfile);
// Normalize classId from query into params for guard compatibility on GET /
const attachClassIdFromQuery = (req, res, next) => {
    const { classId } = req.query;
    if (typeof classId === "string" && !req.params.classId) {
        req.params.classId = classId;
    }
    next();
};
// Self: change password
router.post("/change-password", auth, validate(changeMyPasswordSchema), allow("admin", "teacher", "student"), changeMyPassword);
export default router;
// test checklist
// GET /api/v1/me
// Any authenticated user; returns { user, profile } based on JWT role/profileId.
// PATCH /api/v1/me
// Any authenticated user; send any combination of: firstName, lastName, phone, profileImage, address.
// PATCH /api/v1/me/profile
// Teacher: send any of: address, qualification, joinDate, exitDate, status.
// Student: send any of: admissionNo, rollNo, classId, guardianName, guardianNumber, dateOfAdmission, dateOfLeaving, status.
// Admin: returns ACCESS_DENIED (“No updatable profile fields for admin”).
// DELETE /api/v1/me/profile
// Only student/teacher; soft deletes profile (sets deletedAt).
// POST /api/v1/me/change-password
// Any authenticated user; body with currentPassword and newPassword; invalid current password yields ACCESS_DENIED; success bumps tokenVersion.
