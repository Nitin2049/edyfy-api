import { z } from "zod";

// Helpers to avoid deprecated email()/url() methods in zod v4
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

// Mongo ObjectId (24 hex chars)
const objectIdRegex = /^[a-f\d]{24}$/i;

// Indian phone number (aligned with model)
const INDIAN_PHONE_REGEX = /^(?:\+91|0)?[6-9]\d{9}$/;

/**
 * Unified Admin registration schema
 *
 * Covers fields required to create:
 *  - User (role "admin")
 *  - AdminProfile (schoolId; userId is derived post-user creation)
 *
 * Notes:
 *  - role is forced/defaulted to "admin". Client may omit it.
 *  - dob accepts string/number and is coerced to Date.
 *  - email/url validations use refine to avoid deprecated zod signatures.
 */
export const adminRegisterSchema = z
  .object({
    // Shared / AdminProfile-related
    udisecode: z.string().trim().length(11, "Please enter valid udisecode").optional(),
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
    address: z.string().trim().max(500).optional(),

    // User login details
    username: z
      .string()
      .trim()
      .min(3, "Username must be at least 3 characters long")
      .max(20, "Username cannot exceed 20 characters")
      .regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric"),

    email: z
      .string()
      .trim()
      .refine(isEmail, { message: "Invalid email" })
      .transform((v) => v.toLowerCase()),
    phone: z
      .string()
      .trim()
      .regex(INDIAN_PHONE_REGEX, { message: "Invalid Indian phone number" }),
    password: z
      .string()
      .trim()
      .min(8, "Password must be at least 8 characters long")
      .max(20, "Password cannot exceed 20 characters"),
  })
  .strict();

export type AdminRegisterInput = z.infer<typeof adminRegisterSchema>;
