import { z } from "zod";

// Simple ObjectId string validator
const objectIdRegex = /^[a-f\d]{24}$/i;
const objectIdString = (label = "id") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .regex(objectIdRegex, `${label} must be a valid ObjectId`);

// Helpers consistent with project style
const isEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};
const INDIAN_PHONE_REGEX = /^(?:\+91|0)?[6-9]\d{9}$/;

export const updateStudentSchema = z
  .object({
    // User updatable fields
    firstName: z.string().trim().min(1).optional(),
    lastName: z.string().trim().min(1).optional(),
    email: z
      .string()
      .trim()
      .refine((v) => !v || isEmail(v), { message: "Invalid email" })
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(INDIAN_PHONE_REGEX, "Invalid Indian phone number")
      .optional(),
    profileImage: z
      .string()
      .trim()
      .refine((v) => !v || isUrl(v), { message: "Invalid profile image URL" })
      .optional(),
    dob: z.coerce.date().optional(),
    gender: z.enum(["male", "female", "others"]).optional(),
    address: z.string().trim().optional(),
    isActive: z.boolean().optional(),

    // StudentProfile updatable fields (classId move is NOT allowed here)
    admissionNo: z.string().trim().optional(),
    rollNo: z.coerce.number().optional(),
    guardianName: z.string().trim().optional(),
    guardianNumber: z
      .string()
      .trim()
      .regex(INDIAN_PHONE_REGEX, "Invalid Indian phone number")
      .optional(),
    dateOfAdmission: z.coerce.date().optional(),
    dateOfLeaving: z.coerce.date().nullable().optional(),
    status: z.enum(["active", "transferred", "alumni"]).optional(),
    notes: z.string().trim().max(200).optional(),
  })
  .strict();

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
