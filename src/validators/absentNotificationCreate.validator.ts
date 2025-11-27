import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label: string) =>
  z.string().trim().min(1, `${label} is required`).regex(objectIdRegex, `${label} must be a valid ObjectId`);

const yyyyMMdd = z
  .string()
  .trim()
  .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/i, "date must be in YYYY-MM-DD format");

export const absentNotificationCreateSchema = z
  .object({
    classId: objectId("classId"),
    sessionId: objectId("sessionId"),
    date: yyyyMMdd, // local day string; becomes dateLocal + parsed Date internally
    message: z.string().max(250).optional(),
  })
  .strict();

export type AbsentNotificationCreateInput = z.infer<typeof absentNotificationCreateSchema>;
