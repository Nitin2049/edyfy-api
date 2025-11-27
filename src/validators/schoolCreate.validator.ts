import { z } from "zod";

const phoneRegex = /^[0-9+\-\s()]{7,20}$/;

export const schoolCreateSchema = z
  .object({
    name: z.string().trim().min(1, "name is required"),
    slug: z.string().trim().min(1).optional(),
    udisecode: z.string().trim().length(11,  "Please enter valid udisecode"),

    address: z.string().trim().min(1, "address is required"),
    city: z.string().trim().min(1, "city is required"),
    state: z.string().trim().min(1, "state is required"),
    country: z.string().trim().min(1, "country is required"),
    pincode: z.string().trim().min(1, "pincode is required"),

    contactEmail: z.string().trim().email("contactEmail must be a valid email"),
    contactPhone: z.string().trim().regex(phoneRegex, "Invalid contact phone"),

    logoUrl: z.string().url().optional(),
    plan: z.enum(["free", "standard", "pro"]).optional(),
    subscriptionStatus: z.enum(["trial", "active", "expired"]).optional(),
  })
  .strict();

export type SchoolCreateInput = z.infer<typeof schoolCreateSchema>;
