import { z } from "zod";
const INDIAN_PHONE = /^(?:\+91|0)?[6-9]\d{9}$/i;
const isUrl = (v) => {
    try {
        const u = new URL(v);
        return !!u.protocol && !!u.host;
    }
    catch {
        return false;
    }
};
export const updateUserMeSchema = z
    .object({
    firstName: z.string().min(1).max(50).optional(),
    lastName: z.string().max(50).optional(),
    phone: z.string().regex(INDIAN_PHONE, "Invalid phone").optional(),
    profileImage: z
        .string()
        .trim()
        .refine((v) => !v || isUrl(v), "Invalid URL")
        .optional(),
    address: z.string().max(500).optional(),
})
    .strict();
// Profile update schema: allow superset of teacher/student profile fields.
// Controller filters by role and ignores irrelevant fields.
export const updateMyProfileSchema = z
    .object({
    // Teacher profile fields
    address: z.string().max(500).optional(),
    qualification: z.string().max(200).optional(),
    joinDate: z.coerce.date().optional(),
    exitDate: z.coerce.date().optional(),
    status: z.enum(["active", "resigned", "transferred", "alumni"]).optional(),
    // Student profile fields
    admissionNo: z.string().min(1).max(50).optional(),
    rollNo: z.string().min(1).max(50).optional(),
    classId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid classId").optional(),
    guardianName: z.string().max(100).optional(),
    guardianNumber: z
        .string()
        .regex(/^(?:\+91|0)?[6-9]\d{9}$/i, "Invalid phone number")
        .optional(),
    dateOfAdmission: z.coerce.date().optional(),
    dateOfLeaving: z.coerce.date().optional(),
})
    .strict();
export const changeMyPasswordSchema = z
    .object({
    currentPassword: z.string().min(8).max(20),
    newPassword: z.string().min(8).max(20),
})
    .strict();
