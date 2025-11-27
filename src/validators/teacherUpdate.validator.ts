import { z } from "zod";

// Helpers consistent with project style
const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};
const INDIAN_PHONE_REGEX = /^(?:\+91|0)?[6-9]\d{9}$/;

// Unified teacher update schema (admin-triggered): all fields optional
// - User fields
// - TeacherProfile fields
export const teacherUpdateSchema = z
  .object({
    // User fields
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().optional(),
    gender: z.enum(["male", "female", "others"]).optional(),
    dob: z.coerce.date().optional(),
    profileImage: z.string().trim().refine((v) => !v || isUrl(v), { message: "Invalid profile image URL" }).optional(),
    address: z.string().trim().optional(),
    email: z.string().trim().refine((v) => !v || isEmail(v), { message: "Invalid email" }).optional(),
    phone: z.string().trim().regex(INDIAN_PHONE_REGEX, { message: "Invalid Indian phone number" }).optional(),
    // username updates are intentionally not allowed here to avoid breaking lookups

    // TeacherProfile fields
    qualification: z.string().trim().optional(),
    joinDate: z.coerce.date().optional(),
    exitDate: z.coerce.date().optional(),
    status: z.enum(["active", "resigned"]).optional(),
    classId: z.string().trim().regex(/^[a-f\d]{24}$/i, { message: "Invalid classId" }).optional(),
  })
  .strict();

export type TeacherUpdateInput = z.infer<typeof teacherUpdateSchema>;
