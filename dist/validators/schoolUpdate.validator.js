import { z } from "zod";
const phoneRegex = /^[0-9+\-\s()]{7,20}$/;
export const schoolUpdateSchema = z.object({
    name: z.string().trim().min(1, "name is required").optional(),
    slug: z.string().trim().min(1).optional(),
    udisecode: z.string().trim().length(11, "Please enter valid udisecode").optional(),
    address: z.string().trim().min(1, "address is required").optional(),
    city: z.string().trim().min(1, "city is required").optional(),
    state: z.string().trim().min(1, "state is required").optional(),
    country: z.string().trim().min(1, "country is required").optional(),
    pincode: z.string().trim().min(1, "pincode is required").optional(),
    contactEmail: z.string().trim().email("contactEmail must be a valid email").optional(),
    contactPhone: z.string().trim().regex(phoneRegex, "Invalid contact phone").optional(),
    logoUrl: z.string().url().optional(),
    plan: z.enum(["free", "standard", "pro"]).optional(),
    subscriptionStatus: z.enum(["trial", "active", "expired"]).optional(),
}).strict().refine(data => Object.keys(data).length > 0, { message: "At least one field must be provided" });
