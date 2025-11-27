import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label: string) =>
  z.string().trim().regex(objectIdRegex, `${label} must be a valid ObjectId`);

export const enrollmentUpdateSchema = z
  .object({
    // Optionally move to another class (within the same academic session)
    classId: objectId("classId").optional(),
    // Update status
    status: z.enum(["active", "promoted", "repeater", "left"]).optional(),
    // Update notes
    notes: z.string().max(1000).optional(),
  })
  .strict();

export type EnrollmentUpdateInput = z.infer<typeof enrollmentUpdateSchema>;
