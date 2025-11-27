import { AppError } from "../utils/AppError.js";
// Ensures requests are scoped to the authenticated user's school.
// If schoolId is missing in auth context, propagate an ACCESS_DENIED error.
export function scopeSchool(req, _res, next) {
    const schoolId = req.context?.user?.schoolId;
    if (!schoolId) {
        return next(new AppError("ACCESS_DENIED", { reason: "School scope missing" }));
    }
    next();
}
