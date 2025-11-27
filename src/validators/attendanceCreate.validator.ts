import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label: string) =>
  z.string().trim().min(1, `${label} is required`).regex(objectIdRegex, `${label} must be a valid ObjectId`);

// Strict YYYY-MM-DD date string (no timezone component)
const yyyyMMdd = z
  .string()
  .trim()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/i, "date must be in YYYY-MM-DD format");

export const attendanceCreateSchema = z
  .object({
    classId: objectId("classId"),
    sessionId: objectId("sessionId"), // AcademicSession _id
    date: yyyyMMdd, // will be copied to dateLocal and parsed into Date internally
    isHoliday: z.boolean().default(false),
    notes: z.string().max(200).optional(),
    entries: z
      .array(
        z.object({
          studentId: objectId("studentId"), // StudentProfile _id
          status: z.enum(["present", "absent", "late"]),
        })
      )
      .default([]),
  })
  .refine(
    (v) => (v.isHoliday ? true : v.entries.length > 0),
    { message: "entries must be provided when not a holiday", path: ["entries"] }
  )
  .refine(
    (v) => {
      const ids = v.entries.map((e) => e.studentId);
      return new Set(ids).size === ids.length;
    },
    { message: "entries contain duplicate studentIds", path: ["entries"] }
  )
  .strict();

export type AttendanceCreateInput = z.infer<typeof attendanceCreateSchema>;
