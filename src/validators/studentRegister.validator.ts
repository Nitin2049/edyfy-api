import { z } from "zod";
import { roleGuard } from "../middlewares/roleGuard.middleware.js";

// Helpers to avoid deprecated email()/url() methods in zod v4
const isEmail = (value: string): boolean => {
  // Simple, broadly compatible email check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
};

// Mongo ObjectId (24 hex chars)
const objectIdRegex = /^[a-f\d]{24}$/i;

const isUrl = (value: string): boolean => {
  try {
    // WHATWG URL parse for robust URL verification
    // Will throw for invalid URL strings
    // Accept both http(s) and other valid schemes
    // If you want to restrict to http/https: add protocol check below
    // e.g., const u = new URL(value); return ["http:", "https:"].includes(u.protocol)
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

export const createStudentSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(50, "First name cannot exceed 50 characters"),
  lastName: z
    .string()
    .trim()
    .max(50, "Last name cannot exceed 50 characters")
    .optional(),
  classId: z
    .string()
    .trim()
    .regex(objectIdRegex, { message: "Invalid classId" }),
  profileImage: z
    .string()
    .refine(isUrl, { message: "Invalid image URL" })
    .or(z.undefined()),
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters long")
    .max(20, "Username cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric"),

  email: z.string().refine(isEmail, { message: "Invalid email" }),
  phone: z
    .string()
    .regex(/^(?:\+91|0)?[6-9]\d{9}$/, "Invalid Indian phone number"),
  password: z
    .string()
    .trim()
    .min(8, "Password must be at least 8 characters long")
    .max(20, "Password cannot exceed 20 characters"),
  gender: z.enum(["male", "female", "other"]).optional(),
  dob: z.coerce.date().optional(), // converts string -> Date
  address: z.string().trim().max(500).optional(),
  admissionNo: z.string().trim().max(50).optional(),
  rollNo: z.string().trim().min(1).max(50).optional(),
  guardianName: z.string().trim().max(100).optional(),
  guardianNumber: z
    .string()
    .regex(/^(?:\+91|0)?[6-9]\d{9}$/i, "Invalid phone number")
    .optional(),
  dateOfAdmission: z.coerce.date().optional(),
  dateOfLeaving: z.coerce.date().optional(),
  notes: z.string().trim().max(200).optional(),
}).strict();
