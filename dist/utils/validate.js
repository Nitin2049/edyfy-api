import { AppError } from "../utils/AppError.js";
export const validate = (schema) => (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
        const flat = result.error.flatten();
        const fieldMsgs = Object.values(flat.fieldErrors || {}).flat();
        const messages = [
            ...(flat.formErrors || []),
            ...(fieldMsgs || []),
        ].filter(Boolean);
        return next(new AppError("VALIDATION_ERROR", {
            details: flat,
            messages,
        }));
    }
    // sanitized + validated body
    req.body = result.data;
    next();
};
