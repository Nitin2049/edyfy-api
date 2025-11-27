import { z } from "zod";
// Helpers aligned with other validators (no deprecated zod signatures)
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isUrl = (value) => {
    try {
        new URL(value);
        return true;
    }
    catch {
        return false;
    }
};
// Mongo ObjectId (24 hex chars)
const objectIdRegex = /^[a-f\d]{24}$/i;
// Indian phone number (aligned with User model regex)
const INDIAN_PHONE_REGEX = /^(?:\+91|0)?[6-9]\d{9}$/;
/**
 * Unified Teacher registration schema
 *
 * Covers fields required to create:
 *  - User (role "teacher")
 *  - TeacherProfile (schoolId, address, qualification, join/exit/status)
 *
 * Notes:
 *  - role is forced/defaulted to "teacher" (client may omit it).
 *  - dob/joinDate/exitDate accept string/number and are coerced to Date.
 *  - email/url validations use refine to avoid deprecated zod signatures.
 */
export const teacherRegisterSchema = z
    .object({
    // User personal details
    firstName: z.string().trim().min(1, "First name is required").max(50, "First name cannot exceed 50 characters"),
    lastName: z.string().trim().max(50, "Last name cannot exceed 50 characters").optional(),
    gender: z.enum(["male", "female", "others"]),
    dob: z.coerce.date(),
    profileImage: z
        .string()
        .trim()
        .refine(isUrl, { message: "Invalid profile image URL" })
        .optional(),
    address: z.string().trim().max(200, "Address is too long"),
    // User login details
    username: z
        .string()
        .trim()
        .min(3, "Username must be at least 3 characters long")
        .max(20, "Username cannot exceed 20 characters")
        .regex(/^[a-zA-Z0-9]+$/, "Username must include alphanumeric characters only"),
    email: z
        .string()
        .trim()
        .refine(isEmail, { message: "Invalid email" })
        .transform((v) => v.toLowerCase()),
    phone: z
        .string()
        .trim()
        .regex(INDIAN_PHONE_REGEX, { message: "Invalid phone number" }),
    password: z
        .string()
        .trim()
        .min(8, "Password must be at least 8 characters long")
        .max(20, "Password is too long"),
    // TeacherProfile specific fields
    qualification: z.string().trim().max(200).optional(),
    joinDate: z.coerce.date().optional(),
    exitDate: z.coerce.date().optional(),
    classId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid classId").optional(),
})
    .strict();
