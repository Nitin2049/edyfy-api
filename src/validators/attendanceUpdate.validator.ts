import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label: string) =>
  z
    .string()
    .trim()
    .regex(objectIdRegex, `${label} must be a valid ObjectId`);

const yyyyMMdd = z
  .string()
  .trim()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/i, "date must be in YYYY-MM-DD format");

export const attendanceUpdateSchema = z
  .object({
    classId: objectId("classId").optional(),
    sessionId: objectId("sessionId").optional(),
    date: yyyyMMdd.optional(), // will update dateLocal + date
    isHoliday: z.boolean().optional(),
    notes: z.string().max(200).optional(),
    entries: z
      .array(
        z.object({
          studentId: objectId("studentId"),
          status: z.enum(["present", "absent"]),
        })
      )
      .optional(),
    // Single student update convenience
    studentId: objectId("studentId").optional(),
    status: z.enum(["present", "absent"]).optional(),
  })
  .refine(
    (v) => !(v.studentId && !v.status) && !(!v.studentId && v.status),
    { message: "studentId and status must be provided together", path: ["studentId"] }
  )
  .refine(
    (v) => {
      if (!v.entries) return true;
      const ids = v.entries.map((e) => e.studentId);
      return new Set(ids).size === ids.length;
    },
    { message: "entries contain duplicate studentIds", path: ["entries"] }
  )
  .refine(
    (v) => {
      if (v.isHoliday !== true) return true;
      const entriesEmpty = !v.entries || v.entries.length === 0;
      const singleAbsent = !v.studentId && !v.status;
      return entriesEmpty && singleAbsent;
    },
    { message: "holiday attendance must not include entries or single student update", path: ["isHoliday"] }
  )
  .strict();

export type AttendanceUpdateInput = z.infer<typeof attendanceUpdateSchema>;
