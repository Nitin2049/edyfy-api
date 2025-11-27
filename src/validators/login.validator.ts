import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(3, "Username must be at least 3 characters long")
    .max(20, "Username cannot exceed 20 characters")
    .regex(/^[a-zA-Z0-9]+$/, "Username must be alphanumeric"),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(20, "Password cannot exceed 20 characters"),
});
