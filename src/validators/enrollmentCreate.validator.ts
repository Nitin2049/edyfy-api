import { z } from "zod";

const objectIdRegex = /^[a-f\d]{24}$/i;
const objectId = (label: string) =>
  z.string().trim().min(1, `${label} is required`).regex(objectIdRegex, `${label} must be a valid ObjectId`);

export const enrollmentCreateSchema = z
  .object({
    classId: objectId("classId"),
    studentId: objectId("studentId"), // refers to StudentProfile _id
    sessionId: objectId("sessionId"), // refers to AcademicSession _id
    notes: z.string().max(200).optional(),
  })
  .strict();


  export type EnrollmentCreateInput = z.infer<typeof enrollmentCreateSchema>;
